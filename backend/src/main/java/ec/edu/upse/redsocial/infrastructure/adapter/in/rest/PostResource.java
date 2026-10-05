package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
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

        EstadoReaccion estado = crearPostUseCase.reaccionarPost(userId, postId);
        // Con mutualidad el registro excluye la reacción contraria, así que ambas banderas se
        // conocen con certeza sin lectura extra: el like quedó activo y el dislike no existe.
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción registrada",
                                "postId",
                                postId,
                                "likedByMe",
                                true,
                                "dislikedByMe",
                                false,
                                "totalLikes",
                                estado.totalLikes(),
                                "totalDislikes",
                                estado.totalDislikes()))
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

        EstadoReaccion estado = crearPostUseCase.reaccionarDislike(userId, postId);
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción registrada",
                                "postId",
                                postId,
                                "likedByMe",
                                false,
                                "dislikedByMe",
                                true,
                                "totalLikes",
                                estado.totalLikes(),
                                "totalDislikes",
                                estado.totalDislikes()))
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

        EstadoReaccion estado = crearPostUseCase.quitarLike(userId, postId);
        // La retirada no toca la reacción contraria y el registro ya es excluyente, así que el
        // dislike tampoco existe: ambas banderas van en false con los totales recalculados.
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción retirada",
                                "postId",
                                postId,
                                "likedByMe",
                                false,
                                "dislikedByMe",
                                false,
                                "totalLikes",
                                estado.totalLikes(),
                                "totalDislikes",
                                estado.totalDislikes()))
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

        EstadoReaccion estado = crearPostUseCase.quitarDislike(userId, postId);
        return Response.ok(
                        Map.of(
                                "mensaje",
                                "Reacción retirada",
                                "postId",
                                postId,
                                "likedByMe",
                                false,
                                "dislikedByMe",
                                false,
                                "totalLikes",
                                estado.totalLikes(),
                                "totalDislikes",
                                estado.totalDislikes()))
                .build();
    }

    @GET
    @Path("/tendencias/{userId}")
    public Response obtenerTendencias(@PathParam("userId") String userId) {
        return Response.ok(crearPostUseCase.obtenerTendencias(userId)).build();
    }

    /**
     * Publicaciones de un autor, de la más nueva a la más antigua.
     *
     * <p>Es la lectura que consume el perfil de otra persona. Reutiliza {@link
     * ec.edu.upse.redsocial.domain.model.Post} y su mapeo, en vez de un DTO propio: la pantalla de
     * perfil pinta las mismas tarjetas que el feed, y un tipo distinto obligaría a duplicar el
     * mapeo y a mantenerlo en paralelo.
     *
     * <p>{@code viewerId} es un parámetro de consulta opcional y sólo cambia {@code likedByMe}. Sin
     * él se llama exactamente como en el cURL del ticket y todas las publicaciones llegan con la
     * reacción sin marcar, que es la respuesta honesta para "no se está mirando desde nadie".
     */
    @GET
    @Path("/autor/{userId}")
    public Response obtenerPostsDeUsuario(
            @PathParam("userId") String userId, @QueryParam("viewerId") String viewerId) {
        // Sin esta guarda, un identificador en blanco produce una consulta que no encuentra
        // publicaciones y responde 200 con una lista vacía: idéntica a la de un autor que
        // todavía no ha publicado, y el cliente no puede distinguirlas. Es el mismo motivo por el
        // que /comunes y /camino-corto responden 400 en vez de devolver la lista vacía.
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }

        return Response.ok(crearPostUseCase.obtenerPostsDeUsuario(userId, viewerId)).build();
    }
}
