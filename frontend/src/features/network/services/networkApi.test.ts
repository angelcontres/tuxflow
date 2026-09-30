import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchSeguidos } from './networkApi';
import type { Usuario } from '../types/network.types';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ get: getMock })),
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
