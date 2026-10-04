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
        for (String seguidorId : seguidores) {
            NotificacionInApp n = new NotificacionInApp();
            n.setId(UUID.randomUUID().toString());
            n.setTipo("POST");
            n.setTitulo(autorUsername);
            n.setMensaje(postTexto);
            n.setUrl("/posts/" + postId);
            n.setLeido(false);
            n.setFechaCreacion(System.currentTimeMillis());
            
            grafoPersistencePort.guardarNotificacionInApp(seguidorId, n);
            sseManager.sendNotification(seguidorId, n);
        }
    }
}
