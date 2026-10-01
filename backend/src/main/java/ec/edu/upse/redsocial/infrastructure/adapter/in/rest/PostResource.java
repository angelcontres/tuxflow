package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.port.in.CrearPostUseCase;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

@Path("/api/posts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PostResource {

    @Inject CrearPostUseCase crearPostUseCase;

    @POST
    public Response crearPost(Map<String, String> request) {
        String autorId = request.get("autorId");
        String texto = request.get("texto");
        String mediaUrl = request.get("mediaUrl");
        String autorUsername = request.getOrDefault("autorUsername", "usuario");

        if (autorId == null || autorId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'autorId' es obligatorio"))
                    .build();
        }

        if (texto == null || texto.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El texto de la publicación es obligatorio"))
                    .build();
        }

        try {
            String postId = crearPostUseCase.crearPost(autorId, autorUsername, texto, mediaUrl);
            return Response.status(Response.Status.CREATED)
                    .entity(Map.of("id", postId, "mensaje", "Publicación creada con éxito"))
                    .build();
        } catch (AutorNoEncontradoException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "El autor indicado no existe"))
                    .build();
        }
    }

    @POST
    @Path("/{postId}/like")
    public Response reaccionarPost(@PathParam("postId") String postId, Map<String, String> body) {
        String userId = body.get("userId");
        crearPostUseCase.reaccionarPost(userId, postId);
        return Response.ok(Map.of("mensaje", "Reacción registrada")).build();
    }

    @GET
    @Path("/tendencias/{userId}")
    public Response obtenerTendencias(@PathParam("userId") String userId) {
        return Response.ok(crearPostUseCase.obtenerTendencias(userId)).build();
    }
}
