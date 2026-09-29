import React, { useState } from 'react';
import { Post } from '../types/post.types';
import { PostCard } from './PostCard';
import { Flame, Users, ShoppingBag } from 'lucide-react';

interface FeedListProps {
  posts: Post[];
  currentUserId: string;
  onRefresh: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({ posts, currentUserId, onRefresh }) => {
  const [feedTab, setFeedTab] = useState<'foryou' | 'following'>('foryou');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = [
    { id: 'all', label: '🔥 Todas', emoji: '🍎' },
    { id: 'tropical', label: 'Tropicales', emoji: '🥭' },
    { id: 'berries', label: 'Frutillas & Berries', emoji: '🍓' },
    { id: 'melons', label: 'Sandías & Melones', emoji: '🍉' },
    { id: 'creamy', label: 'Aguacates', emoji: '🥑' },
  ];

  // Filtrado flexible según categoría
  const filteredPosts = posts.filter((p) => {
    if (categoryFilter === 'all') return true;
    const lower = p.texto.toLowerCase();
    if (categoryFilter === 'tropical') {
      return lower.includes('mango') || lower.includes('papaya') || lower.includes('piña') || lower.includes('tropical');
    }
    if (categoryFilter === 'berries') {
      return lower.includes('frutilla') || lower.includes('mora') || lower.includes('berry');
    }
    if (categoryFilter === 'melons') {
      return lower.includes('sandia') || lower.includes('sandía') || lower.includes('melón') || lower.includes('melon');
    }
    if (categoryFilter === 'creamy') {
      return lower.includes('aguacate') || lower.includes('hass') || lower.includes('limón');
    }
    return true;
  });

  return (
    <div className="w-full">
      {/* Selector de Feed Superior Estilo TikTok (Siguiendo | Para ti) */}
      <div className="sticky top-16 z-30 bg-[#010101]/80 backdrop-blur-md border-b border-white/5 pb-2">
        <div className="flex items-center justify-center gap-8 py-2">
          <button
            onClick={() => setFeedTab('following')}
            className={`relative text-sm sm:text-base font-bold transition-all py-1 cursor-pointer ${
              feedTab === 'following' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Siguiendo Huertos
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
              Para ti (Frutas Frescas)
            </span>
            {feedTab === 'foryou' && (
              <span className="absolute bottom-0 inset-x-2 h-0.5 bg-[#FE2C55] rounded-full shadow-[0_0_8px_#FE2C55]" />
            )}
          </button>
        </div>

        {/* Filtros Rápidos de Categoría Frutera */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 px-2 justify-start sm:justify-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                categoryFilter === cat.id
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/5'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Publicaciones o Estado Vacío */}
      {filteredPosts.length === 0 ? (
        <div className="max-w-[460px] mx-auto bg-[#161823] rounded-3xl p-8 text-center border border-white/10 shadow-2xl backdrop-blur-md mt-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#25F4EE]/20 to-[#FE2C55]/20 text-white flex items-center justify-center mx-auto mb-4 border border-white/10">
            <span className="text-2xl">🧺</span>
          </div>
          <h4 className="text-lg font-black text-white mb-2 tracking-tight">
            No hay frutas en esta categoría
          </h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6 leading-relaxed">
            Sigue a más productores fruteros en la columna derecha o publica tu propia cosecha para vender frutas frescas en FrutaTok.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300">
            <ShoppingBag className="w-4 h-4 text-[#FE2C55]" />
            <span>Mercado Social de Cosechas Directas con Neo4j</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mt-2">
          {filteredPosts.map((post) => (
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
