import axios from 'axios';

const api = axios.create({
  baseURL: '/api/auth',
});

export interface LoginResponse {
  id: string;
  username: string;
  email: string;
  nombre: string;
  avatarUrl?: string;
}

export interface RegisterPayload {
  id: string;
  username: string;
  nombre: string;
  email: string;
  password: string;
}

export const loginUser = async (emailOrUsername: string, password: string): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/login', {
    email: emailOrUsername,
    password,
  });
  return response.data;
};

export const registerUser = async (payload: RegisterPayload): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/register', payload);
  return response.data;
};
