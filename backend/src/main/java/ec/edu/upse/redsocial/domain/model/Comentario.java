package ec.edu.upse.redsocial.domain.model;

/**
 * Comentario de una publicación.
 *
 * <p>Es un POJO y no un record, igual que {@link Post}: el adaptador de Neo4j lo rellena campo a
 * campo desde el {@code Record} del driver, y con un record mutable por constructor posicional cada
 * cambio de proyección obligaría a tocar todas las llamadas.
 *
 * <p>{@code parentId} es {@code null} cuando el comentario es de primer nivel y el id del
 * comentario padre cuando es una respuesta. Se guarda como propiedad del nodo porque también viaja
 * al cliente en el JSON: el modal agrupa las respuestas con él y no hay que reconstruirlo con un
 * MATCH extra.
 */
public class Comentario {
    private String id;
    private String texto;
    private Long fechaCreacion;
    private String parentId;
    private String autorId;
    private String autorUsername;
    private String autorAvatar;
    private long totalLikes;
    private boolean likedByMe;

    public Comentario() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTexto() {
        return texto;
    }

    public void setTexto(String texto) {
        this.texto = texto;
    }

    public Long getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(Long fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getAutorId() {
        return autorId;
    }

    public void setAutorId(String autorId) {
        this.autorId = autorId;
    }

    public String getAutorUsername() {
        return autorUsername;
    }

    public void setAutorUsername(String autorUsername) {
        this.autorUsername = autorUsername;
    }

    public String getAutorAvatar() {
        return autorAvatar;
    }

    public void setAutorAvatar(String autorAvatar) {
        this.autorAvatar = autorAvatar;
    }

    public long getTotalLikes() {
        return totalLikes;
    }

    public void setTotalLikes(long totalLikes) {
        this.totalLikes = totalLikes;
    }

    public boolean isLikedByMe() {
        return likedByMe;
    }

    public void setLikedByMe(boolean likedByMe) {
        this.likedByMe = likedByMe;
    }
}
