import { ConexionComun, SugerenciaUsuario, Usuario } from '../types/network.types';
import { api } from '../../../shared/api/client';

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

/**
 * Intersección de los seguidos de dos perfiles (Cypher #3 obligatoria).
 *
 * El error se deja propagar a propósito: el componente que llama es quien sabe
 * cómo mostrarlo al usuario.
 */
export const fetchConexionesComunes = async (
  userA: string,
  userB: string,
): Promise<ConexionComun[]> => {
  const response = await api.get<ConexionComun[]>('/users/comunes', {
    params: { userA, userB },
  });
  return response.data;
};
