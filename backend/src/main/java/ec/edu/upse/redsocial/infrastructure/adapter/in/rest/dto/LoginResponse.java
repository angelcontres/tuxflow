package ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto;

import ec.edu.upse.redsocial.domain.model.Usuario;

/** Respuesta del login: token de sesión más los datos públicos del usuario. */
public class LoginResponse {

    private String token;
    private String id;
    private String username;
    private String email;
    private String nombre;
    private String avatarUrl;

    public LoginResponse() {}

    public static LoginResponse of(String token, Usuario u) {
        LoginResponse r = new LoginResponse();
        r.token = token;
        r.id = u.getId();
        r.username = u.getUsername();
        r.email = u.getEmail();
        r.nombre = u.getNombre();
        r.avatarUrl = u.getAvatarUrl();
        return r;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
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
}
