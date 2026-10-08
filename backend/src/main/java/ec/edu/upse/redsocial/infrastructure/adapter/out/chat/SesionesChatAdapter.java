package ec.edu.upse.redsocial.infrastructure.adapter.out.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.port.out.CanalChatPort;
import ec.edu.upse.redsocial.infrastructure.adapter.in.websocket.dto.MensajeChatResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.Session;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Registro de sesiones abiertas y despacho del chat.
 *
 * <p>El registro es un conjunto de sesiones por usuario y no una sola sesión. El motivo es
 * concreto: con un único slot, la segunda pestaña del mismo usuario sobrescribía a la primera, y el
 * {@code @OnClose} retiraba la clave del usuario sin comprobar a qué sesión pertenecía. Al cerrar
 * la segunda pestaña, la primera quedaba desregistrada y su dueño dejaba de recibir mensajes sin
 * haber cerrado nada. El defecto no aparece probando con dos personas distintas, que es como se
 * probaba el canal: necesita dos pestañas del mismo usuario.
 *
 * <p>La clave del usuario desaparece solo cuando su conjunto de sesiones queda vacío, de modo que
 * cerrar una pestaña no desconecta a la persona que la tenía.
 */
@ApplicationScoped
public class SesionesChatAdapter implements CanalChatPort {

    private static final Logger LOG = Logger.getLogger(SesionesChatAdapter.class.getName());

    /**
     * Sesiones abiertas por identificador de usuario.
     *
     * <p>El conjunto es un {@code Set} de identidad por sesión. La clave interna de cada sesión es
     * su identificador de conexión, así que dos pestañas del mismo usuario son dos entradas
     * distintas.
     */
    private final Map<String, Set<Session>> sesionesPorUsuario = new ConcurrentHashMap<>();

    /**
     * El mapa de Quarkus para serializar, no uno nuevo: el canal debe usar la misma configuración
     * de Jackson que el resto de la aplicación, y crear un mapper propio aquí la ignoraría en
     * silencio.
     *
     * <p>El campo no es privado a propósito. Lo rellena CDI al construir el bean, y lo necesita
     * además una prueba suelta que arma el adaptador a mano, sin contenedor. Hacerlo privado
     * obligaría a esa prueba a Reflection, que es más frágil que dar acceso al campo.
     */
    @Inject ObjectMapper mapper;

    /** Registra la sesión del usuario, creando su conjunto si no existía. */
    public void registrar(String usuarioId, Session session) {
        sesionesPorUsuario
                .computeIfAbsent(usuarioId, clave -> ConcurrentHashMap.newKeySet())
                .add(session);
        LOG.info(
                "Sesión abierta para "
                        + usuarioId
                        + ", ahora con "
                        + sesionesDe(usuarioId)
                        + " abierta(s)");
    }

    /**
     * Retira la sesión que se cierra y borra la clave del usuario solo si ya no le queda ninguna.
     *
     * <p>Retirar el usuario entero en vez de la sesión es el defecto que este adaptador corrige: el
     * resto de pestañas del mismo usuario dejan de recibir mensajes.
     */
    public void retirar(String usuarioId, Session session) {
        Set<Session> sesiones = sesionesPorUsuario.get(usuarioId);
        if (sesiones == null) {
            return;
        }
        sesiones.remove(session);
        if (sesiones.isEmpty()) {
            // El remove por clave, y no solo quitar la entrada del set: si no, sobrevive una clave
            // con un conjunto vacío y el usuario quedaría registrado sin ninguna sesión que
            // escribir.
            sesionesPorUsuario.remove(usuarioId, sesiones);
        }
        LOG.info(
                "Sesión cerrada para "
                        + usuarioId
                        + ", ahora con "
                        + sesionesDe(usuarioId)
                        + " abierta(s)");
    }

    /**
     * Envía el mensaje a todas las sesiones abiertas del destinatario.
     *
     * <p>Devuelve false solo cuando no hay ninguna sesión a la que escribir, que es lo que el
     * servicio de aplicación traduce a "no entregado". En ese caso el mensaje sigue guardado, así
     * que aparece en el historial cuando el destinatario vuelva.
     *
     * <p>Las sesiones cerradas se descartan aquí mismo: una que se cerró sin pasar por el manejador
     * de cierre, o que se cerró entre la comprobación y el envío, produce una excepción en vez de
     * una entrega. Se ignora ese envío porque el destinatario ya no está, que es exactamente el
     * caso que devuelve false.
     *
     * <p>Un fallo al escribir se trata igual, y por el mismo motivo: no es un destinatario ausente,
     * es una sesión que se cayó. La excepción se registra y se sigue con las demás sesiones del
     * mismo usuario. Dejarla subir cerraría el socket de quien escribe, que no tiene nada que ver
     * con el problema y sí está esperando más mensajes; y cortaría el reparto a las pestañas que sí
     * estaban vivas. Si al final no recibió nadie, el resultado es false y el mensaje sigue
     * guardado, así que al emisor le llega un "no entregado" que sigue siendo cierto.
     *
     * <p>Se serializa con el mismo DTO que usa el acuse al emisor, mediante la fábrica de mensaje y
     * no la de resultado. Es deliberado: son dos frames del mismo canal y una forma compartida deja
     * imposible que un campo se añada a uno y se olvide en el otro. Lo que no puede compartirse es
     * el desenlace, porque es lo que el cliente usa para saber si lo que le llega es un acuse o un
     * mensaje nuevo. El adaptador de salida importa un DTO de un adaptador de entrada, y a cambio
     * el contrato que ve el cliente tiene una sola definición.
     */
    @Override
    public boolean enviar(String usuarioId, MensajeChat mensaje) {
        Set<Session> sesiones = sesionesPorUsuario.get(usuarioId);
        if (sesiones == null || sesiones.isEmpty()) {
            return false;
        }
        String payload = serializar(mensaje);

        boolean entregado = false;
        for (Session sesion : sesiones) {
            if (!sesion.isOpen()) {
                sesiones.remove(sesion);
                continue;
            }
            try {
                sesion.getAsyncRemote().sendText(payload);
                entregado = true;
            } catch (RuntimeException e) {
                LOG.log(
                        Level.WARNING,
                        "No se pudo escribir el mensaje en una sesión de " + usuarioId,
                        e);
            }
        }
        return entregado;
    }

    /** Cuántas sesiones tiene abiertas un usuario ahora mismo. */
    public int sesionesDe(String usuarioId) {
        Set<Session> sesiones = sesionesPorUsuario.get(usuarioId);
        return sesiones == null ? 0 : sesiones.size();
    }

    /**
     * Serializa el mensaje al frame que viaja por el canal.
     *
     * <p>Un fallo aquí es un error de programación, no un destinatario ausente, y por eso se
     * propaga: silenciarlo devolvería al emisor un acuse de "no está conectado" que no explica
     * nada.
     */
    private String serializar(MensajeChat mensaje) {
        try {
            return mapper.writeValueAsString(MensajeChatResponse.mensaje(mensaje));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo serializar un mensaje de chat", e);
        }
    }
}
