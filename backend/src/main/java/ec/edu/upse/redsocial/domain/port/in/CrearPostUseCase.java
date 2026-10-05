package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
import ec.edu.upse.redsocial.domain.model.Post;
import java.util.List;

public interface CrearPostUseCase {
    String crearPost(String autorId, String autorUsername, String texto, String mediaUrl);

    /**
     * Registra la reacción de tipo like de forma idempotente y mutuamente excluyente con el
     * dislike.
     *
     * @return el estado completo de reacciones tras registrar la nueva
     */
    EstadoReaccion reaccionarPost(String userId, String postId);

    /**
     * Registra la reacción de tipo dislike de forma idempotente, espejo de {@link #reaccionarPost}.
     *
     * @return el estado completo de reacciones tras registrar la nueva
     */
    EstadoReaccion reaccionarDislike(String userId, String postId);

    /**
     * Retira el like del usuario. Idempotente: si no había reacción devuelve el estado sin cambios.
     */
    EstadoReaccion quitarLike(String userId, String postId);

    /**
     * Retira el dislike del usuario. Idempotente: si no había reacción devuelve el estado sin
     * cambios.
     */
    EstadoReaccion quitarDislike(String userId, String postId);

    Object obtenerTendencias(String userId);

    /**
     * Publicaciones de un autor, de la más nueva a la más antigua.
     *
     * <p>`viewerId` es opcional y sólo cambia el campo `likedByMe` de cada publicación: sin él, no
     * hay quién mirar y todas llegan sin la reacción marcada.
     */
    List<Post> obtenerPostsDeUsuario(String autorId, String viewerId);
}
