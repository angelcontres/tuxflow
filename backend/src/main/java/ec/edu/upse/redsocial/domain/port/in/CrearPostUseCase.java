package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.EstadoReaccion;

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
}
