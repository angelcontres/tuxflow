import { Post, CreatePostPayload, ReactionResponse, Tendencia } from '../types/post.types';
import { api } from '../../../shared/api/client';

export const fetchFeedBySocialGraph = async (userId: string): Promise<Post[]> => {
  const response = await api.get<Post[]>(`/feed/${userId}`);
  return response.data;
};

export const submitPost = async (payload: CreatePostPayload): Promise<{ id: string }> => {
  const response = await api.post<{ id: string }>('/posts', payload);
  return response.data;
};

export const likePost = async (postId: string, userId: string): Promise<ReactionResponse> => {
  const response = await api.post<ReactionResponse>(`/posts/${postId}/like`, { userId });
  return response.data;
};

export const dislikePost = async (postId: string, userId: string): Promise<ReactionResponse> => {
  const response = await api.post<ReactionResponse>(`/posts/${postId}/dislike`, { userId });
  return response.data;
};

export const unlikePost = async (postId: string, userId: string): Promise<ReactionResponse> => {
  // axios delete no admite cuerpo: el userId viaja como query param.
  const response = await api.delete<ReactionResponse>(`/posts/${postId}/like`, {
    params: { userId },
  });
  return response.data;
};

export const undislikePost = async (postId: string, userId: string): Promise<ReactionResponse> => {
  const response = await api.delete<ReactionResponse>(`/posts/${postId}/dislike`, {
    params: { userId },
  });
  return response.data;
};

/**
 * Tendencias de los últimos 7 días en la red extendida a 1-2 saltos (US-11).
 *
 * El error se propaga tal cual: convertirlo en `[]` borraría la diferencia entre "no hay
 * tendencias" y "la petición falló", que el widget pinta como cosas distintas.
 */
export const fetchTendencias = async (userId: string): Promise<Tendencia[]> => {
  const response = await api.get<Tendencia[]>(`/posts/tendencias/${userId}`);
  return response.data;
};
