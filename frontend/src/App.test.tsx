import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { restoreSession } from './features/auth/services/authApi';
import { fetchFeedBySocialGraph, likePost } from './features/feed/services/feedApi';
import {
  fetchSeguidos,
  fetchSugerenciasGrafo,
  unfollowUserInGraph,
} from './features/network/services/networkApi';
import { fetchUsuario } from './features/user/services/userApi';
import type { Post } from './features/feed/types/post.types';
import type { SugerenciaUsuario, Usuario } from './features/network/types/network.types';

vi.mock('./features/auth/services/authApi', () => ({
  restoreSession: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock('./features/feed/services/feedApi', () => ({
  fetchFeedBySocialGraph: vi.fn(),
  likePost: vi.fn(),
  dislikePost: vi.fn(),
  unlikePost: vi.fn(),
  undislikePost: vi.fn(),
  submitPost: vi.fn(),
}));

vi.mock('./features/network/services/networkApi', () => ({
  fetchSugerenciasGrafo: vi.fn(),
  fetchSeguidos: vi.fn(),
  followUserInGraph: vi.fn(),
  unfollowUserInGraph: vi.fn(),
  fetchConexionesComunes: vi.fn(),
}));

vi.mock('./features/user/services/userApi', () => ({
  fetchUsuario: vi.fn(),
  registerOrUpdateUsuario: vi.fn(),
  uploadAvatar: vi.fn(),
}));

vi.mock('./features/chat/services/chatSocket', () => ({
  chatSocketManager: { connect: vi.fn(), disconnect: vi.fn(), sendMessage: vi.fn() },
}));

// El centro de notificaciones abre un EventSource real, y jsdom no implementa
// esa API: el useEffect revienta al montar y tumba el árbol entero. Esta
// prueba es del feed, así que el canal en vivo no aporta nada y el componente
// se aísla completo.
vi.mock('./features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));

// El registro de Web Push pide la clave VAPID al backend al montar la App. Se
// aísla para no arrastrar el cliente HTTP real (que exige getToken del authApi
// mockeado) ni el permiso de notificaciones del navegador.
vi.mock('./features/notifications/services/pushService', () => ({
  initWebPush: vi.fn().mockResolvedValue(undefined),
}));

const sesionMock = vi.mocked(restoreSession);
const feedMock = vi.mocked(fetchFeedBySocialGraph);
const likeMock = vi.mocked(likePost);
const sugerenciasMock = vi.mocked(fetchSugerenciasGrafo);
const seguidosMock = vi.mocked(fetchSeguidos);
const unfollowMock = vi.mocked(unfollowUserInGraph);
const perfilMock = vi.mocked(fetchUsuario);

function postBeatriz(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-beatriz',
    texto: 'Post de beatriz en el feed',
    fechaCreacion: Date.now() - 60_000,
    autorId: 'u-2',
    autorUsername: 'beatriz',
    totalLikes: 5,
    likedByMe: false,
    ...overrides,
  };
}

function postPaulo(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-paulo',
    texto: 'Post de paulo en el feed',
    fechaCreacion: Date.now() - 2 * 3_600_000,
    autorId: 'u-3',
    autorUsername: 'paulo',
    totalLikes: 1,
    likedByMe: false,
    ...overrides,
  };
}

const beatrizSeguida: Usuario = { id: 'u-2', username: 'beatriz', nombre: 'Beatriz' };

const beatrizSugerencia: SugerenciaUsuario = {
  id: 'u-2',
  username: 'beatriz',
  nombre: 'Beatriz',
  conexionesEnComun: 2,
  seguidosEnComun: ['paulo'],
};

/**
 * Red antes del unfollow (beatriz seguida) y despues (beatriz vuelve a ser
 * sugerencia con "Seguir"), como la devolveria el backend real.
 */
function simularRedConUnfollowDeBeatriz(): void {
  seguidosMock.mockResolvedValueOnce([beatrizSeguida]);
  seguidosMock.mockResolvedValue([]);
  sugerenciasMock.mockResolvedValueOnce([]);
  sugerenciasMock.mockResolvedValue([beatrizSugerencia]);
}

describe('App (feed tras dejar de seguir)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sesionMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    perfilMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      nombre: 'Carlos',
    });
    likeMock.mockResolvedValue({
      postId: 'p-paulo',
      likedByMe: true,
      dislikedByMe: false,
      totalLikes: 2,
      totalDislikes: 0,
    });
    unfollowMock.mockResolvedValue(undefined);
  });

  it('deja de seguir vuelve a pedir el feed y quita los posts del usuario filtrado', async () => {
    // El backend excluye de las publicaciones a los no seguidos: la segunda
    // respuesta ya no trae nada de beatriz.
    feedMock.mockResolvedValueOnce([postBeatriz(), postPaulo()]);
    feedMock.mockResolvedValue([postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Post de beatriz en el feed')).toBeInTheDocument();
    expect(screen.getByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));

    expect(unfollowMock).toHaveBeenCalledWith('carlos-patino', 'u-2');
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.queryByText('Post de beatriz en el feed')).not.toBeInTheDocument();
    expect(screen.getByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(2);
  });

  it('los posts del usuario filtrado no reaparecen al recargar la vista', async () => {
    feedMock.mockResolvedValue([postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    const vista = render(<App />);

    expect(await screen.findByText('Post de paulo en el feed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();

    vista.unmount();
    render(<App />);

    expect(await screen.findByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(screen.queryByText('Post de beatriz en el feed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dejar de seguir' })).not.toBeInTheDocument();
  });

  it('dar like a un post que sigue en el feed no vuelve a pedir el feed', async () => {
    feedMock.mockResolvedValue([postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Post de paulo en el feed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1' }));

    expect(likeMock).toHaveBeenCalledTimes(1);
    expect(likeMock).toHaveBeenCalledWith('p-paulo', 'carlos-patino');
    expect(await screen.findByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(1);
  });
});
