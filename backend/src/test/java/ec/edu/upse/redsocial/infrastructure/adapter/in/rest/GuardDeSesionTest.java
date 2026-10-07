package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;

import ec.edu.upse.redsocial.domain.port.out.TokenService;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * El guard que decide si una escritura necesita sesión y de quién es.
 *
 * <p>Existe por un defecto concreto: {@code POST /api/users/{userId}/avatar} escribía en el nodo de
 * quien indicara la URL, sin comprobar sesión. Con el token de Carlos bastaba con cambiar el
 * identificador de la ruta para modificar el perfil de Beatriz.
 *
 * <p>Lo que estas pruebas fijan es la diferencia entre 401 y 403, porque no es un detalle: con 401
 * el interceptor de axios del frontend limpia la sesión y devuelve al login, así que un
 * 403-equivale mal convertido cierra la sesión de un usuario que solo estaba intentando algo que no
 * le corresponde.
 */
@ExtendWith(MockitoExtension.class)
class GuardDeSesionTest {

    private static final String TOKEN_BUENO = "Bearer token-de-carlos";

    @Mock TokenService tokenService;

    @InjectMocks GuardDeSesion guard;

    @BeforeEach
    void tokenDeCarlos() {
        // `lenient` porque no todas las pruebas llegan a validar el token: las que comprueban que
        // no
        // hay cabecera ni siquiera lo intentan, y Mockito falla si un stub no se usa.
        lenient()
                .when(tokenService.validarToken("token-de-carlos"))
                .thenReturn(Optional.of("carlos-patino"));
    }

    @Test
    @DisplayName("sin cabecera Authorization no hay sesión")
    void sinCabeceraNoHaySesion() {
        assertTrue(guard.usuarioActual(null).isEmpty());
        assertTrue(guard.usuarioActual("").isEmpty());
        assertTrue(guard.usuarioActual("token-de-carlos").isEmpty(), "Sin el prefijo Bearer");
    }

    @Test
    @DisplayName("el identificador de la sesión sale del token validado")
    void devuelveElIdentificadorDeLaSesion() {
        assertEquals(Optional.of("carlos-patino"), guard.usuarioActual(TOKEN_BUENO));
    }

    @Test
    @DisplayName("sin sesión responde 401 y no toca nada")
    void sinSesionResponde401() {
        Optional<Response> respuesta = guard.sinSesion(null);

        assertTrue(respuesta.isPresent());
        assertEquals(401, respuesta.get().getStatus());
    }

    @Test
    @DisplayName("con sesión válida no hay respuesta de error")
    void conSesionValidaNoBloquea() {
        assertTrue(guard.sinSesion(TOKEN_BUENO).isEmpty());
    }

    @Test
    @DisplayName("escribir en el perfil de otra persona responde 403, no 401")
    void escribirEnPerfilAjenoResponde403() {
        // 403 y no 401 a propósito: la sesión de Carlos es válida, lo que no vale es que sea la de
        // Beatriz. Un 401 haría que el frontend cerrara la sesión de Carlos, que no tiene nada
        // wrong con esto.
        Optional<Response> respuesta = guard.siNoEsElDueño(TOKEN_BUENO, "beatriz-silva");

        assertTrue(respuesta.isPresent());
        assertEquals(403, respuesta.get().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> cuerpo = (Map<String, String>) respuesta.get().getEntity();
        assertTrue(cuerpo.get("error").contains("otra persona"), cuerpo.get("error"));
    }

    @Test
    @DisplayName("escribir en el perfil propio pasa")
    void escribirEnPerfilPropioPasa() {
        assertTrue(guard.siNoEsElDueño(TOKEN_BUENO, "carlos-patino").isEmpty());
    }

    @Test
    @DisplayName("sin sesión, escribir en cualquier perfil responde 401 antes que 403")
    void sinSesionResponde401AunqueSeaAjeno() {
        // El orden importa: primero se comprueba que hay sesión. Si se comprobara primero la
        // titularidad, alguien sin sesión recibiría 403 y el frontend no cerraría la sesión
        // caducada que realmente tiene.
        Optional<Response> respuesta = guard.siNoEsElDueño(null, "beatriz-silva");

        assertTrue(respuesta.isPresent());
        assertEquals(401, respuesta.get().getStatus());
    }

    @Test
    @DisplayName("un identificador nulo o vacío no se compara como si fuera la sesión")
    void unIdentificadorVacioNoPasa() {
        // Comparar con null por equals daría false y bloquearía, que es lo correcto, pero un
        // vacío podría colarse por una comprobación mal escrita. Se fija explícitamente para que
        // nadie lo cambie por un equals suelto.
        assertFalse(guard.siNoEsElDueño(TOKEN_BUENO, null).isEmpty());
        assertFalse(guard.siNoEsElDueño(TOKEN_BUENO, "").isEmpty());
    }

    @Test
    @DisplayName("el mensaje de 401 no distingue token ausente de caducado")
    void elMensajeNoDistinguePorQueFalloElToken() {
        // Distinguirlo convierte el endpoint en un oráculo de qué tokens existen. Es la misma razón
        // por la que el login responde el mismo texto para usuario inexistente y contraseña
        // incorrecta.
        //
        // El token "invalido" no está stubeado y por eso devuelve vacío: ese es justamente el caso
        // que se compara, uno que llega al guard sin ser válido.
        String ausente = ((Map<String, String>) errorDe(guard.sinSesion(null))).get("error");
        String caducado =
                ((Map<String, String>) errorDe(guard.sinSesion("Bearer invalido"))).get("error");

        assertEquals(ausente, caducado);
    }

    private static Object errorDe(Optional<Response> respuesta) {
        return respuesta.orElseThrow().getEntity();
    }
}
