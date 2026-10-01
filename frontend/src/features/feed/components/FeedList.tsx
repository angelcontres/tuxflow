import React from 'react';
import { Post } from '../types/post.types';
import { PostCard } from './PostCard';
import { MessageSquareOff } from 'lucide-react';

interface FeedListProps {
  posts: Post[];
  currentUserId: string;
  onRefresh: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({ posts, currentUserId, onRefresh }) => {
  return (
    <div className="w-full space-y-4">
      {posts.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <MessageSquareOff className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-800 mb-1">
            No hay publicaciones en tu feed
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Sigue a otros miembros de la red en la columna lateral para ver sus publicaciones aquí.
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onLikeChanged={onRefresh}
          />
        ))
      )}
    </div>
  );
};
