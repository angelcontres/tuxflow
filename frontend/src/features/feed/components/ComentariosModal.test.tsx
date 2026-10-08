import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComentariosModal } from './ComentariosModal';
import {
  crearComentario,
  fetchComentarios,
  likeComentario,
  unlikeComentario,
} from '../services/comentarioApi';
import type { Comentario, Post } from '../types/post.types';

vi.mock('../services/comentarioApi', () => ({
  fetchComentarios: vi.fn(),
  crearComentario: vi.fn(),
  likeComentario: vi.fn(),
  unlikeComentario: vi.fn(),
}));

const fetchMock = vi.mocked(fetchComentarios);
const crearMock = vi.mocked(crearComentario);
const likeMock = vi.mocked(likeComentario);
const unlikeMock = vi.mocked(unlikeComentario);

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-1',
    texto: 'Hola red, primer post',
    fechaCreacion: Date.now() - 60_000,
    autorId: 'u-2',
    autorUsername: 'beatriz',
    totalLikes: 5,
    likedByMe: false,
    ...overrides,
  };
}

function comentario(overrides: Partial<Comentario> = {}): Comentario {
  return {
    id: 'c-1',
    texto: 'Qué buen post',
    fechaCreacion: Date.now() - 30_000,
    parentId: null,
    autorId: 'u-3',
    autorUsername: 'carlos',
    totalLikes: 0,
    likedByMe: false,
    ...overrides,
  };
}

describe('ComentariosModal', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    crearMock.mockReset();
    likeMock.mockReset();
    unlikeMock.mockReset();
  });

  it('muestra el estado vacío cuando la publicación no tiene comentarios', async () => {
    fetchMock.mockResolvedValue([]);

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);

    expect(await screen.findByText('Todavía no hay comentarios')).toBeInTheDocument();
  });

  it('pinta los comentarios de primer nivel y sus respuestas anidadas', async () => {
    fetchMock.mockResolvedValue([
      comentario({ id: 'c-1', texto: 'Comentario raíz', autorUsername: 'carlos' }),
      comentario({
        id: 'c-2',
        texto: 'Una respuesta',
        parentId: 'c-1',
        autorUsername: 'diana',
      }),
    ]);

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);

    expect(await screen.findByText('Comentario raíz')).toBeInTheDocument();
    expect(screen.getByText('Una respuesta')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('publica un comentario nuevo y lo añade al hilo', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockResolvedValue([]);
    crearMock.mockResolvedValue(
      comentario({ id: 'c-9', texto: 'Mi comentario', autorUsername: 'ana' }),
    );

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);
    await screen.findByText('Todavía no hay comentarios');

    await usuario.type(screen.getByLabelText('Escribe un comentario'), 'Mi comentario');
    await usuario.click(screen.getByRole('button', { name: 'Publicar comentario' }));

    await waitFor(() =>
      expect(crearMock).toHaveBeenCalledWith('p-1', {
        userId: 'u-1',
        texto: 'Mi comentario',
      }),
    );
    expect(await screen.findByText('Mi comentario')).toBeInTheDocument();
  });

  it('responde a un comentario enviando el parentId de la raíz', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockResolvedValue([comentario({ id: 'c-1', texto: 'Comentario raíz' })]);
    crearMock.mockResolvedValue(comentario({ id: 'c-10', texto: 'Mi respuesta', parentId: 'c-1' }));

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);
    await screen.findByText('Comentario raíz');

    await usuario.click(screen.getByRole('button', { name: 'Responder' }));
    await usuario.type(screen.getByPlaceholderText('Responder a @carlos...'), 'Mi respuesta');
    await usuario.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() =>
      expect(crearMock).toHaveBeenCalledWith('p-1', {
        userId: 'u-1',
        texto: 'Mi respuesta',
        parentId: 'c-1',
      }),
    );
    expect(await screen.findByText('Mi respuesta')).toBeInTheDocument();
  });

  it('da like optimista y adopta el total del servidor', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockResolvedValue([comentario({ id: 'c-1', totalLikes: 2, likedByMe: false })]);
    likeMock.mockResolvedValue({ comentarioId: 'c-1', likedByMe: true, totalLikes: 3 });

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);
    await screen.findByText('Qué buen post');

    await usuario.click(screen.getByRole('button', { name: 'Me gusta' }));

    expect(screen.getByRole('button', { name: 'Quitar Me Gusta' })).toBeInTheDocument();
    await waitFor(() => expect(likeMock).toHaveBeenCalledWith('p-1', 'c-1', 'u-1'));
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('revierte el like y avisa cuando la petición falla', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockResolvedValue([comentario({ id: 'c-1', totalLikes: 2, likedByMe: false })]);
    likeMock.mockRejectedValue(new Error('sin conexión'));

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);
    await screen.findByText('Qué buen post');

    await usuario.click(screen.getByRole('button', { name: 'Me gusta' }));

    expect(await screen.findByText(/No se pudo registrar tu Me Gusta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Me gusta' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('retira un like existente usando la ruta de retirada', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockResolvedValue([comentario({ id: 'c-1', totalLikes: 1, likedByMe: true })]);
    unlikeMock.mockResolvedValue({ comentarioId: 'c-1', likedByMe: false, totalLikes: 0 });

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);
    await screen.findByText('Qué buen post');

    await usuario.click(screen.getByRole('button', { name: 'Quitar Me Gusta' }));

    await waitFor(() => expect(unlikeMock).toHaveBeenCalledWith('p-1', 'c-1', 'u-1'));
  });

  it('avisa cuando la carga falla y permite reintentar', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new Error('caída')).mockResolvedValueOnce([]);

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={vi.fn()} />);

    expect(await screen.findByText(/No se pudieron cargar los comentarios/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Todavía no hay comentarios')).toBeInTheDocument();
  });

  it('cierra con la tecla Escape', async () => {
    const usuario = userEvent.setup();
    const onClose = vi.fn();
    fetchMock.mockResolvedValue([]);

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={onClose} />);
    await screen.findByText('Todavía no hay comentarios');

    await usuario.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cierra al pulsar el botón de cerrar del encabezado', async () => {
    const usuario = userEvent.setup();
    const onClose = vi.fn();
    fetchMock.mockResolvedValue([]);

    render(<ComentariosModal post={post()} currentUserId="u-1" onClose={onClose} />);
    await screen.findByText('Todavía no hay comentarios');

    await usuario.click(screen.getByRole('button', { name: 'Cerrar comentarios' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
