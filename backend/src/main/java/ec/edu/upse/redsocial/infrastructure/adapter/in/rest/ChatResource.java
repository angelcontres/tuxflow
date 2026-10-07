package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.port.in.GestionarChatUseCase;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.ConversacionChatResponse;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/**
 * Historial de las conversaciones de chat.
 *
 * <p>El historial va por HTTP y el tiempo real por el canal. No es duplicación: la regla es que el
 * socket transporta y HTTP recupera. Cargar el historial por el socket obligaría a que el canal
 * dependiera de la base de datos, y un canal que entrega en milisegundos no debería bloquearse
 * esperando una consulta.
 */
@Path("/api/chat")
@Produces(MediaType.APPLICATION_JSON)
public class ChatResource {

    @Inject GestionarChatUseCase gestionarChatUseCase;

    /**
     * Mensajes de una pareja en ambos sentidos, del más antiguo al más reciente.
     *
     * <p>Los dos participantes van como parámetros y no como un identificador de conversación
     * porque una conversación 1 a 1 no tiene clave propia en el grafo. Por eso la consulta los
     * trata como conjunto simétrico: si los filtrara como par ordenado, el historial saldría
     * completo para uno de los dos participantes y vacío para el otro.
     *
     * <p>Devuelve el modelo de dominio y no un DTO, siguiendo el criterio de {@code FeedResource}:
     * {@code MensajeChat} no lleva contraseña ni suscripción push, así que no hay nada que
     * esconder.
     *
     * @return la lista, vacía con 200 si la pareja nunca se escribió
     */
    @GET
    @Path("/historial")
    public Response obtenerHistorial(
            @QueryParam("userA") String userA, @QueryParam("userB") String userB) {
        // Sin esta validación la consulta correría con parámetros ausentes y no encontraría nada:
        // la
        // respuesta sería 200 con la lista vacía, idéntica a la de una pareja que nunca se
        // escribió, y
        // el cliente no podría distinguir un resultado legítimo de una llamada mal formada. Es el
        // mismo
        // motivo por el que /api/users/comunes responde 400 en vez de devolver la lista vacía.
        if (userA == null || userA.isBlank() || userB == null || userB.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Los campos 'userA' y 'userB' son obligatorios"))
                    .build();
        }

        // Una conversación consigo mismo no es una pregunta que el endpoint pueda responder bien:
        // la
        // consulta trataría los dos lados como la misma persona y devolvería respuestas como si
        // fueran
        // mensajes de un tercero.
        if (userA.equals(userB)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(
                            Map.of(
                                    "error",
                                    "Elige dos identificadores distintos para ver el historial"))
                    .build();
        }

        return Response.ok(gestionarChatUseCase.historial(userA, userB)).build();
    }

    /**
     * Bandeja de conversaciones de un usuario, con el último mensaje de cada una.
     *
     * <p>Es lo que permite abrir el chat sin escribir el identificador de nadie a mano: antes había
     * que teclearlo, y quien no probara eso no tenía forma de saber con quién había hablado.
     *
     * <p>Devuelve un DTO y no el modelo de dominio, al contrario que el historial. La fila de la
     * bandeja es una persona con nombre y avatar, y fijar el contrato aquí evita arrastrar el
     * dominio a la pantalla; ver {@link ConversacionChatResponse} para el detalle. El historial se
     * queda con el modelo porque {@code MensajeChat} no lleva nada que esconder.
     *
     * <p>El identificador va como parámetro de consulta y no se toma de un token porque el resto de
     * la API tampoco lo hace: {@code /users/{userId}/follows} y el propio historial reciben la
     * identidad por parámetro. Cuando haya autenticación de verdad en el servidor, este endpoint
     * cambia de la misma manera que los demás, y no antes.
     *
     * @return las conversaciones, de la más reciente a la más antigua
     */
    @GET
    @Path("/conversaciones")
    public Response obtenerConversaciones(@QueryParam("userId") String userId) {
        // Sin esta validación la consulta correría sin interlocutor y no devolvería nada: la
        // respuesta sería 200 con la bandeja vacía, idéntica a la de quien nunca ha escrito con
        // nadie, y el cliente no podría distinguir un resultado legítimo de una llamada mal
        // formada. Es el mismo motivo por el que el historial y /api/users/comunes responden 400.
        if (userId == null || userId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'userId' es obligatorio"))
                    .build();
        }

        return Response.ok(
                        gestionarChatUseCase.conversaciones(userId).stream()
                                .map(ConversacionChatResponse::from)
                                .toList())
                .build();
    }
}
