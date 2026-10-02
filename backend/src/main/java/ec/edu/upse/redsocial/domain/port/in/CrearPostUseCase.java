package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.Post;
import java.util.List;

public interface CrearPostUseCase {
    String crearPost(String autorId, String autorUsername, String texto, String mediaUrl);

    void reaccionarPost(String userId, String postId);

    Object obtenerTendencias(String userId);

    /**
     * Publicaciones de un autor, de la más nueva a la más antigua.
     *
     * <p>`viewerId` es opcional y sólo cambia el campo `likedByMe` de cada publicación: sin él, no
     * hay quién mirar y todas llegan sin la reacción marcada.
     */
    List<Post> obtenerPostsDeUsuario(String autorId, String viewerId);
}
