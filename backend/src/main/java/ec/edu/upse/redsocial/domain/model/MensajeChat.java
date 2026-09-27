package ec.edu.upse.redsocial.domain.model;

public class MensajeChat {
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
