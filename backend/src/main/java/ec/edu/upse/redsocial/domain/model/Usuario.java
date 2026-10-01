package ec.edu.upse.redsocial.domain.model;

public class Usuario {
    private String id;
    private String username;
    private String email;
    private String nombre;
    private String avatarUrl;
    private String pushSubscriptionJson;
    private String password;

    public Usuario() {}

    public Usuario(String id, String username, String email, String nombre, String avatarUrl) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.nombre = nombre;
        this.avatarUrl = avatarUrl;
    }

    public Usuario(String id, String username, String email, String nombre, String avatarUrl, String password) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.nombre = nombre;
        this.avatarUrl = avatarUrl;
        this.password = password;
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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
