package ec.edu.upse.redsocial.domain.model;

/**
 * Una conversación 1 a 1 resumida a lo que la lista de la bandeja necesita: con quién, cuál fue el
 * último mensaje y cuándo.
 *
 * <p>No es un mensaje ni guarda el historial. La razón es práctica: una bandeja son decenas de
 * parejas, y llevar dentro de cada una todos sus mensajes convertiría esa pantalla en una descarga
 * del buzón entero para dibujar cuarenta líneas de texto. El historial se pide aparte, cuando se abre
 * la conversación, que es cuando hace falta.
 *
 * <p>El interlocutor viene desglosado y no como un {@link Usuario}: la consulta que arma la bandeja
 * necesita el identificador para pedir el historial, y el nombre y el avatar para pintar la fila sin
 * tener que inventarse un segundo campo de búsqueda. Se desglosa además porque el nombre real puede
 * faltar en el grafo, y aquí eso es un hueco legítimo que el cliente rellena con el {@code
 * @username}.
 *
 * <p>Es un POJO con setters por el mismo motivo que {@link MensajeChat}: lo arma el adaptador al
 * leer las filas del driver.
 */
public class ConversacionChat {

    private String interlocutorId;
    private String interlocutorUsername;
    private String interlocutorNombre;
    private String interlocutorAvatarUrl;

    /** Texto del último mensaje de la pareja, en cualquiera de los dos sentidos. */
    private String ultimoMensaje;

    /**
     * Marca de tiempo del servidor de ese último mensaje, en milisegundos.
     *
     * <p>Es la que ordena la bandeja. No se sustituye por la de última actividad con nadie: si dos
     * conversaciones alternaran sus mensajes, "con quién hablaste más veces" daría una lista
     * distinta de "con quién hablaste por última vez", y la segunda es la que espera quien abre el
     * chat.
     */
    private long fechaUltimoMensaje;

    public ConversacionChat() {}

    public String getInterlocutorId() {
        return interlocutorId;
    }

    public void setInterlocutorId(String interlocutorId) {
        this.interlocutorId = interlocutorId;
    }

    public String getInterlocutorUsername() {
        return interlocutorUsername;
    }

    public void setInterlocutorUsername(String interlocutorUsername) {
        this.interlocutorUsername = interlocutorUsername;
    }

    public String getInterlocutorNombre() {
        return interlocutorNombre;
    }

    public void setInterlocutorNombre(String interlocutorNombre) {
        this.interlocutorNombre = interlocutorNombre;
    }

    public String getInterlocutorAvatarUrl() {
        return interlocutorAvatarUrl;
    }

    public void setInterlocutorAvatarUrl(String interlocutorAvatarUrl) {
        this.interlocutorAvatarUrl = interlocutorAvatarUrl;
    }

    public String getUltimoMensaje() {
        return ultimoMensaje;
    }

    public void setUltimoMensaje(String ultimoMensaje) {
        this.ultimoMensaje = ultimoMensaje;
    }

    public long getFechaUltimoMensaje() {
        return fechaUltimoMensaje;
    }

    public void setFechaUltimoMensaje(long fechaUltimoMensaje) {
        this.fechaUltimoMensaje = fechaUltimoMensaje;
    }
}
