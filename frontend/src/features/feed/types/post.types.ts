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

export interface CreatePostPayload {
  autorId: string;
  texto: string;
  mediaUrl?: string;
  autorUsername?: string;
}
