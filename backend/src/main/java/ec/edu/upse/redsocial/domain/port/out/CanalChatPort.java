package ec.edu.upse.redsocial.domain.port.out;

import ec.edu.upse.redsocial.domain.model.MensajeChat;

/**
 * Canal de salida para entregar un mensaje a un usuario conectado.
 *
 * <p>Existe para que el servicio de aplicación pueda despachar sin conocer el contenedor de
 * WebSockets. El adaptador decide cómo serializar y a qué sesiones escribir, y devuelve si la
 * entrega ocurrió para que la capa de aplicación pueda distinguir "llegó" de "no había nadie".
 *
 * <p>Es el mismo patrón que {@link NotificationPushPort}: una capacidad de salida del dominio que
 * la infraestructura implementa con la tecnología concreta.
 */
public interface CanalChatPort {

    /**
     * Entrega el mensaje a las sesiones abiertas del usuario indicado.
     *
     * @param usuarioId destinatario
     * @param mensaje el mensaje ya validado
     * @return true si al menos una sesión recibió el mensaje, false si el usuario no tiene ninguna
     */
    boolean enviar(String usuarioId, MensajeChat mensaje);
}
