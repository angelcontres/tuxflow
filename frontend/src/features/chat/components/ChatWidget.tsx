import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  CheckCheck,
  CheckCircle2,
  ChevronUp,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Minimize2,
  RefreshCw,
  RotateCw,
  Search,
  Smile,
  Sparkles,
  X,
} from 'lucide-react';
import { ChatMessage, ConversacionChat, EstadoChat, FilaChat } from '../types/chat.types';
import { chatSocketManager } from '../services/chatSocket';
import { obtenerConversaciones, obtenerHistorial } from '../services/chatApi';
import { fetchSeguidos } from '../../network/services/networkApi';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';

const EMOJIS_RAPIDOS = ['❤️', '🔥', '👍', '😂', '🎉', '🚀', '👋', '✨'];
const SUGERENCIAS_INICIO = ['👋 ¡Hola!', '🚀 ¿Cómo va el proyecto?', '✨ ¡Mucho gusto!'];

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

const ETIQUETA_ESTADO: Record<EstadoChat['estado'], string> = {
  conectado: 'Conectado',
  conectando: 'Reconectando',
  desconectado: 'Sin conexión',
};

/** Burbuja pendiente: aún sin id porque el servidor no ha confirmado el guardado. */
interface Pendiente extends ChatMessage {
  /** Clave local y estable para React. El id del servidor aún no existe. */
  clave: string;
}

let contadorClaves = 0;
const nuevaClave = (): string => {
  contadorClaves += 1;
  return `local-${contadorClaves}`;
};

/**
 * Quita tildes y baja a minúsculas, para comparar lo que se escribe con lo que está guardado.
 *
 * <p>Sin esto, buscar "Angel" no encuentra a "Ángel" ni "ángel", y en una comunidad con nombres
 * acentuados la búsqueda falla justo en los casos que más se usan. La descomposición Unicode
 * (NFD) separa la tilde de la letra, así que el mismo criterio sirve para las dos.
 */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Junta la bandeja de conversaciones con las personas a las que se sigue.
 *
 * <p>La lista de destino no es solo "con quién he hablado": también está quien se sigue y con quien
 * todavía no se ha escrito nada. Si no estuviera, escribirle por primera vez a una persona a la que
 * sigues exigiría cerrar el chat y buscarla en la barra lateral, que es un rodeo para algo que la
 * propia pantalla del chat puede resolver.
 *
 * <p>Las conversaciones van primero y por fecha, porque son las que tienen algo que leer. Los
 * demás salen detrás y por nombre, para que la lista nueva no salga en el orden en que el servidor
 * devuelve los seguidos, que es el orden del grafo y no uno que signifique nada para quien lee.
 *
 * @param conversaciones lo que devuelve `GET /chat/conversaciones`
 * @param seguidos lo que devuelve `GET /users/{id}/follows`
 * @param yo el usuario abierto: se descarta de ambos lados, porque una conversación consigo mismo no
 *   se puede abrir y el servidor rechaza esos envíos
 */
export function fusionarFilas(
  conversaciones: ConversacionChat[] | undefined,
  seguidos: { id: string; username: string; nombre?: string; avatarUrl?: string }[] | undefined,
  yo: string,
): FilaChat[] {
  const filas: FilaChat[] = [];
  const vistos = new Set<string>();

  const agregar = (fila: FilaChat): void => {
    if (!fila.id || fila.id === yo || vistos.has(fila.id)) {
      return;
    }
    vistos.add(fila.id);
    filas.push(fila);
  };

  if (Array.isArray(conversaciones)) {
    for (const conversacion of conversaciones) {
      if (conversacion && typeof conversacion.id === 'string') {
        agregar({ ...conversacion, conMensajes: true });
      }
    }
  }

  if (Array.isArray(seguidos)) {
    for (const seguido of seguidos) {
      if (seguido && typeof seguido.id === 'string' && typeof seguido.username === 'string') {
        agregar({
          id: seguido.id,
          username: seguido.username,
          nombre: seguido.nombre,
          avatarUrl: seguido.avatarUrl,
          conMensajes: false,
        });
      }
    }
  }

  // Solo se reordena la parte sin conversación. La de arriba viene ya ordenada por fecha desde el
  // servidor y volver a tocarla en JavaScript perdería un criterio que la base de datos resolvió
  // mejor.
  const conMensajes = filas.filter((fila) => fila.conMensajes);
  const sinMensajes = filas
    .filter((fila) => !fila.conMensajes)
    .sort((a, b) =>
      normalizar(a.nombre || a.username).localeCompare(normalizar(b.nombre || b.username)),
    );

  return [...conMensajes, ...sinMensajes];
}

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
  // Apertura: la controla App si pasa las props, y si no el propio widget.
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : internalIsOpen;

  const [activeView, setActiveView] = useState<'inbox' | 'conversation'>('inbox');
  const [contactoActivo, setContactoActivo] = useState<FilaChat | null>(null);
  const [filas, setFilas] = useState<FilaChat[]>([]);
  const [busqueda, setBusqueda] = useState<string>('');
  const [inboxFilter, setInboxFilter] = useState<'todos' | 'directos'>('todos');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [mensaje, setMensaje] = useState<string>('');
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [estado, setEstado] = useState<EstadoChat>({ estado: 'conectando', intento: 0 });
  const [cargandoLista, setCargandoLista] = useState<boolean>(false);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);

  // Toast de notificación flotante para mensajes entrantes en segundo plano
  const [incomingToast, setIncomingToast] = useState<{
    emisorId: string;
    nombre?: string;
    avatarUrl?: string;
    contenido: string;
  } | null>(null);

  // Feedback visual de envío y estado
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [lastSentSuccess, setLastSentSuccess] = useState<boolean>(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const contactoActivoRef = useRef(contactoActivo);
  const activeViewRef = useRef(activeView);
  const filasRef = useRef(filas);
  filasRef.current = filas;

  /**
   * Interlocutor vigente, legible desde el manejador del socket.
   *
   * <p>Hace falta porque ese manejador se registra una sola vez, al montar, y desde ahí no puede
   * leer el estado de cada mensaje entrante: cerraría sobre el valor que tenía la conversación en
   * ese instante, que al montar es ninguna. Con eso, el filtro de "este mensaje es de esta
   * conversación" descartaría todo lo que llegara y el chat no mostraría nunca nada.
   */
  const interlocutorRef = useRef<string>('');

  isOpenRef.current = isOpen;
  contactoActivoRef.current = contactoActivo;
  activeViewRef.current = activeView;
  interlocutorRef.current = contactoActivo?.id ?? '';

  const conectado = estado.estado === 'conectado';

  /**
   * Deja la fila del interlocutor al día con lo que se acaba de escribir o de recibir.
   *
   * <p>La fila pasa a tener conversación aunque la lista no se vuelva a pedir. Si no, volver atrás
   * después de escribir la primera palabra mostraría "Sin mensajes" sobre una conversación que ya
   * existe, y el mensaje recién llegado no se vería reflejado en la bandeja.
   */
  const sincronizarPreview = useCallback((contactoId: string, contenido: string): void => {
    setFilas((previas) => {
      const indice = previas.findIndex(
        (fila) => fila.id.toLowerCase() === contactoId.toLowerCase(),
      );
      if (indice === -1) {
        // Quien escribe sin estar en la lista local (por ejemplo, alguien que acaba de aparecer
        // con un mensaje entrante) se crea la fila para que la bandeja no la pierda.
        const limpio = contactoId.trim().replace(/^@/, '');
        if (!limpio) return previas;
        const nueva: FilaChat = {
          id: limpio,
          username: limpio,
          nombre: limpio.charAt(0).toUpperCase() + limpio.slice(1),
          conMensajes: true,
          ultimoMensaje: contenido,
          fechaUltimoMensaje: Date.now(),
        };
        return [nueva, ...previas];
      }
      const actualizada: FilaChat = {
        ...previas[indice],
        conMensajes: true,
        ultimoMensaje: contenido,
        fechaUltimoMensaje: Date.now(),
      };
      return [actualizada, ...previas.filter((_, i) => i !== indice)];
    });
  }, []);

  /**
   * Frame recibido del canal: lo mezcla en la conversación abierta y, si es un mensaje nuevo y no
   * un acuse, refresca la bandeja y avisa.
   */
  const manejarFrame = (nuevo: ChatMessage): void => {
    setMensajes((previos) => incorporar(previos, nuevo, currentUserId, interlocutorRef.current));

    // Un acuse no es un mensaje nuevo: no suena, no refresca la bandeja y no abre el aviso, porque
    // describe el desenlace de una burbuja que ya está en pantalla.
    const esAcuse = Boolean(nuevo.estado) && nuevo.estado !== 'PENDIENTE';
    if (esAcuse) return;

    const llegaDeOtro = nuevo.emisorId !== currentUserId;
    if (llegaDeOtro) {
      reproducirSonidoFeedback('receive');
      sincronizarPreview(nuevo.emisorId, nuevo.contenido);
    }

    const estaEnOtroChat =
      !isOpenRef.current ||
      activeViewRef.current !== 'conversation' ||
      (contactoActivoRef.current?.id.toLowerCase() ?? '') !== nuevo.emisorId.toLowerCase();

    if (llegaDeOtro && estaEnOtroChat) {
      setUnreadCount((c) => c + 1);
      const contacto = filasRef.current.find(
        (f) => f.id.toLowerCase() === nuevo.emisorId.toLowerCase(),
      );
      setIncomingToast({
        emisorId: nuevo.emisorId,
        nombre: contacto?.nombre || contacto?.username,
        avatarUrl: contacto?.avatarUrl,
        contenido: nuevo.contenido,
      });

      // Auto-cerrar toast tras 7 segundos
      const contenido = nuevo.contenido;
      setTimeout(() => {
        setIncomingToast((prev) => (prev?.contenido === contenido ? null : prev));
      }, 7000);
    }
  };

  /**
   * El manejador vigente se lee a través de la referencia para que el socket, que se registra una
   * sola vez por montaje, no se quede cerrado sobre la primera versión del render.
   */
  const manejarFrameRef = useRef(manejarFrame);
  manejarFrameRef.current = manejarFrame;

  const registrarFrame = useCallback((nuevo: ChatMessage): void => {
    manejarFrameRef.current(nuevo);
  }, []);

  const notificarEstado = useCallback((siguiente: EstadoChat): void => {
    setEstado(siguiente);
  }, []);

  /** Reconexión a mano desde el aviso de desconexión, para no esperar al siguiente reintento. */
  const reconectar = useCallback((): void => {
    chatSocketManager.disconnect();
    chatSocketManager.connect(currentUserId, registrarFrame, notificarEstado);
  }, [currentUserId, registrarFrame, notificarEstado]);

  /**
   * Abre el canal una vez por montaje.
   *
   * <p>App.tsx monta el widget con `key={currentUserId}`, así que al cambiar de usuario React
   * desmonta este componente y crea otro limpio. Sin esa clave el socket seguiría conectado con la
   * identidad anterior durante toda la sesión y los mensajes se irían a la persona equivocada.
   *
   * <p>El efecto no depende de la conversación a propósito: si dependiera, abrir otra cerraría y
   * reabriría el canal, y lo que hubiera en vuelo se perdería. El valor vigente se lee a través de
   * la referencia de arriba, que no es una dependencia porque no cambia.
   */
  useEffect(() => {
    chatSocketManager.connect(currentUserId, registrarFrame, notificarEstado);
    return () => {
      chatSocketManager.disconnect();
    };
  }, [currentUserId, registrarFrame, notificarEstado]);

  /**
   * Carga la lista de destino al abrir el panel, no al montar.
   *
   * <p>Se pide al abrir porque casi nadie mira la bandeja: quien monta el widget solo está pasando
   * por la página, y una petición por cada visita para pintar una lista que nadie miró sería trabajo
   * que se hace y se tira.
   *
   * <p>Un fallo al pedir los seguidos no hunde la lista: se degrada a la bandeja de conversaciones
   * sola. Perder el acceso para escribirle a alguien nuevo no es lo mismo que quedarse sin
   * conversaciones, y la segunda parte sí tiene algo que enseñar.
   */
  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelado = false;
    setCargandoLista(true);
    setErrorLista(null);

    Promise.all([
      obtenerConversaciones(currentUserId),
      fetchSeguidos(currentUserId).catch(() => []),
    ])
      .then(([conversaciones, seguidos]) => {
        if (cancelado) return;
        setFilas(fusionarFilas(conversaciones, seguidos, currentUserId));
        setCargandoLista(false);
      })
      .catch(() => {
        if (cancelado) return;
        setFilas([]);
        setCargandoLista(false);
        setErrorLista('No se pudieron cargar tus conversaciones.');
      });

    return () => {
      cancelado = true;
    };
  }, [isOpen, currentUserId]);

  /**
   * Carga el historial de la conversación abierta.
   *
   * <p>La dependencia es el interlocutor y no la lista de mensajes: si lo fuera, cada envío volvería
   * a pedir la conversación entera y reescribiría con ella las burbujas que acaban de aparecer. La
   * petición se hace una vez por conversación elegida.
   */
  useEffect(() => {
    const interlocutor = contactoActivo?.id;
    if (!interlocutor) {
      setMensajes([]);
      setCargandoHistorial(false);
      setErrorHistorial(null);
      return undefined;
    }

    let cancelado = false;
    setMensajes([]);
    setCargandoHistorial(true);
    setErrorHistorial(null);

    obtenerHistorial(currentUserId, interlocutor)
      .then((historial) => {
        if (cancelado) return;
        setMensajes(historial);
      })
      .catch(() => {
        if (cancelado) return;
        setMensajes([]);
        setErrorHistorial('No se pudo cargar el historial.');
      })
      .finally(() => {
        if (!cancelado) setCargandoHistorial(false);
      });

    return () => {
      cancelado = true;
    };
  }, [contactoActivo?.id, currentUserId]);

  useEffect(() => {
    if (isOpen && activeView === 'conversation' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, isOpen, activeView, contactoActivo]);

  const handleToggle = (): void => {
    if (onToggleExternal) {
      onToggleExternal();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
    if (!isOpen) {
      setUnreadCount(0);
      setIncomingToast(null);
    }
  };

  const handleClose = (): void => {
    if (onCloseExternal) {
      onCloseExternal();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleSeleccionarConversacion = (contacto: FilaChat): void => {
    setContactoActivo(contacto);
    setActiveView('conversation');
    setUnreadCount(0);
    setIncomingToast(null);
  };

  const handleVolverAInbox = (): void => {
    setActiveView('inbox');
  };

  const handleCrearChatCustom = (username: string): void => {
    const limpio = username.trim().replace(/^@/, '');
    if (!limpio) return;

    const existente = filas.find((fila) => fila.id.toLowerCase() === limpio.toLowerCase());
    if (existente) {
      handleSeleccionarConversacion(existente);
      setBusqueda('');
      return;
    }

    const nueva: FilaChat = {
      id: limpio,
      username: limpio,
      nombre: limpio.charAt(0).toUpperCase() + limpio.slice(1),
      conMensajes: false,
    };

    setFilas((previas) => [nueva, ...previas]);
    handleSeleccionarConversacion(nueva);
    setBusqueda('');
  };

  const enviarMensajeTexto = (texto: string): void => {
    const textoAEnviar = texto.trim();
    const destinatario = contactoActivo?.id;
    if (!textoAEnviar || !destinatario) return;

    const entregado = chatSocketManager.sendMessage(destinatario, textoAEnviar);
    if (!entregado) {
      // El texto se conserva a propósito: borrarlo perdería lo escrito por un canal que no está
      // listo, y al reconectar basta con volver a pulsar enviar.
      setSendFeedback('Sin conexión con el canal de chat. Tu mensaje se conserva en el campo.');
      setTimeout(() => setSendFeedback(null), 4000);
      return;
    }

    reproducirSonidoFeedback('send');
    setLastSentSuccess(true);
    setTimeout(() => setLastSentSuccess(false), 2000);

    // La burbuja aparece antes de que el servidor confirme, y con estado provisional. Sin esto, un
    // envío se vería como si no hubiera pasado hasta que llegue la respuesta.
    setMensajes((previos) => [
      ...previos,
      {
        clave: nuevaClave(),
        emisorId: currentUserId,
        destinatarioId: destinatario,
        contenido: textoAEnviar,
        timestamp: Date.now(),
        estado: 'PENDIENTE',
      } as Pendiente,
    ]);
    sincronizarPreview(destinatario, textoAEnviar);
    setMensaje('');
  };

  const handleEnviar = (evento: React.FormEvent): void => {
    evento.preventDefault();
    enviarMensajeTexto(mensaje);
  };

  /** Reenvía una burbuja que el servidor rechazó o no pudo entregar. */
  const reintentarMensaje = (m: ChatMessage): void => {
    const entregado = chatSocketManager.sendMessage(m.destinatarioId, m.contenido);
    if (!entregado) {
      setSendFeedback('Sigue sin conexión. Inténtalo de nuevo en unos segundos.');
      setTimeout(() => setSendFeedback(null), 3000);
      return;
    }

    reproducirSonidoFeedback('send');
    setMensajes((previos) =>
      previos.map((item) =>
        item === m
          ? { ...item, estado: 'PENDIENTE', motivo: undefined, timestamp: Date.now() }
          : item,
      ),
    );
  };

  const reintentarHistorial = (): void => {
    const interlocutor = contactoActivo?.id;
    if (!interlocutor) return;

    setCargandoHistorial(true);
    setErrorHistorial(null);
    obtenerHistorial(currentUserId, interlocutor)
      .then((historial) => setMensajes(historial))
      .catch(() => setErrorHistorial('No se pudo cargar el historial.'))
      .finally(() => setCargandoHistorial(false));
  };

  const avatarLetra = (nombre: string): string => (nombre ? nombre.charAt(0).toUpperCase() : '?');

  const tiempoFila = (fila: FilaChat): string =>
    fila.conMensajes ? formatearHora(fila.fechaUltimoMensaje) : '';

  const estadoFila = (fila: FilaChat): string =>
    fila.conMensajes ? 'Conversación activa' : 'Nuevo contacto';

  const filasVisibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return filas.filter((fila) => {
      const coincide =
        texto === '' || normalizar(`${fila.nombre ?? ''} ${fila.username}`).includes(texto);
      if (!coincide) return false;
      return inboxFilter === 'todos' || fila.conMensajes;
    });
  }, [filas, busqueda, inboxFilter]);

  // Mensajes correspondientes al contacto activo
  const mensajesDelContacto = useMemo(() => {
    if (!contactoActivo) return [];
    const interlocutor = contactoActivo.id.toLowerCase();
    return mensajes.filter(
      (m) =>
        m.destinatarioId.toLowerCase() === interlocutor ||
        m.emisorId.toLowerCase() === interlocutor,
    );
  }, [mensajes, contactoActivo]);

  return (
    <div
      className={
        isOpen
          ? 'fixed inset-0 sm:inset-auto sm:bottom-0 sm:right-6 z-50 flex flex-col justify-end pointer-events-none'
          : 'fixed bottom-4 right-4 sm:bottom-0 sm:right-6 z-50'
      }
    >
      {/* 1. NOTIFICACIÓN POPUP: BURBUJA FLOTANTE UNIFICADA Y ELEGANTE */}
      {incomingToast && (
        <div
          role="status"
          aria-live="polite"
          onClick={() => {
            const contacto = filas.find(
              (fila) => fila.id.toLowerCase() === incomingToast.emisorId.toLowerCase(),
            ) || {
              id: incomingToast.emisorId,
              username: incomingToast.emisorId,
              nombre: incomingToast.nombre || incomingToast.emisorId,
              avatarUrl: incomingToast.avatarUrl,
              conMensajes: true,
              ultimoMensaje: incomingToast.contenido,
              fechaUltimoMensaje: Date.now(),
            };
            handleSeleccionarConversacion(contacto);
            if (!isOpen) handleToggle();
            setIncomingToast(null);
          }}
          className="pointer-events-auto absolute bottom-20 sm:bottom-16 right-2 sm:right-0 max-w-[calc(100vw-2rem)] w-84 sm:w-92 z-50 animate-bubble-toast cursor-pointer select-none group"
        >
          <div
            style={{ backgroundColor: 'rgb(var(--color-surface))' }}
            className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-[#1C1C20]/95 backdrop-blur-xl border border-slate-200/90 dark:border-zinc-700/80 shadow-[0_12px_36px_rgba(0,0,0,0.12),0_4px_12px_rgba(99,102,241,0.08)] group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.16),0_6px_16px_rgba(99,102,241,0.15)] group-hover:border-indigo-500/40 transition-all duration-200"
          >
            {/* Burbuja con Foto/Avatar del Remitente */}
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-indigo-500/25 shadow-sm bg-slate-100 dark:bg-zinc-800 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                {incomingToast.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(incomingToast.avatarUrl)}
                    alt={incomingToast.nombre || incomingToast.emisorId}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm">
                    {(incomingToast.nombre || incomingToast.emisorId).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
            </div>

            {/* Contenido del Mensaje */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100 truncate">
                  {incomingToast.nombre || `@${incomingToast.emisorId}`}
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40 shrink-0">
                  te escribió
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 leading-relaxed break-words font-sans">
                {incomingToast.contenido}
              </p>
            </div>

            {/* Acciones: Cerrar y Ver */}
            <div className="flex flex-col items-end justify-between shrink-0 self-stretch gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIncomingToast(null);
                }}
                aria-label="Descartar notificación"
                className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const contacto = filas.find(
                    (fila) => fila.id.toLowerCase() === incomingToast.emisorId.toLowerCase(),
                  ) || {
                    id: incomingToast.emisorId,
                    username: incomingToast.emisorId,
                    nombre: incomingToast.nombre || incomingToast.emisorId,
                    avatarUrl: incomingToast.avatarUrl,
                    conMensajes: true,
                    ultimoMensaje: incomingToast.contenido,
                    fechaUltimoMensaje: Date.now(),
                  };
                  handleSeleccionarConversacion(contacto);
                  if (!isOpen) handleToggle();
                  setIncomingToast(null);
                }}
                className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[11px] font-semibold cursor-pointer transition-all shadow-xs active:scale-95 flex items-center gap-0.5"
              >
                <span>Ver</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. BARRA MINIMIZADA (DOCK EN DESKTOP / BURBUJA FLOTANTE EN MÓVIL) */}
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
          className="w-14 h-14 rounded-full sm:w-80 sm:h-12 sm:rounded-t-2xl sm:rounded-b-none bg-white dark:bg-[#27272A] hover:bg-slate-50 dark:hover:bg-[#323236] border border-slate-200/90 dark:border-zinc-800 sm:border-b-0 shadow-2xl sm:shadow-xl px-0 sm:px-4 flex items-center justify-center sm:justify-between cursor-pointer transition-all duration-300 select-none group active:scale-95 sm:active:scale-100"
        >
          {/* Vista móvil: Botón circular flotante con badges y efecto burbuja */}
          <div className="sm:hidden relative flex items-center justify-center w-full h-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span
              aria-hidden="true"
              className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-800 ${
                conectado ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-bounce shadow-md">
                {unreadCount}
              </span>
            )}
          </div>

          {/* Vista desktop: Barra dock clásica */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span
                title={ETIQUETA_ESTADO[estado.estado]}
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-800 ${
                  conectado ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                Mensajes
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600 text-white animate-bounce shadow-xs">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-100 transition-colors">
            {!conectado && (
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
          className="pointer-events-auto w-full h-[100dvh] sm:w-96 sm:h-[540px] bg-white dark:bg-[#18181B] sm:border-t sm:border-x border-slate-200/90 dark:border-zinc-800 sm:rounded-t-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 relative"
        >
          {/* Aviso si el canal de chat no está conectado */}
          {!conectado && (
            <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-200 shrink-0">
              <span className="flex items-center gap-1.5 truncate font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>{ETIQUETA_ESTADO[estado.estado]}</span>
                {estado.intento > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-normal">
                    · {estado.intento} intento(s)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={reconectar}
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
                      conectado
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60'
                        : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        conectado ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {conectado ? 'En vivo' : 'Offline'}
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
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
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
                {cargandoLista ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 py-10 text-xs text-slate-500 dark:text-zinc-400">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    Cargando conversaciones...
                  </div>
                ) : errorLista ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errorLista}</p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                      Cierra y vuelve a abrir el chat para intentarlo de nuevo.
                    </p>
                  </div>
                ) : filasVisibles.length === 0 && busqueda.trim() === '' ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 px-4 text-center text-xs text-slate-400 dark:text-zinc-500">
                    <MessageSquare className="w-6 h-6 mb-1 text-slate-300 dark:text-zinc-600" />
                    <p>Todavía no has escrito con nadie.</p>
                  </div>
                ) : (
                  <>
                    {filasVisibles.map((c) => {
                      const esActivo = contactoActivo?.id.toLowerCase() === c.id.toLowerCase();
                      const nombre = c.nombre || c.username;
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSeleccionarConversacion(c)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSeleccionarConversacion(c);
                          }}
                          style={{
                            backgroundColor: esActivo ? undefined : 'rgb(var(--color-surface))',
                          }}
                          className={`flex items-center gap-3 p-3.5 transition-colors cursor-pointer text-left ${
                            esActivo
                              ? 'bg-slate-100 dark:bg-[#27272A] border-l-[3.5px] border-indigo-600'
                              : 'bg-white dark:bg-[#18181B] hover:bg-slate-50 dark:hover:bg-[#222226] border-l-[3.5px] border-transparent'
                          }`}
                        >
                          <div className="relative shrink-0">
                            {c.avatarUrl ? (
                              <img
                                src={resolveMediaUrl(c.avatarUrl)}
                                alt={nombre}
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
                                {avatarLetra(nombre)}
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
                                {nombre}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                {tiempoFila(c)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                              @{c.username}
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate mt-0.5">
                              {c.conMensajes ? c.ultimoMensaje : `@${c.username} · Sin mensajes`}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Si no coincide con ninguno, ofrecer crear chat con el @usuario buscado */}
                    {busqueda.trim() && filasVisibles.length === 0 && (
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">
                          No hay conversaciones con &quot;{busqueda}&quot;
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCrearChatCustom(busqueda)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                        >
                          Iniciar chat con @{busqueda.trim().replace(/^@/, '')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* === VISTA B: CONVERSACIÓN INDIVIDUAL (CHAT ABIERTO) === */}
          {activeView === 'conversation' && contactoActivo && (
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
                    {contactoActivo.avatarUrl ? (
                      <img
                        src={resolveMediaUrl(contactoActivo.avatarUrl)}
                        alt={contactoActivo.nombre || contactoActivo.username}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-zinc-700"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#27272A] text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                        {avatarLetra(contactoActivo.nombre || contactoActivo.username)}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-800" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 truncate">
                        {contactoActivo.nombre || contactoActivo.username}
                      </h4>
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                      @{contactoActivo.username} ·{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {estadoFila(contactoActivo)}
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
                aria-label="Historial de mensajes"
                style={{ backgroundColor: 'rgb(var(--color-chat-bg))' }}
                className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-100 dark:bg-[#121214] scroll-smooth"
              >
                {cargandoHistorial ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    Cargando historial...
                  </div>
                ) : errorHistorial ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errorHistorial}</p>
                    <button
                      type="button"
                      onClick={reintentarHistorial}
                      className="cursor-pointer rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#27272A] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-zinc-200 transition-colors hover:bg-slate-50 dark:hover:bg-[#323236]"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : mensajesDelContacto.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-zinc-400 py-4 px-3">
                    <div className="relative mb-2.5">
                      {contactoActivo.avatarUrl ? (
                        <img
                          src={resolveMediaUrl(contactoActivo.avatarUrl)}
                          alt={contactoActivo.nombre || contactoActivo.username}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-200 dark:ring-zinc-700 shadow-md"
                        />
                      ) : (
                        <div
                          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                          className="w-14 h-14 rounded-full bg-white dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-base font-bold text-slate-800 dark:text-zinc-200 shadow-sm"
                        >
                          {avatarLetra(contactoActivo.nombre || contactoActivo.username)}
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
                      {contactoActivo.nombre || contactoActivo.username}
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
                  mensajesDelContacto.map((m) => {
                    const isMe = m.emisorId === currentUserId;
                    const fallido = m.estado === 'NO_ENTREGADO' || m.estado === 'RECHAZADO';
                    return (
                      <div
                        key={claveDe(m)}
                        className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <div
                            style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                            className="w-5 h-5 rounded-full bg-white dark:bg-[#27272A] border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-[9px] font-bold text-slate-800 dark:text-zinc-200 shrink-0 mb-0.5 shadow-xs"
                          >
                            {contactoActivo.avatarUrl ? (
                              <img
                                src={resolveMediaUrl(contactoActivo.avatarUrl)}
                                alt=""
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              avatarLetra(contactoActivo.nombre || contactoActivo.username)
                            )}
                          </div>
                        )}

                        <div
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[78%]`}
                        >
                          {/* Globo de Mensaje: Índigo normal para propios, Superficie sólida para recibidos */}
                          <div
                            style={
                              !isMe ? { backgroundColor: 'rgb(var(--color-surface))' } : undefined
                            }
                            className={`text-xs px-3.5 py-2 leading-relaxed ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-2xl rounded-br-xs shadow-xs font-normal'
                                : 'bg-white dark:bg-[#27272A] text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700/80 rounded-2xl rounded-bl-xs shadow-xs'
                            } ${fallido ? 'opacity-70' : ''}`}
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
                                {m.estado === 'PENDIENTE' && (
                                  <span
                                    className="inline-flex items-center gap-0.5"
                                    title="Enviando..."
                                  >
                                    <Clock className="w-3 h-3 text-indigo-300 animate-pulse" />
                                    Enviando...
                                  </span>
                                )}
                                {fallido && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => reintentarMensaje(m)}
                                      title={m.motivo || 'Error al enviar. Clic para reintentar'}
                                      aria-label="Reintentar envío"
                                      className="inline-flex items-center gap-0.5 text-rose-500 hover:text-rose-600 cursor-pointer"
                                    >
                                      <AlertTriangle className="w-3 h-3" />
                                      <RotateCw className="w-2.5 h-2.5 ml-0.5" />
                                    </button>
                                    {m.motivo && <span className="text-rose-500">{m.motivo}</span>}
                                  </>
                                )}
                                {m.estado !== 'PENDIENTE' && !fallido && (
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

/** Clave estable para React: el id del servidor en cuanto llega, y la clave local mientras no exista. */
const claveDe = (mensaje: ChatMessage): string => {
  const local = (mensaje as Pendiente).clave;
  return (
    mensaje.id ?? local ?? `${mensaje.emisorId}-${mensaje.timestamp ?? ''}-${mensaje.contenido}`
  );
};

/**
 * Incorpora un frame recibido a la conversación abierta.
 *
 * <p>Un acuse no es un mensaje nuevo: es el desenlace de una burbuja que ya está en pantalla, y si se
 * tratara como mensaje nuevo el emisor vería cada cosa que envía dos veces. Se distingue porque llega
 * con `estado`, campo que el servidor solo pone en los acuses.
 *
 * <p>De las burbujas que encajan se toma la más antigua, no la más reciente. Los acuses llegan en el
 * orden en que el servidor procesó los envíos, así que emparejar el primer acuse con la última
 * burbuja cruzaría los estados: un envío fallido aparecería en la primera burbuja y uno entregado en
 * la segunda, y quien leyera la conversación concluiría lo contrario de lo que pasó.
 */
const incorporar = (
  previos: ChatMessage[],
  nuevo: ChatMessage,
  currentUserId: string,
  interlocutor: string,
): ChatMessage[] => {
  if (nuevo.estado && nuevo.estado !== 'PENDIENTE') {
    const candidatos = previos
      .map((m, indice) => ({ m, indice }))
      .filter(
        ({ m }) =>
          !m.id &&
          m.emisorId === currentUserId &&
          m.destinatarioId === nuevo.destinatarioId &&
          m.contenido === nuevo.contenido,
      );
    const ultimo = candidatos[candidatos.length - 1];
    if (!ultimo) return previos;

    return previos.map((m, indice) =>
      indice === ultimo.indice ? { ...m, ...nuevo, clave: claveDe(m) } : m,
    );
  }

  // Los mensajes de otras conversaciones no se mezclan: la vista muestra una sola.
  if (nuevo.emisorId !== currentUserId && nuevo.emisorId !== interlocutor) {
    return previos;
  }

  return [...previos, nuevo];
};
