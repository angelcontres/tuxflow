package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioPublicoResponse;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioRequest;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioResponse;
import jakarta.ws.rs.core.Response;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserGraphResourceTest {

    @Mock GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

    @InjectMocks UserGraphResource resource;

    @Test
    @DisplayName("POST / responde 201 con el UsuarioResponse, sin el password del dominio")
    void registrarUsuarioRespondeConElDtoDeSalida() {
        // El endpoint used to devolver el Usuario de dominio crudo, y eso arrastraba al contrato
        // publico un campo "password": null que es de persistencia y no de API. La forma de la
        // respuesta es lo que se verifica aqui.
        UsuarioRequest request = new UsuarioRequest();
        request.setId("carlos-patino");
        request.setUsername("carlos");
        request.setEmail("carlos@upse.edu.ec");
        request.setNombre("Carlos Patino");
        request.setAvatarUrl("http://localhost:9000/redsocial-media/media-x.png");

        Response respuesta = resource.registrarUsuario(request);

        assertEquals(201, respuesta.getStatus());
        assertEquals(UsuarioResponse.class, respuesta.getEntity().getClass());
        UsuarioResponse cuerpo = (UsuarioResponse) respuesta.getEntity();
        assertEquals("carlos-patino", cuerpo.getId());
        assertEquals("carlos", cuerpo.getUsername());
        assertEquals("Carlos Patino", cuerpo.getNombre());
    }

    @Test
    @DisplayName("POST / delega en el caso de uso un Usuario con password null")
    void registrarUsuarioDelegaConPasswordNull() {
        UsuarioRequest request = new UsuarioRequest();
        request.setId("carlos-patino");
        request.setUsername("carlos");

        resource.registrarUsuario(request);

        ArgumentCaptor<Usuario> enviado = ArgumentCaptor.forClass(Usuario.class);
        verify(gestionarGrafoSocialUseCase).registrarUsuario(enviado.capture());
        assertNull(enviado.getValue().getPassword());
    }

    @Test
    @DisplayName("POST / sin id responde 400 y no toca el grafo")
    void registrarUsuarioSinIdResponde400() {
        UsuarioRequest request = new UsuarioRequest();
        request.setUsername("carlos");

        Response respuesta = resource.registrarUsuario(request);

        assertEquals(400, respuesta.getStatus());
        verifyNoInteractions(gestionarGrafoSocialUseCase);
    }

    @Test
    @DisplayName("POST / sin username responde 400")
    void registrarUsuarioSinUsernameResponde400() {
        UsuarioRequest request = new UsuarioRequest();
        request.setId("carlos-patino");

        Response respuesta = resource.registrarUsuario(request);

        assertEquals(400, respuesta.getStatus());
    }

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
        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(2, entity.size());
        assertEquals("u2", entity.get(0).getId());
        assertEquals("ana_upse", entity.get(0).getUsername());
        assertEquals("Ana", entity.get(0).getNombre());
        assertEquals("https://minio.upse.edu.ec/leo.png", entity.get(1).getAvatarUrl());
    }

    @Test
    @DisplayName("GET /{userId}/follows no devuelve el Usuario de dominio, sino el DTO sin correo")
    void obtenerSeguidosNoExponeElModeloDeDominio() {
        // Antes este endpoint respondía List<Usuario>, el modelo de dominio, que lleva password y
        // pushSubscriptionJson. Con esta consulta no se llenan, así que salían en null y no había
        // fuga: lo frágil era el patrón, y el perfil ajeno lo vuelve visible. La forma de la
        // respuesta es lo que queda fijado aquí.
        Usuario conCredenciales = new Usuario("u2", "ana_upse", "ana@upse.edu.ec", "Ana", null);
        conCredenciales.setPassword("secreto");
        conCredenciales.setPushSubscriptionJson("{\"endpoint\":\"https://fcm/x\"}");
        when(gestionarGrafoSocialUseCase.obtenerSeguidos("u1"))
                .thenReturn(List.of(conCredenciales));

        Response respuesta = resource.obtenerSeguidos("u1");

        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(UsuarioPublicoResponse.class, entity.get(0).getClass());
        assertFalse(
                respuesta.getEntity().toString().contains("secreto"),
                "La respuesta de una lista de seguidos no debe contener la contraseña");
        assertFalse(
                respuesta.getEntity().toString().contains("fcm"),
                "La respuesta de una lista de seguidos no debe contener la suscripción push");
        assertFalse(
                respuesta.getEntity().toString().contains("@upse.edu.ec"),
                "La lista de personas que sigue otra persona no necesita el correo de nadie");
    }

    @Test
    @DisplayName("GET /{userId}/followers responde 200 con la lista de seguidores del caso de uso")
    void obtenerSeguidoresResponde200ConLaLista() {
        List<Usuario> seguidores =
                List.of(
                        new Usuario(
                                "carlos-patino", "carlos", "carlos@upse.edu.ec", "Carlos", null),
                        new Usuario("elena-vega", "elena", "elena@upse.edu.ec", "Elena", null));
        when(gestionarGrafoSocialUseCase.obtenerSeguidores("beatriz-silva")).thenReturn(seguidores);

        Response respuesta = resource.obtenerSeguidores("beatriz-silva");

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(2, entity.size());
        assertEquals("carlos-patino", entity.get(0).getId());
        assertEquals("Carlos", entity.get(0).getNombre());
    }

    @Test
    @DisplayName("GET /{userId}/followers sin seguidores responde 200 con la lista vacía")
    void obtenerSeguidoresSinSeguidoresResponde200ConListaVacia() {
        // Sin seguidores es un resultado legítimo, no un fallo: responde 200 con [].
        when(gestionarGrafoSocialUseCase.obtenerSeguidores("elena-vega")).thenReturn(List.of());

        Response respuesta = resource.obtenerSeguidores("elena-vega");

        assertEquals(200, respuesta.getStatus());
        assertEquals(List.of(), respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /{userId}/followers no expone el Usuario de dominio")
    void obtenerSeguidoresNoExponeElModeloDeDominio() {
        Usuario conCredenciales = new Usuario("u2", "ana", "ana@upse.edu.ec", "Ana", null);
        conCredenciales.setPassword("secreto");
        conCredenciales.setPushSubscriptionJson("{\"endpoint\":\"https://fcm/x\"}");
        when(gestionarGrafoSocialUseCase.obtenerSeguidores("u1"))
                .thenReturn(List.of(conCredenciales));

        Response respuesta = resource.obtenerSeguidores("u1");

        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(UsuarioPublicoResponse.class, entity.get(0).getClass());
        assertFalse(respuesta.getEntity().toString().contains("secreto"));
        assertFalse(respuesta.getEntity().toString().contains("fcm"));
    }

    @Test
    @DisplayName("GET /comunes responde 200 con la intersección que devuelve el caso de uso")
    void obtenerSeguidosEnComunResponde200ConLaInterseccion() {
        List<Usuario> comunes =
                List.of(
                        new Usuario("beatriz-silva", "beatriz", null, "Beatriz Silva", null),
                        new Usuario("paulo-orrala", "paulo", null, "Paulo Orrala", null));
        when(gestionarGrafoSocialUseCase.obtenerSeguidosEnComun("carlos-patino", "angel-villon"))
                .thenReturn(comunes);

        Response respuesta = resource.obtenerSeguidosEnComun("carlos-patino", "angel-villon");

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(2, entity.size());
        assertEquals("beatriz-silva", entity.get(0).getId());
        assertEquals("Beatriz Silva", entity.get(0).getNombre());
    }

    @Test
    @DisplayName("GET /comunes no expone el Usuario de dominio")
    void obtenerSeguidosEnComunNoExponeElModeloDeDominio() {
        Usuario conCredenciales = new Usuario("u1", "ana", "ana@upse.edu.ec", "Ana", null);
        conCredenciales.setPassword("secreto");
        conCredenciales.setPushSubscriptionJson("{\"endpoint\":\"https://fcm/x\"}");
        when(gestionarGrafoSocialUseCase.obtenerSeguidosEnComun("carlos-patino", "angel-villon"))
                .thenReturn(List.of(conCredenciales));

        Response respuesta = resource.obtenerSeguidosEnComun("carlos-patino", "angel-villon");

        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(UsuarioPublicoResponse.class, entity.get(0).getClass());
        assertFalse(respuesta.getEntity().toString().contains("secreto"));
        assertFalse(respuesta.getEntity().toString().contains("fcm"));
    }

    @Test
    @DisplayName("GET /comunes sin userA responde 400 en vez de una lista vacía indistinguible")
    void obtenerSeguidosEnComunSinUserAResponde400() {
        Response respuesta = resource.obtenerSeguidosEnComun(null, "angel-villon");

        assertEquals(400, respuesta.getStatus());
        assertFalse(respuesta.getEntity() instanceof List<?>);
    }

    @Test
    @DisplayName("GET /comunes sin userB responde 400")
    void obtenerSeguidosEnComunSinUserBResponde400() {
        Response respuesta = resource.obtenerSeguidosEnComun("carlos-patino", null);

        assertEquals(400, respuesta.getStatus());
    }

    @Test
    @DisplayName("GET /comunes con un identificador de solo espacios responde 400")
    void obtenerSeguidosEnComunConIdentificadorEnBlancoResponde400() {
        Response respuesta = resource.obtenerSeguidosEnComun("   ", "angel-villon");

        assertEquals(400, respuesta.getStatus());
    }

    @Test
    @DisplayName(
            "GET /comunes con userA igual a userB responde 400 y no devuelve la lista de seguidos")
    void obtenerSeguidosEnComunConsigoMismoResponde400() {
        Response respuesta = resource.obtenerSeguidosEnComun("carlos-patino", "carlos-patino");

        assertEquals(400, respuesta.getStatus());
        assertFalse(respuesta.getEntity() instanceof List<?>);
    }

    @Test
    @DisplayName("GET /comunes no consulta el grafo cuando la consulta es inválida")
    void obtenerSeguidosEnComunInvalidaNoConsultaElGrafo() {
        resource.obtenerSeguidosEnComun("carlos-patino", "  ");
        resource.obtenerSeguidosEnComun("angel-villon", "angel-villon");

        verifyNoInteractions(gestionarGrafoSocialUseCase);
    }

    @Test
    @DisplayName(
            "GET /camino-corto responde 200 con la ruta y los saltos que devuelve el caso de uso")
    void obtenerCaminoMasCortoResponde200ConLaRuta() {
        Map<String, Object> camino =
                Map.of(
                        "rutaConexion",
                        List.of(
                                Map.of("id", "carlos-patino", "username", "carlos"),
                                Map.of("id", "beatriz-silva", "username", "beatriz"),
                                Map.of("id", "david-mendoza", "username", "david"),
                                Map.of("id", "elena-vega", "username", "elena")),
                        "saltosTotales",
                        3);
        when(gestionarGrafoSocialUseCase.obtenerCaminoMasCorto("carlos-patino", "elena-vega"))
                .thenReturn(camino);

        Response respuesta = resource.obtenerCaminoMasCorto("carlos-patino", "elena-vega");

        assertEquals(200, respuesta.getStatus());
        assertEquals(camino, respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /camino-corto sin camino responde 200 con la forma vacía, no con un error")
    void obtenerCaminoMasCortoSinCaminoResponde200() {
        // No hay conexión dentro de los seis grados: es un resultado legítimo y no un fallo,
        // así que no puede compartir respuesta con una petición incompleta.
        Map<String, Object> sinCamino = Map.of("rutaConexion", List.of(), "saltosTotales", 0);
        when(gestionarGrafoSocialUseCase.obtenerCaminoMasCorto("carlos-patino", "angel-villon"))
                .thenReturn(sinCamino);

        Response respuesta = resource.obtenerCaminoMasCorto("carlos-patino", "angel-villon");

        assertEquals(200, respuesta.getStatus());
        assertEquals(sinCamino, respuesta.getEntity());
    }

    @Test
    @DisplayName(
            "GET /camino-corto sin origen responde 400 en vez de una ruta vacía indistinguible")
    void obtenerCaminoMasCortoSinOrigenResponde400() {
        Response respuesta = resource.obtenerCaminoMasCorto(null, "elena-vega");

        assertEquals(400, respuesta.getStatus());
        assertFalse(respuesta.getEntity() instanceof List<?>);
    }

    @Test
    @DisplayName("GET /camino-corto sin destino responde 400")
    void obtenerCaminoMasCortoSinDestinoResponde400() {
        Response respuesta = resource.obtenerCaminoMasCorto("carlos-patino", null);

        assertEquals(400, respuesta.getStatus());
    }

    @Test
    @DisplayName("GET /camino-corto con un identificador de solo espacios responde 400")
    void obtenerCaminoMasCortoConIdentificadorEnBlancoResponde400() {
        assertEquals(400, resource.obtenerCaminoMasCorto("   ", "elena-vega").getStatus());
        assertEquals(400, resource.obtenerCaminoMasCorto("carlos-patino", "  ").getStatus());
    }

    @Test
    @DisplayName("GET /camino-corto no consulta el grafo cuando la petición es inválida")
    void obtenerCaminoMasCortoInvalidaNoConsultaElGrafo() {
        resource.obtenerCaminoMasCorto(null, "elena-vega");
        resource.obtenerCaminoMasCorto("carlos-patino", "  ");

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
