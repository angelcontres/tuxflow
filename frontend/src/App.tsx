import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './shared/components/Navbar';
import { CreatePostForm } from './features/feed/components/CreatePostForm';
import { FeedList } from './features/feed/components/FeedList';
import { UserSuggestionsCard } from './features/network/components/UserSuggestionsCard';
import { ChatWidget } from './features/chat/components/ChatWidget';
import { LoginScreen } from './features/auth/components/LoginScreen';
import { clearToken, restoreSession } from './features/auth/services/authApi';
import { fetchFeedBySocialGraph } from './features/feed/services/feedApi';
import { fetchSeguidos, fetchSugerenciasGrafo } from './features/network/services/networkApi';
import { Post } from './features/feed/types/post.types';
import { FilaRed, SugerenciaUsuario, Usuario } from './features/network/types/network.types';

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
  const [restoringSession, setRestoringSession] = useState<boolean>(true);

  // Restaura la sesión con el token guardado. Sin esto, un refresh del
  // navegador (F5 o Ctrl+Shift+R) devolvía al usuario al login.
  useEffect(() => {
    let cancelado = false;
    restoreSession()
      .then((usuario) => {
        if (cancelado || !usuario) return;
        setCurrentUserId(usuario.id);
        setCurrentUsername(usuario.username);
        setIsAuthenticated(true);
      })
      .finally(() => {
        if (!cancelado) setRestoringSession(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

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
    if (!isAuthenticated || !currentUserId) {
      setLoading(false);
      return;
    }
    loadAllData();
  }, [isAuthenticated, currentUserId, loadAllData]);

  const handleLogin = (userId: string, username: string) => {
    setCurrentUserId(userId);
    setCurrentUsername(username);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearToken();
    setIsAuthenticated(false);
    setCurrentUserId('');
    setCurrentUsername('');
    setPosts([]);
    setRed([]);
  };

  // Mientras se valida el token guardado no se muestra ni el login ni la app:
  // aparecería el login un instante y luego saltaría a la app.
  if (restoringSession) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      <Navbar
        currentUserId={currentUserId}
        currentUsername={currentUsername}
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
                <p className="text-xs text-slate-500 font-medium">Cargando publicaciones...</p>
              </div>
            ) : (
              <FeedList posts={posts} currentUserId={currentUserId} onRefresh={loadAllData} />
            )}
          </section>

          {/* BARRA LATERAL DERECHA: SESIÓN + SUGERENCIAS + CHAT */}
          <aside className="lg:col-span-5 space-y-6">


            {/* Tu red: sugerencias + seguidos */}
            <UserSuggestionsCard
              filas={red}
              currentUserId={currentUserId}
              onNetworkUpdated={loadAllData}
            />

            {/* Chat en Vivo por WebSocket */}
            <ChatWidget currentUserId={currentUserId} />

            {/* Pie Informativo */}
            <footer className="text-center text-xs text-slate-400 py-2">
              <p>Red Social Distribuida</p>
              <p className="text-[11px] mt-0.5">Universidad Estatal Península de Santa Elena</p>
            </footer>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;
