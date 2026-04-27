import { useEffect } from 'react';
import type { ShortcutDef } from '@shared/types';

export interface ShortcutActions {
  newConversation: () => void;
  openSettings: () => void;
  closeWindow: () => void;
  openSearch: () => void;
}

const isMac = /Mac/.test(navigator.platform);

function eventMatchesShortcut(e: KeyboardEvent, keys: string): boolean {
  // keys format: 'CmdOrCtrl+N', 'CmdOrCtrl+,', 'CmdOrCtrl+K', etc.
  const parts = keys.split('+');
  const modifiers = parts.slice(0, -1).map((p) => p.toLowerCase());
  const key = parts[parts.length - 1];

  const wantsCmdOrCtrl = modifiers.includes('cmdorctrl');
  const wantsShift = modifiers.includes('shift');
  const wantsAlt = modifiers.includes('alt');

  const hasCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
  if (wantsCmdOrCtrl !== hasCmdOrCtrl) return false;
  if (wantsShift !== e.shiftKey) return false;
  if (wantsAlt !== e.altKey) return false;

  // Normalise key comparison
  const evKey = e.key === ' ' ? 'Space' : e.key;
  return evKey.toLowerCase() === key.toLowerCase();
}

export function useShortcuts(shortcuts: ShortcutDef[], actions: ShortcutActions): void {
  useEffect(() => {
    if (shortcuts.length === 0) return;

    const onKey = (e: KeyboardEvent) => {
      // Don't fire when typing inside an input / textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      for (const s of shortcuts) {
        if (s.global) continue; // global shortcuts handled by main process
        if (!eventMatchesShortcut(e, s.keys)) continue;

        e.preventDefault();
        switch (s.id) {
          case 'new-conversation': actions.newConversation(); break;
          case 'open-settings':    actions.openSettings();    break;
          case 'close-window':     actions.closeWindow();     break;
          case 'search':           actions.openSearch();      break;
        }
        return;
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcuts, actions]);
}
