import axios from 'axios';
import { clearToken, getToken } from '../../features/auth/services/authApi';

/**
 * Cliente HTTP compartido.
 *
 * Adjunta el token de sesión a todas las peticiones y borra la sesión si el
 * servidor responde 401 por token expirado o revocado.
 *
 * Nota: los servicios de auth crean su propia instancia de axios y no usan
 * este cliente a propósito, para no reenviar el token durante el login.
 */
export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401) {
      clearToken();
    }
    return Promise.reject(error);
  },
);
