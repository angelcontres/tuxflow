import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  MessageSquare,
  Send,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ChatMessage, EstadoChat } from '../types/chat.types';
import { chatSocketManager } from '../services/chatSocket';
import { obtenerHistorial } from '../services/chatApi';

interface ChatWidgetProps {
  currentUserId: string;
}

/** Antes de pedir historial hay que esperar a que el interlocutor deje de cambiar al escribir. */
const ESPERA_DE_ESCRITURA_MS = 400;

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

export const ChatWidget: React.FC<ChatWidgetProps> = ({ currentUserId }) => {
  const [abierto, setAbierto] = useState<boolean>(false);
  const [interlocutor, setInterlocutor] = useState<string>('');
  const [mensaje, setMensaje] = useState<string>('');
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [estado, setEstado] = useState<EstadoChat>({ estado: 'conectando', intento: 0 });
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Interlocutor vigente, legible desde el manejador del socket.
   *
   * <p>Hace falta porque ese manejador se registra una sola vez, al montar, y desde ahí no puede
   * leer el estado de cada mensaje entrante: cerraría sobre el valor que tenía el interlocutor en
   * ese instante, que al montar está vacío. Con eso, el filtro de "este mensaje es de esta
   * conversación" descartaría todo lo que llegara y el chat no mostraría nunca nada.
   */
  const interlocutorRef = useRef<string>(interlocutor);
  interlocutorRef.current = interlocutor;

  const interlocutorValido = interlocutor.trim() !== '' && interlocutor.trim() !== currentUserId;

  /**
   * Abre el canal una vez por montaje.
   *
   * <p>App.tsx monta el widget con `key={currentUserId}`, así que al cambiar de usuario React
   * desmonta este componente y crea otro limpio. Sin esa clave el socket seguiría conectado con la
   * identidad anterior durante toda la sesión y los mensajes se irían a la persona equivocada.
   */
  useEffect(() => {
    chatSocketManager.connect(
      currentUserId,
      (nuevo) => {
        setMensajes((previos) =>
          incorporar(previos, nuevo, currentUserId, interlocutorRef.current),
        );
      },
      (siguiente) => setEstado(siguiente),
    );
    return () => {
      chatSocketManager.disconnect();
    };
    // El efecto no depende de `interlocutor` a propósito: si dependiera, cambiar de interlocutor
    // cerraría y reabriría el canal, y lo que hubiera en vuelo se perdería. El valor vigente se lee
    // a través de la referencia de arriba, que no es una dependencia porque no cambia.
  }, [currentUserId]);

  /**
   * Carga el historial de la conversación abierta.
   *
   * <p>La espera de escritura evita una petición por pulsación: el ID se escribe letra a letra.
   */
  useEffect(() => {
    const otro = interlocutor.trim();
    if (!otro || otro === currentUserId) {
      setMensajes([]);
      setCargandoHistorial(false);
      setErrorHistorial(null);
      return undefined;
    }

    let cancelado = false;
    setCargandoHistorial(true);
    setErrorHistorial(null);

    const temporizador = setTimeout(() => {
      obtenerHistorial(currentUserId, otro)
        .then((historial) => {
          if (cancelado) return;
          setMensajes(historial);
          setErrorHistorial(null);
        })
        .catch(() => {
          if (cancelado) return;
          setMensajes([]);
          setErrorHistorial('No se pudo cargar el historial.');
        })
        .finally(() => {
          if (!cancelado) setCargandoHistorial(false);
        });
    }, ESPERA_DE_ESCRITURA_MS);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [interlocutor, currentUserId]);

  useEffect(() => {
    const nodo = scrollRef.current;
    if (nodo) {
      nodo.scrollTop = nodo.scrollHeight;
    }
  }, [mensajes]);

  const enviar = (evento: React.FormEvent): void => {
    evento.preventDefault();
    const texto = mensaje.trim();
    if (!texto || !interlocutorValido) return;

    const entregado = chatSocketManager.sendMessage(interlocutor.trim(), texto);
    if (!entregado) {
      // El texto se conserva a propósito: borrarlo perdería lo escrito por un canal que no está listo.
      return;
    }

    // La burbuja aparece antes de que el servidor confirme, y con estado provisional. Sin esto, un
    // envío se vería como si no hubiera pasado hasta que llegue la respuesta.
    setMensajes((previos) => [
      ...previos,
      {
        clave: nuevaClave(),
        emisorId: currentUserId,
        destinatarioId: interlocutor.trim(),
        contenido: texto,
        estado: 'PENDIENTE',
      } as Pendiente,
    ]);
    setMensaje('');
  };

  const reintentarHistorial = useCallback(() => {
    const otro = interlocutor.trim();
    if (!otro) return;
    setCargandoHistorial(true);
    obtenerHistorial(currentUserId, otro)
      .then((historial) => {
        setMensajes(historial);
        setErrorHistorial(null);
      })
      .catch(() => setErrorHistorial('No se pudo cargar el historial.'))
      .finally(() => setCargandoHistorial(false));
  }, [interlocutor, currentUserId]);

  const claseEstado = useMemo(() => {
    switch (estado.estado) {
      case 'conectado':
        return 'text-emerald-700 bg-emerald-50 border-emerald-100';
      case 'conectando':
        return 'text-amber-700 bg-amber-50 border-amber-100';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  }, [estado.estado]);

  const burbaja = () => (
    <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
            <MessageSquare className="h-4 w-4" />
          </span>
          <h3 className="truncate text-sm font-semibold text-slate-900">Mensajes en vivo</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${claseEstado}`}
            title={
              estado.intento > 0
                ? `${estado.intento} intento(s) de reconexión`
                : ETIQUETA_ESTADO[estado.estado]
            }
          >
            {estado.estado === 'conectado' ? (
              <Wifi className="h-3 w-3" />
            ) : estado.estado === 'conectando' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{ETIQUETA_ESTADO[estado.estado]}</span>
          </span>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Minimizar el chat"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <label
          htmlFor="chat-interlocutor"
          className="mb-1 block text-[11px] font-medium text-slate-600"
        >
          Enviar mensaje a (ID)
        </label>
        <div className="relative mb-3">
          <User className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            id="chat-interlocutor"
            type="text"
            value={interlocutor}
            onChange={(e) => setInterlocutor(e.target.value)}
            placeholder="ID de usuario (ej. paulo-orrala)"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 font-mono text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div
          ref={scrollRef}
          className="mb-3 h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          {cargandoHistorial ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              Cargando historial...
            </div>
          ) : errorHistorial ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-xs text-red-600">{errorHistorial}</p>
              <button
                type="button"
                onClick={reintentarHistorial}
                className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Reintentar
              </button>
            </div>
          ) : mensajes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-4 text-center text-xs text-slate-400">
              <MessageSquare className="mb-1 h-6 w-6 text-slate-300" />
              <p>No hay mensajes en esta conversación.</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Escribe para iniciar el chat en tiempo real.
              </p>
            </div>
          ) : (
            mensajes.map((m) => (
              <Burbuja key={claveDe(m)} mensaje={m} currentUserId={currentUserId} />
            ))
          )}
        </div>

        <form onSubmit={enviar} className="flex gap-2">
          <input
            type="text"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder={
              interlocutorValido ? 'Escribe un mensaje...' : 'Escribe un ID de usuario arriba'
            }
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!mensaje.trim() || !interlocutorValido}
            aria-label="Enviar mensaje"
            className="cursor-pointer rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>

        {estado.estado !== 'conectado' && (
          <p className="mt-2 text-center text-[11px] text-amber-600">
            {estado.estado === 'conectando'
              ? 'Reintentando la conexión con el servidor...'
              : 'Sin conexión con el canal de chat.'}
          </p>
        )}
      </div>
    </div>
  );

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir el chat"
        className="fixed bottom-4 right-4 z-50 flex cursor-pointer items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-2xl transition-colors hover:bg-blue-700"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="hidden sm:inline">Chat</span>
        {estado.estado !== 'conectado' && (
          <span
            className="h-2 w-2 rounded-full bg-amber-400"
            title={ETIQUETA_ESTADO[estado.estado]}
          />
        )}
      </button>
    );
  }

  return burbaja();
};

/** Clave estable para React: el id del servidor en cuanto llega, y la clave local mientras no exista. */
const claveDe = (mensaje: ChatMessage): string => {
  const local = (mensaje as Pendiente).clave;
  return (
    mensaje.id ?? local ?? `${mensaje.emisorId}-${mensaje.timestamp ?? ''}-${mensaje.contenido}`
  );
};

const Burbuja: React.FC<{ mensaje: ChatMessage; currentUserId: string }> = ({
  mensaje,
  currentUserId,
}) => {
  const mio = mensaje.emisorId === currentUserId;
  // Solo lo que salió de este navegador y sigue sin acuse está pendiente. Un mensaje propio que
  // viene del historial ya está guardado desde antes, aunque no traiga estado: si se tratara
  // cualquier cosa sin `estado` como pendiente, al cargar la conversación cada mensaje propio
  // antiguo se quedaría con "Enviando..." para siempre.
  const pendiente = mensaje.estado === 'PENDIENTE';
  const fallido = mensaje.estado === 'NO_ENTREGADO' || mensaje.estado === 'RECHAZADO';

  return (
    <div className={`flex flex-col ${mio ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-left text-xs ${
          mio
            ? 'rounded-br-xs bg-blue-600 text-white'
            : 'rounded-bl-xs border border-slate-200 bg-white text-slate-800'
        } ${fallido ? 'opacity-70' : ''}`}
      >
        {mensaje.contenido}
      </div>
      {mio && (pendiente || fallido) && (
        <span
          className={`mt-0.5 text-[10px] ${fallido ? 'text-red-500' : 'text-slate-400'}`}
          title={mensaje.motivo}
        >
          {fallido ? mensaje.motivo : 'Enviando...'}
        </span>
      )}
    </div>
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
  if (nuevo.emisorId !== currentUserId && nuevo.emisorId !== interlocutor.trim()) {
    return previos;
  }

  return [...previos, nuevo];
};
