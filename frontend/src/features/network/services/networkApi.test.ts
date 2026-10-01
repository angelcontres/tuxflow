import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchConexionesComunes, fetchSeguidos } from './networkApi';
import type { ConexionComun, Usuario } from '../types/network.types';

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

// El Cypher #3 proyecta avatarUrl con el alias `avatar`, no con su nombre de
// propiedad, así que la conexión en común no comparte forma con Usuario.
const conexion = (overrides: Partial<ConexionComun> = {}): ConexionComun => ({
  id: 'beatriz-silva',
  username: 'beatriz',
  nombre: 'Beatriz Silva',
  avatar: 'https://cdn.example.com/beatriz.png',
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

describe('fetchConexionesComunes', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('pide GET /users/comunes con los dos identificadores y devuelve la intersección', async () => {
    const comunes = [conexion(), conexion({ id: 'paulo-orrala', username: 'paulo' })];
    getMock.mockResolvedValue({ data: comunes });

    const result = await fetchConexionesComunes('carlos-patino', 'angel-villon');

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/users/comunes', {
      params: { userA: 'carlos-patino', userB: 'angel-villon' },
    });
    expect(result).toEqual(comunes);
  });

  it('devuelve una lista vacía cuando los dos perfiles no comparten seguidos', async () => {
    getMock.mockResolvedValue({ data: [] });

    const result = await fetchConexionesComunes('carlos-patino', 'angel-villon');

    expect(result).toEqual([]);
  });

  it('propaga el error para que sea el componente quien decida cómo mostrarlo', async () => {
    getMock.mockRejectedValue(new Error('Request failed with status code 400'));

    await expect(fetchConexionesComunes('carlos-patino', 'angel-villon')).rejects.toThrow(
      /status code 400/,
    );
  });
});
