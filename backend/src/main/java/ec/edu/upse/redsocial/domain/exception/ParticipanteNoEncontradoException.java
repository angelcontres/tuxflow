package ec.edu.upse.redsocial.domain.exception;

/**
 * Se lanza cuando un mensaje de chat menciona a un usuario que no existe.
 *
 * <p>Existe aparte de {@link AutorNoEncontradoException} por el texto que ve el usuario. Al
 * escribir a alguien inexistente, si se reutilizara la excepción del autor, el motivo diría "el
 * autor no existe" y apuntaría al emisor, que sí existe: el cliente buscaría un problema en sí
 * mismo y no en el destinatario que se equivocó al escribir. Aquí la excepción nombra a quien
 * falta, que es el dato accionable.
 */
public class ParticipanteNoEncontradoException extends RuntimeException {

    private final String participanteId;

    public ParticipanteNoEncontradoException(String participanteId) {
        super("El participante '" + participanteId + "' no existe");
        this.participanteId = participanteId;
    }

    public String getParticipanteId() {
        return participanteId;
    }
}
