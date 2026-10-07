package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.logging.Logger;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/notifications")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class NotificationResource {

    private static final Logger LOG = Logger.getLogger(NotificationResource.class.getName());

    @Inject GrafoPersistencePort grafoPersistencePort;

    @ConfigProperty(name = "redsocial.vapid.public-key")
    String publicKey;

    @POST
    @Path("/subscribe")
    public Response subscribe(Map<String, Object> request) {
        String userId = request != null ? (String) request.get("userId") : null;
        Object subscriptionObj = request != null ? request.get("subscription") : null;

        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }
        if (subscriptionObj == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "La suscripción push es obligatoria"))
                    .build();
        }

        Map<String, Object> subMap =
                subscriptionObj instanceof Map
                        ? (Map<String, Object>) subscriptionObj
                        : new com.fasterxml.jackson.databind.ObjectMapper()
                                .convertValue(subscriptionObj, Map.class);

        if (!subMap.containsKey("endpoint") || !subMap.containsKey("keys")) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "La suscripción debe contener 'endpoint' y 'keys'"))
                    .build();
        }

        try {
            String subscriptionJson =
                    subscriptionObj instanceof String
                            ? (String) subscriptionObj
                            : new com.fasterxml.jackson.databind.ObjectMapper()
                                    .writeValueAsString(subscriptionObj);
            grafoPersistencePort.guardarSuscripcionPush(userId, subscriptionJson);
            return Response.ok(Map.of("mensaje", "Suscripción registrada correctamente")).build();
        } catch (Exception e) {
            LOG.warning("Error al guardar suscripción push: " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", "No se pudo registrar la suscripción"))
                    .build();
        }
    }

    @GET
    @Path("/vapid-public-key")
    public Response getVapidPublicKey() {
        if (publicKey == null || publicKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", "Clave pública VAPID no configurada"))
                    .build();
        }
        return Response.ok(Map.of("publicKey", publicKey)).build();
    }
}
