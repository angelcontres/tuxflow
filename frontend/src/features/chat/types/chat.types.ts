/**
 * Estado que el servidor adjunta al mensaje según cómo terminó el intento de entregarlo.
 *
 * <p>`PENDIENTE` no lo emite nunca el servidor: es el estado con el que el cliente dibuja un envío
 * que aún no tiene acuse. Vive en el mismo tipo porque se pinta igual que los demás y obligaría a
 * repetir el mismo condicional en cada lado si estuviera aparte.
 */
export type EstadoEntrega = 'PENDIENTE' | 'ENTREGADO' | 'NO_ENTREGADO' | 'RECHAZADO';

/** Estado visual temporal del mensaje en la burbuja, según lo que la UI dibuja mientras responde. */
export type MessageStatus = 'enviando' | 'enviado' | 'fallido';

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
  /** Estado temporal usado por los estilos que trae develop para la burbuja. */
  status?: MessageStatus;
}

/** Estado real del socket, que es lo que el indicador tiene que pintar. */
export type EstadoConexion = 'conectado' | 'conectando' | 'desconectado';

/**
 * Fila de la bandeja de conversaciones que devuelve `GET /chat/conversaciones`.
 *
 * Solo lleva el último mensaje de la pareja, no su historial: una fila de la bandeja es una línea
 * de la lista, y meterle dentro todos los mensajes convertiría esa pantalla en una descarga del buzón
 * entero. El historial se pide al abrir la conversación, que es cuando hace falta.
 *
 * `nombre` y `avatarUrl` son opcionales porque en Neo4j guardar `null` borra la propiedad: hay
 * personas sin nombre registrado y sin avatar subido, y quien abra la bandeja pone el `@username` en
 * su lugar.
 */
export interface ConversacionChat {
  /** Identificador del interlocutor: es lo que se le pasa al historial. */
  id: string;
  username: string;
  nombre?: string;
  avatarUrl?: string;
  /** Texto del último mensaje, en cualquiera de los dos sentidos. */
  ultimoMensaje: string;
  /** Marca de tiempo del servidor de ese mensaje, en milisegundos. */
  fechaUltimoMensaje: number;
}

/**
 * Fila de la lista de destino del chat, ya combinada.
 *
 * La lista no es solo la bandeja: incluye también a quien se sigue y con quien todavía no se ha
 * hablado, porque si no, escribirle por primera vez a alguien a quien sigues exigiría salir del chat a
 * buscarlo en otro sitio. `conMensajes` distingue las dos filas, y `ultimoMensaje` queda sin definir
 * cuando la conversación aún no existe.
 *
 * No extiende de `ConversacionChat` a propósito: aquí el último mensaje es opcional, y en la fila del
 * servidor es obligatorio. Forzar la herencia obligaría a inventar un texto vacío para las
 * conversaciones que aún no existen, y ese texto vacío acabaría pintado como si fuera un mensaje.
 */
export interface FilaChat {
  id: string;
  username: string;
  nombre?: string;
  avatarUrl?: string;
  /** Texto del último mensaje; solo si `conMensajes`. */
  ultimoMensaje?: string;
  /** Marca de tiempo del último mensaje, en milisegundos; solo si `conMensajes`. */
  fechaUltimoMensaje?: number;
  /** Si esa pareja ya tiene mensajes, y por tanto aparece con su último. */
  conMensajes: boolean;
}

export interface EstadoChat {
  estado: EstadoConexion;
  /**
   * Intento de reconexión en curso, contando desde 1. Es 0 mientras la conexión está sana o si nunca
   * ha hecho falta reconectar, y sirve para que el indicador muestre que la insistencia está creciendo.
   */
  intento: number;
}
