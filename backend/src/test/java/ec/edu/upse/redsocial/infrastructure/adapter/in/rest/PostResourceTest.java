package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
import ec.edu.upse.redsocial.domain.port.in.CrearPostUseCase;
import jakarta.ws.rs.core.Response;
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

    // --- Like idempotente (US-06) ---

    @Test
    @DisplayName("POST /posts/{id}/like responde 200 con el estado completo de reacciones")
    void likeResponde200ConElTotal() {
        when(crearPostUseCase.reaccionarPost("carlos-patino", "post-b1"))
                .thenReturn(new EstadoReaccion(7, 2));

        Response respuesta = resource.reaccionarPost("post-b1", Map.of("userId", "carlos-patino"));

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) respuesta.getEntity();
        // El contador optimista del cliente se concilia con estos números, no con un incremento
        // local. Las cuatro claves viajan siempre: con mutualidad el like excluye el dislike.
        assertEquals(7, entity.get("totalLikes"));
        assertEquals(2, entity.get("totalDislikes"));
        assertEquals(true, entity.get("likedByMe"));
        assertEquals(false, entity.get("dislikedByMe"));
        assertEquals("post-b1", entity.get("postId"));
    }

    @Test
    @DisplayName("Un like repetido también responde 200: registrar es idempotente")
    void likeRepetidoResponde200() {
        // La segunda llamada reutiliza la relación: los totales no cambian y tampoco es un error.
        when(crearPostUseCase.reaccionarPost("carlos-patino", "post-b1"))
                .thenReturn(new EstadoReaccion(7, 2));

        Response respuesta = resource.reaccionarPost("post-b1", Map.of("userId", "carlos-patino"));

        assertEquals(200, respuesta.getStatus());
    }

    @Test
    @DisplayName("POST /posts/{id}/like responde 400 si falta el userId")
    void likeSinUserIdResponde400() {
        Response respuesta = resource.reaccionarPost("post-b1", Map.of());

        assertEquals(400, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El campo 'userId' es obligatorio", entity.get("error"));
        verify(crearPostUseCase, never()).reaccionarPost(any(), any());
    }

    @Test
    @DisplayName("POST /posts/{id}/like responde 400 si el userId son solo espacios")
    void likeConUserIdEnBlancoResponde400() {
        Response respuesta = resource.reaccionarPost("post-b1", Map.of("userId", "   "));

        assertEquals(400, respuesta.getStatus());
        verify(crearPostUseCase, never()).reaccionarPost(any(), any());
    }

    @Test
    @DisplayName("La publicación ausente llega como 404 y no como un like registrado")
    void likeSobrePostInexistenteLanzaNotFound() {
        when(crearPostUseCase.reaccionarPost("carlos-patino", "post-inexistente"))
                .thenThrow(new PostNoEncontradoException("post-inexistente"));

        // El mapper de dominio traduce la excepción; el recurso no la captura para devolver 200.
        assertThrows(
                PostNoEncontradoException.class,
                () ->
                        resource.reaccionarPost(
                                "post-inexistente", Map.of("userId", "carlos-patino")));
    }

    @Test
    @DisplayName("La publicación ausente se traduce a 404 sin filtrar el identificador")
    void postInexistenteSeTraduceA404() {
        Response respuesta =
                new DomainExceptionMapper.PostNoEncontradoMapper()
                        .toResponse(new PostNoEncontradoException("post-inexistente"));

        assertEquals(404, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El recurso indicado no existe", entity.get("error"));
        assertTrue(!entity.get("error").contains("post-inexistente"));
    }

    // --- Dislike idempotente y retirada de reacciones (TUX-68) ---

    @Test
    @DisplayName("POST /posts/{id}/dislike responde 200 con el estado completo de reacciones")
    void dislikeResponde200ConElTotal() {
        when(crearPostUseCase.reaccionarDislike("carlos-patino", "post-b1"))
                .thenReturn(new EstadoReaccion(3, 1));

        Response respuesta =
                resource.reaccionarDislike("post-b1", Map.of("userId", "carlos-patino"));

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) respuesta.getEntity();
        assertEquals(3, entity.get("totalLikes"));
        assertEquals(1, entity.get("totalDislikes"));
        assertEquals(true, entity.get("dislikedByMe"));
        assertEquals(false, entity.get("likedByMe"));
        assertEquals("post-b1", entity.get("postId"));
    }

    @Test
    @DisplayName("Un dislike repetido también responde 200: registrar es idempotente")
    void dislikeRepetidoResponde200() {
        // La segunda llamada reutiliza la relación con el mismo tipo: los totales no cambian.
        when(crearPostUseCase.reaccionarDislike("carlos-patino", "post-b1"))
                .thenReturn(new EstadoReaccion(3, 1));

        Response respuesta =
                resource.reaccionarDislike("post-b1", Map.of("userId", "carlos-patino"));

        assertEquals(200, respuesta.getStatus());
        verify(crearPostUseCase).reaccionarDislike("carlos-patino", "post-b1");
    }

    @Test
    @DisplayName("POST /posts/{id}/dislike responde 400 si falta el userId")
    void dislikeSinUserIdResponde400() {
        Response respuesta = resource.reaccionarDislike("post-b1", Map.of());

        assertEquals(400, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> entity = (Map<String, String>) respuesta.getEntity();
        assertEquals("El campo 'userId' es obligatorio", entity.get("error"));
        verify(crearPostUseCase, never()).reaccionarDislike(any(), any());
    }

    @Test
    @DisplayName("El dislike sobre una publicación ausente llega como 404")
    void dislikeSobrePostInexistenteLanzaNotFound() {
        when(crearPostUseCase.reaccionarDislike("carlos-patino", "post-inexistente"))
                .thenThrow(new PostNoEncontradoException("post-inexistente"));

        assertThrows(
                PostNoEncontradoException.class,
                () ->
                        resource.reaccionarDislike(
                                "post-inexistente", Map.of("userId", "carlos-patino")));
    }

    @Test
    @DisplayName("DELETE /posts/{id}/like responde 200 con el estado completo recalculado")
    void quitarLikeResponde200() {
        when(crearPostUseCase.quitarLike("carlos-patino", "post-b1"))
                .thenReturn(new EstadoReaccion(6, 2));

        Response respuesta = resource.quitarLike("post-b1", "carlos-patino");

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) respuesta.getEntity();
        assertEquals(false, entity.get("likedByMe"));
        assertEquals(false, entity.get("dislikedByMe"));
        assertEquals(6, entity.get("totalLikes"));
        assertEquals(2, entity.get("totalDislikes"));
        assertEquals("post-b1", entity.get("postId"));
    }

    @Test
    @DisplayName("DELETE /posts/{id}/dislike responde 200 con el estado completo recalculado")
    void quitarDislikeResponde200() {
        when(crearPostUseCase.quitarDislike("carlos-patino", "post-b1"))
                .thenReturn(new EstadoReaccion(7, 1));

        Response respuesta = resource.quitarDislike("post-b1", "carlos-patino");

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) respuesta.getEntity();
        assertEquals(false, entity.get("dislikedByMe"));
        assertEquals(false, entity.get("likedByMe"));
        assertEquals(7, entity.get("totalLikes"));
        assertEquals(1, entity.get("totalDislikes"));
        assertEquals("post-b1", entity.get("postId"));
    }

    @Test
    @DisplayName("DELETE de una reacción que no existe responde 200 con el estado sin cambios")
    void quitarReaccionInexistenteResponde200() {
        // Retirar es idempotente: si no había nada que borrar, igual es 200 con las marcas en
        // false y los totales que ya había. La tarjeta ya no necesita conservar un decremento
        // optimista porque la respuesta trae los números reales.
        when(crearPostUseCase.quitarLike("carlos-patino", "post-b1"))
                .thenReturn(new EstadoReaccion(7, 2));

        Response respuesta = resource.quitarLike("post-b1", "carlos-patino");

        assertEquals(200, respuesta.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> entity = (Map<String, Object>) respuesta.getEntity();
        assertEquals(false, entity.get("likedByMe"));
        assertEquals(7, entity.get("totalLikes"));
        assertEquals(2, entity.get("totalDislikes"));
    }

    @Test
    @DisplayName("DELETE /posts/{id}/like responde 400 si falta el userId")
    void quitarLikeSinUserIdResponde400() {
        Response respuesta = resource.quitarLike("post-b1", null);

        assertEquals(400, respuesta.getStatus());
        verify(crearPostUseCase, never()).quitarLike(any(), any());
    }

    @Test
    @DisplayName("DELETE /posts/{id}/dislike responde 400 si falta el userId")
    void quitarDislikeSinUserIdResponde400() {
        Response respuesta = resource.quitarDislike("post-b1", "   ");

        assertEquals(400, respuesta.getStatus());
        verify(crearPostUseCase, never()).quitarDislike(any(), any());
    }
}
