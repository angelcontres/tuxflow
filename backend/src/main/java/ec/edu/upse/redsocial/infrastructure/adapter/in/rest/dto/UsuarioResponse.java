package ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto;

import ec.edu.upse.redsocial.domain.model.Usuario;

/** DTO de salida: nunca expone el password del usuario. */
public class UsuarioResponse {

    private String id;
    private String username;
    private String email;
    private String nombre;
    private String avatarUrl;
    private String pushSubscriptionJson;

    public UsuarioResponse() {}

    public static UsuarioResponse from(Usuario u) {
        UsuarioResponse dto = new UsuarioResponse();
        dto.id = u.getId();
        dto.username = u.getUsername();
        dto.email = u.getEmail();
        dto.nombre = u.getNombre();
        dto.avatarUrl = u.getAvatarUrl();
        dto.pushSubscriptionJson = u.getPushSubscriptionJson();
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
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

    public String getPushSubscriptionJson() {
        return pushSubscriptionJson;
    }

    public void setPushSubscriptionJson(String pushSubscriptionJson) {
        this.pushSubscriptionJson = pushSubscriptionJson;
    }
}
