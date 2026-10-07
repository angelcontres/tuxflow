export interface BannerTheme {
  key: string;
  nombre: string;
  gradient: string;
  accentBorder: string;
  accentText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  previewBg: string;
}

export const BANNER_THEMES: Record<string, BannerTheme> = {
  aurora: {
    key: 'aurora',
    nombre: 'Aurora Boreal',
    gradient: 'from-cyan-600 via-indigo-600 to-blue-700',
    accentBorder: 'ring-indigo-500',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    previewBg: 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-blue-700',
  },
  ocean: {
    key: 'ocean',
    nombre: 'Océano Pacífico',
    gradient: 'from-blue-800 via-cyan-800 to-teal-700',
    accentBorder: 'ring-cyan-500',
    accentText: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60',
    badgeBorder: 'border-cyan-200 dark:border-cyan-800',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    previewBg: 'bg-gradient-to-r from-blue-800 via-cyan-800 to-teal-700',
  },
  sunset: {
    key: 'sunset',
    nombre: 'Atardecer Cálido',
    gradient: 'from-amber-600 via-orange-600 to-rose-600',
    accentBorder: 'ring-amber-500',
    accentText: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    badgeText: 'text-amber-700 dark:text-amber-300',
    previewBg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600',
  },
  emerald: {
    key: 'emerald',
    nombre: 'Bosque Esmeralda',
    gradient: 'from-emerald-700 via-teal-700 to-cyan-700',
    accentBorder: 'ring-emerald-500',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    previewBg: 'bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700',
  },
  midnight: {
    key: 'midnight',
    nombre: 'Medianoche Estelar',
    gradient: 'from-zinc-900 via-slate-800 to-zinc-900',
    accentBorder: 'ring-slate-400',
    accentText: 'text-slate-400 dark:text-slate-200',
    badgeBg: 'bg-slate-100 dark:bg-zinc-800',
    badgeBorder: 'border-slate-300 dark:border-zinc-700',
    badgeText: 'text-slate-700 dark:text-zinc-200',
    previewBg: 'bg-gradient-to-r from-zinc-900 via-slate-800 to-zinc-900',
  },
  cyber: {
    key: 'cyber',
    nombre: 'Flujo Azul UPSE',
    gradient: 'from-blue-700 via-indigo-700 to-sky-600',
    accentBorder: 'ring-sky-500',
    accentText: 'text-sky-600 dark:text-sky-400',
    badgeBg: 'bg-sky-50 dark:bg-sky-950/60',
    badgeBorder: 'border-sky-200 dark:border-sky-800',
    badgeText: 'text-sky-700 dark:text-sky-300',
    previewBg: 'bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600',
  },
};

const THEME_KEYS = Object.keys(BANNER_THEMES);

/**
 * Obtiene o infiere un tema estético de perfil determinista para un usuario.
 */
export function getBannerTheme(customKey?: string | null, seed?: string): BannerTheme {
  if (customKey && BANNER_THEMES[customKey]) {
    return BANNER_THEMES[customKey];
  }

  if (!seed) {
    return BANNER_THEMES.aurora;
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % THEME_KEYS.length;
  const key = THEME_KEYS[index];
  return BANNER_THEMES[key] || BANNER_THEMES.aurora;
}

export function getUserSavedBanner(userId: string): string | null {
  try {
    return localStorage.getItem(`tuxflow_banner_${userId}`);
  } catch {
    return null;
  }
}

export function saveUserBanner(userId: string, themeKey: string): void {
  try {
    localStorage.setItem(`tuxflow_banner_${userId}`, themeKey);
  } catch {
    // ignorar en entornos donde localStorage falle
  }
}
