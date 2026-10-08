package ec.edu.upse.redsocial.domain.exception;

/**
 * El comentario indicado no existe, o el padre de una respuesta no es válido.
 *
 * <p>Cubre los tres casos que el borde de escritura no puede distinguir sin otra lectura:
 * comentario inexistente, padre inexistente y padre que pertenece a otra publicación. El mapper los
 * traduce a un 404 genérico que no repite el identificador.
 */
public class ComentarioNoEncontradoException extends RuntimeException {

    private final String comentarioId;

    public ComentarioNoEncontradoException(String comentarioId) {
        super("El comentario no existe: " + comentarioId);
        this.comentarioId = comentarioId;
    }

    public String getComentarioId() {
        return comentarioId;
    }
}
