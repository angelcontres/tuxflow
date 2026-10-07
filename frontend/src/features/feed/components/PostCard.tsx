import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, ThumbsDown, Check, Quote, Sparkles } from 'lucide-react';
import { Post, ReactionResponse } from '../types/post.types';
import { dislikePost, likePost, undislikePost, unlikePost } from '../services/feedApi';
import { formatFecha } from '../utils/formatFecha';
import { isThemePost, extractThemeKey, getPostCardTheme } from '../utils/postThemes';

interface PostCardProps {
  post: Post;
  currentUserId: string;
}

type TipoReaccion = 'like' | 'dislike';

export const PostCard: React.FC<PostCardProps> = ({ post, currentUserId }) => {
  const [isLiked, setIsLiked] = useState<boolean>(post.likedByMe);
  const [likesCount, setLikesCount] = useState<number>(post.totalLikes);
  const [isDisliked, setIsDisliked] = useState<boolean>(post.dislikedByMe ?? false);
  const [dislikesCount, setDislikesCount] = useState<number>(post.totalDislikes ?? 0);
  const [avatarCaido, setAvatarCaido] = useState<boolean>(false);
  const [reaccionEnVuelo, setReaccionEnVuelo] = useState<TipoReaccion | null>(null);
  const [errorReaccion, setErrorReaccion] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);
  const [showSparkles, setShowSparkles] = useState<boolean>(false);

  const handleCompartir = async () => {
    try {
      const url = `${window.location.origin}/#post-${post.id}`;
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  React.useEffect(() => {
    setIsLiked(post.likedByMe);
    setLikesCount(post.totalLikes);
    setIsDisliked(post.dislikedByMe ?? false);
    setDislikesCount(post.totalDislikes ?? 0);
  }, [post.likedByMe, post.totalLikes, post.dislikedByMe, post.totalDislikes]);

  // Si cambia el post, el nuevo avatar merece su propio intento de carga.
  React.useEffect(() => {
    setAvatarCaido(false);
  }, [post.autorAvatar]);

  const handleReaccion = async (tipo: TipoReaccion) => {
    // Un clic en vuelo se ignora: dos peticiones simultáneas podrían llegar en orden inverso y
    // dejar el contador con el valor de la más antigua.
    if (reaccionEnVuelo) return;

    const esLike = tipo === 'like';
    const activoPrevio = esLike ? isLiked : isDisliked;

    if (!activoPrevio && esLike) {
      setShowSparkles(true);
      setTimeout(() => setShowSparkles(false), 700);
    }
    // Foto previa de las cuatro piezas: el efecto cruzado toca ambas mitades y la reversión
    // tiene que restaurarlas todas.
    const previo = {
      liked: isLiked,
      disliked: isDisliked,
      likes: likesCount,
      dislikes: dislikesCount,
    };
    setReaccionEnVuelo(tipo);
    setErrorReaccion(null);

    // Actualizacion optimista con interruptor y efecto cruzado: como like y dislike son
    // mutuamente excluyentes, activar uno desmarca el otro y mueve ambos contadores.
    if (activoPrevio) {
      if (esLike) {
        setIsLiked(false);
        setLikesCount((prev) => prev - 1);
      } else {
        setIsDisliked(false);
        setDislikesCount((prev) => prev - 1);
      }
    } else if (esLike) {
      setIsLiked(true);
      setLikesCount((prev) => prev + 1);
      if (isDisliked) {
        setIsDisliked(false);
        setDislikesCount((prev) => prev - 1);
      }
    } else {
      setIsDisliked(true);
      setDislikesCount((prev) => prev + 1);
      if (isLiked) {
        setIsLiked(false);
        setLikesCount((prev) => prev - 1);
      }
    }

    try {
      // El servidor devuelve el estado completo (ambas banderas y ambos totales), que manda
      // sobre el incremento local: solo servia para que la UI respondiera al instante.
      const resultado: ReactionResponse = activoPrevio
        ? await (esLike
            ? unlikePost(post.id, currentUserId)
            : undislikePost(post.id, currentUserId))
        : await (esLike ? likePost(post.id, currentUserId) : dislikePost(post.id, currentUserId));
      setIsLiked(resultado.likedByMe);
      setIsDisliked(resultado.dislikedByMe);
      setLikesCount(resultado.totalLikes);
      setDislikesCount(resultado.totalDislikes);
    } catch (err) {
      // Reversión completa: marcas y contadores vuelven a la foto previa al clic.
      setIsLiked(previo.liked);
      setIsDisliked(previo.disliked);
      setLikesCount(previo.likes);
      setDislikesCount(previo.dislikes);
      setErrorReaccion(
        esLike
          ? 'No se pudo registrar tu Me Gusta. Inténtalo de nuevo.'
          : 'No se pudo registrar tu No me gusta. Inténtalo de nuevo.',
      );
      console.error('Error al reaccionar:', err);
    } finally {
      setReaccionEnVuelo(null);
    }
  };

  const renderFormattedText = (text: string, customTagClass?: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <span
            key={i}
            className={
              customTagClass ||
              'text-slateDark-primaryLight font-medium hover:underline cursor-pointer'
            }
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const initial = (post.autorUsername || '?').charAt(0).toUpperCase();
  const avatarUrl = post.autorAvatar;
  // Mismo patron que UserSuggestionsCard: con avatar caido se muestra la
  // inicial, nunca una imagen rota ni un círculo vacío (D3).
  const mostrarAvatar = Boolean(avatarUrl) && !avatarCaido;
  const enVuelo = reaccionEnVuelo !== null;

  const hasTheme = isThemePost(post.mediaUrl);
  const cardTheme = hasTheme ? getPostCardTheme(extractThemeKey(post.mediaUrl)) : null;

  return (
    <article className="bg-slateDark-surface rounded-xl border border-slateDark-borderSubtle shadow-xs p-5 mb-4 hover:border-slateDark-border hover:shadow-md transition-all duration-200">
      {/* Header del Post */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-slateDark-primary text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 shadow-xs ring-1 ring-slateDark-border">
          {mostrarAvatar && avatarUrl ? (
            <img
              src={avatarUrl}
              alt={post.autorUsername}
              className="w-full h-full object-cover"
              onError={() => setAvatarCaido(true)}
            />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slateDark-text text-sm hover:underline cursor-pointer truncate">
              @{post.autorUsername}
            </span>
          </div>
          <p className="text-[11px] text-slateDark-textMuted">{formatFecha(post.fechaCreacion)}</p>
        </div>
      </div>

      {/* Contenido Visual: Tarjeta Estética con Fondo o Texto Normal */}
      {hasTheme && cardTheme ? (
        <div
          className={`rounded-2xl p-6 sm:p-7 mb-3 relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[130px] ${cardTheme.gradientClass}`}
        >
          <Quote className={`w-10 h-10 absolute top-2.5 left-3 opacity-20 ${cardTheme.quoteColor}`} />
          <div className="relative z-10 text-base sm:text-lg font-medium leading-relaxed max-w-xl break-words">
            {renderFormattedText(post.texto, cardTheme.tagClass)}
          </div>
          <span
            className={`mt-3.5 text-[9px] tracking-wider uppercase font-bold px-2.5 py-0.5 rounded-full border ${cardTheme.badgeStyle}`}
          >
            {cardTheme.nombre}
          </span>
        </div>
      ) : (
        <>
          {/* Contenido de Texto */}
          <div className="text-sm text-slateDark-text leading-relaxed mb-3 break-words">
            {renderFormattedText(post.texto)}
          </div>

          {/* Imagen adjunta */}
          {post.mediaUrl && !hasTheme && (
            <div className="rounded-xl overflow-hidden border border-slateDark-borderSubtle bg-slateDark-surfaceSubtle mb-3 max-h-[450px] flex items-center justify-center">
              <img
                src={post.mediaUrl}
                alt="Contenido multimedia"
                className="w-full max-h-[450px] object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Error de reacción: visible para el usuario. El console.error es apoyo de diagnostico, no aviso. */}
      {errorReaccion && (
        <p role="alert" className="mb-2 text-xs text-rose-400">
          {errorReaccion}
        </p>
      )}

      {/* Barra de Acciones / Interacciones */}
      <div className="pt-3 border-t border-slateDark-borderSubtle flex items-center gap-6 text-slateDark-textMuted text-xs">
        {/* Like */}
        <button
          onClick={() => handleReaccion('like')}
          disabled={enVuelo}
          aria-pressed={isLiked}
          className={`flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-progress active:scale-95 relative ${
            isLiked ? 'text-rose-500 font-semibold' : 'hover:text-rose-400'
          }`}
        >
          <span className="relative inline-flex items-center justify-center">
            <Heart
              className={`w-4 h-4 transition-transform ${
                isLiked ? 'fill-rose-500 text-rose-500 animate-heart-pop' : ''
              }`}
            />
            {showSparkles && (
              <span className="absolute -inset-1.5 pointer-events-none flex items-center justify-center animate-sparkle-burst">
                <Sparkles className="w-5 h-5 text-rose-400" />
              </span>
            )}
          </span>
          <span>{likesCount}</span>
        </button>

        {/* Dislike */}
        <button
          onClick={() => handleReaccion('dislike')}
          disabled={enVuelo}
          aria-pressed={isDisliked}
          aria-label="No me gusta"
          className={`flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-progress active:scale-125 ${
            isDisliked ? 'text-amber-500 font-semibold' : 'hover:text-amber-400'
          }`}
        >
          <ThumbsDown className={`w-4 h-4 transition-transform ${isDisliked ? 'fill-amber-500 text-amber-500 scale-110' : ''}`} />
          <span>{dislikesCount}</span>
        </button>

        {/* Comentarios */}
        <button className="flex items-center gap-1.5 hover:text-slateDark-primaryLight transition-colors cursor-pointer">
          <MessageCircle className="w-4 h-4" />
          <span>Comentar</span>
        </button>

        {/* Compartir / Copiar Enlace */}
        <button
          onClick={handleCompartir}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            copiado ? 'text-emerald-400 font-medium' : 'hover:text-slateDark-primaryLight'
          }`}
          title="Copiar enlace del post"
        >
          {copiado ? (
            <>
              <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in-50" />
              <span>¡Copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Compartir</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
