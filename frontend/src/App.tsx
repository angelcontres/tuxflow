import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './shared/components/Navbar';
import { CreatePostForm } from './features/feed/components/CreatePostForm';
import { FeedList } from './features/feed/components/FeedList';
import { UserSuggestionsCard } from './features/network/components/UserSuggestionsCard';
import { ChatWidget } from './features/chat/components/ChatWidget';
import { LoginScreen } from './features/auth/components/LoginScreen';
import { fetchFeedBySocialGraph } from './features/feed/services/feedApi';
import { fetchSeguidos, fetchSugerenciasGrafo } from './features/network/services/networkApi';
import { Post } from './features/feed/types/post.types';
import { FilaRed, SugerenciaUsuario, Usuario } from './features/network/types/network.types';
import { UserCheck } from 'lucide-react';

export function fusionarRed(seguidos: Usuario[], sugerencias: SugerenciaUsuario[]): FilaRed[] {
  const filas: FilaRed[] = [];
  const vistos = new Set<string>();
  const agregar = (fila: FilaRed): void => {
    if (typeof fila.id !== 'string' || vistos.has(fila.id)) {
      return;
    }
    vistos.add(fila.id);
    filas.push(fila);
  };
  if (Array.isArray(seguidos)) {
    for (const seguido of seguidos) {
      if (seguido && typeof seguido.id === 'string' && typeof seguido.username === 'string') {
        agregar({ ...seguido, seguido: true });
      }
    }
  }
  if (Array.isArray(sugerencias)) {
    for (const sugerencia of sugerencias) {
      if (
        sugerencia &&
        typeof sugerencia.id === 'string' &&
        typeof sugerencia.username === 'string'
      ) {
        agregar({ ...sugerencia, seguido: false });
      }
    }
  }
  return filas;
}

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [red, setRed] = useState<FilaRed[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAllData = useCallback(async () => {
    try {
      const [feedData, sugData, segData] = await Promise.all([
        fetchFeedBySocialGraph(currentUserId).catch(() => []),
        fetchSugerenciasGrafo(currentUserId).catch(() => []),
        fetchSeguidos(currentUserId).catch(() => []),
      ]);
      setPosts(feedData);
      setRed(fusionarRed(segData, sugData));
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

  const handleLogin = (userId: string, username: string) => {
    setCurrentUserId(userId);
    setCurrentUsername(username);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUserId('');
    setCurrentUsername('');
    setPosts([]);
    setRed([]);
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      <Navbar
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        onUserChange={handleUserChange}
        onProfileUpdated={loadAllData}
        onLogout={handleLogout}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA PRINCIPAL: FORMULARIO DE POST Y FEED */}
          <section className="lg:col-span-7 space-y-4">
            <CreatePostForm
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              onPostCreated={loadAllData}
            />

            {loading ? (
              <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-xs">
                <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-medium">
                  Cargando publicaciones desde el grafo Neo4j...
                </p>
              </div>
            ) : (
              <FeedList posts={posts} currentUserId={currentUserId} onRefresh={loadAllData} />
            )}
          </section>

          {/* BARRA LATERAL DERECHA: SESIÓN + SUGERENCIAS + CHAT */}
          <aside className="lg:col-span-5 space-y-6">
            {/* Tarjeta de Sesión Activa */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                {currentUsername.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">@{currentUsername}</p>
                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Sesión activa en Grafo Social
                </p>
              </div>
            </div>

            {/* Tu red: sugerencias + seguidos (Neo4j) */}
            <UserSuggestionsCard
              filas={red}
              currentUserId={currentUserId}
              onNetworkUpdated={loadAllData}
            />

            {/* Chat en Vivo por WebSocket */}
            <ChatWidget currentUserId={currentUserId} />

            {/* Pie Informativo */}
            <footer className="text-center text-xs text-slate-400 py-2">
              <p>Red Social Distribuida • Neo4j & MinIO S3</p>
              <p className="text-[11px] mt-0.5">Universidad Estatal Península de Santa Elena</p>
            </footer>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;
