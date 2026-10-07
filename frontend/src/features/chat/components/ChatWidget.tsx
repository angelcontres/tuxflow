import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Sparkles,
  ChevronUp,
  Minimize2,
  X,
  Search,
  CheckCircle2,
  ArrowUp,
  ArrowLeft,
  CheckCheck,
  Smile,
  AlertTriangle,
  RefreshCw,
  RotateCw,
  Clock,
} from 'lucide-react';
import { ChatMessage } from '../types/chat.types';
import { chatSocketManager } from '../services/chatSocket';

const EMOJIS_RAPIDOS = ['❤️', '🔥', '👍', '😂', '🎉', '🚀', '👋', '✨'];
const SUGERENCIAS_INICIO = [
  '👋 ¡Hola!',
  '🚀 ¿Cómo va el proyecto?',
  '✨ ¡Mucho gusto!',
];

const formatearHora = (timestamp?: number): string => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Sintetizador de audio con Web Audio API: genera sutiles toques sonoros
 * de envío y recepción sin necesidad de archivos externos.
 */
function reproducirSonidoFeedback(tipo: 'send' | 'receive') {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipo === 'send') {
      // Pop sutil ascendente al enviar
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.06);
    } else {
      // Campanilla suave de dos tonos al recibir
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.07); // E5
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch {
    // Si el navegador bloquea audio sin interacción previa, se ignora silenciosamente
  }
}

export interface ContactoChat {
  id: string;
  username: string;
  nombre: string;
  avatar?: string;
  estado: string;
  ultimoMensaje?: string;
  tiempo?: string;
}

const CONTACTOS_PREDETERMINADOS: ContactoChat[] = [
  {
    id: 'beatriz',
    username: 'beatriz',
    nombre: 'Beatriz Silva',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    estado: 'En línea',
    ultimoMensaje: '¡Hola! ¿Cómo vas con el proyecto?',
    tiempo: 'Ahora',
  },
  {
    id: 'paulo',
    username: 'paulo',
    nombre: 'Paulo Orrala',
    avatar: undefined,
    estado: 'En línea',
    ultimoMensaje: 'Toca para iniciar una conversación',
    tiempo: '1h',
  },
  {
    id: 'angel-villon',
    username: 'angel-villon',
    nombre: 'Ángel Villón',
    avatar: undefined,
    estado: 'En línea',
    ultimoMensaje: 'Revisa las actualizaciones del grafo',
    tiempo: 'Ayer',
  },
];

export interface ChatWidgetProps {
  currentUserId: string;
  isOpenExternal?: boolean;
  onToggleExternal?: () => void;
  onCloseExternal?: () => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  currentUserId,
  isOpenExternal,
  onToggleExternal,
  onCloseExternal,
}) => {
  // Estado local para fallback si no se controlan externamente
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : internalIsOpen;

  const [activeView, setActiveView] = useState<'inbox' | 'conversation'>('inbox');
  const [contactoActivo, setContactoActivo] = useState<ContactoChat>(CONTACTOS_PREDETERMINADOS[0]);
  const [contactos, setContactos] = useState<ContactoChat[]>(CONTACTOS_PREDETERMINADOS);
  const [searchTerm, setSearchTerm] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'todos' | 'directos'>('todos');
  const [unreadCount, setUnreadCount] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(true);

  // Toast de notificación flotante para mensajes entrantes en segundo plano
  const [incomingToast, setIncomingToast] = useState<{
    emisorId: string;
    contenido: string;
  } | null>(null);

  // Feedback visual de envío y estado
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [lastSentSuccess, setLastSentSuccess] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const contactoActivoRef = useRef(contactoActivo);
  const activeViewRef = useRef(activeView);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    contactoActivoRef.current = contactoActivo;
  }, [contactoActivo]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  // Actualiza la previsualización del último mensaje y sube la conversación al tope
  const sincronizarPreviewContacto = (
    contactoId: string,
    ultimoMensaje: string,
    tiempo = 'Ahora',
  ) => {
    setContactos((prev) => {
      const idx = prev.findIndex((c) => c.id.toLowerCase() === contactoId.toLowerCase());
      if (idx !== -1) {
        const actualizado: ContactoChat = {
          ...prev[idx],
          ultimoMensaje,
          tiempo,
        };
        const filtrado = prev.filter((_, i) => i !== idx);
        return [actualizado, ...filtrado];
      }
      // Si el contacto no estaba en la lista, crearlo y ubicarlo primero
      const clean = contactoId.trim().replace(/^@/, '');
      const nuevo: ContactoChat = {
        id: clean,
        username: clean,
        nombre: clean.charAt(0).toUpperCase() + clean.slice(1),
        estado: 'Directo',
        ultimoMensaje,
        tiempo,
      };
      return [nuevo, ...prev];
    });
  };

  const conectarSocket = () => {
    chatSocketManager.connect(
      currentUserId,
      (nuevoMensaje) => {
        const msgCompleto: ChatMessage = {
          ...nuevoMensaje,
          timestamp: Date.now(),
          status: 'enviado',
        };
        setMensajes((prev) => [...prev, msgCompleto]);
        reproducirSonidoFeedback('receive');

        // Sincronizar el feed / previsualización de la bandeja de entrada
        sincronizarPreviewContacto(nuevoMensaje.emisorId, nuevoMensaje.contenido, 'Ahora');

        // Feedback al recibir: si el chat está cerrado o en otra conversación
        const estaEnOtroChat =
          !isOpenRef.current ||
          activeViewRef.current !== 'conversation' ||
          contactoActivoRef.current.id.toLowerCase() !== nuevoMensaje.emisorId.toLowerCase();

        if (estaEnOtroChat) {
          setUnreadCount((c) => c + 1);
          setIncomingToast({
            emisorId: nuevoMensaje.emisorId,
            contenido: nuevoMensaje.contenido,
          });

          // Auto-cerrar toast tras 6 segundos
          setTimeout(() => {
            setIncomingToast((prev) =>
              prev?.contenido === nuevoMensaje.contenido ? null : prev,
            );
          }, 6000);
        }
      },
      (conectado) => {
        setIsSocketConnected(conectado);
      },
    );
  };

  useEffect(() => {
    conectarSocket();

    return () => {
      chatSocketManager.disconnect();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen && activeView === 'conversation' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, isOpen, activeView, contactoActivo]);

  const handleToggle = () => {
    if (onToggleExternal) {
      onToggleExternal();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
    if (!isOpen) {
      setUnreadCount(0);
      setIncomingToast(null);
    }
  };

  const handleClose = () => {
    if (onCloseExternal) {
      onCloseExternal();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleSeleccionarConversacion = (contacto: ContactoChat) => {
    setContactoActivo(contacto);
    setActiveView('conversation');
    setUnreadCount(0);
    setIncomingToast(null);
  };

  const handleVolverAInbox = () => {
    setActiveView('inbox');
  };

  const handleCrearChatCustom = (username: string) => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return;

    const existente = contactos.find((c) => c.id.toLowerCase() === clean.toLowerCase());
    if (existente) {
      handleSeleccionarConversacion(existente);
      setSearchTerm('');
      return;
    }

    const nuevo: ContactoChat = {
      id: clean,
      username: clean,
      nombre: clean.charAt(0).toUpperCase() + clean.slice(1),
      estado: 'Directo',
      ultimoMensaje: 'Conversación nueva',
      tiempo: 'Ahora',
    };

    setContactos((prev) => [nuevo, ...prev]);
    setContactoActivo(nuevo);
    setActiveView('conversation');
    setSearchTerm('');
  };

  const enviarMensajeTexto = (texto: string) => {
    const textoAEnviar = texto.trim();
    if (!textoAEnviar || !contactoActivo.id.trim()) return;

    // Enviar por WebSocket
    const resultado = chatSocketManager.sendMessage(contactoActivo.id, textoAEnviar);
    const enviadoOk = resultado !== false;

    if (enviadoOk) {
      reproducirSonidoFeedback('send');
      setSendFeedback(null);
      setLastSentSuccess(true);
      setTimeout(() => setLastSentSuccess(false), 2000);
    } else {
      setSendFeedback('WebSocket desconectado. El mensaje se guardó localmente.');
      setTimeout(() => setSendFeedback(null), 4000);
    }

    const nuevoMensaje: ChatMessage = {
      emisorId: currentUserId,
      destinatarioId: contactoActivo.id,
      contenido: textoAEnviar,
      timestamp: Date.now(),
      status: enviadoOk ? 'enviado' : 'fallido',
    };

    setMensajes((prev) => [...prev, nuevoMensaje]);
    sincronizarPreviewContacto(contactoActivo.id, textoAEnviar, 'Ahora');
    setMensaje('');
  };

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    enviarMensajeTexto(mensaje);
  };

  const handleReintentar = (m: ChatMessage) => {
    const resultado = chatSocketManager.sendMessage(m.destinatarioId, m.contenido);
    if (resultado !== false) {
      reproducirSonidoFeedback('send');
      setMensajes((prev) =>
        prev.map((item) =>
          item === m ? { ...item, status: 'enviado', timestamp: Date.now() } : item,
        ),
      );
      setSendFeedback(null);
    } else {
      setSendFeedback('El reintento falló. Comprueba la conexión.');
      setTimeout(() => setSendFeedback(null), 3000);
    }
  };

  const avatarLetra = (nombre: string) => (nombre ? nombre.charAt(0).toUpperCase() : '?');

  // Filtrado de contactos en el Inbox
  const contactosFiltrados = contactos.filter((c) => {
    const coincideBusqueda =
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.username.toLowerCase().includes(searchTerm.toLowerCase());
    if (inboxFilter === 'directos') {
      return coincideBusqueda && c.estado !== 'Ayer';
    }
    return coincideBusqueda;
  });

  // Mensajes correspondientes al contacto activo
  const mensajesDelContacto = mensajes.filter(
    (m) =>
      m.destinatarioId.toLowerCase() === contactoActivo.id.toLowerCase() ||
      m.emisorId.toLowerCase() === contactoActivo.id.toLowerCase(),
  );

  return (
    <div className="fixed bottom-0 right-4 sm:right-6 z-50">
      {/* 1. TOAST FLOTANTE DE FEEDBACK PARA MENSAJE ENTRANTE */}
      {incomingToast && (
        <div
          role="status"
          aria-live="polite"
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
          className="absolute bottom-14 right-0 w-80 sm:w-88 p-3 rounded-2xl bg-white dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 shadow-2xl flex items-center justify-between gap-3 text-xs text-slate-900 dark:text-zinc-100 animate-in slide-in-from-bottom-2 fade-in duration-200 z-50"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-indigo-400/40 shadow-xs">
              {incomingToast.emisorId.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate flex items-center gap-1">
                <span>@{incomingToast.emisorId}</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">te escribió</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {incomingToast.contenido}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const contacto = contactos.find(
                  (c) => c.id.toLowerCase() === incomingToast.emisorId.toLowerCase(),
                ) || {
                  id: incomingToast.emisorId,
                  username: incomingToast.emisorId,
                  nombre: incomingToast.emisorId,
                  estado: 'En línea',
                };
                handleSeleccionarConversacion(contacto);
                if (!isOpen) handleToggle();
              }}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer transition-colors shadow-xs active:scale-95"
            >
              Ver
            </button>
            <button
              type="button"
              onClick={() => setIncomingToast(null)}
              aria-label="Descartar notificación"
              className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. BARRA MINIMIZADA (DOCK LIMPIO Y SÓLIDO) */}
      {!isOpen && (
        <div
          onClick={handleToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleToggle();
          }}
          aria-label="Abrir mensajes directos"
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
          className="w-72 sm:w-80 h-12 bg-white dark:bg-[#27272A] hover:bg-slate-50 dark:hover:bg-[#323236] border-t border-x border-slate-200/90 dark:border-zinc-800 rounded-t-2xl shadow-xl px-4 flex items-center justify-between cursor-pointer transition-all duration-200 select-none group"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-800 ${
                  isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Mensajes</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600 text-white animate-bounce shadow-xs">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-100 transition-colors">
            {!isSocketConnected && (
              <span className="text-[10px] text-amber-500 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3" />
                Desconectado
              </span>
            )}
            <ChevronUp className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
          </div>
        </div>
      )}

      {/* 3. VENTANA DE MENSAJERÍA COMPLETA (INBOX + CONVERSACIÓN) */}
      {isOpen && (
        <div
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
          className="w-80 sm:w-96 h-[520px] bg-white dark:bg-[#18181B] border-t border-x border-slate-200/90 dark:border-zinc-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
        >
          {/* Banner de feedback si el WebSocket está desconectado */}
          {!isSocketConnected && (
            <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-200 shrink-0">
              <span className="flex items-center gap-1.5 truncate font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>WebSocket desconectado</span>
              </span>
              <button
                type="button"
                onClick={conectarSocket}
                className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer ml-2 shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Reconectar
              </button>
            </div>
          )}

          {/* Banner de feedback temporal de error en envío */}
          {sendFeedback && (
            <div className="bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800 px-3 py-1 text-[11px] text-rose-700 dark:text-rose-200 shrink-0 animate-in fade-in flex items-center justify-between">
              <span>{sendFeedback}</span>
              <button
                type="button"
                onClick={() => setSendFeedback(null)}
                className="text-rose-500 hover:text-rose-700 ml-2"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Toast sutil de confirmación de envío exitoso */}
          {lastSentSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800/80 px-3 py-1 text-[11px] text-emerald-700 dark:text-emerald-300 shrink-0 animate-in fade-in flex items-center gap-1.5 font-medium">
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Mensaje enviado correctamente</span>
            </div>
          )}

          {/* === VISTA A: BANDEJA DE ENTRADA (LISTA DE CONVERSACIONES) === */}
          {activeView === 'inbox' && (
            <div
              style={{ backgroundColor: 'rgb(var(--color-surface))' }}
              className="flex-1 flex flex-col h-full bg-white dark:bg-[#18181B]"
            >
              {/* Header de la Bandeja */}
              <div
                style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shrink-0"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">Mensajes</h3>
                  <span
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      isSocketConnected
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60'
                        : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {isSocketConnected ? 'En vivo' : 'Offline'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Minimizar mensajes"
                    title="Minimizar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Cerrar mensajes"
                    title="Cerrar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Buscador de conversaciones y filtros */}
              <div
                style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                className="p-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shrink-0 space-y-2"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar o escribir @usuario..."
                    className="w-full bg-slate-100 dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 rounded-full pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans transition-all"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-2.5" />
                </div>

                {/* Filtros de Pestañas Normales */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setInboxFilter('todos')}
                    className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all cursor-pointer ${
                      inboxFilter === 'todos'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-[#27272A] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxFilter('directos')}
                    className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all cursor-pointer ${
                      inboxFilter === 'directos'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-[#27272A] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    Directos
                  </button>
                </div>
              </div>

              {/* Lista Vertical de Conversaciones */}
              <div
                style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/70 bg-white dark:bg-[#18181B]"
              >
                {contactosFiltrados.map((c) => {
                  const esActivo = contactoActivo.id.toLowerCase() === c.id.toLowerCase();
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSeleccionarConversacion(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSeleccionarConversacion(c);
                      }}
                      style={{ backgroundColor: esActivo ? undefined : 'rgb(var(--color-surface))' }}
                      className={`flex items-center gap-3 p-3.5 transition-colors cursor-pointer text-left ${
                        esActivo
                          ? 'bg-slate-100 dark:bg-[#27272A] border-l-[3.5px] border-indigo-600'
                          : 'bg-white dark:bg-[#18181B] hover:bg-slate-50 dark:hover:bg-[#222226] border-l-[3.5px] border-transparent'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt={c.nombre}
                            className={`w-10 h-10 rounded-full object-cover transition-all ${
                              esActivo
                                ? 'ring-2 ring-indigo-500 shadow-xs'
                                : 'ring-1 ring-slate-200 dark:ring-zinc-700'
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-full text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center transition-all ${
                              esActivo
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500'
                                : 'bg-slate-100 dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700'
                            }`}
                          >
                            {avatarLetra(c.nombre)}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-800" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs truncate ${
                              esActivo
                                ? 'font-bold text-slate-900 dark:text-zinc-100'
                                : 'font-semibold text-slate-900 dark:text-zinc-100'
                            }`}
                          >
                            {c.nombre}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">{c.tiempo}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                          @{c.username}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate mt-0.5">
                          {c.ultimoMensaje}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Si no coincide con ninguno, ofrecer crear chat con el @usuario buscado */}
                {searchTerm.trim() && contactosFiltrados.length === 0 && (
                  <div className="p-4 text-center">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">
                      No hay conversaciones con &quot;{searchTerm}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCrearChatCustom(searchTerm)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                    >
                      Iniciar chat con @{searchTerm.trim().replace(/^@/, '')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === VISTA B: CONVERSACIÓN INDIVIDUAL (CHAT ABIERTO) === */}
          {activeView === 'conversation' && (
            <div
              style={{ backgroundColor: 'rgb(var(--color-surface))' }}
              className="flex-1 flex flex-col h-full bg-white dark:bg-[#18181B]"
            >
              {/* Header de la Conversación */}
              <div
                style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shrink-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={handleVolverAInbox}
                    aria-label="Volver a lista de mensajes"
                    title="Volver"
                    className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="relative shrink-0">
                    {contactoActivo.avatar ? (
                      <img
                        src={contactoActivo.avatar}
                        alt={contactoActivo.nombre}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-zinc-700"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#27272A] text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                        {avatarLetra(contactoActivo.nombre)}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-800" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 truncate">
                        {contactoActivo.nombre}
                      </h4>
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                      @{contactoActivo.username} ·{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {contactoActivo.estado}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Minimizar mensajes"
                    title="Minimizar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Cerrar mensajes"
                    title="Cerrar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Historial de Mensajes: Lienzo Sólido */}
              <div
                ref={scrollRef}
                style={{ backgroundColor: 'rgb(var(--color-chat-bg))' }}
                className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-100 dark:bg-[#121214] scroll-smooth"
              >
                {mensajesDelContacto.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-zinc-400 py-4 px-3">
                    <div className="relative mb-2.5">
                      {contactoActivo.avatar ? (
                        <img
                          src={contactoActivo.avatar}
                          alt={contactoActivo.nombre}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-200 dark:ring-zinc-700 shadow-md"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                          className="w-14 h-14 rounded-full bg-white dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-base font-bold text-slate-800 dark:text-zinc-200 shadow-sm"
                        >
                          {avatarLetra(contactoActivo.nombre)}
                        </div>
                      )}
                      <div
                        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                        className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 text-indigo-500 shadow-xs"
                      >
                        <Sparkles className="w-3 h-3" />
                      </div>
                    </div>

                    <p className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                      {contactoActivo.nombre}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                      @{contactoActivo.username}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 max-w-[210px] leading-relaxed">
                      Mensajes directos cifrados e instantáneos en TuxFlow.
                    </p>

                    {/* Sugerencias Rápidas para Iniciar Conversación */}
                    <div className="mt-3 flex flex-wrap gap-1.5 justify-center max-w-[240px]">
                      {SUGERENCIAS_INICIO.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => enviarMensajeTexto(sug)}
                          className="text-[10px] px-2.5 py-1 bg-white dark:bg-[#27272A] hover:bg-slate-50 dark:hover:bg-[#323236] text-slate-700 dark:text-zinc-200 rounded-full border border-slate-200 dark:border-zinc-700 cursor-pointer shadow-xs transition-all hover:scale-105 active:scale-95"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  mensajesDelContacto.map((m, idx) => {
                    const isMe = m.emisorId === currentUserId;
                    return (
                      <div
                        key={idx}
                        className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <div
                            style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                            className="w-5 h-5 rounded-full bg-white dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-[9px] font-bold text-slate-800 dark:text-zinc-200 shrink-0 mb-0.5 shadow-xs"
                          >
                            {contactoActivo.avatar ? (
                              <img
                                src={contactoActivo.avatar}
                                alt=""
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              avatarLetra(contactoActivo.nombre)
                            )}
                          </div>
                        )}

                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[78%]`}>
                          {/* Globo de Mensaje: Índigo normal para propios, Superficie sólida para recibidos */}
                          <div
                            style={!isMe ? { backgroundColor: 'rgb(var(--color-surface))' } : undefined}
                            className={`text-xs px-3.5 py-2 leading-relaxed ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-2xl rounded-br-xs shadow-xs font-normal'
                                : 'bg-white dark:bg-[#27272A] text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700/80 rounded-2xl rounded-bl-xs shadow-xs'
                            }`}
                          >
                            {m.contenido}
                          </div>
                          <div
                            className={`flex items-center gap-1 mt-0.5 px-1 text-[9px] text-slate-500 dark:text-zinc-400 ${
                              isMe ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span>{formatearHora(m.timestamp)}</span>
                            {isMe && (
                              <>
                                {m.status === 'enviando' && (
                                  <span title="Enviando...">
                                    <Clock className="w-3 h-3 text-indigo-300 animate-pulse" />
                                  </span>
                                )}
                                {m.status === 'fallido' && (
                                  <button
                                    type="button"
                                    onClick={() => handleReintentar(m)}
                                    title="Error al enviar. Clic para reintentar"
                                    className="inline-flex items-center gap-0.5 text-rose-500 hover:text-rose-600 cursor-pointer"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    <RotateCw className="w-2.5 h-2.5 ml-0.5" />
                                  </button>
                                )}
                                {(!m.status || m.status === 'enviado') && (
                                  <span title="Mensaje entregado por WebSocket">
                                    <CheckCheck className="w-3 h-3 text-indigo-400" />
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Barra Rápida de Reacciones Emoji */}
              <div
                style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                className="px-3 py-1.5 bg-white dark:bg-[#18181B] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0"
              >
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 mr-1 flex items-center gap-1 font-medium">
                    <Smile className="w-3 h-3 text-indigo-500" />
                    Reaccionar:
                  </span>
                  {EMOJIS_RAPIDOS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setMensaje((prev) => prev + emoji)}
                      className="text-xs p-1 hover:scale-125 transition-transform cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-zinc-800"
                      title={`Insertar ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compositor en Píldora Redondeada */}
              <form
                onSubmit={handleEnviar}
                style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                className="p-2.5 bg-white dark:bg-[#18181B] border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2 shrink-0"
              >
                <div className="flex-1 flex items-center bg-slate-100 dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 rounded-full px-3.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
                  <input
                    type="text"
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder={`Mensaje a @${contactoActivo.username}...`}
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!mensaje.trim()}
                  className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all cursor-pointer shadow-xs flex items-center justify-center shrink-0 active:scale-95"
                  title="Enviar mensaje"
                  aria-label="Enviar mensaje"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
