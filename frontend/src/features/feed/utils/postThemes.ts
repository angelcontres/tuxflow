export interface PostCardTheme {
  key: string;
  nombre: string;
  gradientClass: string;
  badgeStyle: string;
  quoteColor: string;
  textColor: string;
  tagClass: string;
  chipClass: string;
}

export const POST_CARD_THEMES: Record<string, PostCardTheme> = {
  aurora: {
    key: 'aurora',
    nombre: 'Aurora',
    gradientClass: 'bg-gradient-to-br from-indigo-700 via-sky-700 to-cyan-600 text-white shadow-md',
    badgeStyle: 'bg-white/20 text-white border-white/30',
    quoteColor: 'text-cyan-200/40',
    textColor: 'text-white',
    tagClass: 'bg-white/20 text-white hover:bg-white/30 border border-white/20',
    chipClass: 'bg-gradient-to-br from-indigo-600 to-cyan-500',
  },
  ocean: {
    key: 'ocean',
    nombre: 'Océano',
    gradientClass: 'bg-gradient-to-br from-blue-900 via-cyan-900 to-teal-800 text-white shadow-md',
    badgeStyle: 'bg-white/20 text-white border-white/30',
    quoteColor: 'text-teal-200/40',
    textColor: 'text-white',
    tagClass: 'bg-white/20 text-white hover:bg-white/30 border border-white/20',
    chipClass: 'bg-gradient-to-br from-blue-900 to-teal-600',
  },
  sunset: {
    key: 'sunset',
    nombre: 'Atardecer',
    gradientClass:
      'bg-gradient-to-br from-amber-700 via-orange-600 to-rose-700 text-white shadow-md',
    badgeStyle: 'bg-white/20 text-white border-white/30',
    quoteColor: 'text-amber-200/40',
    textColor: 'text-white',
    tagClass: 'bg-white/20 text-white hover:bg-white/30 border border-white/20',
    chipClass: 'bg-gradient-to-br from-amber-600 to-rose-600',
  },
  emerald: {
    key: 'emerald',
    nombre: 'Esmeralda',
    gradientClass:
      'bg-gradient-to-br from-emerald-800 via-teal-700 to-cyan-800 text-white shadow-md',
    badgeStyle: 'bg-white/20 text-white border-white/30',
    quoteColor: 'text-emerald-200/40',
    textColor: 'text-white',
    tagClass: 'bg-white/20 text-white hover:bg-white/30 border border-white/20',
    chipClass: 'bg-gradient-to-br from-emerald-700 to-cyan-700',
  },
  midnight: {
    key: 'midnight',
    nombre: 'Medianoche',
    gradientClass:
      'bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-950 text-zinc-100 shadow-md border border-zinc-700/60',
    badgeStyle: 'bg-white/10 text-zinc-300 border-white/10',
    quoteColor: 'text-slate-400/30',
    textColor: 'text-zinc-100',
    tagClass: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700',
    chipClass: 'bg-gradient-to-br from-zinc-900 to-slate-800 border border-zinc-600',
  },
};

export const THEME_LIST = Object.values(POST_CARD_THEMES);

export function isThemePost(mediaUrl?: string): boolean {
  return typeof mediaUrl === 'string' && mediaUrl.startsWith('theme:');
}

export function extractThemeKey(mediaUrl?: string): string {
  if (!isThemePost(mediaUrl)) return '';
  return mediaUrl!.slice(6).trim().toLowerCase();
}

export function getPostCardTheme(themeKey: string): PostCardTheme {
  return POST_CARD_THEMES[themeKey] || POST_CARD_THEMES.aurora;
}
