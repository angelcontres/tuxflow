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
        String userId = body != null ? body.get("userId") : null;
        // Sin usuario no hay forma de crear la relación. Un 200 aquí sería un like que nunca
        // existió.
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }

        int totalLikes = crearPostUseCase.reaccionarPost(userId, postId);
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción registrada",
                                "postId",
                                postId,
                                "likedByMe",
                                true,
                                "totalLikes",
                                totalLikes))
                .build();
    }

    @POST
    @Path("/{postId}/dislike")
    public Response reaccionarDislike(
            @PathParam("postId") String postId, Map<String, String> body) {
        String userId = body != null ? body.get("userId") : null;
        // Misma validación que el like: sin usuario no hay relación que crear.
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }

        int totalDislikes = crearPostUseCase.reaccionarDislike(userId, postId);
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción registrada",
                                "postId",
                                postId,
                                "dislikedByMe",
                                true,
                                "totalDislikes",
                                totalDislikes))
                .build();
    }

    @DELETE
    @Path("/{postId}/like")
    public Response quitarLike(
            @PathParam("postId") String postId, @QueryParam("userId") String userId) {
        // El userId viaja en la query porque el DELETE no lleva cuerpo. Un @QueryParam ausente
        // llega como null, así que la validación es la misma que en los POST.
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }

        crearPostUseCase.quitarLike(userId, postId);
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción retirada",
                                "postId",
                                postId,
                                "likedByMe",
                                false))
                .build();
    }

    @DELETE
    @Path("/{postId}/dislike")
    public Response quitarDislike(
            @PathParam("postId") String postId, @QueryParam("userId") String userId) {
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }

        crearPostUseCase.quitarDislike(userId, postId);
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción retirada",
                                "postId",
                                postId,
                                "dislikedByMe",
                                false))
                .build();
    }

    @GET
    @Path("/tendencias/{userId}")
    public Response obtenerTendencias(@PathParam("userId") String userId) {
        return Response.ok(crearPostUseCase.obtenerTendencias(userId)).build();
    }
}
