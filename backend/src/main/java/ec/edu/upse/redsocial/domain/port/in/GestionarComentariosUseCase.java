package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.Comentario;
import ec.edu.upse.redsocial.domain.model.EstadoComentario;
import java.util.List;

public interface GestionarComentariosUseCase {

    /**
     * Crea un comentario de una publicación y lo devuelve completo.
     *
     * <p>{@code parentId} opcional sólo admite un comentario de primer nivel de la misma
     * publicación: la anidación es de un solo nivel, como la del hilo de Instagram. Un padre
     * inexistente o de otra publicación es un 404, no un comentario huérfano que nunca se vería.
     *
     * @throws ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException si el autor no
     *     existe
     * @throws ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException si la publicación no
     *     existe
     * @throws ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException si el padre no
     *     es válido
     */
    Comentario crearComentario(String userId, String postId, String texto, String parentId);

    /**
     * Comentarios de una publicación, del más antiguo al más reciente.
     *
     * @param viewerId opcional: sin él ningún comentario llega marcado como "me gusta"
     */
    List<Comentario> obtenerComentarios(String postId, String viewerId);

    /**
     * Registra el like de un comentario de forma idempotente.
     *
     * @return total de likes tras registrar
     * @throws ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException si no existe
     */
    EstadoComentario likeComentario(String userId, String comentarioId);

    /** Retira el like de un comentario. Idempotente: retirar lo que no existe no falla. */
    EstadoComentario quitarLikeComentario(String userId, String comentarioId);
}
