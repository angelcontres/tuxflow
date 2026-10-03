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
 * Respuesta de registrar un like. El servidor devuelve el total real de reacciones para que la
 * tarjeta concilie su contador optimista en vez de confiar en un incremento local.
 */
export interface LikePostResponse {
  postId: string;
  likedByMe: boolean;
  totalLikes: number;
}

/**
 * Respuesta de cualquier operación de reacción (like, dislike o retirada). Cada endpoint devuelve
 * solo lo que su operación establece con certeza y la tarjeta conserva su estado previo para el
 * resto: el servidor no inventa el estado contrario porque con las firmas actuales no puede
 * conocerlo sin una lectura extra.
 */
export interface ReactionResponse {
  postId: string;
  likedByMe?: boolean;
  dislikedByMe?: boolean;
  totalLikes?: number;
  totalDislikes?: number;
}

export interface CreatePostPayload {
  autorId: string;
  texto: string;
  mediaUrl?: string;
  autorUsername?: string;
}
