package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.port.in.CrearPostUseCase;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import ec.edu.upse.redsocial.domain.port.out.NotificationPushPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

@ApplicationScoped
public class PostApplicationService implements CrearPostUseCase {

    @Inject GrafoPersistencePort grafoPersistencePort;

    @Inject NotificationPushPort notificationPushPort;

    @Override
    public String crearPost(String autorId, String autorUsername, String texto, String mediaUrl) {
        String postId = UUID.randomUUID().toString();
        grafoPersistencePort.crearPost(autorId, postId, texto, mediaUrl);

        // Notificación Web Push a seguidores mediante el puerto de salida
        notificationPushPort.notificarSeguidoresNuevoPost(autorId, autorUsername, texto);

        return postId;
    }

    @Override
    public void reaccionarPost(String userId, String postId) {
        grafoPersistencePort.alternarLike(userId, postId);
    }

    @Override
    public Object obtenerTendencias(String userId) {
        return grafoPersistencePort.obtenerTendenciasRedExtendida(userId);
    }
}
