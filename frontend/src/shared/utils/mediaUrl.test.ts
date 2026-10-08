import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from './mediaUrl';

describe('resolveMediaUrl', () => {
  it('devuelve cadena vacia si es nulo o indefinido', () => {
    expect(resolveMediaUrl(null)).toBe('');
    expect(resolveMediaUrl(undefined)).toBe('');
    expect(resolveMediaUrl('')).toBe('');
  });

  it('extrae ruta relativa si contiene /redsocial-media/', () => {
    expect(resolveMediaUrl('http://localhost:9000/redsocial-media/foto.jpg')).toBe(
      '/redsocial-media/foto.jpg',
    );
    expect(resolveMediaUrl('http://3.144.255.71:9000/redsocial-media/media-123.png')).toBe(
      '/redsocial-media/media-123.png',
    );
    expect(resolveMediaUrl('https://s3.tudominio.com/redsocial-media/avatar.webp')).toBe(
      '/redsocial-media/avatar.webp',
    );
  });

  it('conserva URLs relativas existentes o externas que no son de MinIO', () => {
    expect(resolveMediaUrl('/redsocial-media/foto.jpg')).toBe('/redsocial-media/foto.jpg');
    expect(resolveMediaUrl('https://cdn.externo.com/avatar.jpg')).toBe(
      'https://cdn.externo.com/avatar.jpg',
    );
  });
});
