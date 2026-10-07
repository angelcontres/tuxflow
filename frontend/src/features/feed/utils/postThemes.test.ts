import { describe, it, expect } from 'vitest';
import { isThemePost, extractThemeKey, getPostCardTheme, POST_CARD_THEMES } from './postThemes';

describe('postThemes utility', () => {
  it('detecta correctamente si un post usa un tema de fondo estético', () => {
    expect(isThemePost('theme:aurora')).toBe(true);
    expect(isThemePost('theme:sunset')).toBe(true);
    expect(isThemePost('https://cdn.example.com/foto.jpg')).toBe(false);
    expect(isThemePost(undefined)).toBe(false);
    expect(isThemePost('')).toBe(false);
  });

  it('extrae la clave del tema limpiamente', () => {
    expect(extractThemeKey('theme:aurora')).toBe('aurora');
    expect(extractThemeKey('theme:Ocean')).toBe('ocean');
    expect(extractThemeKey('https://example.com/img.png')).toBe('');
  });

  it('devuelve el objeto de estilo para temas conocidos y fallback para desconocidos', () => {
    const aurora = getPostCardTheme('aurora');
    expect(aurora.nombre).toBe('Aurora');
    expect(aurora.gradientClass).toContain('from-indigo-700');

    const ocean = getPostCardTheme('ocean');
    expect(ocean.nombre).toBe('Océano');

    const desconocido = getPostCardTheme('no-existe');
    expect(desconocido.key).toBe(POST_CARD_THEMES.aurora.key);
  });
});
