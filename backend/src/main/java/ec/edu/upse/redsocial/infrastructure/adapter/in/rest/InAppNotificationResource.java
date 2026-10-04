package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.NotificacionInApp;
import ec.edu.upse.redsocial.domain.port.in.InAppNotificationUseCase;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.List;

@Path("/api/in-app-notifications")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class InAppNotificationResource {

    @Inject InAppNotificationUseCase useCase;
    @Inject SseNotificationManager sseManager;

    @GET
    public List<NotificacionInApp> getHistorial(@QueryParam("userId") String userId) {
        return useCase.obtenerHistorial(userId);
    }

    @GET
    @Path("/unread-count")
    public Response getUnreadCount(@QueryParam("userId") String userId) {
        long count = useCase.obtenerConteoNoLeidas(userId);
        return Response.ok(count).build();
    }

    @PUT
    @Path("/{id}/read")
    public Response markAsRead(@PathParam("id") String id, @QueryParam("userId") String userId) {
        useCase.marcarLeida(userId, id);
        return Response.ok().build();
    }

    @GET
    @Path("/stream")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    public void stream(
            @QueryParam("userId") String userId,
            @Context SseEventSink eventSink,
            @Context Sse sse) {
        sseManager.register(userId, eventSink, sse);
    }
}
