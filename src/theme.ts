import { session } from './data/session';

export function applyTheme(theme = session.theme()) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1530' : '#fff3d6');
}

export function cycleTheme(): 'auto' | 'light' | 'dark' {
  // Starting from the default (dark), the 🌓 button goes to light, then "follow the phone".
  const order = ['dark', 'light', 'auto'] as const;
  const next = order[(order.indexOf(session.theme()) + 1) % order.length];
  session.setTheme(next);
  applyTheme(next);
  return next;
}
