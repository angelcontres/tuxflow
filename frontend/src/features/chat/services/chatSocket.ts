import { ChatMessage, EstadoChat, EstadoConexion } from '../types/chat.types';

/**
 * Espera del primer reintento. A partir de ahí dobla en cada intento hasta el tope.
 */
const ESPERA_INICIAL_MS = 500;

/** Tope de la espera. Sin él, cada pestaña abierta martilla al servidor con un intento por segundo. */
const ESPERA_MAXIMA_MS = 8000;

interface ConexionViva {
  socket: WebSocket;
  generacion: number;
}

/**
 * Canal de chat del navegador, con reconexión y estado real.
 *
 * <p>Es un servicio y no estado del componente por dos razones que ya se notaban en el código anterior.
 * El temporizador de reintento, si viviera en el componente, se perdería en cada remontaje de React y
 * dejaría sockets huérfanos. Y el estado de la conexión es compartido: el indicador lo pinta y el
 * servicio lo produce, así que tenerlos en sitios distintos obliga a duplicarlos.
 *
 * <p>La reconexión usa espera creciente y acotada porque el websocket sobrevive a la caída del backend.
 * Sin ella, cada pestaña abierta insiste sin parar mientras el servidor no vuelve.
 */
export class ChatSocketManager {
  private conexion: ConexionViva | null = null;

  private temporizadorReintento: ReturnType<typeof setTimeout> | null = null;

  private onMensaje: ((mensaje: ChatMessage) => void) | null = null;

  private onEstado: ((estado: EstadoChat) => void) | null = null;

  private userId: string | null = null;

  /**
   * Número de intento de reconexión, en curso. Se reinicia a cero cuando la conexión se establece.
   */
  private intento = 0;

  /**
   * Generación del socket vigente.
   *
   * <p>Cada socket recuerda la generación con la que se abrió, y sus manejadores hacen nada si ya no
   * es la actual. Resuelve un caso real de React 18: en desarrollo el doble montaje de los efectos
   * conecta, desconecta y vuelve a conectar. El cierre del socket viejo llega después de que el nuevo
   * ya está abierto, y sin este contador ese cierre obsoleto se leería como una caída y provocaría un
   * reintento sobre un socket que ya está sano, dejando uno abierto de más.
   */
  private generacion = 0;

  /**
   * Abre el canal y lo mantiene abierto mientras el componente siga montado.
   *
   * @param userId identidad de quien conecta; viaja en la ruta y es la que el servidor toma como
   *   remitente de todo lo que se envíe por esta conexión
   * @param onMensaje se llama con cada frame recibido, incluidos los acuses de los envíos propios
   * @param onEstado se llama con el estado real del canal, para que el indicador no afirme una
   *   conexión que no existe
   */
  connect(
    userId: string,
    onMensaje: (mensaje: ChatMessage) => void,
    onEstado: (estado: EstadoChat) => void,
  ): void {
    this.userId = userId;
    this.onMensaje = onMensaje;
    this.onEstado = onEstado;
    this.intento = 0;
    this.cancelarReintento();
    this.abrirSocket();
  }

  private abrirSocket(): void {
    const userId = this.userId;
    if (!userId) return;

    const generacion = ++this.generacion;
    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocolo}//${window.location.host}/chat/${userId}`);
    this.conexion = { socket, generacion };

    socket.onopen = () => {
      if (!esVigente(this.conexion, generacion)) return;
      this.intento = 0;
      this.notificarEstado('conectado');
    };

    socket.onmessage = (evento) => {
      if (!esVigente(this.conexion, generacion)) return;
      try {
        const mensaje: ChatMessage = JSON.parse(evento.data as string);
        this.onMensaje?.(mensaje);
      } catch (error) {
        // Un frame ilegible no debe tumbar el canal: el mensaje se pierde, pero el chat sigue.
        console.error('No se pudo interpretar un mensaje entrante del chat:', error);
      }
    };

    socket.onerror = () => {
      // No se reintenta aquí. El cierre viene siempre después de un error, y reintentar en los dos
      // sitios abriría dos sockets por cada caída.
      if (!esVigente(this.conexion, generacion)) return;
      console.warn('Error en el canal de chat');
    };

    socket.onclose = () => {
      if (!esVigente(this.conexion, generacion)) return;
      this.conexion = null;
      this.programarReintento();
    };
  }

  /**
   * Espera creciente y luego reintenta.
   *
   * <p>Programar en vez de reintentar de inmediato es lo que evita el bucle contra un backend caído.
   */
  private programarReintento(): void {
    const userId = this.userId;
    if (!userId) return;

    this.intento += 1;
    const espera = this.esperaPara(this.intento);
    this.notificarEstado('conectando');

    this.temporizadorReintento = setTimeout(() => {
      this.temporizadorReintento = null;
      if (this.userId !== userId) return;
      this.abrirSocket();
    }, espera);
  }

  /** Primera espera la mitad del tope siguiente, y así hasta quedarse en el tope. */
  private esperaPara(intento: number): number {
    return Math.min(ESPERA_INICIAL_MS * 2 ** (intento - 1), ESPERA_MAXIMA_MS);
  }

  private notificarEstado(estado: EstadoConexion): void {
    this.onEstado?.({ estado, intento: this.intento });
  }

  /**
   * Envía un mensaje al destinatario indicado.
   *
   * <p>El cuerpo no lleva `emisorId`. Antes se mandaba vacío, lo que además de ser mentira obligaba al
   * servidor a corregirlo. Ahora no se manda: el servidor toma la identidad de la ruta de conexión, que
   * es la única que no puede elegir quien escribe.
   *
   * @return false si el canal no está listo, en cuyo caso el texto se conserva en el campo de escritura
   */
  sendMessage(destinatarioId: string, contenido: string): boolean {
    const conexion = this.conexion;
    if (!conexion || conexion.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    const cuerpo: ChatMessage = { emisorId: '', destinatarioId, contenido };
    conexion.socket.send(JSON.stringify(cuerpo));
    return true;
  }

  /** Cierra el canal y cancela cualquier reintento pendiente. */
  disconnect(): void {
    this.cancelarReintento();
    this.userId = null;
    this.onMensaje = null;
    this.onEstado = null;
    this.intento = 0;
    // Invalidar la generación antes de cerrar es lo que impide que el `onclose` de este socket, que
    // llega de forma asíncrona, programe un reintento sobre un canal ya cerrado a propósito.
    this.generacion++;
    const conexion = this.conexion;
    this.conexion = null;
    conexion?.socket.close();
  }

  private cancelarReintento(): void {
    if (this.temporizadorReintento !== null) {
      clearTimeout(this.temporizadorReintento);
      this.temporizadorReintento = null;
    }
  }
}

/** El socket sigue siendo el vigente si además su generación no quedó obsoleta. */
function esVigente(conexion: ConexionViva | null, generacion: number): boolean {
  return conexion !== null && conexion.generacion === generacion;
}

export const chatSocketManager = new ChatSocketManager();
