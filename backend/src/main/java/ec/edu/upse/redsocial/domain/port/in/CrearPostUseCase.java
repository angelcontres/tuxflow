package ec.edu.upse.redsocial.domain.port.in;

public interface CrearPostUseCase {
    String crearPost(String autorId, String autorUsername, String texto, String mediaUrl);

    /**
     * Registra la reacción de tipo like de forma idempotente.
     *
     * @return el total de reacciones de la publicación tras registrar la nueva
     */
    int reaccionarPost(String userId, String postId);

    Object obtenerTendencias(String userId);
}
