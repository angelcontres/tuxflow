package ec.edu.upse.redsocial.domain.exception;

/** Se lanza cuando se intenta operar sobre un usuario que no existe en el grafo. */
public class AutorNoEncontradoException extends RuntimeException {

    private final String autorId;

    public AutorNoEncontradoException(String autorId) {
        super("El autor '" + autorId + "' no existe");
        this.autorId = autorId;
    }

    public String getAutorId() {
        return autorId;
    }
}
