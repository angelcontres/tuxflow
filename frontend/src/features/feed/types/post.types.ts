export interface Post {
  id: string;
  texto: string;
  mediaUrl?: string;
  fechaCreacion: number;
  autorId: string;
  autorUsername: string;
  autorAvatar?: string;
  totalLikes: number;
  likedByMe: boolean;
  totalDislikes?: number;
  dislikedByMe?: boolean;
}

/**
 * Respuesta de cualquier operación de reacción (like, dislike o retirada). Con la mutualidad el
 * servidor devuelve siempre el estado completo: ambas banderas y ambos totales. La tarjeta
 * reconcilia asignando las cuatro sin guardas, lo que elimina la deriva del contador que había
 * cuando la retirada no traía el total.
 */
export interface ReactionResponse {
  postId: string;
  likedByMe: boolean;
  dislikedByMe: boolean;
  totalLikes: number;
  totalDislikes: number;
}

export interface CreatePostPayload {
  autorId: string;
  texto: string;
  mediaUrl?: string;
  autorUsername?: string;
}

/**
 * Fila de la lista de tendencias (US-11). El backend devuelve un Map de Cypher serializado como
 * JSON, no una entidad Post: no hay fecha ni avatar, sí la puntuación neta (likes - dislikes) que
 * ordena la lista y el total de reacciones que la desempata.
 */
export interface Tendencia {
  id: string;
  texto: string;
  autor: string;
  likes: number;
  dislikes: number;
  totalReacciones: number;
  puntuacionNeta: number;
}

/**
 * Comentario de una publicación (US (por definir)). `parentId` nulo lo identifica como comentario de primer
 * nivel y no nulo como respuesta. El cliente agrupa con ese campo: la lista llega plana y ordenada
 * del servidor.
 */
export interface Comentario {
  id: string;
  texto: string;
  fechaCreacion: number;
  parentId: string | null;
  autorId: string;
  autorUsername: string;
  autorAvatar?: string;
  totalLikes: number;
  likedByMe: boolean;
}

/**
 * Respuesta de registrar o retirar el like de un comentario. Los comentarios no tienen dislike, así
 * que a diferencia de `ReactionResponse` sólo hay un total.
 */
export interface ComentarioLikeResponse {
  comentarioId: string;
  likedByMe: boolean;
  totalLikes: number;
}

export interface CrearComentarioPayload {
  userId: string;
  texto: string;
  parentId?: string;
}
