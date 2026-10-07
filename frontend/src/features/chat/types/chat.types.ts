export type MessageStatus = 'enviando' | 'enviado' | 'fallido';

export interface ChatMessage {
  emisorId: string;
  destinatarioId: string;
  contenido: string;
  timestamp?: number;
  status?: MessageStatus;
}

