import React from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { Post } from '../types/post.types';
import { togglePostLike } from '../services/feedApi';

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onLikeChanged: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, currentUserId, onLikeChanged }) => {
  const handleLike = async () => {
    try {
      await togglePostLike(post.id, currentUserId);
      onLikeChanged();
    } catch (err) {
      console.error('Error al dar like:', err);
    }
  };

  return (
    <article className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 mb-4 transition-all hover:border-slate-300">
      {/* Post Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-slate-100">
            {post.autorAvatar ? (
              <img
                src={post.autorAvatar}
                alt={post.autorUsername}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              post.autorUsername.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-900">@{post.autorUsername}</span>
              <span className="text-[11px] text-slate-400">• Amigo en Grafo</span>
            </div>
            <span className="text-xs text-slate-400 block">{post.fechaCreacion || 'Reciente'}</span>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Post Content */}
      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line mb-3">
        {post.texto}
      </p>

      {/* Optional Media (S3 / MinIO) */}
      {post.mediaUrl && (
        <div className="mb-4 rounded-xl overflow-hidden border border-slate-100 max-h-[420px] bg-slate-900">
          <img
            src={post.mediaUrl}
            alt="Multimedia de post"
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>
      )}

      {/* Actions Bar */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500 text-xs">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
            post.likedByMe
              ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
              : 'hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span>
            {post.totalLikes} {post.totalLikes === 1 ? 'Me gusta' : 'Me gustas'}
          </span>
        </button>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium hover:bg-slate-100 hover:text-slate-800 transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span>Comentar</span>
        </button>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium hover:bg-slate-100 hover:text-slate-800 transition-colors">
          <Share2 className="w-4 h-4" />
          <span>Compartir</span>
        </button>
      </div>
    </article>
  );
};
