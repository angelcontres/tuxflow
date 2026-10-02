import { describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    isAxiosError: vi.fn((err: unknown) => {
      return typeof err === 'object' && err !== null && 'isAxiosError' in err;
    }),
  },
}));

const { getUserFacingError } = await import('./errorMessage');

/** Reproduce un error de axios con lo que le importa a este helper. */
function errorAxios(status: number, data?: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

describe('getUserFacingError', () => {
  it('usa el mensaje del backend cuando viene en el campo error', () => {
    const err = errorAxios(400, { error: 'Los campos origen y destino son obligatorios' });

    expect(getUserFacingError(err, 'mensaje generico')).toBe(
      'Los campos origen y destino son obligatorios',
    );
  });

  it('explica un 413 en vez de devolver el texto generico', () => {
    // Lo que pasaba al subir una foto de más de 10 MB: Quarkus contestaba 413
    // con cuerpo vacío, así que no había campo error que leer y el usuario veía
    // "No pudimos subir la imagen" sin saber que el problema era el tamaño.
    const err = errorAxios(413);

    const mensaje = getUserFacingError(err, 'No pudimos subir la imagen. Inténtalo de nuevo.');

    expect(mensaje).toBe('La imagen es demasiado grande. El máximo permitido es 20 MB.');
    expect(mensaje).not.toBe('No pudimos subir la imagen. Inténtalo de nuevo.');
  });

  it('prefiere el mensaje del backend cuando el estado también tiene uno propio', () => {
    const err = errorAxios(413, { error: 'La imagen supera el máximo permitido' });

    expect(getUserFacingError(err, 'generico')).toBe('La imagen supera el máximo permitido');
  });

  it('descarta el mensaje del backend cuando suena a detalle técnico', () => {
    const err = errorAxios(500, { error: 'Error de MinIO en http://localhost:9000' });

    expect(getUserFacingError(err, 'No pudimos guardar la imagen.')).toBe(
      'No pudimos guardar la imagen.',
    );
  });

  it('devuelve el fallback cuando el estado no tiene mensaje propio', () => {
    const err = errorAxios(503);

    expect(getUserFacingError(err, 'No pudimos conectar.')).toBe('No pudimos conectar.');
  });

  it('devuelve el fallback ante un error que no viene de axios', () => {
    expect(getUserFacingError(new Error('fallo local'), 'No pudimos publicar.')).toBe(
      'No pudimos publicar.',
    );
  });
});
