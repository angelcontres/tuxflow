import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSocketManager } from '../services/chatSocket';
import { ChatMessage, EstadoChat } from '../types/chat.types';

/**
 * WebSocket falso que se puede abrir, cerrar y hacer fallar a voluntad.
 *
 * <p>Se simula a mano en vez de usar un doble de biblioteca porque lo que se necesita es disparar
 * `onclose` y `onopen` en el orden que se quiera, y eso no lo da ningún doble estándar.
 */
class WebSocketFalso {
  static instancias: WebSocketFalso[] = [];

  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = WebSocketFalso.CLOSED;
  enviados: string[] = [];
  cerradoPorCodigo = false;

  onopen: (() => void) | null = null;
  onmessage: ((evento: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    WebSocketFalso.instancias.push(this);
  }

  abrir(): void {
    this.readyState = WebSocketFalso.OPEN;
    this.onopen?.();
  }

  /** Simula una caída del servidor: el navegador emite onclose. */
  caer(): void {
    this.readyState = WebSocketFalso.CLOSED;
    this.onclose?.();
  }

  recibir(mensaje: ChatMessage): void {
    this.onmessage?.({ data: JSON.stringify(mensaje) });
  }

  recibirTexto(data: string): void {
    this.onmessage?.({ data });
  }

  send(texto: string): void {
    this.enviados.push(texto);
  }

  close(): void {
    this.cerradoPorCodigo = true;
    this.readyState = WebSocketFalso.CLOSED;
  }
}

const instalarWebSocketFalso = (): void => {
  WebSocketFalso.instancias = [];
  vi.stubGlobal('WebSocket', WebSocketFalso);
};

const ultimo = (): WebSocketFalso =>
  WebSocketFalso.instancias[WebSocketFalso.instancias.length - 1];

describe('ChatSocketManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    instalarWebSocketFalso();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('conexión', () => {
    it('abre el canal en la ruta que lleva la identidad de quien conecta', () => {
      new ChatSocketManager().connect(
        'carlos',
        () => undefined,
        () => undefined,
      );

      expect(ultimo().url).toBe('ws://localhost:3000/chat/carlos');
    });

    it('usa wss cuando la página viene por https', () => {
      vi.stubGlobal('location', { protocol: 'https:', host: 'red.example' });

      new ChatSocketManager().connect(
        'carlos',
        () => undefined,
        () => undefined,
      );

      expect(ultimo().url).toBe('wss://red.example/chat/carlos');
    });

    it('avisa de que está conectado al abrirse', () => {
      const estados: EstadoChat[] = [];
      new ChatSocketManager().connect(
        'carlos',
        () => undefined,
        (e) => estados.push(e),
      );

      ultimo().abrir();

      expect(estados[estados.length - 1]?.estado).toBe('conectado');
      expect(estados[estados.length - 1]?.intento).toBe(0);
    });

    it('entrega los mensajes que llegan por el canal', () => {
      const recibidos: ChatMessage[] = [];
      new ChatSocketManager().connect(
        'carlos',
        (m) => recibidos.push(m),
        () => undefined,
      );
      ultimo().abrir();

      ultimo().recibir({ emisorId: 'paulo', destinatarioId: 'carlos', contenido: 'hola' });

      expect(recibidos).toHaveLength(1);
      expect(recibidos[0].contenido).toBe('hola');
    });

    it('un frame ilegible no tumba el canal: se pierde ese mensaje y sigue abierto', () => {
      const recibidos: ChatMessage[] = [];
      new ChatSocketManager().connect(
        'carlos',
        (m) => recibidos.push(m),
        () => undefined,
      );
      ultimo().abrir();

      ultimo().recibirTexto('esto no es json');
      ultimo().recibir({ emisorId: 'paulo', destinatarioId: 'carlos', contenido: 'siguiente' });

      expect(recibidos).toHaveLength(1);
      expect(recibidos[0].contenido).toBe('siguiente');
    });
  });

  describe('envío', () => {
    it('no manda el emisor en el cuerpo: la identidad la toma el servidor de la ruta', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();

      manager.sendMessage('paulo', 'hola');

      const cuerpo = JSON.parse(ultimo().enviados[0]) as ChatMessage;
      expect(cuerpo.destinatarioId).toBe('paulo');
      expect(cuerpo.contenido).toBe('hola');
      expect(cuerpo.emisorId).toBe('');
    });

    it('devuelve false si el canal no está listo, para que el texto no se pierda', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();
      ultimo().readyState = WebSocketFalso.CLOSED;

      expect(manager.sendMessage('paulo', 'hola')).toBe(false);
      expect(ultimo().enviados).toHaveLength(0);
    });
  });

  describe('reconexión', () => {
    it('vuelve a abrir el canal cuando el servidor se cae', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();

      ultimo().caer();
      vi.advanceTimersByTime(600);

      expect(WebSocketFalso.instancias).toHaveLength(2);
      expect(ultimo().url).toBe('ws://localhost:3000/chat/carlos');
    });

    it('duplica la espera a cada intento, para no martillear al servidor caído', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();
      ultimo().caer();

      // El primer reintento espera 500 ms; si arrives antes, no debe reabrir todavía.
      vi.advanceTimersByTime(400);
      expect(WebSocketFalso.instancias).toHaveLength(1);

      vi.advanceTimersByTime(200);
      expect(WebSocketFalso.instancias).toHaveLength(2);
      ultimo().caer();

      // El segundo ya dobla: 1000 ms.
      vi.advanceTimersByTime(900);
      expect(WebSocketFalso.instancias).toHaveLength(2);
      vi.advanceTimersByTime(200);
      expect(WebSocketFalso.instancias).toHaveLength(3);
    });

    it('acota la espera para no dejar de reintentar nunca', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();

      // Suficientes caídas para pasar de 500 ms a 8000 ms, que es el tope.
      for (let i = 0; i < 8; i += 1) {
        ultimo().caer();
        vi.advanceTimersByTime(9000);
      }

      const cantidadTrasVariasCaidas = WebSocketFalso.instancias.length;
      ultimo().caer();
      vi.advanceTimersByTime(2000);
      expect(WebSocketFalso.instancias).toHaveLength(cantidadTrasVariasCaidas);
    });

    it('el estado pasa por conectando durante el reintento, para que el indicador no afirme estar en línea', () => {
      const estados: EstadoChat['estado'][] = [];
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        (e) => estados.push(e.estado),
      );
      ultimo().abrir();

      ultimo().caer();

      expect(estados).toContain('conectando');
      expect(estados[estados.length - 1]).toBe('conectando');
    });

    it('cuenta los intentos y los reinicia al recuperarse', () => {
      const estados: EstadoChat[] = [];
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        (e) => estados.push(e),
      );
      ultimo().abrir();

      ultimo().caer();
      vi.advanceTimersByTime(600);
      ultimo().caer();
      vi.advanceTimersByTime(1100);

      const reconectando = estados.filter((e) => e.estado === 'conectando');
      expect(reconectando[reconectando.length - 1]?.intento).toBe(2);

      ultimo().abrir();
      expect(estados[estados.length - 1]).toEqual({ estado: 'conectado', intento: 0 });
    });

    it('reconecta solo: no hace falta que el usuario vuelva a escribir para que vuelva el canal', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();
      ultimo().caer();

      vi.advanceTimersByTime(600);
      ultimo().abrir();

      expect(manager.sendMessage('paulo', 'hola')).toBe(true);
    });
  });

  describe('cierre', () => {
    it('desconectar cancela el reintento pendiente: si no, el socket reviviría solo', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();
      ultimo().caer();

      manager.disconnect();
      vi.advanceTimersByTime(20000);

      expect(WebSocketFalso.instancias).toHaveLength(1);
    });

    it('desconectar cierra el socket abierto', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();

      manager.disconnect();

      expect(ultimo().cerradoPorCodigo).toBe(true);
    });

    it('el cierre deliberado no dispara reintentos aunque llegue el onclose', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();

      manager.disconnect();
      // El onclose llega después del close(), de forma asíncrona.
      ultimo().onclose?.();
      vi.advanceTimersByTime(20000);

      expect(WebSocketFalso.instancias).toHaveLength(1);
    });

    it('el socket viejo que se cierra no provoca un reintento sobre el canal nuevo', () => {
      // Es el caso del doble montaje de los efectos en desarrollo: conectar, desconectar y volver a
      // conectar. El cierre del socket viejo es asíncrono y llega cuando el nuevo ya está abierto.
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      const socketViejo = ultimo();
      socketViejo.abrir();

      manager.disconnect();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      const socketNuevo = ultimo();
      socketNuevo.abrir();

      socketViejo.onclose?.();
      vi.advanceTimersByTime(20000);

      expect(WebSocketFalso.instancias).toHaveLength(2);
      expect(manager.sendMessage('paulo', 'hola')).toBe(true);
      expect(socketNuevo.enviados).toHaveLength(1);
    });

    it('tras desconectar, enviar devuelve false', () => {
      const manager = new ChatSocketManager();
      manager.connect(
        'carlos',
        () => undefined,
        () => undefined,
      );
      ultimo().abrir();

      manager.disconnect();

      expect(manager.sendMessage('paulo', 'hola')).toBe(false);
    });
  });
});
