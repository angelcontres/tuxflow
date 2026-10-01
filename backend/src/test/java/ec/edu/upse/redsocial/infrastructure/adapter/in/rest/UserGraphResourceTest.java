package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import jakarta.ws.rs.core.Response;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserGraphResourceTest {

    @Mock GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

    @InjectMocks UserGraphResource resource;

    @Test
    @DisplayName("GET /{userId}/follows responde 200 con lista vacía cuando no hay seguidos")
    void obtenerSeguidosSinSeguidosResponde200ConListaVacia() {
        when(gestionarGrafoSocialUseCase.obtenerSeguidos("u1")).thenReturn(List.of());

        Response respuesta = resource.obtenerSeguidos("u1");

        assertEquals(200, respuesta.getStatus());
        assertEquals(List.of(), respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /{userId}/follows responde 200 con la lista de seguidos del caso de uso")
    void obtenerSeguidosConSeguidosResponde200ConLaLista() {
        List<Usuario> seguidos =
                List.of(
                        new Usuario("u2", "ana_upse", "ana@upse.edu.ec", "Ana", null),
                        new Usuario(
                                "u3",
                                "leo_upse",
                                "leo@upse.edu.ec",
                                "Leo",
                                "https://minio.upse.edu.ec/leo.png"));
        when(gestionarGrafoSocialUseCase.obtenerSeguidos("u1")).thenReturn(seguidos);

        Response respuesta = resource.obtenerSeguidos("u1");

        assertEquals(200, respuesta.getStatus());
        assertEquals(seguidos, respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /comunes responde 200 con la intersección que devuelve el caso de uso")
    void obtenerSeguidoresEnComunResponde200ConLaInterseccion() {
        List<Usuario> comunes =
                List.of(
                        new Usuario("beatriz-silva", "beatriz", null, "Beatriz Silva", null),
                        new Usuario("paulo-orrala", "paulo", null, "Paulo Orrala", null));
        when(gestionarGrafoSocialUseCase.obtenerSeguidoresEnComun("carlos-patino", "angel-villon"))
                .thenReturn(comunes);

        Response respuesta = resource.obtenerSeguidoresEnComun("carlos-patino", "angel-villon");

        assertEquals(200, respuesta.getStatus());
        assertEquals(comunes, respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /comunes sin userA responde 400 en vez de una lista vacía indistinguible")
    void obtenerSeguidoresEnComunSinUserAResponde400() {
        Response respuesta = resource.obtenerSeguidoresEnComun(null, "angel-villon");

        assertEquals(400, respuesta.getStatus());
        assertFalse(respuesta.getEntity() instanceof List<?>);
    }

    @Test
    @DisplayName("GET /comunes sin userB responde 400")
    void obtenerSeguidoresEnComunSinUserBResponde400() {
        Response respuesta = resource.obtenerSeguidoresEnComun("carlos-patino", null);

        assertEquals(400, respuesta.getStatus());
    }

    @Test
    @DisplayName("GET /comunes con un identificador de solo espacios responde 400")
    void obtenerSeguidoresEnComunConIdentificadorEnBlancoResponde400() {
        Response respuesta = resource.obtenerSeguidoresEnComun("   ", "angel-villon");

        assertEquals(400, respuesta.getStatus());
    }

    @Test
    @DisplayName(
            "GET /comunes con userA igual a userB responde 400 y no devuelve la lista de seguidos")
    void obtenerSeguidoresEnComunConsigoMismoResponde400() {
        Response respuesta = resource.obtenerSeguidoresEnComun("carlos-patino", "carlos-patino");

        assertEquals(400, respuesta.getStatus());
        assertFalse(respuesta.getEntity() instanceof List<?>);
    }

    @Test
    @DisplayName("GET /comunes no consulta el grafo cuando la consulta es inválida")
    void obtenerSeguidoresEnComunInvalidaNoConsultaElGrafo() {
        resource.obtenerSeguidoresEnComun("carlos-patino", "  ");
        resource.obtenerSeguidoresEnComun("angel-villon", "angel-villon");

        verifyNoInteractions(gestionarGrafoSocialUseCase);
    }

    @Test
    @DisplayName("POST /avatar sin archivo responde 400 con mensaje para el usuario")
    void subirAvatarSinArchivoResponde400() {
        Response respuesta = resource.subirAvatarSinUsuario(null);

        assertEquals(400, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("No se proporcionó ningún archivo de imagen.", entity.get("error"));
    }

    @Test
    @DisplayName(
            "POST /{userId}/avatar propaga el fallo del almacenamiento como 500 con mensaje, no una excepcion")
    void subirAvatarConErrorDeAlmacenamientoResponde500() throws Exception {
        when(gestionarGrafoSocialUseCase.subirAvatar(any(), any(), anyLong(), any(), any()))
                .thenThrow(
                        new IllegalStateException(
                                "El bucket de almacenamiento 'redsocial-media' no existe en"
                                        + " http://localhost:9000. Crearlo con: mc mb"));

        FileUpload file = mock(FileUpload.class);
        Path temp = Files.createTempFile("avatar-test", ".png");
        Files.write(temp, new byte[] {1, 2, 3});
        when(file.uploadedFile()).thenReturn(temp);
        when(file.fileName()).thenReturn("avatar.png");
        when(file.contentType()).thenReturn("image/png");
        when(file.size()).thenReturn(3L);

        Response respuesta = resource.subirAvatarUsuario("u1", file);

        assertEquals(500, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        // El detalle va al log; al usuario solo le llega algo accionable.
        assertEquals("No pudimos guardar la imagen. Inténtalo de nuevo.", entity.get("error"));
        assertTrue(
                entity.get("error").toLowerCase().contains("intentalo")
                        || entity.get("error").toLowerCase().contains("inténtalo"));
    }
}
