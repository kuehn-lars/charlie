export type Theme = 'light' | 'dark';

export const THEME_KEY = 'fuer-charlie:theme';

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Set before first paint by the inline head script (vite.config.ts). */
export const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

function stored(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/**
 * Follows the system until the switch is used once, then remembers the choice.
 * `apply` runs on every change (and once now) to repaint canvases.
 */
export function initTheme(apply: (theme: Theme) => void): (theme: Theme) => void {
  const set = (theme: Theme) => {
    document.documentElement.dataset.theme = theme;
    apply(theme);
  };
  media().addEventListener('change', (e) => {
    if (!stored()) set(e.matches ? 'dark' : 'light');
  });
  set(stored() ?? (media().matches ? 'dark' : 'light'));
  return (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private mode: the choice lasts for this page view.
    }
    set(theme);
  };
}
