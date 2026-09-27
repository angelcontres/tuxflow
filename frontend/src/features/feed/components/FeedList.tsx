import React from 'react';
import { Post } from '../types/post.types';
import { PostCard } from './PostCard';
import { Users2 } from 'lucide-react';

interface FeedListProps {
  posts: Post[];
  currentUserId: string;
  onRefresh: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({ posts, currentUserId, onRefresh }) => {
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
          <Users2 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-800 mb-1">
          Tu feed de grafo social está vacío
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 leading-relaxed">
          Las publicaciones se obtienen mediante la relación Cypher de 2 saltos: solo verás posts de
          usuarios a quienes sigues. ¡Empieza a conectar con otros integrantes!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onLikeChanged={onRefresh}
        />
      ))}
    </div>
  );
};
