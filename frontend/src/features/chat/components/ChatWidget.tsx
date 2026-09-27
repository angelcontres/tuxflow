import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User } from 'lucide-react';
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
    if (!mensaje.trim() || !destinatarioId.trim()) return;

    chatSocketManager.sendMessage(destinatarioId, mensaje);
    setMensajes((prev) => [
      ...prev,
      { emisorId: currentUserId, destinatarioId, contenido: mensaje },
    ]);
    setMensaje('');
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Chat en Vivo</h3>
        </div>
        <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          WebSocket
        </span>
      </div>

      {/* Selector de destinatario */}
      <div className="mb-3">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Chatear con:
        </label>
        <div className="relative">
          <input
            type="text"
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
            placeholder="ID de usuario (ej. beatriz, angel, paulo)"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Ventana de mensajes */}
      <div
        ref={scrollRef}
        className="h-44 overflow-y-auto rounded-xl bg-slate-50/70 border border-slate-100 p-3 space-y-2 mb-3"
      >
        {mensajes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs py-4">
            <p>Canal bidireccional listo.</p>
            <p className="text-[11px] text-slate-400 mt-1">Escribe para iniciar la conversación.</p>
          </div>
        ) : (
          mensajes.map((m, idx) => {
            const isMe = m.emisorId === currentUserId;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] text-xs px-3 py-2 rounded-2xl ${
                    isMe
                      ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-br-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs'
                  }`}
                >
                  {m.contenido}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input de envío */}
      <form onSubmit={handleEnviar} className="flex gap-2">
        <input
          type="text"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={!mensaje.trim()}
          className="p-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
