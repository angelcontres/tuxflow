import { ChatMessage } from '../types/chat.types';

export class ChatSocketManager {
  private socket: WebSocket | null = null;
  private onMessageCallback: ((msg: ChatMessage) => void) | null = null;

  connect(userId: string, onMessage: (msg: ChatMessage) => void) {
    this.onMessageCallback = onMessage;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}/chat/${userId}`);

    this.socket.onopen = () => {
      console.log('WebSocket de Chat conectado para usuario:', userId);
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

    this.socket.onclose = () => {
      console.log('WebSocket de Chat desconectado');
    };
  }

  sendMessage(destinatarioId: string, contenido: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload: ChatMessage = {
        emisorId: '',
        destinatarioId,
        contenido,
      };
      this.socket.send(JSON.stringify(payload));
    } else {
      console.warn('WebSocket no disponible o desconectado');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const chatSocketManager = new ChatSocketManager();
