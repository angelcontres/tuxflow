import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    isAxiosError: vi.fn(() => false),
    create: vi.fn(() => ({
      get: getMock,
      post: postMock,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

import { clearToken, getToken, loginUser, registerUser, restoreSession, setToken } from './authApi';

const TOKEN = 'header.payload.firma';

describe('persistencia de sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('guarda el token devuelto por el login', async () => {
    postMock.mockResolvedValue({
      data: { token: TOKEN, id: 'u1', username: 'angelprueba', email: '', nombre: 'Angel' },
    });

    await loginUser('angelprueba', 'secreta');

    expect(localStorage.getItem('redsocial.token')).toBe(TOKEN);
    expect(getToken()).toBe(TOKEN);
  });

  it('guarda el token devuelto por el registro', async () => {
    postMock.mockResolvedValue({
      data: { token: TOKEN, id: 'u2', username: 'nuevo', email: '', nombre: 'Nuevo' },
    });

    await registerUser({ nombre: 'Nuevo', username: 'nuevo', password: 'secreta' });

    expect(getToken()).toBe(TOKEN);
  });

  it('reconstruye la sesión con el token guardado sin volver a pedir contraseña', async () => {
    setToken(TOKEN);
    const usuario = { id: 'u1', username: 'angelprueba', email: '', nombre: 'Angel' };
    getMock.mockResolvedValue({ data: usuario });

    const resultado = await restoreSession();

    expect(getMock).toHaveBeenCalledWith('/me', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(resultado).toEqual(usuario);
  });

  it('devuelve null y borra el token cuando ya expiró', async () => {
    setToken(TOKEN);
    getMock.mockRejectedValue(new Error('401'));

    const resultado = await restoreSession();

    expect(resultado).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('devuelve null si no hay token guardado', async () => {
    const resultado = await restoreSession();

    expect(resultado).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('clearToken elimina la sesión', () => {
    setToken(TOKEN);
    clearToken();

    expect(getToken()).toBeNull();
  });
});
