package ec.edu.upse.redsocial.domain.model;

import java.util.List;

public class SugerenciaUsuario {
    private String id;
    private String username;
    private String nombre;
    private String avatar;
    private long conexionesEnComun;
    private List<String> seguidosEnComun;

    public SugerenciaUsuario() {}

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

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public long getConexionesEnComun() {
        return conexionesEnComun;
    }

    public void setConexionesEnComun(long conexionesEnComun) {
        this.conexionesEnComun = conexionesEnComun;
    }

    public List<String> getSeguidosEnComun() {
        return seguidosEnComun;
    }

    public void setSeguidosEnComun(List<String> seguidosEnComun) {
        this.seguidosEnComun = seguidosEnComun;
    }
}
