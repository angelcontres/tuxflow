import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBannerTheme,
  getUserSavedBanner,
  saveUserBanner,
} from './profileStyle';

describe('profileStyle utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve el tema explícito si existe en BANNER_THEMES', () => {
    const theme = getBannerTheme('sunset');
    expect(theme.key).toBe('sunset');
    expect(theme.nombre).toBe('Atardecer Cálido');
    expect(theme.gradient).toContain('from-amber-600');
  });

  it('calcula un tema determinista estable a partir del seed', () => {
    const theme1 = getBannerTheme(undefined, 'usuario-a');
    const theme2 = getBannerTheme(undefined, 'usuario-a');
    expect(theme1.key).toBe(theme2.key);
  });

  it('guarda y recupera el tema en localStorage', () => {
    expect(getUserSavedBanner('user-123')).toBeNull();

    saveUserBanner('user-123', 'emerald');
    expect(getUserSavedBanner('user-123')).toBe('emerald');

    const theme = getBannerTheme(getUserSavedBanner('user-123'), 'user-123');
    expect(theme.key).toBe('emerald');
  });
});
