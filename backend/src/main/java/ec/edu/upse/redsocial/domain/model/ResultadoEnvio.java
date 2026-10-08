package ec.edu.upse.redsocial.domain.model;

/**
 * Resultado de intentar entregar un mensaje al destinatario, con el motivo cuando no se entrega.
 *
 * <p>Es un {@code record} y no un POJO mutable por el mismo motivo que {@link EstadoReaccion}: no
 * es una entidad del grafo, se construye en el servicio de aplicación y se lee hacia afuera. Que
 * sea inmutable importa aquí más que en las reacciones, porque su destino natural es un acuse que
 * el cliente ve: un resultado que pudiera cambiarse entre el despacho y la respuesta sería un acuse
 * que puede mentir.
 *
 * <p><b>Por qué el estado de entrega no vive en {@link MensajeChat}.</b> "No entregado" describe un
 * instante del envío, no el mensaje. Si el estado se guardara en el nodo, el grafo tendría mensajes
 * marcados como no entregados que en el historial se leerían igual que los entregados, y el cliente
 * no tendría forma de saber en qué momento se decidió el estado. Además, un mensaje reenviado más
 * tarde lleva el estado del último intento, que no es información del mensaje.
 *
 * @param mensaje el mensaje tal como quedó tras el intento, con la marca de tiempo del servidor. No
 *     es null, ni siquiera en un rechazo: el emisor necesita ver el contenido que se rechazó
 * @param estado entrega efectiva, falta de destinatario o rechazo por datos inválidos
 * @param motivo la razón en texto legible, solo presente cuando {@code estado} no es entregado
 */
public record ResultadoEnvio(MensajeChat mensaje, Estado estado, String motivo) {

    /** Los tres desenlaces posibles de un envío, sin solapamiento entre sí. */
    public enum Estado {
        /** El mensaje llegó al canal del destinatario. */
        ENTREGADO,
        /** El mensaje se conservó, pero el destinatario no tenía ninguna sesión abierta. */
        NO_ENTREGADO,
        /** El mensaje no se conservó porque los datos no eran válidos. */
        RECHAZADO
    }

    public static ResultadoEnvio entregado(MensajeChat mensaje) {
        return new ResultadoEnvio(mensaje, Estado.ENTREGADO, null);
    }

    public static ResultadoEnvio noEntregado(MensajeChat mensaje, String motivo) {
        return new ResultadoEnvio(mensaje, Estado.NO_ENTREGADO, motivo);
    }

    public static ResultadoEnvio rechazado(MensajeChat mensaje, String motivo) {
        return new ResultadoEnvio(mensaje, Estado.RECHAZADO, motivo);
    }

    /** Atajo para no repetir la comparación en el punto de uso. */
    public boolean fueEntregado() {
        return estado == Estado.ENTREGADO;
    }
}
