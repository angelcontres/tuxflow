package ec.edu.upse.redsocial.infrastructure.adapter.out.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import ec.edu.upse.redsocial.domain.port.out.NotificationPushPort;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.control.ActivateRequestContext;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Logger;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.apache.http.HttpResponse;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jose4j.lang.JoseException;

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

    private PushService pushService;

    @PostConstruct
    void init() {
        if (publicKey == null || privateKey == null || publicKey.isBlank() || privateKey.isBlank()) {
            LOG.warning(
                    "Faltan claves VAPID (redsocial.vapid.public-key/private-key). Las notificaciones push NO funcionarán.");
        } else {
            try {
                pushService = new PushService(publicKey, privateKey, subject);
            } catch (Exception e) {
                LOG.warning("No se pudo inicializar PushService VAPID: " + e.getMessage());
            }
        }
    }

    @Override
    public void notificarSeguidoresNuevoPost(
            String autorId, String autorUsername, String postTexto) {
        notificarSeguidoresNuevoPost(autorId, autorUsername, postTexto, null);
    }

    @Override
    @ActivateRequestContext
    public void notificarSeguidoresNuevoPost(
            String autorId, String autorUsername, String postTexto, String postId) {
        List<String> suscripciones =
                grafoPersistencePort.obtenerSuscripcionesPushDeSeguidores(autorId);
        LOG.info(
                "Hexagonal Outbound Push Adapter: Notificando a "
                        + suscripciones.size()
                        + " seguidores de: "
                        + autorUsername);

        if (pushService == null || suscripciones.isEmpty()) {
            return;
        }

        String titulo = autorUsername != null && !autorUsername.isBlank()
                ? autorUsername
                : "Nueva publicación";
        String cuerpo = postTexto != null && !postTexto.isBlank() ? postTexto : "";

        for (String subJson : suscripciones) {
            CompletableFuture.runAsync(
                    () -> {
                        try {
                            Map<String, Object> data = new HashMap<>();
                            data.put("title", titulo);
                            data.put("body", cuerpo);
                            if (postId != null) {
                                data.put("postId", postId);
                            }
                            data.put("authorUsername", autorUsername);

                            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                            nl.martijndwars.webpush.Subscription subscription =
                                    mapper.readValue(subJson, nl.martijndwars.webpush.Subscription.class);
                            Notification notification =
                                    new Notification(subscription, mapper.writeValueAsString(data));

                            HttpResponse response = pushService.send(notification);
                            int status = response.getStatusLine().getStatusCode();
                            if (status == HttpURLConnection.HTTP_GONE
                                    || status == HttpURLConnection.HTTP_NOT_FOUND) {
                                try {
                                    grafoPersistencePort.eliminarSuscripcionPush(autorId, subJson);
                                    LOG.info(
                                            "Suscripción push inválida eliminada para autor/seguidor (respuesta "
                                                    + status
                                                    + ")");
                                } catch (Exception ex) {
                                    LOG.warning("Error al eliminar suscripción push: " + ex.getMessage());
                                }
                            } else if (status < 200 || status >= 300) {
                                LOG.warning(
                                        "Web Push respondió con estado no exitoso: " + status);
                            }
                        } catch (IOException | JoseException e) {
                            String msg = e.getMessage();
                            boolean invalid = msg != null
                                    && (msg.contains("404") || msg.contains("410") || msg.contains("Gone") || msg.contains("gone"));
                            if (invalid) {
                                try {
                                    grafoPersistencePort.eliminarSuscripcionPush(autorId, subJson);
                                    LOG.info("Suscripción push inválida eliminada (excepción): " + msg);
                                } catch (Exception ex) {
                                    LOG.warning("Error al eliminar suscripción push: " + ex.getMessage());
                                }
                            } else {
                                LOG.warning("Error enviando Web Push (transitorio): " + msg);
                            }
                        } catch (Exception e) {
                            String msg = e.getMessage();
                            LOG.warning("Error inesperado enviando Web Push: " + msg);
                        }
                    });
        }
    }
}
