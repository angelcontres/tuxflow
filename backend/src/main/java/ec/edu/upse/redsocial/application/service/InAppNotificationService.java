package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.model.NotificacionInApp;
import ec.edu.upse.redsocial.domain.port.in.InAppNotificationUseCase;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.SseNotificationManager;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class InAppNotificationService implements InAppNotificationUseCase {

    @Inject GrafoPersistencePort grafoPersistencePort;
    @Inject SseNotificationManager sseManager;

    @Override
    public List<NotificacionInApp> obtenerHistorial(String userId) {
        return grafoPersistencePort.obtenerNotificacionesInApp(userId);
    }

    @Override
    public long obtenerConteoNoLeidas(String userId) {
        return grafoPersistencePort.obtenerConteoNoLeidas(userId);
    }

    @Override
    public void marcarLeida(String userId, String notificacionId) {
        grafoPersistencePort.marcarComoLeida(userId, notificacionId);
    }

    @Override
    public void notificarSeguidoresNuevoPost(String autorId, String autorUsername, String postTexto, String postId) {
        List<String> seguidores = grafoPersistencePort.obtenerSeguidoresId(autorId);
        String titulo = autorUsername + " ha posteado";
        for (String seguidorId : seguidores) {
            emitirNotificacion(seguidorId, "POST", titulo, postTexto, "/posts/" + postId);
        }
    }

    @Override
    public void notificarNuevaReaccion(String actorId, String postId, String tipoReaccion) {
        String autorId = grafoPersistencePort.obtenerAutorDePost(postId);
        if (autorId == null || autorId.equals(actorId)) {
            return; // No notificar si el post no existe o si es una auto-reacción
        }
        
        grafoPersistencePort.obtenerUsuarioPorId(actorId).ifPresent(actor -> {
            String accion = tipoReaccion.equalsIgnoreCase("LIKE") ? "like" : "dislike";
            String titulo = actor.getUsername() + " ha dado " + accion + " a tu post";
            String mensaje = "Mira la reacción en tu post.";
            emitirNotificacion(autorId, tipoReaccion.toUpperCase(), titulo, mensaje, "/posts/" + postId);
        });
    }

    @Override
    public void emitirNotificacion(String destinatarioId, String tipo, String titulo, String mensaje, String url) {
        NotificacionInApp n = new NotificacionInApp();
        n.setId(UUID.randomUUID().toString());
        n.setTipo(tipo);
        n.setTitulo(titulo);
        n.setMensaje(mensaje);
        n.setUrl(url);
        n.setLeido(false);
        n.setFechaCreacion(System.currentTimeMillis());
        
        grafoPersistencePort.guardarNotificacionInApp(destinatarioId, n);
        sseManager.sendNotification(destinatarioId, n);
    }
}
