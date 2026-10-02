/**
 * Publicación tal como la devuelve `GET /posts/autor/{userId}`.
 *
 * Es el mismo `Post` del feed y a propósito se reexporta en vez de declararse otra vez: la tarjeta
 * del perfil ajeno y la del feed pintan el mismo dato, y dos declaraciones del mismo contrato
 * divergen en cuanto una de las dos se toca. El backend tampoco duplica el DTO, por el mismo
 * motivo.
 */
export type { Post } from '../../feed/types/post.types';
