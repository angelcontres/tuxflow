package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.NotificacionInApp;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseBroadcaster;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class SseNotificationManager {

    private final ConcurrentHashMap<String, SseBroadcaster> broadcasters =
            new ConcurrentHashMap<>();
    private Sse sse;

    public void setSse(Sse sse) {
        this.sse = sse;
    }

    public void register(String userId, SseEventSink eventSink, Sse sseContext) {
        if (this.sse == null) {
            this.sse = sseContext;
        }
        SseBroadcaster broadcaster =
                broadcasters.computeIfAbsent(userId, k -> sse.newBroadcaster());
        broadcaster.register(eventSink);
    }

    public void sendNotification(String userId, NotificacionInApp notificacion) {
        if (sse == null) {
            return;
        }
        SseBroadcaster broadcaster = broadcasters.get(userId);
        if (broadcaster != null) {
            OutboundSseEvent event =
                    sse.newEventBuilder()
                            .name("notification")
                            .mediaType(MediaType.APPLICATION_JSON_TYPE)
                            .data(notificacion)
                            .build();
            broadcaster.broadcast(event);
        }
    }
}
