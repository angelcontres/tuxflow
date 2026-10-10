import React from 'react';
import { Post } from '../types/post.types';
import { PostCard } from './PostCard';
import { MessageSquareOff } from 'lucide-react';

interface FeedListProps {
  posts: Post[];
  currentUserId: string;
  onComentar?: (post: Post) => void;
  onOpenPerfil?: (usuarioId: string) => void;
  onComentarioCreado?: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({
  posts,
  currentUserId,
  onComentar,
  onOpenPerfil,
}) => {
  return (
    <div className="w-full space-y-4">
      {posts.length === 0 ? (
        <div className="bg-slateDark-surface rounded-xl p-8 text-center border border-slateDark-borderSubtle shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slateDark-surfaceSubtle text-slateDark-textMuted flex items-center justify-center mx-auto mb-3 border border-slateDark-borderSubtle">
            <MessageSquareOff className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-slateDark-text mb-1">
            No hay publicaciones en tu feed
          </h4>
          <p className="text-xs text-slateDark-textMuted max-w-sm mx-auto">
            Sigue a otros miembros de la red en la columna lateral para ver sus publicaciones aquí.
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onComentar={onComentar}
            onOpenPerfil={onOpenPerfil}
          />
        ))
      )}
    </div>
  );
};
