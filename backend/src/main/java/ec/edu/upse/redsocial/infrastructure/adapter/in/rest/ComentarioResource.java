package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.Comentario;
import ec.edu.upse.redsocial.domain.model.EstadoComentario;
import ec.edu.upse.redsocial.domain.port.in.GestionarComentariosUseCase;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/**
 * Comentarios de una publicación y sus likes.
 *
 * <p>La colección cuelga del post —{@code /api/posts/{postId}/comentarios}— igual que el like de un
 * post cuelga de {@code /api/posts/{postId}/like}. El like de un comentario se resuelve bajo la
 * misma ruta para no abrir un segundo recurso de primer nivel sólo para reacciones.
 */
@Path("/api/posts/{postId}/comentarios")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ComentarioResource {

    @Inject GestionarComentariosUseCase gestionarComentariosUseCase;

    @GET
    public Response listar(
            @PathParam("postId") String postId, @QueryParam("viewerId") String viewerId) {
        // Un postId en blanco produciría la misma lista vacía que una publicación sin comentarios:
        // dos situaciones distintas con una sola respuesta. Se rechaza como en /autor.
        if (postId == null || postId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'postId' es obligatorio"))
                    .build();
        }
        return Response.ok(gestionarComentariosUseCase.obtenerComentarios(postId, viewerId))
                .build();
    }

    @POST
    public Response crear(@PathParam("postId") String postId, Map<String, String> request) {
        String userId = request != null ? request.get("userId") : null;
        String texto = request != null ? request.get("texto") : null;
        String parentId = request != null ? request.get("parentId") : null;

        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }
        if (texto == null || texto.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El texto del comentario es obligatorio"))
                    .build();
        }

        try {
            // Un parentId vacío equivale a comentario de primer nivel: el cliente manda "" cuando
            // el
            // campo existe pero no aplica, y tratarlo como id rompería el MATCH del padre.
            String padre = parentId == null || parentId.isBlank() ? null : parentId;
            Comentario creado =
                    gestionarComentariosUseCase.crearComentario(userId, postId, texto, padre);
            return Response.status(Response.Status.CREATED).entity(creado).build();
        } catch (AutorNoEncontradoException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "El autor indicado no existe"))
                    .build();
        }
    }

    @POST
    @Path("/{comentarioId}/like")
    public Response darLike(
            @PathParam("comentarioId") String comentarioId, Map<String, String> body) {
        String userId = body != null ? body.get("userId") : null;
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }
        return Response.ok(
                        respuestaLike(
                                comentarioId,
                                gestionarComentariosUseCase.likeComentario(userId, comentarioId),
                                "Me Gusta registrado"))
                .build();
    }

    @DELETE
    @Path("/{comentarioId}/like")
    public Response quitarLike(
            @PathParam("comentarioId") String comentarioId, @QueryParam("userId") String userId) {
        // El userId viaja en la query porque el DELETE no lleva cuerpo, igual que en
        // /posts/{id}/like.
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }
        return Response.ok(
                        respuestaLike(
                                comentarioId,
                                gestionarComentariosUseCase.quitarLikeComentario(
                                        userId, comentarioId),
                                "Me Gusta retirado"))
                .build();
    }

    private static Map<String, Object> respuestaLike(
            String comentarioId, EstadoComentario estado, String mensaje) {
        return Map.of(
                "mensaje",
                mensaje,
                "comentarioId",
                comentarioId,
                "likedByMe",
                estado.likedByMe(),
                "totalLikes",
                estado.totalLikes());
    }
}
