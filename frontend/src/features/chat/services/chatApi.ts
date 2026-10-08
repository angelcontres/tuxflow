import { api } from '../../../shared/api/client';
import { ChatMessage, ConversacionChat } from '../types/chat.types';

/**
 * Cliente HTTP del chat.
 *
 * <p>El historial no viaja por el canal porque son cosas distintas: el socket entrega lo que pasa
 * ahora y el HTTP recupera lo que ya pasó. Un cliente que acaba de abrir la pestaña espera segundos
 * hasta tener conexión, y durante ese tiempo el historial no podría mostrar nada. Además, por el
 * socket no se puede volver a pedir nada: su serie de mensajes son los que van llegando, no una
 * consulta con parámetros.
 *
 * <p>La bandeja de conversaciones va por la misma razón y con el mismo cliente compartido que el
 * resto de la aplicación: es una consulta, no un suceso, y tiene que llevar el token de sesión como
 * las demás. Antes este módulo usaba `fetch` pelado, que no adjunta nada y además se saltaba el
 * borrado de sesión cuando el servidor responde 401.
 */

/**
 * Trae los mensajes intercambiados entre dos participantes, del más antiguo al más reciente.
 *
 * @returns la lista tal cual la devuelve el servidor, vacía si esa pareja nunca se escribió
 * @throws el error de axios si la petición falla, para que el widget pueda avisar en vez de fingir
 *   que no hay historial
 */
export async function obtenerHistorial(userA: string, userB: string): Promise<ChatMessage[]> {
  const response = await api.get<ChatMessage[]>('/chat/historial', {
    params: { userA, userB },
  });
  return response.data;
}

/**
 * Bandeja de conversaciones del usuario: una fila por interlocutor, con su último mensaje.
 *
 * @returns las conversaciones de la más reciente a la más antigua, vacía si nunca se escribió con
 *   nadie
 * @throws el error de axios si la petición falla. Se deja propagar a propósito, como en los demás
 *   servicios: el componente que llama es quien sabe cómo mostrarlo, y convertir el fallo en una
 *   lista vacía haría creer que no hay conversaciones
 */
export async function obtenerConversaciones(userId: string): Promise<ConversacionChat[]> {
  const response = await api.get<ConversacionChat[]>('/chat/conversaciones', {
    params: { userId },
  });
  return response.data;
}
