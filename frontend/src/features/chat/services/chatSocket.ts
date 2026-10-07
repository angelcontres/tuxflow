import { ChatMessage } from '../types/chat.types';

export class ChatSocketManager {
  private socket: WebSocket | null = null;
  private onMessageCallback: ((msg: ChatMessage) => void) | null = null;
  private onStatusCallback: ((conectado: boolean) => void) | null = null;

  connect(userId: string, onMessage: (msg: ChatMessage) => void, onStatus?: (conectado: boolean) => void) {
    this.onMessageCallback = onMessage;
    if (onStatus) {
      this.onStatusCallback = onStatus;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}/chat/${userId}`);

    this.socket.onopen = () => {
      console.log('WebSocket de Chat conectado para usuario:', userId);
      this.onStatusCallback?.(true);
    };

    this.socket.onmessage = (event) => {
      try {
        const message: ChatMessage = JSON.parse(event.data);
        if (this.onMessageCallback) {
          this.onMessageCallback(message);
        }
      } catch (err) {
        console.error('Error parseando mensaje entrante:', err);
      }
    };

    this.socket.onerror = () => {
      this.onStatusCallback?.(false);
    };

    this.socket.onclose = () => {
      console.log('WebSocket de Chat desconectado');
      this.onStatusCallback?.(false);
    };
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  sendMessage(destinatarioId: string, contenido: string): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload: ChatMessage = {
        emisorId: '',
        destinatarioId,
        contenido,
      };
      this.socket.send(JSON.stringify(payload));
      return true;
    } else {
      console.warn('WebSocket no disponible o desconectado');
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.onStatusCallback?.(false);
    }
  }
}

export const chatSocketManager = new ChatSocketManager();
