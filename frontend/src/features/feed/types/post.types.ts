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
