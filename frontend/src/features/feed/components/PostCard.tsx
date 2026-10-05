import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, ThumbsDown } from 'lucide-react';
import { Post, ReactionResponse } from '../types/post.types';
import { dislikePost, likePost, undislikePost, unlikePost } from '../services/feedApi';
import { formatFecha } from '../utils/formatFecha';

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

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <span key={i} className="text-blue-600 font-medium hover:underline cursor-pointer">
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

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 mb-4 hover:border-slate-300 transition-colors">
      {/* Header del Post */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 shadow-xs">
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
            <span className="font-semibold text-slate-900 text-sm hover:underline cursor-pointer truncate">
              @{post.autorUsername}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">{formatFecha(post.fechaCreacion)}</p>
        </div>
      </div>

      {/* Contenido de Texto */}
      <div className="text-sm text-slate-800 leading-relaxed mb-3 break-words">
        {renderFormattedText(post.texto)}
      </div>

      {/* Imagen adjunta */}
      {post.mediaUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 mb-3 max-h-[450px] flex items-center justify-center">
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

      {/* Error de reacción: visible para el usuario. El console.error es apoyo de diagnostico, no aviso. */}
      {errorReaccion && (
        <p role="alert" className="mb-2 text-xs text-rose-600">
          {errorReaccion}
        </p>
      )}

      {/* Barra de Acciones / Interacciones */}
      <div className="pt-3 border-t border-slate-100 flex items-center gap-6 text-slate-500 text-xs">
        {/* Like */}
        <button
          onClick={() => handleReaccion('like')}
          disabled={enVuelo}
          aria-pressed={isLiked}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-progress ${
            isLiked ? 'text-rose-600 font-semibold' : 'hover:text-rose-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
          <span>{likesCount}</span>
        </button>

        {/* Dislike */}
        <button
          onClick={() => handleReaccion('dislike')}
          disabled={enVuelo}
          aria-pressed={isDisliked}
          aria-label="No me gusta"
          className={`flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-progress ${
            isDisliked ? 'text-amber-600 font-semibold' : 'hover:text-amber-600'
          }`}
        >
          <ThumbsDown className={`w-4 h-4 ${isDisliked ? 'fill-amber-600 text-amber-600' : ''}`} />
          <span>{dislikesCount}</span>
        </button>

        {/* Comentarios */}
        <button className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer">
          <MessageCircle className="w-4 h-4" />
          <span>Comentar</span>
        </button>

        {/* Compartir */}
        <button className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer">
          <Share2 className="w-4 h-4" />
          <span>Compartir</span>
        </button>
      </div>
    </article>
  );
};
