import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostCard } from './PostCard';
import {
  fetchFeedBySocialGraph,
  likePost,
  dislikePost,
  unlikePost,
  undislikePost,
} from '../services/feedApi';
import type { Post } from '../types/post.types';

vi.mock('../services/feedApi', () => ({
  fetchFeedBySocialGraph: vi.fn(),
  likePost: vi.fn(),
  dislikePost: vi.fn(),
  unlikePost: vi.fn(),
  undislikePost: vi.fn(),
  submitPost: vi.fn(),
}));

const feedMock = vi.mocked(fetchFeedBySocialGraph);
const likeMock = vi.mocked(likePost);
const dislikeMock = vi.mocked(dislikePost);
const unlikeMock = vi.mocked(unlikePost);
const undislikeMock = vi.mocked(undislikePost);

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
    dislikeMock.mockReset();
    unlikeMock.mockReset();
    undislikeMock.mockReset();
    likeMock.mockResolvedValue({
      postId: 'p-1',
      likedByMe: true,
      dislikedByMe: false,
      totalLikes: 6,
      totalDislikes: 0,
    });
    dislikeMock.mockResolvedValue({
      postId: 'p-1',
      likedByMe: false,
      dislikedByMe: true,
      totalLikes: 5,
      totalDislikes: 1,
    });
    unlikeMock.mockResolvedValue({
      postId: 'p-1',
      likedByMe: false,
      dislikedByMe: false,
      totalLikes: 5,
      totalDislikes: 0,
    });
    undislikeMock.mockResolvedValue({
      postId: 'p-1',
      likedByMe: false,
      dislikedByMe: false,
      totalLikes: 5,
      totalDislikes: 0,
    });
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

    it('desmarca y descuenta con un segundo clic usando la ruta de retirada', async () => {
      const user = userEvent.setup();
      render(<PostCard post={post({ likedByMe: true, totalLikes: 6 })} currentUserId="u-1" />);

      await user.click(screen.getByRole('button', { name: '6' }));

      // Con ruta de retirada (TUX-68), el segundo clic quita la reacción en vez de reenviarla:
      // el caso anterior ("no desmarca") describía la API sin Unlike y quedó obsoleto.
      expect(unlikeMock).toHaveBeenCalledTimes(1);
      expect(unlikeMock).toHaveBeenCalledWith('p-1', 'u-1');
      expect(likeMock).not.toHaveBeenCalled();
      expect(await screen.findByRole('button', { name: '5' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('adopta el total del servidor en lugar del incremento local', async () => {
      // Otra persona reaccionó entre la carga del feed y el clic.
      likeMock.mockResolvedValue({
        postId: 'p-1',
        likedByMe: true,
        dislikedByMe: false,
        totalLikes: 12,
        totalDislikes: 0,
      });
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

  describe('dislike con interruptor', () => {
    it('marca el dislike y sube su contador sin esperar al servidor', async () => {
      // La peticion queda pendiente: el cambio optimista tiene que verse sin su respuesta.
      dislikeMock.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      const boton = screen.getByRole('button', { name: 'No me gusta' });
      expect(boton).toHaveAttribute('aria-pressed', 'true');
      expect(boton).toHaveTextContent('1');
      expect(dislikeMock).toHaveBeenCalledTimes(1);
      expect(dislikeMock).toHaveBeenCalledWith('p-1', 'carlos-patino');
    });

    it('adopta el total de dislikes del servidor en lugar del incremento local', async () => {
      // Otra persona reaccionó entre la carga del feed y el clic.
      dislikeMock.mockResolvedValue({
        postId: 'p-1',
        likedByMe: false,
        dislikedByMe: true,
        totalLikes: 5,
        totalDislikes: 4,
      });
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      expect(screen.getByRole('button', { name: 'No me gusta' })).toHaveTextContent('4');
    });

    it('desmarca el dislike con un segundo clic usando la ruta de retirada', async () => {
      // La retirada ahora devuelve el estado completo: el 1 final lo pone el servidor, no el
      // decremento optimista (antes se conservaba porque la respuesta no traía total).
      undislikeMock.mockResolvedValue({
        postId: 'p-1',
        likedByMe: false,
        dislikedByMe: false,
        totalLikes: 5,
        totalDislikes: 1,
      });
      const user = userEvent.setup();
      render(
        <PostCard post={post({ dislikedByMe: true, totalDislikes: 2 })} currentUserId="u-1" />,
      );

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      expect(undislikeMock).toHaveBeenCalledTimes(1);
      expect(undislikeMock).toHaveBeenCalledWith('p-1', 'u-1');
      expect(dislikeMock).not.toHaveBeenCalled();
      const boton = screen.getByRole('button', { name: 'No me gusta' });
      expect(boton).toHaveAttribute('aria-pressed', 'false');
      expect(boton).toHaveTextContent('1');
    });

    it('revierte el dislike y avisa al usuario cuando la petición falla', async () => {
      dislikeMock.mockRejectedValue(new Error('error de red'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      const boton = screen.getByRole('button', { name: 'No me gusta' });
      expect(boton).toHaveAttribute('aria-pressed', 'false');
      expect(boton).toHaveTextContent('0');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo registrar tu No me gusta');
      expect(screen.getByText('Hola red, primer post')).toBeInTheDocument();
    });

    it('ignora un segundo clic mientras la reacción está en vuelo', async () => {
      dislikeMock.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      const boton = screen.getByRole('button', { name: 'No me gusta' });
      await user.click(boton);
      await user.click(boton);

      expect(dislikeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('mutualidad like/dislike', () => {
    it('dar dislike con el like activo desmarca el corazón y mueve ambos contadores', async () => {
      const user = userEvent.setup();
      render(
        <PostCard
          post={post({ likedByMe: true, totalLikes: 6, dislikedByMe: false, totalDislikes: 0 })}
          currentUserId="carlos-patino"
        />,
      );

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      expect(dislikeMock).toHaveBeenCalledTimes(1);
      expect(dislikeMock).toHaveBeenCalledWith('p-1', 'carlos-patino');
      expect(likeMock).not.toHaveBeenCalled();
      expect(await screen.findByRole('button', { name: '5' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      const dislike = screen.getByRole('button', { name: 'No me gusta' });
      expect(dislike).toHaveAttribute('aria-pressed', 'true');
      expect(dislike).toHaveTextContent('1');
    });

    it('dar like con el dislike activo desmarca el dislike y mueve ambos contadores', async () => {
      likeMock.mockResolvedValue({
        postId: 'p-1',
        likedByMe: true,
        dislikedByMe: false,
        totalLikes: 6,
        totalDislikes: 1,
      });
      const user = userEvent.setup();
      render(
        <PostCard
          post={post({ likedByMe: false, totalLikes: 5, dislikedByMe: true, totalDislikes: 2 })}
          currentUserId="carlos-patino"
        />,
      );

      await user.click(screen.getByRole('button', { name: '5' }));

      expect(likeMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('button', { name: '6' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      const dislike = screen.getByRole('button', { name: 'No me gusta' });
      expect(dislike).toHaveAttribute('aria-pressed', 'false');
      expect(dislike).toHaveTextContent('1');
    });

    it('el efecto cruzado se ve al instante, sin esperar al servidor', async () => {
      // La peticion queda pendiente: el desmarcado del contrario tiene que verse sin su respuesta.
      dislikeMock.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(
        <PostCard
          post={post({ likedByMe: true, totalLikes: 6, dislikedByMe: false, totalDislikes: 0 })}
          currentUserId="carlos-patino"
        />,
      );

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      expect(await screen.findByRole('button', { name: '5' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      const dislike = screen.getByRole('button', { name: 'No me gusta' });
      expect(dislike).toHaveAttribute('aria-pressed', 'true');
      expect(dislike).toHaveTextContent('1');
    });

    it('la reconciliación adopta ambos totales del servidor', async () => {
      // Alguien más reaccionó en paralelo: la respuesta corrige los dos contadores a la vez.
      dislikeMock.mockResolvedValue({
        postId: 'p-1',
        likedByMe: false,
        dislikedByMe: true,
        totalLikes: 9,
        totalDislikes: 4,
      });
      const user = userEvent.setup();
      render(
        <PostCard
          post={post({ likedByMe: true, totalLikes: 6, dislikedByMe: false, totalDislikes: 0 })}
          currentUserId="carlos-patino"
        />,
      );

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      expect(await screen.findByRole('button', { name: '9' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No me gusta' })).toHaveTextContent('4');
    });

    it('si el cruce falla, ambas mitades vuelven a su estado previo', async () => {
      dislikeMock.mockRejectedValue(new Error('error de red'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(
        <PostCard
          post={post({ likedByMe: true, totalLikes: 6, dislikedByMe: false, totalDislikes: 0 })}
          currentUserId="carlos-patino"
        />,
      );

      await user.click(screen.getByRole('button', { name: 'No me gusta' }));

      expect(await screen.findByRole('button', { name: '6' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      const dislike = screen.getByRole('button', { name: 'No me gusta' });
      expect(dislike).toHaveAttribute('aria-pressed', 'false');
      expect(dislike).toHaveTextContent('0');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo registrar tu No me gusta');
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

  describe('acción de comentar', () => {
    it('llama al callback con la publicación al pulsar Comentar', async () => {
      const usuario = userEvent.setup();
      const onComentar = vi.fn();
      const publicacion = post({ id: 'p-comentar' });

      render(<PostCard post={publicacion} currentUserId="carlos-patino" onComentar={onComentar} />);

      await usuario.click(screen.getByRole('button', { name: 'Comentar' }));

      expect(onComentar).toHaveBeenCalledWith(publicacion);
    });

    it('no muestra la acción si no se entrega el callback', () => {
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      expect(screen.queryByRole('button', { name: 'Comentar' })).not.toBeInTheDocument();
    });
  });
});
