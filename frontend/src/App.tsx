import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './shared/components/Navbar';
import { CreatePostForm } from './features/feed/components/CreatePostForm';
import { FeedList } from './features/feed/components/FeedList';
import { UserSuggestionsCard } from './features/network/components/UserSuggestionsCard';
import { ChatWidget } from './features/chat/components/ChatWidget';
import { fetchFeedBySocialGraph } from './features/feed/services/feedApi';
import { fetchSugerenciasGrafo } from './features/network/services/networkApi';
import { Post } from './features/feed/types/post.types';
import { SugerenciaUsuario } from './features/network/types/network.types';
import {
  Users,
  Compass,
  Radio,
  Flame,
  Hash,
  Sparkles,
  Truck,
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentUserId, setCurrentUserId] = useState<string>('carlos-patino');
  const [currentUsername, setCurrentUsername] = useState<string>('carlos');
  const [posts, setPosts] = useState<Post[]>([]);
  const [sugerencias, setSugerencias] = useState<SugerenciaUsuario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeNav, setActiveNav] = useState<'foryou' | 'following' | 'explore' | 'live'>('foryou');

  const loadAllData = useCallback(async () => {
    try {
      const [feedData, sugData] = await Promise.all([
        fetchFeedBySocialGraph(currentUserId).catch(() => []),
        fetchSugerenciasGrafo(currentUserId).catch(() => []),
      ]);
      setPosts(feedData);
      setSugerencias(sugData);
    } catch (err) {
      console.error('Error al sincronizar datos:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleUserChange = (userId: string, username: string) => {
    setCurrentUserId(userId);
    setCurrentUsername(username);
  };

  const trendingFruitHashtags = [
    { tag: 'MangosDeTemporada', views: '2.4M', emoji: '🥭' },
    { tag: 'SandiasSantaElena', views: '1.8M', emoji: '🍉' },
    { tag: 'FrutillasAmbato', views: '950K', emoji: '🍓' },
    { tag: 'AguacateHass', views: '680K', emoji: '🥑' },
    { tag: 'CosechaOrganica', views: '420K', emoji: '🌱' },
  ];

  return (
    <div className="min-h-screen bg-[#010101] text-white selection:bg-[#FE2C55] selection:text-white pb-16">
      <Navbar
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        onUserChange={handleUserChange}
        onProfileUpdated={loadAllData}
      />

      <main className="max-w-7xl mx-auto px-2 sm:px-4 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* BARRA LATERAL IZQUIERDA (Estilo Menú TikTok FruitTok) */}
          <aside className="hidden md:block md:col-span-3 lg:col-span-3 sticky top-20 space-y-6 select-none">
            {/* Menú de Navegación Principal */}
            <div className="bg-[#161823] rounded-2xl p-3 border border-white/10 shadow-xl space-y-1">
              <button
                onClick={() => setActiveNav('foryou')}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer ${
                  activeNav === 'foryou'
                    ? 'text-[#FE2C55] bg-white/5 shadow-inner'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Flame className={`w-5 h-5 ${activeNav === 'foryou' ? 'text-[#FE2C55]' : ''}`} />
                <span>Para ti (Frutas)</span>
              </button>

              <button
                onClick={() => setActiveNav('following')}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  activeNav === 'following'
                    ? 'text-[#FE2C55] bg-white/5 shadow-inner'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Siguiendo Huertos</span>
              </button>

              <button
                onClick={() => setActiveNav('explore')}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  activeNav === 'explore'
                    ? 'text-[#25F4EE] bg-white/5 shadow-inner'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Compass className="w-5 h-5" />
                <span>Mercado Frutero</span>
              </button>

              <button
                onClick={() => setActiveNav('live')}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  activeNav === 'live'
                    ? 'text-[#FE2C55] bg-white/5 shadow-inner'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Radio className="w-5 h-5" />
                <span>LIVE Cosecha</span>
                <span className="ml-auto text-[9px] font-black uppercase bg-[#FE2C55] text-white px-1.5 py-0.5 rounded">
                  En vivo
                </span>
              </button>
            </div>

            {/* Banner de Envíos Frescos */}
            <div className="bg-gradient-to-r from-emerald-950/80 to-[#161823] rounded-2xl p-3.5 border border-emerald-500/20 shadow-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white leading-tight">Envíos Directos</p>
                <p className="text-[11px] text-emerald-400 font-semibold">Cosecha fresca a tu puerta</p>
              </div>
            </div>

            {/* Tarjeta de Sesión Activa */}
            <div className="bg-[#161823] rounded-2xl p-4 border border-white/10 shadow-xl space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Sesión FrutaTok
              </span>
              <div className="flex items-center gap-3 pt-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#25F4EE] to-[#FE2C55] flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/20">
                  {currentUsername.charAt(0).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-white truncate">@{currentUsername}</p>
                  <p className="text-[11px] text-[#25F4EE] flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25F4EE] animate-pulse" />
                    Productor Conectado
                  </p>
                </div>
              </div>
            </div>

            {/* Tendencias Fruteras Estilo TikTok */}
            <div className="bg-[#161823] rounded-2xl p-4 border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#FE2C55]" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Frutas en Tendencia
                  </h4>
                </div>
                <span className="text-xs">🍓</span>
              </div>

              <div className="space-y-2.5">
                {trendingFruitHashtags.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs hover:bg-white/5 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-neutral-500 font-mono text-[11px]">#{idx + 1}</span>
                      <span className="font-bold text-white hover:underline truncate">
                        {item.emoji} #{item.tag}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-1">
                      {item.views}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer de Créditos */}
            <div className="px-2 text-[11px] text-neutral-500 space-y-1 leading-relaxed">
              <p className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#FE2C55]" />
                <span>FrutaTok • Mercado Social en Grafo</span>
              </p>
              <p>Neo4j Graph Database • MinIO Object Storage</p>
              <p className="text-[10px] text-neutral-600 pt-1">
                © 2026 Universidad Estatal Península de Santa Elena
              </p>
            </div>
          </aside>

          {/* COLUMNA CENTRAL: FEED TIKTOK DE FRUTAS */}
          <section className="col-span-1 md:col-span-9 lg:col-span-5 max-w-[500px] mx-auto w-full">
            <CreatePostForm
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              onPostCreated={loadAllData}
            />

            {loading ? (
              <div className="bg-[#161823] rounded-3xl p-10 text-center border border-white/10 shadow-2xl">
                <div className="animate-spin w-8 h-8 border-3 border-[#FE2C55] border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-xs text-neutral-400 font-medium">
                  Buscando cosechas y frutas frescas en el grafo Neo4j...
                </p>
              </div>
            ) : (
              <FeedList posts={posts} currentUserId={currentUserId} onRefresh={loadAllData} />
            )}
          </section>

          {/* COLUMNA DERECHA: HUERTOS SUGERIDOS (NEO4J 2º GRADO) + CHAT DE PEDIDOS */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-20 space-y-6">
            <UserSuggestionsCard
              sugerencias={sugerencias}
              currentUserId={currentUserId}
              onNetworkUpdated={loadAllData}
            />

            <ChatWidget currentUserId={currentUserId} />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;
