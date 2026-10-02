package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
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
        return Response.status(Response.Status.NOT_FOUND)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", "El recurso indicado no existe"))
                .build();
    }
}
