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
    public int reaccionarPost(String userId, String postId) {
        // El like es idempotente: repetir la llamada no duplica la relación. El total devuelto
        // permite que la tarjeta concilie su contador optimista con el dato real del grafo.
        return grafoPersistencePort.registrarLike(userId, postId);
    }

    @Override
    public int reaccionarDislike(String userId, String postId) {
        // Espejo del like con tipo DISLIKE: el total devuelto es solo de dislikes.
        return grafoPersistencePort.registrarDislike(userId, postId);
    }

    @Override
    public boolean quitarLike(String userId, String postId) {
        return grafoPersistencePort.retirarLike(userId, postId);
    }

    @Override
    public boolean quitarDislike(String userId, String postId) {
        return grafoPersistencePort.retirarDislike(userId, postId);
    }

    @Override
    public Object obtenerTendencias(String userId) {
        return grafoPersistencePort.obtenerTendenciasRedExtendida(userId);
    }
}
