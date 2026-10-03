import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostCard } from './PostCard';
import { fetchFeedBySocialGraph, likePost } from '../services/feedApi';
import type { Post } from '../types/post.types';

vi.mock('../services/feedApi', () => ({
  fetchFeedBySocialGraph: vi.fn(),
  likePost: vi.fn(),
  submitPost: vi.fn(),
}));

const feedMock = vi.mocked(fetchFeedBySocialGraph);
const likeMock = vi.mocked(likePost);

const AVATAR_ROTO = 'https://ejemplo.com/avatar-roto.png';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-1',
    texto: 'Hola red, primer post',
    fechaCreacion: Date.now() - 5 * 60_000,
    autorId: 'u-2',
    autorUsername: 'beatriz',
    totalLikes: 5,
    likedByMe: false,
    ...overrides,
  };
}

describe('PostCard', () => {
  beforeEach(() => {
    feedMock.mockReset();
    likeMock.mockReset();
    likeMock.mockResolvedValue({ postId: 'p-1', likedByMe: true, totalLikes: 6 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fecha de la publicación', () => {
    it('muestra tiempo relativo en lugar del literal fijo', () => {
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      expect(screen.getByText('hace 5 minutos')).toBeInTheDocument();
      expect(screen.queryByText('Publicado')).not.toBeInTheDocument();
    });

    it('muestra fecha absoluta para publicaciones de hace más de siete días', () => {
      render(
        <PostCard
          post={post({ fechaCreacion: Date.now() - 8 * 24 * 3_600_000 })}
          currentUserId="carlos-patino"
        />,
      );

      expect(screen.queryByText(/hace/)).not.toBeInTheDocument();
      expect(screen.queryByText('Publicado')).not.toBeInTheDocument();
    });

    it("muestra 'Reciente' y el resto del post cuando la fecha llega ausente o inválida", () => {
      render(
        <PostCard
          post={post({ fechaCreacion: null as unknown as number })}
          currentUserId="carlos-patino"
        />,
      );

      expect(screen.getByText('Reciente')).toBeInTheDocument();
      expect(screen.getByText('Hola red, primer post')).toBeInTheDocument();
    });
  });

  describe('like idempotente', () => {
    it('marca el corazon y sube el contador sin esperar al servidor', async () => {
      // La peticion queda pendiente: el cambio optimista tiene que verse sin su respuesta.
      likeMock.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: '5' }));

      expect(await screen.findByRole('button', { name: '6' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '6' })).toHaveAttribute('aria-pressed', 'true');
      expect(feedMock).not.toHaveBeenCalled();
      expect(screen.getByText('Hola red, primer post')).toBeInTheDocument();
    });

    it('envia la peticion una vez por clic con el post y el usuario correctos', async () => {
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: '5' }));

      expect(likeMock).toHaveBeenCalledTimes(1);
      expect(likeMock).toHaveBeenCalledWith('p-1', 'carlos-patino');
      expect(await screen.findByRole('button', { name: '6' })).toBeInTheDocument();
    });

    it('no desmarca ni descuenta cuando se repite el like', async () => {
      likeMock.mockResolvedValue({ postId: 'p-1', likedByMe: true, totalLikes: 6 });
      const user = userEvent.setup();
      render(<PostCard post={post({ likedByMe: true, totalLikes: 6 })} currentUserId="u-1" />);

      await user.click(screen.getByRole('button', { name: '6' }));

      // El backend solo registra likes: un segundo clic no puede quitar la reaccion del grafo,
      // asi que la pantalla tampoco puede fingir que la quita.
      expect(await screen.findByRole('button', { name: '6' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '6' })).toHaveAttribute('aria-pressed', 'true');
      expect(likeMock).toHaveBeenCalledTimes(1);
    });

    it('adopta el total del servidor en lugar del incremento local', async () => {
      // Otra persona reaccionó entre la carga del feed y el clic.
      likeMock.mockResolvedValue({ postId: 'p-1', likedByMe: true, totalLikes: 12 });
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: '5' }));

      expect(await screen.findByRole('button', { name: '12' })).toBeInTheDocument();
    });

    it('revierte el estado y avisa al usuario cuando el like falla', async () => {
      likeMock.mockRejectedValue(new Error('error de red'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: '5' }));

      expect(await screen.findByRole('button', { name: '5' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'false');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo registrar tu Me Gusta');
      expect(screen.getByText('Hola red, primer post')).toBeInTheDocument();
    });

    it('vuelve a marcar cuando la prop llega actualizada tras recargar el feed', () => {
      const { rerender } = render(<PostCard post={post()} currentUserId="carlos-patino" />);

      rerender(
        <PostCard post={post({ likedByMe: true, totalLikes: 9 })} currentUserId="carlos-patino" />,
      );

      expect(screen.getByRole('button', { name: '9' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('avatar del autor', () => {
    it('muestra el avatar cuando la imagen carga', () => {
      render(
        <PostCard
          post={post({ autorAvatar: 'https://ejemplo.com/beatriz.png' })}
          currentUserId="carlos-patino"
        />,
      );

      expect(screen.getByAltText('beatriz')).toBeInTheDocument();
      expect(screen.queryByText('B')).not.toBeInTheDocument();
    });

    it('muestra la inicial sin imagen rota ni círculo vacío cuando el avatar no carga', () => {
      render(<PostCard post={post({ autorAvatar: AVATAR_ROTO })} currentUserId="carlos-patino" />);

      fireEvent.error(screen.getByAltText('beatriz'));

      expect(screen.queryByAltText('beatriz')).not.toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('muestra la inicial cuando el autor no trae avatar', () => {
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      expect(screen.queryByRole('img', { name: 'beatriz' })).not.toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });
  });
});
