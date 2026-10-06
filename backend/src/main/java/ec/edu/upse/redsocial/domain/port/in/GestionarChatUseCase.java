package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.model.ResultadoEnvio;
import java.util.List;

/**
 * Caso de entrada del chat 1 a 1: enviar un mensaje en tiempo real y recuperar el historial de una
 * conversación.
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
}
