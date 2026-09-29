import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types/chat.types';
import { chatSocketManager } from '../services/chatSocket';

interface ChatWidgetProps {
  currentUserId: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ currentUserId }) => {
  const [destinatarioId, setDestinatarioId] = useState('beatriz');
  const [mensaje, setMensaje] = useState('');
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatSocketManager.connect(currentUserId, (nuevoMensaje) => {
      setMensajes((prev) => [...prev, nuevoMensaje]);
    });

    return () => {
      chatSocketManager.disconnect();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    const textoAEnviar = mensaje.trim();
    if (!textoAEnviar || !destinatarioId.trim()) return;

    chatSocketManager.sendMessage(destinatarioId, textoAEnviar);
    setMensajes((prev) => [
      ...prev,
      { emisorId: currentUserId, destinatarioId, contenido: textoAEnviar },
    ]);
    setMensaje('');
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900">Mensajes en Vivo</h3>
        </div>
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          WebSocket
        </span>
      </div>

      {/* Selector de destinatario */}
      <div className="mb-3">
        <label className="text-[11px] font-medium text-slate-600 block mb-1">
          Enviar mensaje a (ID):
        </label>
        <div className="relative">
          <input
            type="text"
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
            placeholder="ID de usuario (ej. beatriz, paulo)"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
        </div>
      </div>

      {/* Historial de mensajes */}
      <div
        ref={scrollRef}
        className="h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 mb-3"
      >
        {mensajes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs py-4">
            <MessageSquare className="w-6 h-6 mb-1 text-slate-300" />
            <p>No hay mensajes en esta conversación.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Escribe para iniciar el chat en tiempo real.
            </p>
          </div>
        ) : (
          mensajes.map((m, idx) => {
            const isMe = m.emisorId === currentUserId;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] text-xs px-3 py-2 rounded-xl ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-2xs'
                  }`}
                >
                  {m.contenido}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Formulario de envío */}
      <form onSubmit={handleEnviar} className="flex gap-2">
        <input
          type="text"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!mensaje.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
