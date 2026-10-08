package ec.edu.upse.redsocial.infrastructure.adapter.in.websocket.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.model.ResultadoEnvio;

/**
 * DTO del frame de chat que viaja por el canal, en las dos direcciones.
 *
 * <p>Es el mensaje más el desenlace del envío. No se serializa el modelo de dominio porque {@code
 * estado} y {@code motivo} no son propiedades del mensaje: son del intento de entregarlo. Ver
 * {@link ResultadoEnvio} para el motivo de esa separación.
 *
 * <p>Un único tipo para ambos sentidos a propósito. El frame que recibe el destinatario y el acuse
 * que recibe el emisor comparten forma, y si fueran dos clases distintas cualquier campo que se
 * añadiera a uno se olvidaría en el otro: el cliente terminaría con un tipo cuyo contrato no se
 * cumplía. El cliente trata {@code estado} y {@code motivo} como opcionales, que es lo que
 * corresponde, porque solo quien envía necesita saber el desenlace.
 *
 * <p>Los campos nulos no se serializan, y es una decisión de esta clase y no del mapa que la
 * serialice. El cliente usa la presencia de {@code estado} para distinguir un acuse de un mensaje
 * nuevo, así que un {@code "estado": null} en el frame de entrega lo convertiría en un acuse
 * huérfano y el mensaje se descartaría. Que el mapa global de Jackson decida si los nulos se
 * escriben deja ese comportamiento en manos de una configuración ajena a este contrato.
 *
 * <p>Se ubica en el adaptador del WebSocket y no en el de REST porque el historial HTTP devuelve el
 * modelo de dominio: {@link MensajeChat} no lleva ni contraseña ni suscripción push, así que no hay
 * nada que esconder, y el recurso sigue el criterio de {@code FeedResource}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MensajeChatResponse {

    private String id;
    private String emisorId;
    private String destinatarioId;
    private String contenido;
    private long timestamp;
    private ResultadoEnvio.Estado estado;
    private String motivo;

    public MensajeChatResponse() {}

    /**
     * Frame de salida, sin desenlace: es lo que llega al destinatario.
     *
     * <p>El campo {@code estado} se deja a propósito vacío. Es la única señal con la que el cliente
     * distingue un acuse de un mensaje nuevo: si el frame de entrega también lo trajera, el cliente
     * lo leería como un acuse, buscaría la burbuja a la que corresponde y, al no encontrar ninguna,
     * lo descartaría. El efecto sería que el destinatario no ve nunca los mensajes que le envían, y
     * ni el remitente ni el servidor se enterarían: para ellos el envío fue entregado.
     */
    public static MensajeChatResponse mensaje(MensajeChat mensaje) {
        MensajeChatResponse dto = new MensajeChatResponse();
        dto.desde(mensaje);
        return dto;
    }

    /**
     * Acuse al emisor: el mensaje tal como quedó, con el desenlace y el motivo si no se entregó.
     */
    public static MensajeChatResponse conResultado(MensajeChat mensaje, ResultadoEnvio resultado) {
        MensajeChatResponse dto = new MensajeChatResponse();
        dto.desde(mensaje);
        dto.estado = resultado.estado();
        dto.motivo = resultado.motivo();
        return dto;
    }

    private void desde(MensajeChat mensaje) {
        this.id = mensaje.getId();
        this.emisorId = mensaje.getEmisorId();
        this.destinatarioId = mensaje.getDestinatarioId();
        this.contenido = mensaje.getContenido();
        this.timestamp = mensaje.getTimestamp();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEmisorId() {
        return emisorId;
    }

    public void setEmisorId(String emisorId) {
        this.emisorId = emisorId;
    }

    public String getDestinatarioId() {
        return destinatarioId;
    }

    public void setDestinatarioId(String destinatarioId) {
        this.destinatarioId = destinatarioId;
    }

    public String getContenido() {
        return contenido;
    }

    public void setContenido(String contenido) {
        this.contenido = contenido;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public ResultadoEnvio.Estado getEstado() {
        return estado;
    }

    public void setEstado(ResultadoEnvio.Estado estado) {
        this.estado = estado;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }
}
