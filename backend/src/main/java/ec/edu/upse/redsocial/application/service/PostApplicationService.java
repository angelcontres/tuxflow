package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
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
        notificationPushPort.notificarSeguidoresNuevoPost(autorId, autorUsername, texto, postId);

        return postId;
    }

    @Override
    public EstadoReaccion reaccionarPost(String userId, String postId) {
        // El like es idempotente y excluyente con el dislike: repetir la llamada no duplica la
        // relación y borra la contraria. El estado devuelto permite que la tarjeta concilie ambos
        // contadores con el dato real del grafo.
        return grafoPersistencePort.registrarLike(userId, postId);
    }

    @Override
    public EstadoReaccion reaccionarDislike(String userId, String postId) {
        // Espejo del like con tipo DISLIKE: el estado devuelto trae ambos totales.
        return grafoPersistencePort.registrarDislike(userId, postId);
    }

    @Override
    public EstadoReaccion quitarLike(String userId, String postId) {
        return grafoPersistencePort.retirarLike(userId, postId);
    }

    @Override
    public EstadoReaccion quitarDislike(String userId, String postId) {
        return grafoPersistencePort.retirarDislike(userId, postId);
    }

    @Override
    public Object obtenerTendencias(String userId) {
        return grafoPersistencePort.obtenerTendenciasRedExtendida(userId);
    }
}
