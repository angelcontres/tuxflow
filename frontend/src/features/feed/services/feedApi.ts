import axios from 'axios';
import { Post, CreatePostPayload } from '../types/post.types';

const api = axios.create({
  baseURL: '/api',
});

export const fetchFeedBySocialGraph = async (userId: string): Promise<Post[]> => {
  const response = await api.get<Post[]>(`/feed/${userId}`);
  return response.data;
};

export const submitPost = async (payload: CreatePostPayload): Promise<{ id: string }> => {
  const response = await api.post<{ id: string }>('/posts', payload);
  return response.data;
};

export const togglePostLike = async (postId: string, userId: string): Promise<void> => {
  await api.post(`/posts/${postId}/like`, { userId });
};
