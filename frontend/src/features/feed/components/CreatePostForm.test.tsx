import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatePostForm } from './CreatePostForm';
import { submitPost } from '../services/feedApi';
import { uploadAvatar } from '../../user/services/userApi';

vi.mock('../services/feedApi', () => ({
  submitPost: vi.fn(),
}));

vi.mock('../../user/services/userApi', () => ({
  uploadAvatar: vi.fn(),
}));

const submitPostMock = vi.mocked(submitPost);
const uploadAvatarMock = vi.mocked(uploadAvatar);

describe('CreatePostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitPostMock.mockResolvedValue({ id: 'post-1' });
    uploadAvatarMock.mockResolvedValue({ avatarUrl: 'https://cdn.test/foto.png' });
  });

  const renderForm = (onPostCreated = vi.fn()) => {
    render(
      <CreatePostForm
        currentUserId="angelprueba-1"
        currentUsername="angelprueba"
        onPostCreated={onPostCreated}
      />,
    );
    return { onPostCreated };
  };

  it('publica solo texto cuando no hay imagen', async () => {
    const user = userEvent.setup();
    const { onPostCreated } = renderForm();

    await user.type(screen.getByPlaceholderText('¿Qué estás pensando hoy?'), 'Hola mundo');
    await user.click(screen.getByRole('button', { name: /publicar/i }));

    await waitFor(() => {
      expect(submitPostMock).toHaveBeenCalledWith({
        autorId: 'angelprueba-1',
        autorUsername: 'angelprueba',
        texto: 'Hola mundo',
        mediaUrl: undefined,
      });
    });
    expect(onPostCreated).toHaveBeenCalled();
  });

  it('sube la imagen desde el dispositivo y la adjunta al post', async () => {
    const user = userEvent.setup();
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
    renderForm();

    await user.type(screen.getByPlaceholderText('¿Qué estás pensando hoy?'), 'Con foto');
    await user.click(screen.getByRole('button', { name: /agregar imagen/i }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText('Vista previa de la imagen adjunta')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /publicar/i }));

    await waitFor(() => {
      expect(submitPostMock).toHaveBeenCalledWith(
        expect.objectContaining({ mediaUrl: 'https://cdn.test/foto.png' }),
      );
    });
  });

  it('permite quitar la imagen antes de publicar', async () => {
    const user = userEvent.setup();
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    renderForm();

    await user.click(screen.getByRole('button', { name: /agregar imagen/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText('Vista previa de la imagen adjunta')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /quitar imagen/i }));

    await waitFor(() => {
      expect(screen.queryByAltText('Vista previa de la imagen adjunta')).not.toBeInTheDocument();
    });
  });

  it('admite pegar el enlace de una imagen como alternativa', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText('¿Qué estás pensando hoy?'), 'Por enlace');
    await user.click(screen.getByRole('button', { name: /usar enlace/i }));

    const urlInput = screen.getByPlaceholderText('https://ejemplo.com/imagen.jpg');
    await user.type(urlInput, 'https://ejemplo.com/foto.jpg');
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));

    await waitFor(() => {
      expect(screen.getByAltText('Vista previa de la imagen adjunta')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('¿Qué estás pensando hoy?'), '!');
    await user.click(screen.getByRole('button', { name: /publicar/i }));

    await waitFor(() => {
      expect(submitPostMock).toHaveBeenCalledWith(
        expect.objectContaining({ mediaUrl: 'https://ejemplo.com/foto.jpg' }),
      );
    });
  });

  it('oculta los controles de imagen cuando ya hay una adjunta', async () => {
    const user = userEvent.setup();
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    renderForm();

    await user.click(screen.getByRole('button', { name: /agregar imagen/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText('Vista previa de la imagen adjunta')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /agregar imagen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /usar enlace/i })).not.toBeInTheDocument();
  });

  it('muestra un mensaje sin detalle técnico si la subida falla', async () => {
    const user = userEvent.setup();
    uploadAvatarMock.mockRejectedValue(new Error('Request failed with status code 500'));
    renderForm();

    await user.click(screen.getByRole('button', { name: /agregar imagen/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'f.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(
        screen.getByText('No pudimos subir la imagen. Inténtalo de nuevo.'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/status code/i)).not.toBeInTheDocument();
  });

  it('permite arrastrar y soltar (drag and drop) una imagen para adjuntarla', async () => {
    const { container } = render(
      <CreatePostForm
        currentUserId="angelprueba-1"
        currentUsername="angelprueba"
        onPostCreated={vi.fn()}
      />,
    );
    const dropzone = container.firstChild as HTMLElement;
    const file = new File(['drag-content'], 'arrastrada.png', { type: 'image/png' });

    // Drag enter activa el overlay
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        items: [{ kind: 'file', type: 'image/png' }],
        types: ['Files'],
      },
    });

    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
    expect(screen.getByText('Suelta tu imagen aquí para adjuntarla')).toBeInTheDocument();

    // Drop adjunta el archivo
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(uploadAvatarMock).toHaveBeenCalledWith(file);
      expect(screen.getByAltText('Vista previa de la imagen adjunta')).toBeInTheDocument();
    });
  });

  it('permite pegar una imagen con Ctrl+V para adjuntarla', async () => {
    const { container } = render(
      <CreatePostForm
        currentUserId="angelprueba-1"
        currentUsername="angelprueba"
        onPostCreated={vi.fn()}
      />,
    );
    const dropzone = container.firstChild as HTMLElement;
    const file = new File(['paste-content'], 'pegada.png', { type: 'image/png' });

    fireEvent.paste(dropzone, {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    });

    await waitFor(() => {
      expect(uploadAvatarMock).toHaveBeenCalledWith(file);
      expect(screen.getByAltText('Vista previa de la imagen adjunta')).toBeInTheDocument();
    });
  });
});
