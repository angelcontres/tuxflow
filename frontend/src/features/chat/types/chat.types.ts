/**
 * Estado que el servidor adjunta al mensaje según cómo terminó el intento de entregarlo.
 *
 * <p>`PENDIENTE` no lo emite nunca el servidor: es el estado con el que el cliente dibuja un envío
 * que aún no tiene acuse. Vive en el mismo tipo porque se pinta igual que los demás y obligaría a
 * repetir el mismo condicional en cada lado si estuviera aparte.
 */
export type EstadoEntrega = 'PENDIENTE' | 'ENTREGADO' | 'NO_ENTREGADO' | 'RECHAZADO';

export interface ChatMessage {
  /**
   * Identificador que asigna el servidor al persistir el mensaje.
   *
   * Es lo que permite reconciliar la burbuja que el emisor ve de forma optimista con el acuse que
   * vuelve después. Antes de recibirlo la burbuja no lo tiene, y por eso es opcional.
   */
  id?: string;
  emisorId: string;
  destinatarioId: string;
  contenido: string;
  /** Marca de tiempo del servidor, en milisegundos. La fija el servidor, no el navegador. */
  timestamp?: number;
  /**
   * Cómo terminó el envío. Solo lo recibe quien envía: el destinatario ya tiene el mensaje entregado
   * en su propia bandeja, así que no necesita un acuse.
   *
   * Su presencia es lo que distingue un acuse de un mensaje nuevo, así que el servidor no puede
   * adjuntarlo al frame que entrega el mensaje: el cliente leería la entrega como un acuse, no
   * hallaría la burbuja a la que corresponde y descartaría el mensaje. En el frame de entrega esta
   * clave no debe existir, ni siquiera con valor nulo.
   */
  estado?: EstadoEntrega;
  /** Explicación legible cuando `estado` no es `ENTREGADO`. */
  motivo?: string;
}

/** Estado real del socket, que es lo que el indicador tiene que pintar. */
export type EstadoConexion = 'conectado' | 'conectando' | 'desconectado';

export interface EstadoChat {
  estado: EstadoConexion;
  /**
   * Intento de reconexión en curso, contando desde 1. Es 0 mientras la conexión está sana o si nunca
   * ha hecho falta reconectar, y sirve para que el indicador muestre que la insistencia está creciendo.
   */
  intento: number;
}
