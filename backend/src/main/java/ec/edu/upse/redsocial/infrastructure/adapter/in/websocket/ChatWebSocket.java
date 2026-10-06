package ec.edu.upse.redsocial.infrastructure.adapter.in.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.model.ResultadoEnvio;
import ec.edu.upse.redsocial.domain.port.in.GestionarChatUseCase;
import ec.edu.upse.redsocial.infrastructure.adapter.in.websocket.dto.MensajeChatResponse;
import ec.edu.upse.redsocial.infrastructure.adapter.out.chat.SesionesChatAdapter;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.logging.Logger;

/**
 * Canal de chat 1 a 1. Un endpoint por conexión, en el que la identidad del emisor es el {@code
 * userId} de la ruta.
 *
 * <p>Su trabajo se mantiene deliberadamente estrecho: abrir y cerrar sesiones, traducir JSON a un
 * caso de uso y traducir el resultado a un acuse. Las reglas de validación, la persistencia y el
 * despacho viven en el servicio de aplicación y en el registro de sesiones. Esa separación no es
 * purismo: es lo que permite probar el rechazo de un mensaje y el fallo de entrega sin levantar el
 * contenedor de WebSockets, que es un punto de prueba caro.
 *
 * <p>El registro de sesiones no vive aquí. Antes era un mapa estático en esta clase, y por eso un
 * mismo usuario no podía tener dos pestañas.
 *
 * <p>La extensión del proyecto es {@code quarkus-websockets}, la de Jakarta WebSocket, que registra
 * las clases anotadas con {@code @ServerEndpoint} como beans de CDI. Por eso el alcance
 * {@code @ApplicationScoped} es real y la inyección funciona: hay una sola instancia para todas las
 * conexiones, y los datos de la conexión viajan como parámetro de los manejadores, nunca en campos
 * de la instancia.
 */
@ServerEndpoint("/chat/{userId}")
@ApplicationScoped
public class ChatWebSocket {

    private static final Logger LOG = Logger.getLogger(ChatWebSocket.class.getName());

    @Inject GestionarChatUseCase gestionarChatUseCase;

    @Inject SesionesChatAdapter sesionesChat;

    @Inject ObjectMapper mapper;

    @OnOpen
    public void onOpen(Session session, @PathParam("userId") String userId) {
        sesionesChat.registrar(userId, session);
    }

    /**
     * Retira del registro la sesión que se cierra, no el usuario.
     *
     * <p>Retirar el usuario entero era el defecto anterior: al cerrar la segunda pestaña del mismo
     * usuario se desregistraba también la primera, y quien la tenía dejaba de recibir mensajes.
     */
    @OnClose
    public void onClose(Session session, @PathParam("userId") String userId) {
        sesionesChat.retirar(userId, session);
    }

    /**
     * Un error de transporte cierra la sesión y la retira del registro.
     *
     * <p>Antes solo se retiraba del registro y se escribía una línea en el log. Una sesión que
     * queda viva en el registro pero inservible es peor que una ausente: el emisor sigue recibiendo
     * acuses de entregado hacia un socket que ya no responde.
     */
    @OnError
    public void onError(Session session, @PathParam("userId") String userId, Throwable throwable) {
        LOG.warning("Error en la sesión de chat de " + userId + ": " + throwable.getMessage());
        sesionesChat.retirar(userId, session);
        try {
            session.close();
        } catch (IOException e) {
            LOG.fine("La sesión de " + userId + " ya estaba cerrada: " + e.getMessage());
        }
    }

    /**
     * Traduce el mensaje entrante y devuelve el desenlace al emisor.
     *
     * <p>El {@code emisorId} del cuerpo se descarta siempre. La identidad es el {@code userId} de
     * la ruta, que es la conexión que el contenedor estableció: un cuerpo es texto que eligió quien
     * envía, y si se tomara de ahí, cualquiera podría escribir en nombre de otro con solo poner su
     * identificador en un campo.
     */
    @OnMessage
    public void onMessage(
            Session session, String mensajeJson, @PathParam("userId") String remitenteId) {
        MensajeChat entrante = deserializar(session, mensajeJson, remitenteId);
        if (entrante == null) {
            return;
        }

        ResultadoEnvio resultado =
                gestionarChatUseCase.enviar(
                        remitenteId, entrante.getDestinatarioId(), entrante.getContenido());

        enviarAcuse(session, resultado);
        registrarEnLog(resultado);
    }

    /**
     * Lee el cuerpo del frame y, si no se puede leer, acusa el rechazo al emisor.
     *
     * <p>Un cuerpo ilegible no es un rechazo de negocio: no se sabe ni el destinatario ni el texto,
     * así que no hay mensaje que construir para el caso de uso. Aun así se avisa, porque el error
     * silencioso sería que el emisor escribe y no ve nunca nada, sin ningún indicio de que su
     * mensaje está mal formado. El motivo es explícito sobre lo que no se sabe.
     *
     * @return el mensaje leído, o null si el cuerpo no se pudo interpretar
     */
    private MensajeChat deserializar(Session sesionEmisor, String mensajeJson, String remitenteId) {
        try {
            return mapper.readValue(mensajeJson, MensajeChat.class);
        } catch (IOException e) {
            LOG.warning(
                    "Cuerpo de chat ilegible recibido de " + remitenteId + ": " + e.getMessage());
            // El remitente es el de la ruta y no hay destinatario: es lo único que se sabe con
            // certeza.
            MensajeChat ilegible = new MensajeChat(null, remitenteId, null);
            enviarAcuse(
                    sesionEmisor,
                    ResultadoEnvio.rechazado(
                            ilegible, "El mensaje enviado no tiene un formato válido."));
            return null;
        }
    }

    /**
     * Devuelve el desenlace al emisor, que es quien necesita saberlo.
     *
     * <p>Es el punto que cierra el hueco que tenía el canal: antes el emisor agregaba su mensaje a
     * la lista de forma optimista y el servidor nunca respondía, así que un envío a un destinatario
     * desconectado se veía igual que un envío entregado. El destinatario no recibe este frame,
     * porque el mensaje ya le llegó por su propio camino y no necesita enterarse del acuse.
     */
    private void enviarAcuse(Session sesionEmisor, ResultadoEnvio resultado) {
        try {
            String acuse =
                    mapper.writeValueAsString(
                            MensajeChatResponse.conResultado(resultado.mensaje(), resultado));
            sesionEmisor.getAsyncRemote().sendText(acuse);
        } catch (Exception e) {
            // El acuse es lo que impide que el emisor crea entregado lo que no lo está. Si falla,
            // no
            // hay forma de avisarle desde el canal, así que al menos queda en el log del servidor.
            LOG.warning(
                    "No se pudo enviar el acuse de " + resultado.estado() + ": " + e.getMessage());
        }
    }

    /** Los tres desenlaces quedan en el registro del servidor, no solo uno de ellos. */
    private void registrarEnLog(ResultadoEnvio resultado) {
        switch (resultado.estado()) {
            case ENTREGADO ->
                    LOG.info(
                            "Entregado a "
                                    + resultado.mensaje().getDestinatarioId()
                                    + " el mensaje "
                                    + resultado.mensaje().getId());
            case NO_ENTREGADO ->
                    LOG.info(
                            "No entregado a "
                                    + resultado.mensaje().getDestinatarioId()
                                    + ", conservado para el historial");
            case RECHAZADO ->
                    LOG.info(
                            "Rechazado el mensaje de "
                                    + resultado.mensaje().getEmisorId()
                                    + ": "
                                    + resultado.motivo());
        }
    }
}
