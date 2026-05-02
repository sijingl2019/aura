import type { AppTheme } from '@shared/types';

let _mq: MediaQueryList | null = null;
let _listener: (() => void) | null = null;

function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '217 119 87';
  return `${r} ${g} ${b}`;
}

function setDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export function applyTheme(theme: AppTheme, accentColor: string, transparentWindow: boolean) {
  document.documentElement.style.setProperty('--color-accent', hexToRgbChannels(accentColor));
  document.documentElement.classList.toggle('is-transparent', transparentWindow);

  if (_mq && _listener) {
    _mq.removeEventListener('change', _listener);
    _listener = null;
  }

  if (theme === 'system') {
    _mq = window.matchMedia('(prefers-color-scheme: dark)');
    _listener = () => setDark(_mq!.matches);
    _mq.addEventListener('change', _listener);
    setDark(_mq.matches);
  } else {
    setDark(theme === 'dark');
  }
}
