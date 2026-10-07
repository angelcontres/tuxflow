import { ResultadoBusquedaUsuario, Usuario } from '../types/user.types';
import { Post } from '../../feed/types/post.types';
import { api } from '../../../shared/api/client';

export const fetchUsuario = async (userId: string): Promise<Usuario> => {
  const response = await api.get<Usuario>(`/users/${userId}`);
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

/**
 * Publicaciones de una persona, de la más nueva a la más antigua.
 *
 * El endpoint las devuelve ya ordenadas por fecha de creación, y el orden es parte de lo que el
 * perfil promete, así que el cliente no reordena: una lista que se reordena en el navegador puede
 * discrepar de la del servidor en cuanto las dos consultas se mezclan.
 *
 * `viewerId` es opcional y sólo cambia el campo `likedByMe` de cada publicación, que es lo que
 * permite pintar la reacción ya puesta cuando el perfil ajeno ya tenía un like de esta sesión. Sin
 * él, las publicaciones llegan sin la reacción marcada.
 *
 * El error se deja propagar: el componente que llama sabe distinguir "no publicó nada" (200 con
 * lista vacía) de "no se pudo consultar", y no puede hacerlo si aquí se convierte todo en [].
 */
export const fetchPostsDeUsuario = async (userId: string, viewerId?: string): Promise<Post[]> => {
  const response = await api.get<Post[]>(`/posts/autor/${userId}`, {
    params: viewerId ? { viewerId } : undefined,
  });
  return response.data;
};

/**
 * Personas que siguen a un perfil.
 *
 * Es la inversa de `fetchSeguidos`, y no su alias: mismo par de nodos, arista leída al revés. La
 * respuesta no lleva el correo ni la suscripción de nadie, porque quien la pide está mirando la
 * red de otra persona y no necesita ninguno de los dos.
 */
export const fetchSeguidores = async (userId: string): Promise<Usuario[]> => {
  const response = await api.get<Usuario[]>(`/users/${userId}/followers`);
  return response.data;
};

/**
 * Personas cuyo nombre o nombre de usuario contienen el texto, ya ordenadas por relevancia.
 *
 * El orden viene del servidor y el cliente lo respeta sin reordenar: la regla (coincidencia exacta
 * de nombre de usuario, luego empieza por, luego contiene) es del backend, y un cliente que la
 * reimplementara podría equivocarse.
 *
 * `signal` cancela la petición en vuelo. Hace falta además del debounce: con debounce y sin
 * cancelación, dos respuestas pueden llegar en orden contrario y pintar el resultado de un texto que
 * ya no es el del campo. Es un fallo de identidad, no un problema de rendimiento.
 *
 * El error se deja propagar, como en `fetchSeguidores`: quien llama tiene que poder distinguir
 * "no hay nadie con ese nombre" de "no se pudo consultar", y no puede hacerlo si aquí todo se
 * convierte en `[]`.
 */
export const buscarUsuarios = async (
  texto: string,
  signal?: AbortSignal,
): Promise<ResultadoBusquedaUsuario[]> => {
  const response = await api.get<ResultadoBusquedaUsuario[]>('/users/buscar', {
    params: { q: texto },
    signal,
  });
  return response.data;
};
