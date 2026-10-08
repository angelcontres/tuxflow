package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.Map;

/**
 * Evita que las excepciones de dominio escapen como 500 con detalle técnico. Traduce el error a un
 * mensaje que el frontend puede mostrar al usuario.
 */
@Provider
public class DomainExceptionMapper implements ExceptionMapper<AutorNoEncontradoException> {

    @Override
    public Response toResponse(AutorNoEncontradoException exception) {
        return notFound();
    }

    /**
     * Mapeo aparte para la publicación ausente: cada mapper se registra por su tipo concreto, y un
     * solo mapper para RuntimeException taparía además errores que deben seguir siendo 500.
     */
    @Provider
    public static class PostNoEncontradoMapper
            implements ExceptionMapper<PostNoEncontradoException> {

        @Override
        public Response toResponse(PostNoEncontradoException exception) {
            return notFound();
        }
    }

    /**
     * El comentario ausente comparte el 404 genérico, incluido el caso de un padre de respuesta que
     * no existe o que cuelga de otra publicación: desde fuera el recurso pedido no está donde se
     * dijo, y el identificador interno no se repite.
     */
    @Provider
    public static class ComentarioNoEncontradoMapper
            implements ExceptionMapper<ComentarioNoEncontradoException> {

        @Override
        public Response toResponse(ComentarioNoEncontradoException exception) {
            return notFound();
        }
    }

    private static Response notFound() {
        // El mensaje no repite el identificador interno del recurso.
        return Response.status(Response.Status.NOT_FOUND)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", "El recurso indicado no existe"))
                .build();
    }
}
