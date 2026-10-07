import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './shared/components/Navbar';
import { CreatePostForm } from './features/feed/components/CreatePostForm';
import { FeedList } from './features/feed/components/FeedList';
import { UserSuggestionsCard } from './features/network/components/UserSuggestionsCard';
import { TrendingSidebar } from './features/feed/components/TrendingSidebar';
import { ConexionesComunesPanel } from './features/network/components/ConexionesComunesPanel';
import { ChatWidget } from './features/chat/components/ChatWidget';
import { PerfilAjeno } from './features/user/components/PerfilAjeno';
import { LoginScreen } from './features/auth/components/LoginScreen';
import { clearToken, restoreSession } from './features/auth/services/authApi';
import { fetchFeedBySocialGraph } from './features/feed/services/feedApi';
import { fetchSeguidos, fetchSugerenciasGrafo } from './features/network/services/networkApi';
import { Post } from './features/feed/types/post.types';
import { FilaRed, SugerenciaUsuario, Usuario } from './features/network/types/network.types';
import { initWebPush } from './features/notifications/services/pushService';

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
  // Perfil ajeno que se está mirando (US-12), o null si no hay ninguno abierto.
  //
  // Estado local y no una ruta de URL: el proyecto no tiene router, y meter react-router por esto
  // obligaría a rehacer el layout y el Navbar para resolver una navegación que hoy son dos vistas
  // del mismo sitio. Cuando se necesite una URL compartible es el momento de introducirlo, y no
  // antes.
  const [perfilAjenoId, setPerfilAjenoId] = useState<string | null>(null);

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

  // Refresco solo del feed. Se usa en la carga inicial y al crear un
  // post: ahí sí aplica el filtrado vigente del backend (D2).
  const loadFeed = useCallback(async () => {
    try {
      const feedData = await fetchFeedBySocialGraph(currentUserId).catch(() => []);
      setPosts(feedData);
    } catch (err) {
      console.error('Error al sincronizar el feed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Refresco solo de red (sugerencias + seguidos), sin tocar los posts.
  const loadNetwork = useCallback(async () => {
    try {
      const [sugData, segData] = await Promise.all([
        fetchSugerenciasGrafo(currentUserId).catch(() => []),
        fetchSeguidos(currentUserId).catch(() => []),
      ]);
      setRed(fusionarRed(segData, sugData));
    } catch (err) {
      console.error('Error al sincronizar la red:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Carga combinada. Es lo que dispara follow/unfollow: al dejar de seguir,
  // el feed se vuelve a pedir a propósito, porque el backend ya excluye de
  // las publicaciones a los usuarios no seguidos y sus posts deben
  // desaparecer de la vista sin esperar a recargar la página.
  const loadAllData = useCallback(async () => {
    await Promise.all([loadFeed(), loadNetwork()]);
  }, [loadFeed, loadNetwork]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      setLoading(false);
      return;
    }
    loadAllData();
  }, [isAuthenticated, currentUserId, loadAllData]);

  useEffect(() => {
    if (isAuthenticated && currentUserId) {
      initWebPush(currentUserId);
    }
  }, [isAuthenticated, currentUserId]);

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
    setPerfilAjenoId(null);
  };

  const handleOpenPerfil = useCallback((usuarioId: string) => {
    setPerfilAjenoId(usuarioId);
  }, []);

  const handleCerrarPerfil = useCallback(() => {
    setPerfilAjenoId(null);
  }, []);

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
        onOpenPerfil={handleOpenPerfil}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA PRINCIPAL: PERFIL AJENO O, SI NO HAY NINGUNO, FORMULARIO Y FEED */}
          <section className="lg:col-span-7 space-y-4">
            {perfilAjenoId !== null ? (
              <PerfilAjeno
                usuarioId={perfilAjenoId}
                viewerId={currentUserId}
                viewerUsername={currentUsername}
                onCerrar={handleCerrarPerfil}
                onNetworkUpdated={loadAllData}
                onOpenPerfil={handleOpenPerfil}
              />
            ) : (
              <>
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
                  <FeedList posts={posts} currentUserId={currentUserId} />
                )}
              </>
            )}
          </section>

          {/* BARRA LATERAL DERECHA: TENDENCIAS + SUGERENCIAS + CONEXIONES + CHAT */}
          <aside className="lg:col-span-5 space-y-6">
            {/* Tendencias de la red extendida (US-11): va primero por decisión de producto */}
            <TrendingSidebar currentUserId={currentUserId} />

            {/* Tu red: sugerencias + seguidos */}
            <UserSuggestionsCard
              filas={red}
              currentUserId={currentUserId}
              onNetworkUpdated={loadAllData}
              onOpenPerfil={handleOpenPerfil}
            />

            {/* Conexiones en común con otra persona */}
            <ConexionesComunesPanel
              currentUserId={currentUserId}
              currentUsername={currentUsername}
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
