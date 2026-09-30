import { describe, expect, it } from 'vitest';
import { fusionarRed } from './App';
import type { SugerenciaUsuario, Usuario } from './features/network/types/network.types';

const sugerencia = (overrides: Partial<SugerenciaUsuario> = {}): SugerenciaUsuario => ({
  id: 'u-2',
  username: 'beatriz',
  nombre: 'Beatriz',
  conexionesEnComun: 3,
  seguidosEnComun: ['carlos'],
  ...overrides,
});

const seguido = (overrides: Partial<Usuario> = {}): Usuario => ({
  id: 'u-9',
  username: 'elena',
  nombre: 'Elena',
  ...overrides,
});

describe('fusionarRed', () => {
  it('pone los seguidos primero con seguido:true y las sugerencias después con seguido:false', () => {
    const filas = fusionarRed([seguido()], [sugerencia()]);

    expect(filas.map((f) => f.id)).toEqual(['u-9', 'u-2']);
    expect(filas.map((f) => f.seguido)).toEqual([true, false]);
  });

  it('no duplica cuando un id llega en ambas fuentes y manda la entrada de seguido', () => {
    const filas = fusionarRed(
      [seguido({ id: 'u-2', username: 'beatriz', nombre: 'Beatriz' })],
      [sugerencia()],
    );

    expect(filas).toHaveLength(1);
    expect(filas[0]?.id).toBe('u-2');
    expect(filas[0]?.seguido).toBe(true);
  });

  it('no se cae ante entradas malformadas y las omite', () => {
    const filas = fusionarRed(
      [null, { username: 'sin-id' }] as unknown as Usuario[],
      [undefined, sugerencia()] as unknown as SugerenciaUsuario[],
    );

    expect(filas.map((f) => f.id)).toEqual(['u-2']);
  });

  it('devuelve lista vacía cuando ambas fuentes están vacías o no son arreglos', () => {
    expect(fusionarRed([], [])).toEqual([]);
    expect(
      fusionarRed(null as unknown as Usuario[], undefined as unknown as SugerenciaUsuario[]),
    ).toEqual([]);
  });
});
