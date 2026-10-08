package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.Comentario;
import ec.edu.upse.redsocial.domain.model.EstadoComentario;
import ec.edu.upse.redsocial.domain.port.in.GestionarComentariosUseCase;
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
class ComentarioResourceTest {

    @Mock GestionarComentariosUseCase gestionarComentariosUseCase;

    @InjectMocks ComentarioResource resource;

    // --- Crear ---

    @Test
    @DisplayName("POST /posts/{id}/comentarios responde 201 con el comentario completo")
    void crearResponde201ConElComentario() {
        Comentario creado = comentario("com-1", "Buen aporte", null);
        when(gestionarComentariosUseCase.crearComentario(
                        "paulo-orrala", "post-b1", "Buen aporte", null))
                .thenReturn(creado);

        Response respuesta =
                resource.crear("post-b1", Map.of("userId", "paulo-orrala", "texto", "Buen aporte"));

        assertEquals(201, respuesta.getStatus());
        assertEquals(creado, respuesta.getEntity());
    }

    @Test
    @DisplayName("Una respuesta llega al caso de uso con su parentId")
    void crearRespuestaDelegaElParentId() {
        Comentario respuesta = comentario("com-2", "De acuerdo", "com-1");
        when(gestionarComentariosUseCase.crearComentario(
                        "carlos-patino", "post-b1", "De acuerdo", "com-1"))
                .thenReturn(respuesta);

        Response r =
                resource.crear(
                        "post-b1",
                        Map.of(
                                "userId", "carlos-patino",
                                "texto", "De acuerdo",
                                "parentId", "com-1"));

        assertEquals(201, r.getStatus());
        verify(gestionarComentariosUseCase)
                .crearComentario("carlos-patino", "post-b1", "De acuerdo", "com-1");
    }

    @Test
    @DisplayName("Un parentId vacío se trata como comentario de primer nivel")
    void parentIdVacioEsComentarioRaiz() {
        when(gestionarComentariosUseCase.crearComentario(any(), any(), any(), eq(null)))
                .thenReturn(comentario("com-1", "texto", null));

        resource.crear(
                "post-b1", Map.of("userId", "paulo-orrala", "texto", "texto", "parentId", "  "));

        verify(gestionarComentariosUseCase)
                .crearComentario("paulo-orrala", "post-b1", "texto", null);
    }

    @Test
    @DisplayName("POST sin userId responde 400 y no llama al caso de uso")
    void crearSinUserIdResponde400() {
        Response respuesta = resource.crear("post-b1", Map.of("texto", "Hola"));

        assertEquals(400, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El campo 'userId' es obligatorio", entity.get("error"));
        verify(gestionarComentariosUseCase, never()).crearComentario(any(), any(), any(), any());
    }

    @Test
    @DisplayName("POST con texto en blanco responde 400 y no crea nada")
    void crearSinTextoResponde400() {
        Response respuesta =
                resource.crear("post-b1", Map.of("userId", "paulo-orrala", "texto", "   "));

        assertEquals(400, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El texto del comentario es obligatorio", entity.get("error"));
        verify(gestionarComentariosUseCase, never()).crearComentario(any(), any(), any(), any());
    }

    @Test
    @DisplayName("El autor inexistente responde 404 y no filtra el identificador")
    void autorInexistenteResponde404() {
        when(gestionarComentariosUseCase.crearComentario(any(), any(), any(), any()))
                .thenThrow(new AutorNoEncontradoException("fantasma"));

        Response respuesta =
                resource.crear("post-b1", Map.of("userId", "fantasma", "texto", "Hola"));

        assertEquals(404, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El autor indicado no existe", entity.get("error"));
        assertTrue(!entity.get("error").contains("fantasma"));
    }

    @Test
    @DisplayName("La publicación ausente llega como 404")
    void publicacionAusentePropaga404() {
        when(gestionarComentariosUseCase.crearComentario(any(), any(), any(), any()))
                .thenThrow(new PostNoEncontradoException("post-x"));

        assertThrows(
                PostNoEncontradoException.class,
                () -> resource.crear("post-x", Map.of("userId", "paulo-orrala", "texto", "Hola")));
    }

    @Test
    @DisplayName("El padre inválido llega como 404")
    void padreInvalidoPropaga404() {
        when(gestionarComentariosUseCase.crearComentario(any(), any(), any(), any()))
                .thenThrow(new ComentarioNoEncontradoException("com-x"));

        assertThrows(
                ComentarioNoEncontradoException.class,
                () ->
                        resource.crear(
                                "post-b1",
                                Map.of(
                                        "userId", "paulo-orrala",
                                        "texto", "Hola",
                                        "parentId", "com-x")));
    }

    @Test
    @DisplayName("El comentario ausente se traduce a 404 genérico sin filtrar el identificador")
    void comentarioAusenteSeTraduceA404() {
        Response respuesta =
                new DomainExceptionMapper.ComentarioNoEncontradoMapper()
                        .toResponse(new ComentarioNoEncontradoException("com-x"));

        assertEquals(404, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El recurso indicado no existe", entity.get("error"));
        assertTrue(!entity.get("error").contains("com-x"));
    }

    // --- Listar ---

    @Test
    @DisplayName("GET delega el visor y responde 200 con la lista")
    void listarDelegaElVisor() {
        List<Comentario> comentarios =
                List.of(comentario("com-1", "primero", null), comentario("com-2", "segundo", null));
        when(gestionarComentariosUseCase.obtenerComentarios("post-b1", "carlos-patino"))
                .thenReturn(comentarios);

        Response respuesta = resource.listar("post-b1", "carlos-patino");

        assertEquals(200, respuesta.getStatus());
        assertEquals(comentarios, respuesta.getEntity());
    }

    @Test
    @DisplayName("GET sin visor responde 200 y no inventa un visor")
    void listarSinVisor() {
        when(gestionarComentariosUseCase.obtenerComentarios("post-b1", null)).thenReturn(List.of());

        Response respuesta = resource.listar("post-b1", null);

        assertEquals(200, respuesta.getStatus());
        assertEquals(List.of(), respuesta.getEntity());
    }

    @Test
    @DisplayName("GET con postId en blanco responde 400 y no consulta el grafo")
    void listarConPostIdEnBlancoResponde400() {
        Response respuesta = resource.listar("   ", "carlos-patino");

        assertEquals(400, respuesta.getStatus());
        verify(gestionarComentariosUseCase, never()).obtenerComentarios(any(), any());
    }

    // --- Likes ---

    @Test
    @DisplayName("POST like responde 200 con likedByMe y el total del grafo")
    void likeResponde200() {
        when(gestionarComentariosUseCase.likeComentario("carlos-patino", "com-1"))
                .thenReturn(new EstadoComentario(3, true));

        Response respuesta = resource.darLike("com-1", Map.of("userId", "carlos-patino"));

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) respuesta.getEntity();
        assertEquals(3, entity.get("totalLikes"));
        assertEquals(true, entity.get("likedByMe"));
        assertEquals("com-1", entity.get("comentarioId"));
    }

    @Test
    @DisplayName("POST like sin userId responde 400 y no llama al caso de uso")
    void likeSinUserIdResponde400() {
        Response respuesta = resource.darLike("com-1", Map.of());

        assertEquals(400, respuesta.getStatus());
        verify(gestionarComentariosUseCase, never()).likeComentario(any(), any());
    }

    @Test
    @DisplayName("DELETE like responde 200 con likedByMe en false")
    void quitarLikeResponde200() {
        when(gestionarComentariosUseCase.quitarLikeComentario("carlos-patino", "com-1"))
                .thenReturn(new EstadoComentario(2, false));

        Response respuesta = resource.quitarLike("com-1", "carlos-patino");

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) respuesta.getEntity();
        assertEquals(false, entity.get("likedByMe"));
        assertEquals(2, entity.get("totalLikes"));
    }

    @Test
    @DisplayName("DELETE like sin userId responde 400")
    void quitarLikeSinUserIdResponde400() {
        Response respuesta = resource.quitarLike("com-1", "   ");

        assertEquals(400, respuesta.getStatus());
        verify(gestionarComentariosUseCase, never()).quitarLikeComentario(any(), any());
    }

    @Test
    @DisplayName("El like sobre un comentario inexistente llega como excepción de dominio")
    void likeSobreComentarioInexistenteLanzaNotFound() {
        when(gestionarComentariosUseCase.likeComentario("carlos-patino", "com-x"))
                .thenThrow(new ComentarioNoEncontradoException("com-x"));

        ComentarioNoEncontradoException error =
                assertThrows(
                        ComentarioNoEncontradoException.class,
                        () -> resource.darLike("com-x", Map.of("userId", "carlos-patino")));
        assertEquals("com-x", error.getComentarioId());
    }

    private static Comentario comentario(String id, String texto, String parentId) {
        Comentario c = new Comentario();
        c.setId(id);
        c.setTexto(texto);
        c.setParentId(parentId);
        c.setFechaCreacion(1727270000000L);
        c.setAutorId("paulo-orrala");
        c.setAutorUsername("paulo");
        c.setTotalLikes(0);
        c.setLikedByMe(false);
        return c;
    }
}
