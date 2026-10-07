package ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto;

import ec.edu.upse.redsocial.domain.model.ConversacionChat;

/**
 * Fila de la bandeja de conversaciones de {@code GET /api/chat/conversaciones}.
 *
 * <p>Existe por la misma razón que {@link UsuarioPublicoResponse}: la pantalla es una lista de
 * personas y una lista de personas es lo que alguien copia. Al fijar aquí el contrato se documenta
 * en el sitio donde se consume, y un campo nuevo del dominio no aparece en la API sin que alguien
 * lo decida.
 *
 * <p>Los nombres del interlocutor van con prefijo en el dominio ({@code interlocutorId}, {@code
 * interlocutorNombre}) y aquí se les quita. La fila de la bandeja es siempre "esta persona", así
 * que repetirlo en cada propiedad no dice nada que el contenedor no diga ya, y obligaría al cliente
 * a escribir {@code conversacion.interlocutor.interlocutorNombre} o a inventar un atajo.
 *
 * <p>El nombre y el avatar pueden venir nulos porque en Neo4j guardar null borra la propiedad: hay
 * personas sin nombre registrado y sin avatar subido. Se viajan como están para que el cliente
 * decida el respaldo, que aquí es el {@code @username}, y no para que esta capa invente un texto.
 */
public class ConversacionChatResponse {

    private String id;
    private String username;
    private String nombre;
    private String avatarUrl;
    private String ultimoMensaje;
    private long timestampUltimo;

    public ConversacionChatResponse() {}

    public static ConversacionChatResponse from(ConversacionChat conversacion) {
        ConversacionChatResponse dto = new ConversacionChatResponse();
        dto.id = conversacion.getInterlocutorId();
        dto.username = conversacion.getInterlocutorUsername();
        dto.nombre = conversacion.getInterlocutorNombre();
        dto.avatarUrl = conversacion.getInterlocutorAvatarUrl();
        dto.ultimoMensaje = conversacion.getUltimoMensaje();
        dto.timestampUltimo = conversacion.getFechaUltimoMensaje();
        return dto;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getUltimoMensaje() {
        return ultimoMensaje;
    }

    public void setUltimoMensaje(String ultimoMensaje) {
        this.ultimoMensaje = ultimoMensaje;
    }

    public long getFechaUltimoMensaje() {
        return timestampUltimo;
    }

    public void setFechaUltimoMensaje(long timestampUltimo) {
        this.timestampUltimo = timestampUltimo;
    }
}
