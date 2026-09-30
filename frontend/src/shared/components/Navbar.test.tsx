import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Navbar } from './Navbar';
import {
  fetchUsuario,
  fetchAllUsuarios,
  registerOrUpdateUsuario,
  uploadAvatar,
} from '../../features/user/services/userApi';
import type { Usuario } from '../../features/user/types/user.types';

vi.mock('../../features/user/services/userApi', () => ({
  fetchUsuario: vi.fn(),
  fetchAllUsuarios: vi.fn(),
  registerOrUpdateUsuario: vi.fn(),
  uploadAvatar: vi.fn(),
}));

const fetchUsuarioMock = vi.mocked(fetchUsuario);
const fetchAllUsuariosMock = vi.mocked(fetchAllUsuarios);
const registerMock = vi.mocked(registerOrUpdateUsuario);
const uploadMock = vi.mocked(uploadAvatar);

const createdUser: Usuario = {
  id: 'nuevo-id',
  username: 'dev_upse',
  nombre: 'Dev Upse',
  email: '',
};

function renderNavbar(props: Partial<React.ComponentProps<typeof Navbar>> = {}) {
  return render(
    <Navbar currentUserId="carlos" currentUsername="carlos" onUserChange={vi.fn()} {...props} />,
  );
}

function openRegisterTab() {
  fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }));
}

function fillRegisterForm() {
  fireEvent.change(screen.getByPlaceholderText('nuevo-programador'), {
    target: { value: 'nuevo-id' },
  });
  fireEvent.change(screen.getByPlaceholderText('dev_upse'), {
    target: { value: 'dev_upse' },
  });
  fireEvent.change(screen.getByPlaceholderText('Programador Insano'), {
    target: { value: 'Dev Upse' },
  });
}

function attachRegisterFile(container: HTMLElement, name = 'avatar.png') {
  const fileInput = container.querySelector('input[type="file"]');
  expect(fileInput).not.toBeNull();
  const file = new File(['avatar-bytes'], name, { type: 'image/png' });
  fireEvent.change(fileInput!, { target: { files: [file] } });
  return file;
}

function submitRegister() {
  fireEvent.click(screen.getByRole('button', { name: /registrar en grafo social/i }));
}

describe('Navbar register flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchUsuarioMock.mockRejectedValue(new Error('not found'));
    fetchAllUsuariosMock.mockResolvedValue([]);
    URL.createObjectURL = vi.fn(() => 'blob:mock-preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('creates the user first without avatarUrl, then uploads the file with the returned id', async () => {
    const onUserChange = vi.fn();
    registerMock.mockResolvedValue(createdUser);
    uploadMock.mockResolvedValue({ avatarUrl: 'http://minio/avatar.png' });
    const { container } = renderNavbar({ onUserChange });

    openRegisterTab();
    fillRegisterForm();
    const file = attachRegisterFile(container);
    submitRegister();

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });
    const payload = registerMock.mock.calls[0]?.[0] as Usuario;
    expect(payload.id).toBe('nuevo-id');
    expect('avatarUrl' in payload).toBe(false);

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(1);
    });
    expect(uploadMock).toHaveBeenCalledWith(file, 'nuevo-id');
    expect(registerMock.mock.invocationCallOrder[0] as number).toBeLessThan(
      uploadMock.mock.invocationCallOrder[0] as number,
    );

    expect(onUserChange).toHaveBeenCalledWith('nuevo-id', 'dev_upse');
    // Success closes the modal.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /registrar en grafo social/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('does not upload before the user exists when a file is picked', async () => {
    registerMock.mockResolvedValue(createdUser);
    uploadMock.mockResolvedValue({ avatarUrl: 'http://minio/avatar.png' });
    const { container } = renderNavbar();

    openRegisterTab();
    attachRegisterFile(container);

    expect(uploadMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/archivo seleccionado/i)).toBeInTheDocument();
  });

  it('registers without touching the avatar endpoint when no file is picked', async () => {
    const onUserChange = vi.fn();
    registerMock.mockResolvedValue(createdUser);
    renderNavbar({ onUserChange });

    openRegisterTab();
    fillRegisterForm();
    submitRegister();

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onUserChange).toHaveBeenCalledWith('nuevo-id', 'dev_upse');
    // Success closes the modal.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /registrar en grafo social/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('reports clearly that the user was created when the post-create upload fails', async () => {
    const onUserChange = vi.fn();
    registerMock.mockResolvedValue(createdUser);
    uploadMock.mockRejectedValue(new Error('NoSuchBucket'));
    const { container } = renderNavbar({ onUserChange });

    openRegisterTab();
    fillRegisterForm();
    attachRegisterFile(container);
    submitRegister();

    const feedback = await screen.findByText(/registrado, pero el avatar no pudo vincularse/i);
    expect(feedback).toBeInTheDocument();
    expect(uploadMock).toHaveBeenCalledWith(expect.any(File), 'nuevo-id');
    // The user was already created, so the session still switches instead of
    // failing silently, and the modal stays open so the feedback is visible.
    expect(onUserChange).toHaveBeenCalledWith('nuevo-id', 'dev_upse');
    expect(screen.getByRole('button', { name: /registrar en grafo social/i })).toBeInTheDocument();
  });
});
