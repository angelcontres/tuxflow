package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

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

        String postId = crearPostUseCase.crearPost(autorId, autorUsername, texto, mediaUrl);

        return Response.status(Response.Status.CREATED)
                .entity(Map.of("id", postId, "mensaje", "Publicación creada con éxito"))
                .build();
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
