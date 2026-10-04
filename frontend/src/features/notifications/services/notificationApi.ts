import { api } from '../../../shared/api/client';
import { NotificacionInApp } from '../types/notification.types';

const BASE_PATH = '/in-app-notifications';

export const fetchHistorial = async (): Promise<NotificacionInApp[]> => {
  const response = await api.get(BASE_PATH);
  return response.data;
};

export const fetchUnreadCount = async (): Promise<number> => {
  const response = await api.get(`${BASE_PATH}/unread-count`);
  return response.data;
};

export const markAsRead = async (id: string): Promise<void> => {
  await api.post(`${BASE_PATH}/${id}/read`);
};
