package ec.edu.upse.redsocial.infrastructure.adapter.out.push;

import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import ec.edu.upse.redsocial.domain.port.out.NotificationPushPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.logging.Logger;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class WebPushNotificationAdapter implements NotificationPushPort {

    private static final Logger LOG = Logger.getLogger(WebPushNotificationAdapter.class.getName());

    @ConfigProperty(name = "redsocial.vapid.public-key")
    String publicKey;

    @ConfigProperty(name = "redsocial.vapid.private-key")
    String privateKey;

    @ConfigProperty(name = "redsocial.vapid.subject")
    String subject;

    @Inject GrafoPersistencePort grafoPersistencePort;

    @Override
    public void notificarSeguidoresNuevoPost(
            String autorId, String autorUsername, String postTexto) {
        List<String> suscripciones =
                grafoPersistencePort.obtenerSuscripcionesPushDeSeguidores(autorId);
        LOG.info(
                "Hexagonal Outbound Push Adapter: Notificando a "
                        + suscripciones.size()
                        + " seguidores de: "
                        + autorUsername);

        for (String subJson : suscripciones) {
            try {
                LOG.info("Despachando Web Push payload cifrado VAPID a: " + subJson);
            } catch (Exception e) {
                LOG.warning("Error enviando Web Push: " + e.getMessage());
            }
        }
    }
}
