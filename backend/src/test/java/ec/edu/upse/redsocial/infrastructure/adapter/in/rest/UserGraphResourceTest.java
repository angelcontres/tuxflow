package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
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

    // --- Búsqueda de personas (US-14) ---

    @Test
    @DisplayName("GET /buscar responde 200 con la lista de resultados que devuelve el caso de uso")
    void buscarUsuariosResponde200ConLaLista() {
        when(gestionarGrafoSocialUseCase.buscarUsuarios("beatriz"))
                .thenReturn(
                        List.of(
                                new Usuario(
                                        "beatriz-silva",
                                        "beatriz",
                                        null,
                                        "Beatriz Silva",
                                        "https://cdn/b.png"),
                                new Usuario("paulo-orrala", "paulo", null, "Paulo Orrala", null)));

        Response respuesta = resource.buscarUsuarios("beatriz");

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(2, entity.size());
        assertEquals("beatriz-silva", entity.get(0).getId());
        assertEquals("Beatriz Silva", entity.get(0).getNombre());
    }

    @Test
    @DisplayName("GET /buscar no expone el Usuario de dominio, sino el DTO sin correo ni password")
    void buscarUsuariosNoExponeElModeloDeDominio() {
        // La búsqueda es la lectura más amplia de la comunidad que tiene la API: cualquiera que
        // adivine dos letras puede preguntar por todos. Por eso la respuesta es la más estrecha
        // posible, y por eso esto se comprueba sobre el cuerpo y no sólo sobre la clase.
        Usuario conCredenciales =
                new Usuario(
                        "beatriz-silva", "beatriz", "beatriz@upse.edu.ec", "Beatriz Silva", null);
        conCredenciales.setPassword("no-debe-aparecer");
        conCredenciales.setPushSubscriptionJson("{\"endpoint\":\"https://fcm/secreto\"}");
        when(gestionarGrafoSocialUseCase.buscarUsuarios("beatriz"))
                .thenReturn(List.of(conCredenciales));

        Response respuesta = resource.buscarUsuarios("beatriz");

        @SuppressWarnings("unchecked")
        List<UsuarioPublicoResponse> entity = (List<UsuarioPublicoResponse>) respuesta.getEntity();
        assertEquals(UsuarioPublicoResponse.class, entity.get(0).getClass());
        String cuerpo = respuesta.getEntity().toString();
        assertFalse(cuerpo.contains("no-debe-aparecer"), "La contraseña se filtró: " + cuerpo);
        assertFalse(cuerpo.contains("fcm"), "La suscripción push se filtró: " + cuerpo);
        assertFalse(cuerpo.contains("@upse.edu.ec"), "El correo se filtró: " + cuerpo);
    }

    @Test
    @DisplayName("GET /buscar sin resultados responde 200 con la lista vacía, no con un error")
    void buscarUsuariosSinResultadosResponde200() {
        // "No hay nadie con ese nombre" es un resultado legítimo y no puede compartir respuesta con
        // una petición mal formada, que responde 400.
        when(gestionarGrafoSocialUseCase.buscarUsuarios("zzzz")).thenReturn(List.of());

        Response respuesta = resource.buscarUsuarios("zzzz");

        assertEquals(200, respuesta.getStatus());
        assertEquals(List.of(), respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /buscar con menos de dos caracteres responde 400 y no toca el grafo")
    void buscarUsuariosConTextoCortoResponde400() {
        // Con un carácter, "a" devuelve casi toda la comunidad y el endpoint es un GET /api/users
        // con otro nombre. La mitigación tiene que estar en el servidor: en el navegador no
        // mitiga nada contra un curl.
        assertEquals(400, resource.buscarUsuarios("a").getStatus());
        assertEquals(400, resource.buscarUsuarios(" ").getStatus());

        verifyNoInteractions(gestionarGrafoSocialUseCase);
    }

    @Test
    @DisplayName("GET /buscar sin q responde 400 en vez de devolver la comunidad entera")
    void buscarUsuariosSinQueryResponde400() {
        // Sin esta validación, una petición sin parámetro devolvía toda la lista de resultados
        // posibles. Y no puede devolver la lista vacía: "no le pasaste el parámetro" y "no hay
        // nadie" son la misma respuesta y el cliente no puede distinguirlas.
        assertEquals(400, resource.buscarUsuarios(null).getStatus());
        assertEquals(400, resource.buscarUsuarios("").getStatus());

        verifyNoInteractions(gestionarGrafoSocialUseCase);
    }

    @Test
    @DisplayName("GET /buscar cuenta los espacios que sobran antes de medir el mínimo")
    void buscarUsuariosMideElTextoSinLosEspaciosSobrantes() {
        // "  a  " tiene cinco caracteres pero sólo uno útil. Medir el texto sin limpiar haría que
        // "  a  " pasara el mínimo y pidiera una búsqueda que el servidor va a rechazar.
        Response respuesta = resource.buscarUsuarios("  a  ");

        assertEquals(400, respuesta.getStatus());
        verifyNoInteractions(gestionarGrafoSocialUseCase);
    }

    @Test
    @DisplayName("GET /buscar con dos caracteres sí consulta, porque ése es el mínimo")
    void buscarUsuariosConDosCaracteresConsulta() {
        when(gestionarGrafoSocialUseCase.buscarUsuarios("be")).thenReturn(List.of());

        Response respuesta = resource.buscarUsuarios("be");

        assertEquals(200, respuesta.getStatus());
        verify(gestionarGrafoSocialUseCase).buscarUsuarios("be");
    }

    @Test
    @DisplayName("GET /buscar devuelve el motivo en el campo 'error', que es el que lee el cliente")
    void buscarUsuariosDevuelveElMotivoEnError() {
        // `getUserFacingError` del frontend lee el campo `error`. Si el endpoint devolviera otra
        // clave, el mensaje del servidor no llegaría nunca a pantalla.
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) resource.buscarUsuarios("a").getEntity();

        assertNotNull(entity.get("error"));
        assertTrue(entity.get("error").contains("2"));
    }

    @Test
    @DisplayName("Ya no existe GET /api/users: el directorio con correos se cerró")
    void elDirectorioDeUsuariosYaNoExiste() {
        // Este endpoint devolvía TODOS los usuarios con su correo y sin pedir autenticación. No
        // borrarlo por completo --dejar listarUsuarios en el servicio-- dejaría la puerta abierta
        // con el mismo defecto detrás, así que la comprobación es sobre la superficie pública del
        // recurso y no sobre un caso concreto.
        //
        // Se filtran los métodos sintéticos y las lambdas que genera el compilador: si no, esta
        // prueba fallaría por motivos que no tienen que ver con lo que comprueba.
        Set<String> metodos =
                Arrays.stream(UserGraphResource.class.getDeclaredMethods())
                        .filter(metodo -> !metodo.isSynthetic())
                        .map(java.lang.reflect.Method::getName)
                        .filter(nombre -> !nombre.startsWith("lambda$"))
                        .collect(Collectors.toSet());

        assertFalse(
                metodos.contains("listarUsuarios"),
                "El directorio volvió a exponerse en el recurso: " + metodos);
        assertTrue(
                metodos.contains("buscarUsuarios"),
                "La búsqueda no está en el recurso: " + metodos);
        // El registro sigue en pie: es otra ruta del mismo recurso, y cerrarlo sería romper US-01.
        assertTrue(
                metodos.contains("registrarUsuario"),
                "El registro de usuarios se cerró por error: " + metodos);
    }

    @Test
    @DisplayName("GET /{userId} no devuelve el correo de nadie, ni siquiera del propio")
    void elPerfilPublicoNoDevuelveElCorreo() {
        // Este endpoint respondía UsuarioResponse, que lleva email y pushSubscriptionJson, y sin
        // pedir autenticación. Medido antes del arreglo:
        //   GET /api/users/beatriz-silva  ->  200  email = beatriz@upse.edu.ec
        //
        // El correo es un dato de la cuenta, no del perfil que ve el resto. Ahora vive en
        // GET /api/auth/me, que exige sesión.
        Usuario conCorreo =
                new Usuario(
                        "beatriz-silva", "beatriz", "beatriz@upse.edu.ec", "Beatriz Silva", null);
        conCorreo.setPushSubscriptionJson("{\"endpoint\":\"https://fcm/secreto\"}");
        when(gestionarGrafoSocialUseCase.obtenerUsuarioPorId("beatriz-silva"))
                .thenReturn(Optional.of(conCorreo));

        Response respuesta = resource.obtenerUsuarioPorId("beatriz-silva");

        assertEquals(200, respuesta.getStatus());
        // Un perfil es un objeto, no una lista: son las listas de seguidores y la búsqueda las que
        // devuelven varias.
        UsuarioPublicoResponse entity = (UsuarioPublicoResponse) respuesta.getEntity();
        assertEquals("beatriz-silva", entity.getId());
        assertEquals("Beatriz Silva", entity.getNombre());

        String cuerpo = respuesta.getEntity().toString();
        assertFalse(cuerpo.contains("upse.edu.ec"), "El correo se filtró: " + cuerpo);
        assertFalse(cuerpo.contains("fcm"), "La suscripción push se filtró: " + cuerpo);
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
