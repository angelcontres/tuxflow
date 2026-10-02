package ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import ec.edu.upse.redsocial.domain.model.Usuario;
import java.lang.reflect.Field;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Cubre el contrato de {@link UsuarioRequest}, el DTO de entrada de crear/actualizar el perfil.
 *
 * <p>Lo relevante es que el DTO no declare campo {@code password}: mientras no lo declare, el JSON
 * entrante no puede mapear una credencial al dominio. Ese era el origen del defecto por el que
 * guardar el perfil vaciaba la contraseña.
 */
class UsuarioRequestTest {

    private static UsuarioRequest requestCompleto() {
        UsuarioRequest r = new UsuarioRequest();
        r.setId("carlos-patino");
        r.setUsername("carlos");
        r.setEmail("carlos@upse.edu.ec");
        r.setNombre("Carlos Patino");
        r.setAvatarUrl("http://localhost:9000/redsocial-media/media-x.png");
        return r;
    }

    @Test
    @DisplayName("el DTO de entrada NO declara campo password")
    void noDeclaraCampoPassword() {
        // Si alguien agrega el campo al DTO, la protección se pierde y el perfil puede volver a
        // pisar la credencial. Se falla aquí para que no ocurra en silencio.
        for (Field campo : UsuarioRequest.class.getDeclaredFields()) {
            assertFalse(
                    "password".equals(campo.getName()),
                    "UsuarioRequest no debe declarar password: el perfil no guarda credenciales");
        }
    }

    @Test
    @DisplayName("el DTO de salida NO declara campo password")
    void elDtoDeSalidaTampocoLoDeclara() {
        for (Field campo : UsuarioResponse.class.getDeclaredFields()) {
            assertFalse(
                    "password".equals(campo.getName()),
                    "UsuarioResponse no debe declarar password");
        }
    }

    @Test
    @DisplayName("convierte el DTO al modelo de dominio con todos los campos del perfil")
    void convierteAlModeloDeDominio() {
        Usuario u = requestCompleto().toUsuario();

        assertEquals("carlos-patino", u.getId());
        assertEquals("carlos", u.getUsername());
        assertEquals("carlos@upse.edu.ec", u.getEmail());
        assertEquals("Carlos Patino", u.getNombre());
        assertEquals("http://localhost:9000/redsocial-media/media-x.png", u.getAvatarUrl());
    }

    @Test
    @DisplayName("el Usuario del dominio sale con password null, que significa 'no cambiar'")
    void laPasswordDelDominioQuedaEnNull() {
        // Esta es la pieza que conecta con el arreglo del adaptador: null es la señal de "no
        // tocar la contraseña", y el Cypher sólo la escribe cuando llega con valor.
        Usuario u = requestCompleto().toUsuario();

        assertNull(u.getPassword(), "La contraseña debe llegar al dominio como null");
    }

    @Test
    @DisplayName("un DTO con campos vacíos no rompe la conversión")
    void dtoConCamposVaciosNoRomppe() {
        UsuarioRequest vacio = new UsuarioRequest();
        vacio.setId("u1");

        Usuario u = vacio.toUsuario();

        assertEquals("u1", u.getId());
        assertNull(u.getUsername());
        assertNull(u.getNombre());
        assertNull(u.getPassword());
    }
}
