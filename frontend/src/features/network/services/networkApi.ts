import axios from 'axios';
import { SugerenciaUsuario, Usuario } from '../types/network.types';

const api = axios.create({
  baseURL: '/api',
});

export const fetchSugerenciasGrafo = async (userId: string): Promise<SugerenciaUsuario[]> => {
  const response = await api.get<SugerenciaUsuario[]>(`/users/${userId}/sugerencias`);
  return response.data;
};

export const fetchSeguidos = async (userId: string): Promise<Usuario[]> => {
  const response = await api.get<Usuario[]>(`/users/${userId}/follows`);
  return response.data;
};

export const followUserInGraph = async (seguidorId: string, seguidoId: string): Promise<void> => {
  await api.post(`/users/${seguidorId}/follow/${seguidoId}`);
};

export const unfollowUserInGraph = async (seguidorId: string, seguidoId: string): Promise<void> => {
  await api.delete(`/users/${seguidorId}/follow/${seguidoId}`);
};
