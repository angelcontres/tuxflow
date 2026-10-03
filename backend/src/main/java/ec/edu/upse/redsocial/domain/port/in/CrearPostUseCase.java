package ec.edu.upse.redsocial.domain.port.in;

public interface CrearPostUseCase {
    String crearPost(String autorId, String autorUsername, String texto, String mediaUrl);

    /**
     * Registra la reacción de tipo like de forma idempotente.
     *
     * @return el total de reacciones de la publicación tras registrar la nueva
     */
    int reaccionarPost(String userId, String postId);

    /**
     * Registra la reacción de tipo dislike de forma idempotente, espejo de {@link #reaccionarPost}.
     *
     * @return el total de dislikes de la publicación tras registrar la nueva
     */
    int reaccionarDislike(String userId, String postId);

    /** Retira el like del usuario. Idempotente: si no había reacción devuelve {@code false}. */
    boolean quitarLike(String userId, String postId);

    /** Retira el dislike del usuario. Idempotente: si no había reacción devuelve {@code false}. */
    boolean quitarDislike(String userId, String postId);

    Object obtenerTendencias(String userId);
}
