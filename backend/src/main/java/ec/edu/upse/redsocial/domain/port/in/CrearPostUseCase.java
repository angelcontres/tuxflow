package ec.edu.upse.redsocial.domain.port.in;

public interface CrearPostUseCase {
    String crearPost(String autorId, String autorUsername, String texto, String mediaUrl);

    void reaccionarPost(String userId, String postId);

    Object obtenerTendencias(String userId);
}
