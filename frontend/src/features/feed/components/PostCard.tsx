import React, { useState } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { Post } from '../types/post.types';
import { togglePostLike } from '../services/feedApi';

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onLikeChanged: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, currentUserId, onLikeChanged }) => {
  const [isLiked, setIsLiked] = useState<boolean>(post.likedByMe);
  const [likesCount, setLikesCount] = useState<number>(post.totalLikes);

  React.useEffect(() => {
    setIsLiked(post.likedByMe);
    setLikesCount(post.totalLikes);
  }, [post.likedByMe, post.totalLikes]);

  const handleLike = async () => {
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      await togglePostLike(post.id, currentUserId);
      onLikeChanged();
    } catch (err) {
      setIsLiked(!nextState);
      setLikesCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
      console.error('Error al dar like:', err);
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

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 mb-4 hover:border-slate-300 transition-colors">
      {/* Header del Post */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 shadow-xs">
          {post.autorAvatar ? (
            <img
              src={post.autorAvatar}
              alt={post.autorUsername}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
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
          <p className="text-[11px] text-slate-400">Publicado en el grafo social</p>
        </div>
      </div>

      {/* Contenido de Texto */}
      <div className="text-sm text-slate-800 leading-relaxed mb-3 break-words">
        {renderFormattedText(post.texto)}
      </div>

      {/* Multimedia Adjunta (MinIO S3 o Externa) */}
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

      {/* Barra de Acciones / Interacciones */}
      <div className="pt-3 border-t border-slate-100 flex items-center gap-6 text-slate-500 text-xs">
        {/* Like */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            isLiked ? 'text-rose-600 font-semibold' : 'hover:text-rose-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
          <span>{likesCount}</span>
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
