import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Radio, ShoppingBag } from 'lucide-react';
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

  const quickMessages = [
    '🥭 ¿Tienes cajas disponibles?',
    '🚚 ¿Hacen envíos hoy?',
    '🍓 Quiero reservar 2 canastas',
  ];

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

  const handleEnviar = (e?: React.FormEvent, textoManual?: string) => {
    if (e) e.preventDefault();
    const textoAEnviar = (textoManual || mensaje).trim();
    if (!textoAEnviar || !destinatarioId.trim()) return;

    chatSocketManager.sendMessage(destinatarioId, textoAEnviar);
    setMensajes((prev) => [
      ...prev,
      { emisorId: currentUserId, destinatarioId, contenido: textoAEnviar },
    ]);
    if (!textoManual) {
      setMensaje('');
    }
  };

  return (
    <div className="bg-[#161823] rounded-2xl p-5 shadow-2xl border border-white/10 backdrop-blur-md">
      {/* Header estilo TikTok Direct Messages Frutero */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FE2C55]/15 text-[#FE2C55]">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <h3 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
            <span>Chat de Pedidos en Vivo</span>
            <span className="text-xs">🍉</span>
          </h3>
        </div>
        <span className="text-[10px] font-bold tracking-wider uppercase text-[#25F4EE] bg-[#25F4EE]/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#25F4EE]/20">
          <Radio className="w-3 h-3 animate-pulse" />
          WebSocket
        </span>
      </div>

      {/* Selector de productor a contactar */}
      <div className="mb-2">
        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
          Pedir Fruta a:
        </label>
        <div className="relative">
          <input
            type="text"
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
            placeholder="ID de productor (ej. beatriz, paulo)"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#25F4EE] font-mono"
          />
          <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Botones de Consulta Rápida de Frutas */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-2">
        {quickMessages.map((qm, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleEnviar(undefined, qm)}
            className="text-[10px] font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg transition-colors border border-white/5 shrink-0 cursor-pointer"
          >
            {qm}
          </button>
        ))}
      </div>

      {/* Ventana de mensajes */}
      <div
        ref={scrollRef}
        className="h-44 overflow-y-auto rounded-xl bg-black/40 border border-white/5 p-3 space-y-2 mb-3"
      >
        {mensajes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 text-xs py-4">
            <span className="text-xl mb-1">🧺</span>
            <p>Canal de pedidos directo con el agricultor.</p>
            <p className="text-[11px] text-neutral-400 mt-1">Escribe o usa las consultas rápidas.</p>
          </div>
        ) : (
          mensajes.map((m, idx) => {
            const isMe = m.emisorId === currentUserId;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] text-xs px-3 py-2 rounded-2xl ${
                    isMe
                      ? 'bg-[#FE2C55] text-white rounded-br-xs shadow-md shadow-[#FE2C55]/20 font-medium'
                      : 'bg-white/10 text-white border border-white/10 rounded-bl-xs'
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
      <form onSubmit={(e) => handleEnviar(e)} className="flex gap-2">
        <input
          type="text"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Mensaje o pedido de fruta..."
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FE2C55]"
        />
        <button
          type="submit"
          disabled={!mensaje.trim()}
          className="p-2 bg-[#FE2C55] hover:bg-[#e0264b] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-md shadow-[#FE2C55]/25 transition-all cursor-pointer active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
