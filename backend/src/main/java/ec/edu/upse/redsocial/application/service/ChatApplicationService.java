package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.exception.ParticipanteNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.ConversacionChat;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.model.ResultadoEnvio;
import ec.edu.upse.redsocial.domain.port.in.GestionarChatUseCase;
import ec.edu.upse.redsocial.domain.port.out.CanalChatPort;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ChatApplicationService implements GestionarChatUseCase {

    @Inject GrafoPersistencePort grafoPersistencePort;

    @Inject CanalChatPort canalChatPort;

    /**
     * Valida, conserva y despacha, en ese orden.
     *
     * <p>Conservar antes de despachar es deliberado. Si se invirtiera, un destinatario ausente
     * perdería el mensaje: el despacho fallaría, nadie se loería y no quedaría nada en el grafo
     * para entregar después. Hoy ese hueco se cubre con una línea en el log, que el emisor nunca
     * ve.
     *
     * <p>La validación vive aquí y no en el endpoint WebSocket por dos razones: se puede probar sin
     * levantar el contenedor de WebSockets, y evita que la regla exista en dos sitios. El endpoint
     * cumple un papel más estrecho, que es decidir de qué identidad se trata y traducir el
     * resultado a bytes.
     */
    @Override
    public ResultadoEnvio enviar(String emisorId, String destinatarioId, String contenido) {
        // Se construye el mensaje antes de validar para que el rechazo pueda devolver el contenido
        // que se quiso enviar. El emisor necesita ver qué se rechazó, no solo que se rechazó algo.
        MensajeChat mensaje = new MensajeChat(emisorId, destinatarioId, contenido);

        String rechazo = motivoRechazo(emisorId, destinatarioId, contenido);
        if (rechazo != null) {
            return ResultadoEnvio.rechazado(mensaje, rechazo);
        }

        // El id lo genera el servidor, igual que el de una publicación, para que la burbuja del
        // cliente y la fila del grafo compartan identidad y el acuse pueda correlaciónarse.
        mensaje.setId(UUID.randomUUID().toString());

        try {
            grafoPersistencePort.guardarMensajeChat(mensaje);
        } catch (ParticipanteNoEncontradoException e) {
            // Escribir a un identificador equivocado es el error más fácil de cometer con una
            // dirección escrita a mano, y hay que responderlo como lo que es: un rechazo de este
            // mensaje. Si la excepción subiera hasta el contenedor de WebSockets, el socket del
            // emisor se cerraría por un mensaje que él no puede corregir, y quien escribió bien
            // perdería el canal.
            //
            // El mensaje no se guardó, así que el motivo no dice que quedó guardado: sería falso, y
            // un cliente que confíe en él creería que está en la conversación.
            mensaje.setId(null);
            return ResultadoEnvio.rechazado(
                    mensaje, "El usuario '" + e.getParticipanteId() + "' no existe.");
        }

        if (!canalChatPort.enviar(destinatarioId, mensaje)) {
            return ResultadoEnvio.noEntregado(
                    mensaje, "El destinatario no está conectado. El mensaje quedó guardado.");
        }

        return ResultadoEnvio.entregado(mensaje);
    }

    /**
     * Devuelve el motivo del rechazo, o null si el mensaje es válido.
     *
     * <p>Devolver el motivo en vez de lanzar deja el motivo en un solo lugar: quien llama decide
     * cómo comunicarlo, que en el canal es un acuse y en HTTP sería un 400.
     */
    private String motivoRechazo(String emisorId, String destinatarioId, String contenido) {
        if (destinatarioId == null || destinatarioId.isBlank()) {
            return "Falta el destinatario del mensaje.";
        }
        // Escribir a uno mismo no es un caso degenerado sin consecuencias: crearía un nodo de
        // mensaje con las dos relaciones sobre la misma persona, y el historial de esa pareja
        // devolvería una conversación consigo mismo que en el grafo significa una sola persona.
        if (destinatarioId.equals(emisorId)) {
            return "No puedes enviarte un mensaje a ti mismo.";
        }
        if (contenido == null || contenido.isBlank()) {
            return "El mensaje no puede estar vacío.";
        }
        return null;
    }

    @Override
    public List<MensajeChat> historial(String usuarioA, String usuarioB) {
        return grafoPersistencePort.obtenerHistorialChat(usuarioA, usuarioB);
    }

    @Override
    public List<ConversacionChat> conversaciones(String usuarioId) {
        // Delega sin validar. La llamada mal formada la responde el recurso con un 400, que es
        // donde se decide el código que ve el cliente, y repetir esa comprobación aquí solo
        // devolvería una bandeja vacía a quien ya se le dijo que la llamada iba mal. Con un
        // identificador ausente la consulta no encuentra filas y la lista sale vacía, que tampoco
        // molesta a nadie: es la misma respuesta que la de quien no ha escrito con nadie.
        return grafoPersistencePort.obtenerConversacionesChat(usuarioId);
    }
}
