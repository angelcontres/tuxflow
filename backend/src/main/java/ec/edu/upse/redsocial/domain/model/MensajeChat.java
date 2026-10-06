package ec.edu.upse.redsocial.domain.model;

/**
 * Mensaje de la conversación 1 a 1, con lo que se conserva en el grafo.
 *
 * <p>Es un POJO y no un {@code record} porque lo deserializa Jackson desde el frame del WebSocket,
 * que llega sin constructor y con todos los campos opcionales. Por eso conserva los setters.
 *
 * <p>No lleva estado de entrega: ese dato pertenece al intento de envío, no al mensaje. Ver {@link
 * ResultadoEnvio} para el motivo.
 */
public class MensajeChat {
    private String id;
    private String emisorId;
    private String destinatarioId;
    private String contenido;
    private long timestamp;

    public MensajeChat() {
        this.timestamp = System.currentTimeMillis();
    }

    public MensajeChat(String emisorId, String destinatarioId, String contenido) {
        this.emisorId = emisorId;
        this.destinatarioId = destinatarioId;
        this.contenido = contenido;
        this.timestamp = System.currentTimeMillis();
    }

    /**
     * Mensaje listo para conservarse, con la marca de tiempo del servidor ya fijada.
     *
     * <p>El cuarto parámetro existe porque el identificador lo genera el servicio de aplicación,
     * igual que hace con el id de una publicación, y no dentro del mensaje por defecto.
     *
     * @param id identificador asignado por el servidor
     */
    public MensajeChat(String id, String emisorId, String destinatarioId, String contenido) {
        this.id = id;
        this.emisorId = emisorId;
        this.destinatarioId = destinatarioId;
        this.contenido = contenido;
        this.timestamp = System.currentTimeMillis();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEmisorId() {
        return emisorId;
    }

    public void setEmisorId(String emisorId) {
        this.emisorId = emisorId;
    }

    public String getDestinatarioId() {
        return destinatarioId;
    }

    public void setDestinatarioId(String destinatarioId) {
        this.destinatarioId = destinatarioId;
    }

    public String getContenido() {
        return contenido;
    }

    public void setContenido(String contenido) {
        this.contenido = contenido;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
