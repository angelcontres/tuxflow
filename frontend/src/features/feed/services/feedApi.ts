import { Post, CreatePostPayload, LikePostResponse } from '../types/post.types';
import { api } from '../../../shared/api/client';

export const fetchFeedBySocialGraph = async (userId: string): Promise<Post[]> => {
  const response = await api.get<Post[]>(`/feed/${userId}`);
  return response.data;
};

export const submitPost = async (payload: CreatePostPayload): Promise<{ id: string }> => {
  const response = await api.post<{ id: string }>('/posts', payload);
  return response.data;
};

export const likePost = async (postId: string, userId: string): Promise<LikePostResponse> => {
  const response = await api.post<LikePostResponse>(`/posts/${postId}/like`, { userId });
  return response.data;
};
