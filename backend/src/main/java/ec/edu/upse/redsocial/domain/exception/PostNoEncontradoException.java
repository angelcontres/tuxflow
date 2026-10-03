package ec.edu.upse.redsocial.domain.exception;

/**
 * Se lanza cuando se intenta operar sobre una publicación que no existe en el grafo.
 *
 * <p>En una reacción el Cypher hace un único {@code MATCH} sobre usuario y publicación, así que
 * cuando no devuelve filas no se puede saber cuál de los dos falta. La excepción nombra el objetivo
 * de la reacción y el mensaje de la capa HTTP no expone identificadores internos.
 */
public class PostNoEncontradoException extends RuntimeException {

    private final String postId;

    public PostNoEncontradoException(String postId) {
        super("La publicación '" + postId + "' no existe");
        this.postId = postId;
    }

    public String getPostId() {
        return postId;
    }
}
