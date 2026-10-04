package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.NotificacionInApp;
import java.util.List;

public interface InAppNotificationUseCase {
    List<NotificacionInApp> obtenerHistorial(String userId);
    long obtenerConteoNoLeidas(String userId);
    void marcarLeida(String userId, String notificacionId);
    void notificarSeguidoresNuevoPost(String autorId, String autorUsername, String postTexto, String postId);
    void emitirNotificacion(String destinatarioId, String tipo, String titulo, String mensaje, String url);
}
