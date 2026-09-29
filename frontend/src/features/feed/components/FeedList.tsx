import React, { useState } from 'react';
import { Post } from '../types/post.types';
import { PostCard } from './PostCard';
import { Flame, Users, Sparkles, Compass } from 'lucide-react';

interface FeedListProps {
  posts: Post[];
  currentUserId: string;
  onRefresh: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({ posts, currentUserId, onRefresh }) => {
  const [feedTab, setFeedTab] = useState<'foryou' | 'following'>('foryou');

  return (
    <div className="w-full">
      {/* Selector de Feed Superior Estilo TikTok (Siguiendo | Para ti) */}
      <div className="flex items-center justify-center gap-8 py-3 mb-4 sticky top-16 z-30 bg-[#010101]/80 backdrop-blur-md border-b border-white/5">
        <button
          onClick={() => setFeedTab('following')}
          className={`relative text-sm sm:text-base font-bold transition-all py-1 cursor-pointer ${
            feedTab === 'following' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Siguiendo
          </span>
          {feedTab === 'following' && (
            <span className="absolute bottom-0 inset-x-2 h-0.5 bg-white rounded-full" />
          )}
        </button>

        <span className="text-white/20">|</span>

        <button
          onClick={() => setFeedTab('foryou')}
          className={`relative text-sm sm:text-base font-bold transition-all py-1 cursor-pointer ${
            feedTab === 'foryou' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#FE2C55]" />
            Para ti
          </span>
          {feedTab === 'foryou' && (
            <span className="absolute bottom-0 inset-x-2 h-0.5 bg-[#FE2C55] rounded-full shadow-[0_0_8px_#FE2C55]" />
          )}
        </button>
      </div>

      {/* Lista de Publicaciones o Estado Vacío */}
      {posts.length === 0 ? (
        <div className="max-w-[460px] mx-auto bg-[#161823] rounded-3xl p-8 text-center border border-white/10 shadow-2xl backdrop-blur-md">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#25F4EE]/20 to-[#FE2C55]/20 text-white flex items-center justify-center mx-auto mb-4 border border-white/10">
            <Sparkles className="w-7 h-7 text-[#25F4EE]" />
          </div>
          <h4 className="text-lg font-black text-white mb-2 tracking-tight">
            Tu feed de grafo social está vacío
          </h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6 leading-relaxed">
            En TuxTok, las publicaciones se obtienen mediante la relación Cypher de 2 saltos: solo verás videos y publicaciones de usuarios a quienes sigues en el grafo social.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300">
            <Compass className="w-4 h-4 text-[#FE2C55]" />
            <span>Sigue a los creadores sugeridos en la columna derecha para ver sus videos</span>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
};
