package ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto;

import ec.edu.upse.redsocial.domain.model.Usuario;

/**
 * DTO de salida para las listas de personas: seguidores, seguidos y conexiones en común.
 *
 * <p>Es más estrecho que {@link UsuarioResponse} a propósito. {@code UsuarioResponse} existe para
 * el perfil propio, que se pide autenticado, y por eso lleva el correo y la suscripción push. Estas
 * listas son la lectura de las relaciones de otra persona y no necesitan nada de eso: son dos
 * propiedades menos que exponer, y dos menos que se pueden leer por accidente.
 *
 * <p>El motivo de fondo es que {@link Usuario} es el modelo de dominio y arrastra {@code password}
 * y {@code pushSubscriptionJson}. Antes de esta clase, {@code /follows} y {@code /comunes}
 * devolvían el {@code Usuario} crudo. No había fuga porque esas consultas nunca llenan esas dos
 * propiedades, así que salían en {@code null}: el riesgo era el patrón, no el dato. El perfil ajeno
 * hace el patrón visible porque ahora una lista de seguidores es una pantalla, y una pantalla es lo
 * que alguien copia.
 */
public class UsuarioPublicoResponse {

    private String id;
    private String username;
    private String nombre;
    private String avatarUrl;

    public UsuarioPublicoResponse() {}

    public static UsuarioPublicoResponse from(Usuario u) {
        UsuarioPublicoResponse dto = new UsuarioPublicoResponse();
        dto.id = u.getId();
        dto.username = u.getUsername();
        dto.nombre = u.getNombre();
        dto.avatarUrl = u.getAvatarUrl();
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
}
