import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { restoreSession } from './features/auth/services/authApi';
import { fetchFeedBySocialGraph, togglePostLike } from './features/feed/services/feedApi';
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
  togglePostLike: vi.fn(),
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

const sesionMock = vi.mocked(restoreSession);
const feedMock = vi.mocked(fetchFeedBySocialGraph);
const likeMock = vi.mocked(togglePostLike);
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
 * La red antes del unfollow (beatriz seguida) y despues (beatriz vuelve a
 * ser sugerencia con "Seguir"), como la devolveria el backend real.
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
    likeMock.mockResolvedValue(undefined);
    unfollowMock.mockResolvedValue(undefined);
  });

  it('tras dejar de seguir, los posts ya renderizados siguen visibles y la tarjeta de red refleja el nuevo estado', async () => {
    feedMock.mockResolvedValue([postBeatriz(), postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Post de beatriz en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));

    expect(unfollowMock).toHaveBeenCalledWith('carlos-patino', 'u-2');
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.getByText('Post de beatriz en el feed')).toBeInTheDocument();
    expect(screen.getByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(1);
  });

  it('en la próxima carga del feed tras el unfollow, los posts del usuario filtrado ya no aparecen', async () => {
    feedMock.mockResolvedValueOnce([postBeatriz(), postPaulo()]);
    feedMock.mockResolvedValue([postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    const vista = render(<App />);

    expect(await screen.findByText('Post de beatriz en el feed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.getByText('Post de beatriz en el feed')).toBeInTheDocument();

    vista.unmount();
    render(<App />);

    expect(await screen.findByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(screen.queryByText('Post de beatriz en el feed')).not.toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(2);
  });

  it('dar like a un post visible tras el unfollow actualiza el contador sin recargar el feed', async () => {
    feedMock.mockResolvedValue([postBeatriz()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Post de beatriz en el feed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '5' }));

    expect(likeMock).toHaveBeenCalledTimes(1);
    expect(likeMock).toHaveBeenCalledWith('p-beatriz', 'carlos-patino');
    expect(await screen.findByRole('button', { name: '6' })).toBeInTheDocument();
    expect(screen.getByText('Post de beatriz en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(1);
  });
});
