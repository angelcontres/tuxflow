import React, { useState, useEffect } from 'react';
import { Navbar } from './shared/components/Navbar';
import { CreatePostForm } from './features/feed/components/CreatePostForm';
import { FeedList } from './features/feed/components/FeedList';
import { UserSuggestionsCard } from './features/network/components/UserSuggestionsCard';
import { ChatWidget } from './features/chat/components/ChatWidget';
import { fetchFeedBySocialGraph } from './features/feed/services/feedApi';
import { fetchSugerenciasGrafo } from './features/network/services/networkApi';
import { Post } from './features/feed/types/post.types';
import { SugerenciaUsuario } from './features/network/types/network.types';

export const App: React.FC = () => {
  const [currentUserId] = useState<string>('carlos-patino');
  const [currentUsername] = useState<string>('carlos');
  const [posts, setPosts] = useState<Post[]>([]);
  const [sugerencias, setSugerencias] = useState<SugerenciaUsuario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAllData = async () => {
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
  };

  useEffect(() => {
    loadAllData();
  }, [currentUserId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <Navbar currentUsername={currentUsername} />

      <main className="max-w-6xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Columna Principal: Feed (2 columnas en desktop) */}
          <section className="lg:col-span-2">
            <CreatePostForm
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              onPostCreated={loadAllData}
            />

            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80">
                <div className="animate-spin w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-xs text-slate-500">Recorriendo grafo social en Neo4j...</p>
              </div>
            ) : (
              <FeedList posts={posts} currentUserId={currentUserId} onRefresh={loadAllData} />
            )}
          </section>

          {/* Columna Lateral: Sugerencias de Grafo + Chat en Vivo */}
          <aside className="space-y-6">
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
