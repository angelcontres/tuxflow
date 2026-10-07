import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ChatMessage, ConversacionChat, EstadoChat, FilaChat } from '../types/chat.types';
import { chatSocketManager } from '../services/chatSocket';
import { obtenerConversaciones, obtenerHistorial } from '../services/chatApi';
import { fetchSeguidos } from '../../network/services/networkApi';

interface ChatWidgetProps {
  currentUserId: string;
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

export const ChatWidget: React.FC<ChatWidgetProps> = ({ currentUserId }) => {
  const [abierto, setAbierto] = useState<boolean>(false);
  const [enConversacion, setEnConversacion] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>('');
  const [filas, setFilas] = useState<FilaChat[]>([]);
  const [seleccion, setSeleccion] = useState<FilaChat | null>(null);
  const [mensaje, setMensaje] = useState<string>('');
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [estado, setEstado] = useState<EstadoChat>({ estado: 'conectando', intento: 0 });
  const [cargandoLista, setCargandoLista] = useState<boolean>(false);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Interlocutor vigente, legible desde el manejador del socket.
   *
   * <p>Hace falta porque ese manejador se registra una sola vez, al montar, y desde ahí no puede
   * leer el estado de cada mensaje entrante: cerraría sobre el valor que tenía la conversación en
   * ese instante, que al montar es ninguna. Con eso, el filtro de "este mensaje es de esta
   * conversación" descartaría todo lo que llegara y el chat no mostraría nunca nada.
   */
  const interlocutorRef = useRef<string>('');
  interlocutorRef.current = seleccion?.id ?? '';

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
    // El efecto no depende de la conversación a propósito: si dependiera, abrir otra cerraría y
    // reabriría el canal, y lo que hubiera en vuelo se perdería. El valor vigente se lee a través
    // de la referencia de arriba, que no es una dependencia porque no cambia.
  }, [currentUserId]);

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
    if (!abierto) return undefined;

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
  }, [abierto, currentUserId]);

  /**
   * Carga el historial de la conversación abierta.
   *
   * <p>Ya no hay espera de escritura: antes el interlocutor se tecleaba letra a letra y cada
   * pulsación disparaba una petición. Ahora se elige de una lista, así que la petición se hace una
   * vez por conversación abierta.
   */
  useEffect(() => {
    if (!seleccion) {
      setMensajes([]);
      setCargandoHistorial(false);
      setErrorHistorial(null);
      return undefined;
    }

    let cancelado = false;
    setCargandoHistorial(true);
    setErrorHistorial(null);

    obtenerHistorial(currentUserId, seleccion.id)
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
  }, [seleccion, currentUserId]);

  useEffect(() => {
    const nodo = scrollRef.current;
    if (nodo) {
      nodo.scrollTop = nodo.scrollHeight;
    }
  }, [mensajes]);

  const abrirFila = (fila: FilaChat): void => {
    setEnConversacion(true);
    setSeleccion(fila);
  };

  const volverALista = (): void => {
    setEnConversacion(false);
    setSeleccion(null);
  };

  const enviar = (evento: React.FormEvent): void => {
    evento.preventDefault();
    const texto = mensaje.trim();
    const destinatario = seleccion?.id;
    if (!texto || !destinatario) return;

    const entregado = chatSocketManager.sendMessage(destinatario, texto);
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
        destinatarioId: destinatario,
        contenido: texto,
        estado: 'PENDIENTE',
      } as Pendiente,
    ]);
    setMensaje('');
    // La fila del interlocutor pasa a tener conversación aunque la lista no se vuelva a pedir. Si
    // no, volver atrás después de escribir la primera palabra mostraría "Sin mensajes" sobre una
    // conversación que existe.
    marcarEnviado(destinatario, texto);
  };

  /** Deja la fila del interlocutor al día con lo que se acaba de escribir. */
  const marcarEnviado = (destinatarioId: string, contenido: string): void => {
    setFilas((previas) =>
      previas.map((fila) =>
        fila.id === destinatarioId
          ? {
              ...fila,
              conMensajes: true,
              ultimoMensaje: contenido,
              fechaUltimoMensaje: Date.now(),
            }
          : fila,
      ),
    );
  };

  const reintentarHistorial = useCallback(() => {
    if (!seleccion) return;
    setCargandoHistorial(true);
    obtenerHistorial(currentUserId, seleccion.id)
      .then((historial) => {
        setMensajes(historial);
        setErrorHistorial(null);
      })
      .catch(() => setErrorHistorial('No se pudo cargar el historial.'))
      .finally(() => setCargandoHistorial(false));
  }, [seleccion, currentUserId]);

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    if (texto === '') return filas;
    return filas.filter((fila) =>
      normalizar(`${fila.nombre ?? ''} ${fila.username}`).includes(texto),
    );
  }, [filas, busqueda]);

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

  const cabecera = (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {enConversacion ? (
          <button
            type="button"
            onClick={volverALista}
            aria-label="Volver a la lista de conversaciones"
            className="cursor-pointer rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
            <MessageSquare className="h-4 w-4" />
          </span>
        )}
        <h3 className="truncate text-sm font-semibold text-slate-900">
          {enConversacion && seleccion
            ? seleccion.nombre || `@${seleccion.username}`
            : 'Mensajes en vivo'}
        </h3>
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
  );

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col">
      {!enConversacion && (
        <div className="border-b border-slate-200 p-3">
          <label htmlFor="chat-buscar" className="sr-only">
            Buscar conversación
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="chat-buscar"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o usuario"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {!enConversacion ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {cargandoLista ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-xs text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              Cargando conversaciones...
            </div>
          ) : errorLista ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-xs text-red-600">{errorLista}</p>
              <p className="text-[11px] text-slate-400">
                Cierra y vuelve a abrir el chat para intentarlo de nuevo.
              </p>
            </div>
          ) : visibles.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center text-xs text-slate-400">
              <MessageSquare className="mb-1 h-6 w-6 text-slate-300" />
              <p>
                {busqueda.trim() === ''
                  ? 'Todavía no has escrito con nadie.'
                  : 'Ninguna conversación coincide con la búsqueda.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {visibles.map((fila) => (
                <li key={fila.id}>
                  <FilaConversacion fila={fila} onAbrir={abrirFila} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
            {cargandoHistorial ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-xs text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Cargando historial...
              </div>
            ) : errorHistorial ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
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
              <div className="flex h-full flex-col items-center justify-center py-10 text-center text-xs text-slate-400">
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

          <form onSubmit={enviar} className="flex gap-2 border-t border-slate-200 p-3">
            <label htmlFor="chat-mensaje" className="sr-only">
              Escribe un mensaje
            </label>
            <input
              id="chat-mensaje"
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!mensaje.trim()}
              aria-label="Enviar mensaje"
              className="cursor-pointer rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </>
      )}

      {estado.estado !== 'conectado' && (
        <p className="border-t border-slate-200 px-4 py-2 text-center text-[11px] text-amber-600">
          {estado.estado === 'conectando'
            ? 'Reintentando la conexión con el servidor...'
            : 'Sin conexión con el canal de chat.'}
        </p>
      )}
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

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[80vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {cabecera}
      {panel}
    </div>
  );
};

/**
 * Fila de la lista de destino.
 *
 * <p>El avatar cae a la inicial si no hay imagen o si la imagen no carga, igual que en el resto de la
 * aplicación: un retrato roto en una lista corta da la impresión de que el perfil está vacío.
 */
const FilaConversacion: React.FC<{ fila: FilaChat; onAbrir: (fila: FilaChat) => void }> = ({
  fila,
  onAbrir,
}) => {
  const [avatarCaido, setAvatarCaido] = useState<boolean>(false);
  const inicial = (fila.nombre || fila.username || '?').charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onAbrir(fila)}
      className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-slate-100"
    >
      {fila.avatarUrl && !avatarCaido ? (
        <img
          src={fila.avatarUrl}
          alt={`Avatar de @${fila.username}`}
          className="h-8 w-8 shrink-0 rounded-full bg-slate-200 object-cover"
          onError={() => setAvatarCaido(true)}
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {inicial}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-slate-800">
          {fila.nombre || `@${fila.username}`}
        </span>
        <span className="block truncate text-[11px] text-slate-500">
          {fila.conMensajes ? fila.ultimoMensaje : `@${fila.username} · Sin mensajes`}
        </span>
      </span>
    </button>
  );
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
  if (nuevo.emisorId !== currentUserId && nuevo.emisorId !== interlocutor) {
    return previos;
  }

  return [...previos, nuevo];
};
