import { api } from '../../../shared/api/client';
import { NotificacionInApp } from '../types/notification.types';

const BASE_PATH = '/in-app-notifications';

export const fetchHistorial = async (userId: string): Promise<NotificacionInApp[]> => {
  const response = await api.get(`${BASE_PATH}?userId=${userId}`);
  return response.data;
};

export const fetchUnreadCount = async (userId: string): Promise<number> => {
  const response = await api.get(`${BASE_PATH}/unread-count?userId=${userId}`);
  return response.data;
};

export const markAsRead = async (id: string, userId: string): Promise<void> => {
  await api.put(`${BASE_PATH}/${id}/read?userId=${userId}`);
};
