import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Send, X, Quote, AlertCircle, Loader2 } from 'lucide-react';
import { Comentario, Post } from '../types/post.types';
import {
  crearComentario,
  fetchComentarios,
  likeComentario,
  unlikeComentario,
} from '../services/comentarioApi';
import { formatFecha } from '../utils/formatFecha';
import { isThemePost, extractThemeKey, getPostCardTheme } from '../utils/postThemes';

interface ComentariosModalProps {
  post: Post;
  currentUserId: string;
  onClose: () => void;
  onOpenPerfil?: (usuarioId: string) => void;
}

/**
 * Avatar con la misma degradación que `PostCard`: si la imagen falla o no hay, se pinta la inicial.
 * Nunca un hueco ni una imagen rota.
 */
const AvatarComentario: React.FC<{ username: string; avatarUrl?: string; grande?: boolean }> = ({
  username,
  avatarUrl,
  grande,
}) => {
  const [caido, setCaido] = useState(false);
  const mostrar = Boolean(avatarUrl) && !caido;
  const dimension = grande ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  return (
    <div
      className={`${dimension} rounded-full bg-slateDark-primary text-white flex items-center justify-center font-bold overflow-hidden shrink-0 ring-1 ring-slateDark-border`}
    >
      {mostrar && avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="w-full h-full object-cover"
          onError={() => setCaido(true)}
        />
      ) : (
        (username || '?').charAt(0).toUpperCase()
      )}
    </div>
  );
};

const FilaComentario: React.FC<{
  comentario: Comentario;
  esRespuesta?: boolean;
  enVuelo: boolean;
  respondiendo: boolean;
  onLike: (comentario: Comentario) => void;
  onResponder: (comentario: Comentario | null) => void;
  children?: React.ReactNode;
}> = ({ comentario, esRespuesta, enVuelo, respondiendo, onLike, onResponder, children }) => (
  <div className={esRespuesta ? 'mt-3' : ''}>
    <div className="flex items-start gap-2.5">
      <AvatarComentario username={comentario.autorUsername} avatarUrl={comentario.autorAvatar} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slateDark-text leading-relaxed break-words">
          <span className="font-semibold mr-1.5">@{comentario.autorUsername}</span>
          {comentario.texto}
        </div>
        <div className="mt-1 flex items-center gap-4 text-[11px] text-slateDark-textMuted">
          <span>{formatFecha(comentario.fechaCreacion)}</span>
          <button
            type="button"
            onClick={() => onLike(comentario)}
            disabled={enVuelo}
            aria-pressed={comentario.likedByMe}
            aria-label={comentario.likedByMe ? 'Quitar Me Gusta' : 'Me gusta'}
            className={`flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-60 ${
              comentario.likedByMe ? 'text-rose-500 font-semibold' : 'hover:text-rose-400'
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 ${comentario.likedByMe ? 'fill-rose-500 text-rose-500' : ''}`}
            />
            {comentario.totalLikes > 0 && <span>{comentario.totalLikes}</span>}
          </button>
          {!esRespuesta && (
            <button
              type="button"
              onClick={() => onResponder(respondiendo ? null : comentario)}
              className="hover:text-slateDark-primaryLight transition-colors cursor-pointer font-medium"
            >
              {respondiendo ? 'Cancelar' : 'Responder'}
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  </div>
);

/**
 * Hilo de comentarios de una publicación (US (por definir)).
 *
 * Estilo Instagram web: la publicación a la izquierda y los comentarios a la derecha con scroll
 * propio; en móvil sólo queda el hilo, con una cabecera compacta de la publicación. El like de cada
 * comentario es optimista con reversión, el mismo contrato que el like de la tarjeta.
 */
export const ComentariosModal: React.FC<ComentariosModalProps> = ({
  post,
  currentUserId,
  onClose,
  onOpenPerfil,
}) => {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [textoNuevo, setTextoNuevo] = useState<string>('');
  const [enviandoNuevo, setEnviandoNuevo] = useState<boolean>(false);
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);

  const [respondiendoA, setRespondiendoA] = useState<Comentario | null>(null);
  const [textoRespuesta, setTextoRespuesta] = useState<string>('');
  const [enviandoRespuesta, setEnviandoRespuesta] = useState<boolean>(false);
  const [errorRespuesta, setErrorRespuesta] = useState<string | null>(null);

  const [likesEnVuelo, setLikesEnVuelo] = useState<string[]>([]);
  const [errorLike, setErrorLike] = useState<string | null>(null);

  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const datos = await fetchComentarios(post.id, currentUserId);
      if (montado.current) setComentarios(datos);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
      if (montado.current)
        setErrorCarga('No se pudieron cargar los comentarios. Inténtalo de nuevo.');
    } finally {
      if (montado.current) setCargando(false);
    }
  }, [post.id, currentUserId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Escape cierra el modal. Se registra una sola vez y se limpia al desmontar.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  const agregarComentario = (nuevo: Comentario) => {
    // El servidor es la fuente de verdad: se añade el objeto que devolvió, no uno reconstruido con
    // los datos del formulario, para que id, fecha y autor salgan del mismo sitio que en la recarga.
    setComentarios((previos) => [...previos, nuevo]);
  };

  const enviarNuevo = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = textoNuevo.trim();
    if (!texto || enviandoNuevo) return;
    setEnviandoNuevo(true);
    setErrorNuevo(null);
    try {
      const creado = await crearComentario(post.id, { userId: currentUserId, texto });
      agregarComentario(creado);
      setTextoNuevo('');
    } catch (err) {
      console.error('Error al comentar:', err);
      setErrorNuevo('No se pudo publicar el comentario. Inténtalo de nuevo.');
    } finally {
      setEnviandoNuevo(false);
    }
  };

  const enviarRespuesta = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = textoRespuesta.trim();
    if (!texto || !respondiendoA || enviandoRespuesta) return;
    setEnviandoRespuesta(true);
    setErrorRespuesta(null);
    try {
      const creado = await crearComentario(post.id, {
        userId: currentUserId,
        texto,
        parentId: respondiendoA.id,
      });
      agregarComentario(creado);
      setTextoRespuesta('');
      setRespondiendoA(null);
    } catch (err) {
      console.error('Error al responder:', err);
      setErrorRespuesta('No se pudo publicar la respuesta. Inténtalo de nuevo.');
    } finally {
      setEnviandoRespuesta(false);
    }
  };

  const alternarLike = async (comentario: Comentario) => {
    if (likesEnVuelo.includes(comentario.id)) return;
    const activoPrevio = comentario.likedByMe;
    const previo = { likedByMe: comentario.likedByMe, totalLikes: comentario.totalLikes };

    setErrorLike(null);
    setLikesEnVuelo((previos) => [...previos, comentario.id]);
    // Optimista: el corazón responde al instante. El total nunca baja de cero.
    setComentarios((previos) =>
      previos.map((c) =>
        c.id === comentario.id
          ? {
              ...c,
              likedByMe: !activoPrevio,
              totalLikes: Math.max(0, c.totalLikes + (activoPrevio ? -1 : 1)),
            }
          : c,
      ),
    );

    try {
      const estado = activoPrevio
        ? await unlikeComentario(post.id, comentario.id, currentUserId)
        : await likeComentario(post.id, comentario.id, currentUserId);
      // El servidor manda: se sobreescribe el incremento local para no arrastrar deriva.
      setComentarios((previos) =>
        previos.map((c) =>
          c.id === comentario.id
            ? { ...c, likedByMe: estado.likedByMe, totalLikes: estado.totalLikes }
            : c,
        ),
      );
    } catch (err) {
      console.error('Error al reaccionar al comentario:', err);
      // Reversión completa al estado previo al clic.
      setComentarios((previos) =>
        previos.map((c) => (c.id === comentario.id ? { ...c, ...previo } : c)),
      );
      setErrorLike('No se pudo registrar tu Me Gusta. Inténtalo de nuevo.');
    } finally {
      setLikesEnVuelo((previos) => previos.filter((id) => id !== comentario.id));
    }
  };

  const raices = comentarios.filter((c) => !c.parentId);
  const respuestasDe = (padreId: string) => comentarios.filter((c) => c.parentId === padreId);

  const hasTheme = isThemePost(post.mediaUrl);
  const cardTheme = hasTheme ? getPostCardTheme(extractThemeKey(post.mediaUrl)) : null;

  const cabeceraPost = (compacta: boolean) => (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={!onOpenPerfil}
        onClick={() => {
          onClose();
          onOpenPerfil?.(post.autorId);
        }}
        aria-label={`Ver perfil de @${post.autorUsername}`}
        className={`rounded-full shrink-0 ${onOpenPerfil ? 'cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-indigo-500' : ''}`}
      >
        <AvatarComentario
          username={post.autorUsername}
          avatarUrl={post.autorAvatar}
          grande={!compacta}
        />
      </button>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          disabled={!onOpenPerfil}
          onClick={() => {
            onClose();
            onOpenPerfil?.(post.autorId);
          }}
          className={`font-semibold text-slateDark-text text-sm truncate text-left ${
            onOpenPerfil ? 'hover:underline cursor-pointer hover:text-indigo-400' : ''
          }`}
        >
          @{post.autorUsername}
        </button>
        <p className="text-[11px] text-slateDark-textMuted">{formatFecha(post.fechaCreacion)}</p>
      </div>
    </div>
  );

  const formularioRespuesta = (
    <form onSubmit={enviarRespuesta} className="mt-2 flex items-center gap-2">
      <input
        autoFocus
        value={textoRespuesta}
        onChange={(e) => setTextoRespuesta(e.target.value)}
        placeholder={`Responder a @${respondiendoA?.autorUsername ?? ''}...`}
        className="flex-1 bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg px-3 py-1.5 text-xs text-slateDark-text placeholder:text-slateDark-textMuted/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={!textoRespuesta.trim() || enviandoRespuesta}
        className="text-slateDark-primaryLight text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {enviandoRespuesta ? 'Enviando...' : 'Publicar'}
      </button>
    </form>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comentarios-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full h-full sm:h-[88vh] sm:max-h-[820px] max-w-5xl bg-slateDark-surface sm:rounded-2xl shadow-2xl border border-slateDark-border flex flex-col sm:flex-row overflow-hidden">
        {/* Panel de la publicación (sólo escritorio) */}
        <div className="hidden md:flex md:w-[45%] flex-col bg-slateDark-surfaceSubtle/40 border-r border-slateDark-borderSubtle">
          <div className="p-4 border-b border-slateDark-borderSubtle">{cabeceraPost(false)}</div>
          <div className="flex-1 overflow-y-auto p-5">
            {hasTheme && cardTheme ? (
              <div
                className={`rounded-2xl p-6 relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[160px] ${cardTheme.gradientClass}`}
              >
                <Quote
                  className={`w-8 h-8 absolute top-2.5 left-3 opacity-20 ${cardTheme.quoteColor}`}
                />
                <div className="relative z-10 text-base font-medium leading-relaxed break-words">
                  {post.texto}
                </div>
                <span
                  className={`mt-3 text-[9px] tracking-wider uppercase font-bold px-2.5 py-0.5 rounded-full border ${cardTheme.badgeStyle}`}
                >
                  {cardTheme.nombre}
                </span>
              </div>
            ) : (
              <>
                <p className="text-sm text-slateDark-text leading-relaxed break-words mb-3">
                  {post.texto}
                </p>
                {post.mediaUrl && (
                  <img
                    src={post.mediaUrl}
                    alt="Contenido multimedia"
                    className="w-full rounded-xl border border-slateDark-borderSubtle object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Panel de comentarios */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slateDark-borderSubtle shrink-0">
            <h2
              id="comentarios-titulo"
              className="text-sm font-semibold text-slateDark-text flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Comentarios
              {!cargando && (
                <span className="text-slateDark-textMuted">({comentarios.length})</span>
              )}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar comentarios"
              className="p-1 rounded-lg text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cabecera compacta de la publicación en móvil */}
          <div className="md:hidden p-4 border-b border-slateDark-borderSubtle shrink-0">
            {cabeceraPost(true)}
            <p className="mt-2 text-sm text-slateDark-text leading-relaxed break-words">
              {post.texto}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4" data-testid="lista-comentarios">
            {cargando ? (
              <div className="flex items-center justify-center py-10 text-slateDark-textMuted">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : errorCarga ? (
              <div className="text-center py-8">
                <p role="alert" className="text-xs text-rose-400 mb-3">
                  {errorCarga}
                </p>
                <button
                  type="button"
                  onClick={cargar}
                  className="text-xs font-semibold text-slateDark-primaryLight hover:underline cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            ) : raices.length === 0 ? (
              <div className="text-center py-12 text-slateDark-textMuted">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium text-slateDark-text">
                  Todavía no hay comentarios
                </p>
                <p className="text-xs mt-1">Sé el primero en comentar.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {raices.map((raiz) => {
                  const respuestas = respuestasDe(raiz.id);
                  return (
                    <FilaComentario
                      key={raiz.id}
                      comentario={raiz}
                      enVuelo={likesEnVuelo.includes(raiz.id)}
                      respondiendo={respondiendoA?.id === raiz.id}
                      onLike={alternarLike}
                      onResponder={setRespondiendoA}
                    >
                      {respuestas.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-slateDark-borderSubtle">
                          {respuestas.map((respuesta) => (
                            <FilaComentario
                              key={respuesta.id}
                              comentario={respuesta}
                              esRespuesta
                              enVuelo={likesEnVuelo.includes(respuesta.id)}
                              respondiendo={false}
                              onLike={alternarLike}
                              onResponder={setRespondiendoA}
                            />
                          ))}
                        </div>
                      )}
                      {respondiendoA?.id === raiz.id && formularioRespuesta}
                    </FilaComentario>
                  );
                })}
              </div>
            )}

            {errorLike && (
              <p role="alert" className="mt-3 text-xs text-rose-400">
                {errorLike}
              </p>
            )}
          </div>

          <form
            onSubmit={enviarNuevo}
            className="border-t border-slateDark-borderSubtle p-3 shrink-0"
          >
            {errorNuevo && (
              <p role="alert" className="mb-2 text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errorNuevo}
              </p>
            )}
            {errorRespuesta && (
              <p role="alert" className="mb-2 text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errorRespuesta}
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                value={textoNuevo}
                onChange={(e) => setTextoNuevo(e.target.value)}
                placeholder="Escribe un comentario..."
                aria-label="Escribe un comentario"
                className="flex-1 bg-slateDark-surfaceSubtle border border-slateDark-border rounded-full px-4 py-2 text-sm text-slateDark-text placeholder:text-slateDark-textMuted/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!textoNuevo.trim() || enviandoNuevo}
                aria-label="Publicar comentario"
                className="p-2 rounded-full bg-slateDark-primary hover:bg-slateDark-primaryHover text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {enviandoNuevo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
