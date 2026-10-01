import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchSeguidos } from './networkApi';
import type { Usuario } from '../types/network.types';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

// El cliente compartido registra interceptores para adjuntar el token de
// sesión, así que el mock de axios debe exponer esa API.
vi.mock('axios', () => ({
  default: {
    isAxiosError: vi.fn(() => false),
    create: vi.fn(() => ({
      get: getMock,
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

const usuario = (overrides: Partial<Usuario> = {}): Usuario => ({
  id: 'u-2',
  username: 'beatriz',
  nombre: 'Beatriz',
  avatarUrl: 'https://cdn.example.com/beatriz.png',
  ...overrides,
});

describe('fetchSeguidos', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('pide GET /users/{userId}/follows y devuelve la lista de Usuario', async () => {
    const seguidos = [usuario(), usuario({ id: 'u-3', username: 'david', nombre: 'David' })];
    getMock.mockResolvedValue({ data: seguidos });

    const result = await fetchSeguidos('carlos-patino');

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/users/carlos-patino/follows');
    expect(result).toEqual(seguidos);
  });

  it('devuelve una lista vacía cuando el usuario no tiene seguidos', async () => {
    getMock.mockResolvedValue({ data: [] });

    const result = await fetchSeguidos('carlos-patino');

    expect(getMock).toHaveBeenCalledWith('/users/carlos-patino/follows');
    expect(result).toEqual([]);
  });
});
