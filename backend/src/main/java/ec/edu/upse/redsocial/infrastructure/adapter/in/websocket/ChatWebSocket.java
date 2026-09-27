package ec.edu.upse.redsocial.infrastructure.adapter.in.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.*;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

@ServerEndpoint("/chat/{userId}")
@ApplicationScoped
public class ChatWebSocket {

    private static final Logger LOG = Logger.getLogger(ChatWebSocket.class.getName());
    private static final Map<String, Session> sesionesActivas = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    @OnOpen
    public void onOpen(Session session, @PathParam("userId") String userId) {
        sesionesActivas.put(userId, session);
        LOG.info("Adaptador WebSocket: Sesión abierta para usuario " + userId);
    }

    @OnClose
    public void onClose(Session session, @PathParam("userId") String userId) {
        sesionesActivas.remove(userId);
        LOG.info("Adaptador WebSocket: Sesión cerrada para usuario " + userId);
    }

    @OnError
    public void onError(Session session, @PathParam("userId") String userId, Throwable throwable) {
        sesionesActivas.remove(userId);
        LOG.warning(
                "Adaptador WebSocket: Error en sesión de "
                        + userId
                        + ": "
                        + throwable.getMessage());
    }

    @OnMessage
    public void onMessage(String mensajeJson, @PathParam("userId") String remitenteId) {
        try {
            MensajeChat mensaje = mapper.readValue(mensajeJson, MensajeChat.class);
            mensaje.setEmisorId(remitenteId);

            Session sesionDestinatario = sesionesActivas.get(mensaje.getDestinatarioId());
            if (sesionDestinatario != null && sesionDestinatario.isOpen()) {
                String payload = mapper.writeValueAsString(mensaje);
                sesionDestinatario.getAsyncRemote().sendText(payload);
                LOG.info("Mensaje enrutado en tiempo real hacia " + mensaje.getDestinatarioId());
            } else {
                LOG.info("Destinatario " + mensaje.getDestinatarioId() + " no conectado");
            }
        } catch (IOException e) {
            LOG.severe("Error parseando mensaje WebSocket: " + e.getMessage());
        }
    }
}
