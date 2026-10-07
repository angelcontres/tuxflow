package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.ConversacionChat;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.model.ResultadoEnvio;
import java.util.List;

/**
 * Caso de entrada del chat 1 a 1: enviar un mensaje en tiempo real, recuperar el historial de una
 * conversación y listar las conversaciones del usuario.
 */
public interface GestionarChatUseCase {

    /**
     * Envía un mensaje de un emisor a un destinatario y devuelve el resultado del despacho.
     *
     * <p>La implementación valida los datos, conserva el mensaje y lo despacha, en ese orden. El
     * orden importa: si se despachara antes de conservar, un destinatario ausente perdería el
     * mensaje.
     *
     * @param emisorId el remitente, tomado siempre de la ruta de conexión y nunca del cuerpo
     * @param destinatarioId a quién se envía; no puede estar vacío ni coincidir con el emisor
     * @param contenido el texto, que no puede estar vacío ni ser solo espacios
     * @return el desenlace, con el motivo cuando no se entrega
     */
    ResultadoEnvio enviar(String emisorId, String destinatarioId, String contenido);

    /**
     * Mensajes de una conversación en ambos sentidos, del más antiguo al más reciente.
     *
     * @param usuarioA un participante de la conversación
     * @param usuarioB el otro participante; debe ser distinto de {@code usuarioA}
     * @return la lista, vacía si la pareja nunca se escribió
     */
    List<MensajeChat> historial(String usuarioA, String usuarioB);

    /**
     * Bandeja de conversaciones del usuario: una fila por interlocutor, con su último mensaje.
     *
     * <p>Va por HTTP y no por el canal porque es una consulta, no un suceso: el socket entrega
     * mensajes según llegan y no admite "¿con quién he hablado?". Es lo que permite abrir el chat
     * sin escribir el identificador de nadie a mano.
     *
     * @param usuarioId quien abre su bandeja
     * @return las conversaciones, de la más reciente a la más antigua; vacía si nunca se escribió
     *     con nadie
     */
    List<ConversacionChat> conversaciones(String usuarioId);
}
