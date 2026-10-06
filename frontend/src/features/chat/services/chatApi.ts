import { ChatMessage } from '../types/chat.types';

/**
 * Cliente HTTP del historial de chat.
 *
 * <p>El historial no viaja por el canal porque son cosas distintas: el socket entrega lo que pasa
 * ahora y el HTTP recupera lo que ya pasó. Un cliente que acaba de abrir la pestaña espera segundos
 * hasta tener conexión, y durante ese tiempo el historial no podría mostrar nada. Además, por el
 * socket no se puede volver a pedir nada: su serie de mensajes son los que van llegando, no una
 * consulta con parámetros.
 */

/**
 * Trae los mensajes intercambiados entre dos participantes, del más antiguo al más reciente.
 *
 * @returns la lista tal cual la devuelve el servidor, vacía si esa pareja nunca se escribió
 * @throws Error si la petición falla, para que el widget pueda avisar en vez de fingir que no hay
 *   historial
 */
export async function obtenerHistorial(userA: string, userB: string): Promise<ChatMessage[]> {
  const parametros = new URLSearchParams({ userA, userB });
  const respuesta = await fetch(`/api/chat/historial?${parametros.toString()}`);

  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar el historial (${respuesta.status})`);
  }

  const cuerpo = await respuesta.json();
  return Array.isArray(cuerpo) ? (cuerpo as ChatMessage[]) : [];
}
