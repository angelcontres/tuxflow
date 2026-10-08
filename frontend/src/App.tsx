import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './shared/components/Navbar';
import { CreatePostForm } from './features/feed/components/CreatePostForm';
import { FeedList } from './features/feed/components/FeedList';
import { UserSuggestionsCard } from './features/network/components/UserSuggestionsCard';
import { TrendingSidebar } from './features/feed/components/TrendingSidebar';
import { GraphExplorerModal } from './features/network/components/GraphExplorerModal';
import { ComentariosModal } from './features/feed/components/ComentariosModal';
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
import { ThemeProvider } from './shared/context/ThemeContext';

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

const AppContent: React.FC = () => {
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
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState<boolean>(false);
  // Publicación cuyo hilo de comentarios está abierto (US (por definir)), o null si no hay ninguno.
  const [postComentado, setPostComentado] = useState<Post | null>(null);

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
      <div className="min-h-screen bg-slateDark-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slateDark-bg text-slateDark-text pb-16">
      <Navbar
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        onProfileUpdated={loadAllData}
        onLogout={handleLogout}
        onOpenPerfil={handleOpenPerfil}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        isChatOpen={isChatOpen}
        onOpenGraphModal={() => setIsGraphModalOpen(true)}
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
                onComentar={setPostComentado}
              />
            ) : (
              <>
                <CreatePostForm
                  currentUserId={currentUserId}
                  currentUsername={currentUsername}
                  onPostCreated={loadAllData}
                />

                {loading ? (
                  <div className="bg-slateDark-surface rounded-xl p-8 text-center border border-slateDark-borderSubtle shadow-xs">
                    <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-xs text-slateDark-textMuted font-medium">
                      Cargando publicaciones...
                    </p>
                  </div>
                ) : (
                  <FeedList
                    posts={posts}
                    currentUserId={currentUserId}
                    onComentar={setPostComentado}
                  />
                )}
              </>
            )}
          </section>

          {/* BARRA LATERAL DERECHA: SUGERENCIAS Y TENDENCIAS */}
          <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <UserSuggestionsCard
              filas={red}
              currentUserId={currentUserId}
              onNetworkUpdated={loadAllData}
              onOpenPerfil={handleOpenPerfil}
              onOpenGraphModal={() => setIsGraphModalOpen(true)}
            />

            {/* Conexiones en común con otra persona */}
            <ConexionesComunesPanel
              currentUserId={currentUserId}
              currentUsername={currentUsername}
            />

            <TrendingSidebar currentUserId={currentUserId} />

            {/* Pie Informativo */}
            <footer className="text-center text-xs text-slateDark-textMuted/70 py-2">
              <p className="font-semibold text-slateDark-text">TuxFlow</p>
              <p className="text-[11px] mt-0.5">Red Social Distribuida · UPSE</p>
            </footer>
          </aside>
        </div>
      </main>

      {/*
        Chat en Vivo por WebSocket. Va fuera del `main` porque es flotante de verdad: se fija a la
        esquina con `position: fixed`, así que su lugar en el DOM solo sirve para declarar que
        pertenece a la app y no a la barra lateral. Dentro de ella seguiría leyéndose como una
        tarjeta más del sidebar.

        `key={currentUserId}` fuerza que React desmonte el widget al cambiar de usuario y monte otro
        limpio. Sin la clave, el componente se reutilizaría con las props nuevas y su efecto de
        conexión ni volvería a correr, dejando el socket del usuario anterior vivo durante toda la
        sesión: los mensajes seguirían llegando al chat de quien ya cerró su sesión.
      */}
      <ChatWidget
        key={currentUserId}
        currentUserId={currentUserId}
        isOpenExternal={isChatOpen}
        onToggleExternal={() => setIsChatOpen((prev) => !prev)}
        onCloseExternal={() => setIsChatOpen(false)}
      />

      {/* Hilo de comentarios de una publicación (US (por definir)) */}
      {postComentado && (
        <ComentariosModal
          post={postComentado}
          currentUserId={currentUserId}
          onClose={() => setPostComentado(null)}
        />
      )}

      {/* Explorador Interactivo del Grafo Social TuxFlow */}
      {isGraphModalOpen && (
        <GraphExplorerModal
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          onClose={() => setIsGraphModalOpen(false)}
          onOpenPerfil={handleOpenPerfil}
          onNetworkUpdated={loadAllData}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
