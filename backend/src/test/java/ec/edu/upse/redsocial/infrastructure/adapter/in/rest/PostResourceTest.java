package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.port.in.CrearPostUseCase;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PostResourceTest {

    @Mock CrearPostUseCase crearPostUseCase;

    @InjectMocks PostResource resource;

    @Test
    @DisplayName("POST /posts responde 201 cuando el post se crea correctamente")
    void crearPostResponde201() {
        when(crearPostUseCase.crearPost(anyString(), anyString(), anyString(), any()))
                .thenReturn("post-123");

        Response respuesta =
                resource.crearPost(
                        Map.of(
                                "autorId", "carlos-patino",
                                "autorUsername", "carlos",
                                "texto", "Hola mundo",
                                "mediaUrl", "http://img/1.png"));

        assertEquals(201, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("post-123", entity.get("id"));
    }

    @Test
    @DisplayName("POST /posts responde 404 y no propaga excepción si el autor no existe")
    void crearPostConAutorInexistenteResponde404() {
        when(crearPostUseCase.crearPost(anyString(), anyString(), anyString(), any()))
                .thenThrow(new AutorNoEncontradoException("carlos-patino"));

        Response respuesta =
                resource.crearPost(
                        Map.of(
                                "autorId", "carlos-patino",
                                "autorUsername", "carlos",
                                "texto", "Hola mundo",
                                "mediaUrl", "http://img/1.png"));

        assertEquals(404, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El autor indicado no existe", entity.get("error"));
    }

    @Test
    @DisplayName("POST /posts responde 400 si falta autorId y no llama al caso de uso")
    void crearPostSinAutorIdResponde400() {
        Response respuesta = resource.crearPost(Map.of("texto", "Hola mundo"));

        assertEquals(400, respuesta.getStatus());
        verify(crearPostUseCase, never()).crearPost(any(), any(), any(), any());
    }

    @Test
    @DisplayName("POST /posts responde 400 si el texto está vacío")
    void crearPostSinTextoResponde400() {
        Response respuesta = resource.crearPost(Map.of("autorId", "carlos-patino", "texto", "   "));

        assertEquals(400, respuesta.getStatus());
        verify(crearPostUseCase, never()).crearPost(any(), any(), any(), any());
    }

    @Test
    @DisplayName("El error de autor inexistente no filtra detalles técnicos")
    void errorNoExponeIdInterno() {
        when(crearPostUseCase.crearPost(anyString(), anyString(), anyString(), any()))
                .thenThrow(new AutorNoEncontradoException("carlos-patino"));

        Response respuesta =
                resource.crearPost(Map.of("autorId", "carlos-patino", "texto", "Hola mundo"));

        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertTrue(entity.get("error").contains("no existe"));
        assertTrue(!entity.get("error").contains("carlos-patino"));
    }

    @Test
    @DisplayName("GET /posts/autor/{userId} responde 200 con las publicaciones del caso de uso")
    void obtenerPostsDeUsuarioResponde200ConLasPublicaciones() {
        List<Post> posts =
                List.of(
                        post("post-b2", "La mas nueva", 1727270000000L),
                        post("post-b1", "La mas antigua", 1727260000000L));
        when(crearPostUseCase.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino"))
                .thenReturn(posts);

        Response respuesta = resource.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        assertEquals(200, respuesta.getStatus());
        assertEquals(posts, respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /posts/autor/{userId} delega el visor para saber si la reacción es mía")
    void obtenerPostsDeUsuarioDelegaElVisor() {
        List<Post> posts = List.of(post("post-b1", "texto", 1727260000000L));
        when(crearPostUseCase.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino"))
                .thenReturn(posts);

        resource.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        // Sin el visor, likedByMe no tendría quién mirar y volvería false en todas las
        // publicaciones: la tarjeta de Reaction se reiniciaría en cada recarga.
        verify(crearPostUseCase).obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");
    }

    @Test
    @DisplayName("GET /posts/autor/{userId} sin visor responde 200 y no inventa un visor")
    void obtenerPostsDeUsuarioSinVisor() {
        // Es exactamente la llamada del cURL del ticket, sin parameter de visor.
        List<Post> posts = List.of(post("post-b1", "texto", 1727260000000L));
        when(crearPostUseCase.obtenerPostsDeUsuario("beatriz-silva", null)).thenReturn(posts);

        Response respuesta = resource.obtenerPostsDeUsuario("beatriz-silva", null);

        assertEquals(200, respuesta.getStatus());
        assertEquals(posts, respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /posts/autor/{userId} responde 200 con lista vacía si el autor no publicó")
    void obtenerPostsDeUsuarioSinPublicacionesResponde200() {
        // Un perfil nuevo sin publicaciones es un resultado legítimo, no un fallo.
        when(crearPostUseCase.obtenerPostsDeUsuario("elena-vega", "carlos-patino"))
                .thenReturn(List.of());

        Response respuesta = resource.obtenerPostsDeUsuario("elena-vega", "carlos-patino");

        assertEquals(200, respuesta.getStatus());
        assertEquals(List.of(), respuesta.getEntity());
    }

    @Test
    @DisplayName(
            "GET /posts/autor/{userId} con identificador en blanco responde 400 y no consulta el grafo")
    void obtenerPostsDeUsuarioConIdEnBlancoResponde400() {
        // Sin la guarda, un id en blanco devuelve 200 con la lista vacía: la misma respuesta que
        // da un autor que todavía no publicó, y el cliente no puede distinguirlas.
        Response respuesta = resource.obtenerPostsDeUsuario("   ", "carlos-patino");

        assertEquals(400, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El campo 'userId' es obligatorio", entity.get("error"));
        verify(crearPostUseCase, never()).obtenerPostsDeUsuario(any(), any());
    }

    /**
     * Publicación de prueba, con los campos que el perfil ajeno necesita para pintar la tarjeta.
     */
    private static Post post(String id, String texto, long fecha) {
        Post p = new Post();
        p.setId(id);
        p.setTexto(texto);
        p.setFechaCreacion(fecha);
        p.setAutorId("beatriz-silva");
        p.setAutorUsername("beatriz");
        p.setTotalLikes(2);
        p.setLikedByMe(false);
        return p;
    }
}
