import { Comentario, ComentarioLikeResponse, CrearComentarioPayload } from '../types/post.types';
import { api } from '../../../shared/api/client';

/**
 * Comentarios de una publicación (US (por definir)).
 *
 * Todas cuelgan de `/posts/{postId}/comentarios`, incluido el like de un comentario, para no abrir
 * un segundo recurso de primer nivel sólo para reacciones. El error se propaga tal cual: el modal
 * distingue "no hay comentarios" de "la petición falló" y pinta cosas distintas.
 */

export const fetchComentarios = async (
  postId: string,
  viewerId?: string,
): Promise<Comentario[]> => {
  const response = await api.get<Comentario[]>(`/posts/${postId}/comentarios`, {
    params: viewerId ? { viewerId } : undefined,
  });
  return response.data;
};

export const crearComentario = async (
  postId: string,
  payload: CrearComentarioPayload,
): Promise<Comentario> => {
  const response = await api.post<Comentario>(`/posts/${postId}/comentarios`, payload);
  return response.data;
};

export const likeComentario = async (
  postId: string,
  comentarioId: string,
  userId: string,
): Promise<ComentarioLikeResponse> => {
  const response = await api.post<ComentarioLikeResponse>(
    `/posts/${postId}/comentarios/${comentarioId}/like`,
    { userId },
  );
  return response.data;
};

export const unlikeComentario = async (
  postId: string,
  comentarioId: string,
  userId: string,
): Promise<ComentarioLikeResponse> => {
  // Igual que en los likes de post: axios delete no admite cuerpo, el userId va en la query.
  const response = await api.delete<ComentarioLikeResponse>(
    `/posts/${postId}/comentarios/${comentarioId}/like`,
    { params: { userId } },
  );
  return response.data;
};
