import { Usuario } from '../types/user.types';
import { api } from '../../../shared/api/client';

export const fetchUsuario = async (userId: string): Promise<Usuario> => {
  const response = await api.get<Usuario>(`/users/${userId}`);
  return response.data;
};

export const fetchAllUsuarios = async (): Promise<Usuario[]> => {
  const response = await api.get<Usuario[]>('/users');
  return response.data;
};

export const registerOrUpdateUsuario = async (usuario: Usuario): Promise<Usuario> => {
  const response = await api.post<Usuario>('/users', usuario);
  return response.data;
};

export const uploadAvatar = async (file: File, userId?: string): Promise<{ avatarUrl: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const url = userId ? `/users/${userId}/avatar` : '/users/avatar';
  const response = await api.post<{ avatarUrl: string }>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
