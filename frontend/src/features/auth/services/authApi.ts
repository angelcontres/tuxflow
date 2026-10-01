import axios from 'axios';

const api = axios.create({
  baseURL: '/api/auth',
});

const TOKEN_KEY = 'redsocial.token';

export interface Usuario {
  id: string;
  username: string;
  email: string;
  nombre: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  token: string;
  id: string;
  username: string;
  email: string;
  nombre: string;
  avatarUrl?: string;
}

export interface RegisterPayload {
  nombre: string;
  username: string;
  password: string;
}

/** Lee el token guardado. Devuelve null si no hay sesión. */
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

/** Guarda el token para que la sesión sobreviva a un refresh del navegador. */
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);

/** Borra el token al cerrar sesión. */
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

/**
 * Reconstruye la sesión con el token guardado.
 * Devuelve null si no hay token, expiró, o el usuario ya no existe.
 */
export const restoreSession = async (): Promise<Usuario | null> => {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await api.get<Usuario>('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch {
    // Token expirado, manipulado o revocado: la sesión ya no vale.
    clearToken();
    return null;
  }
};

export const loginUser = async (
  emailOrUsername: string,
  password: string,
): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/login', {
    email: emailOrUsername,
    password,
  });
  setToken(response.data.token);
  return response.data;
};

export const registerUser = async (payload: RegisterPayload): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/register', payload);
  setToken(response.data.token);
  return response.data;
};
