import React, { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import { NotificacionInApp } from '../types/notification.types';
import { fetchHistorial, fetchUnreadCount, markAsRead } from '../services/notificationApi';

interface NotificationCenterProps {
  currentUserId: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ currentUserId }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificacionInApp[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUnread = async () => {
      try {
        if (!currentUserId) return;
        const count = await fetchUnreadCount(currentUserId);
        setUnreadCount(count);
      } catch (e) {
        console.error('Error fetching unread count', e);
      }
    };
    loadUnread();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const eventSource = new EventSource(`/api/in-app-notifications/stream?userId=${currentUserId}`);

    eventSource.addEventListener('notification', () => {
      // The backend sends events named "notification"
      setUnreadCount((prev) => prev + 1);
    });

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [currentUserId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      try {
        if (!currentUserId) return;
        const history = await fetchHistorial(currentUserId);
        setNotifications(history);
      } catch (e) {
        console.error('Error fetching history', e);
      }
    }
  };

  const handleNotificationClick = async (notif: NotificacionInApp) => {
    if (!notif.leido) {
      try {
        if (!currentUserId) return;
        await markAsRead(notif.id, currentUserId);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        console.error('Error marking as read', e);
      }
    }

    setIsOpen(false);
    if (notif.url) {
      window.location.href = notif.url; // Use standard navigation, or router if available
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors relative cursor-pointer"
        title="Notificaciones"
      >
        <Globe className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-200 font-bold text-slate-700">
            Notificaciones
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No tienes notificaciones
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.leido ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="text-sm font-semibold text-slate-800">{notif.titulo}</div>
                  <div className="text-xs text-slate-600 mt-1">{notif.mensaje}</div>
                  <div className="text-[10px] text-slate-400 mt-2">
                    {new Date(notif.fechaCreacion).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
