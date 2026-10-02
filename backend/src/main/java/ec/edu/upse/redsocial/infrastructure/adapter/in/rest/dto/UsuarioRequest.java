package ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto;

import ec.edu.upse.redsocial.domain.model.Usuario;

/**
 * DTO de entrada para crear o actualizar el perfil de un usuario.
 *
 * <p>Es la traducción del contrato HTTP al modelo de dominio, que es la función del adaptador
 * inbound. No lleva campo {@code password} a propósito, por dos razones:
 *
 * <ul>
 *   <li>Este endpoint guarda el perfil. La credencial no es parte del perfil, y aceptarla aquí
 *       abriría la puerta a que un cliente la sobrescribiera por accidente.
 *   <li>Mientras el DTO no declare el campo, el JSON que llega no puede Mapear la contraseña al
 *       dominio. Con el modelo de dominio directamente como cuerpo de la petición, el frontend
 *       mandaba un {@code Usuario} sin password y el backend lo interpretaba como "vaciar la
 *       contraseña": guardar el perfil dejaba al usuario sin poder iniciar sesión.
 * </ul>
 *
 * <p>El registro de una cuenta nueva sí necesita contraseña, y para eso está el endpoint de {@code
 * AuthResource}, cuyo DTO sí la declara.
 */
public class UsuarioRequest {

    private String id;
    private String username;
    private String email;
    private String nombre;
    private String avatarUrl;

    public UsuarioRequest() {}

    /** Convierte el DTO al modelo de dominio que espera el caso de uso. */
    public Usuario toUsuario() {
        Usuario u = new Usuario();
        u.setId(id);
        u.setUsername(username);
        u.setEmail(email);
        u.setNombre(nombre);
        u.setAvatarUrl(avatarUrl);
        // password queda sin tocar a propósito: null significa "no cambiar".
        return u;
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
