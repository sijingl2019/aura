import path from 'node:path';
import { globalShortcut, screen, type BrowserWindow } from 'electron';
import type { SelectionHookConstructor, SelectionHookInstance, TextSelectionData } from 'selection-hook';
import { getSettings } from '../config/store';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SelectionHook: SelectionHookConstructor = require('selection-hook');

const INVALID = SelectionHook.INVALID_COORDINATE;
const hook: SelectionHookInstance = new SelectionHook();

let mainWindowRef: (() => BrowserWindow | null) | null = null;
let registeredShortcut = '';

type HookState = 'off' | 'active' | 'passive';
let hookState: HookState = 'off';

export function initSelectionIpc(getMainWindow: () => BrowserWindow | null): void {
  mainWindowRef = getMainWindow;

  // Exclude this app's process so in-app selections don't double-fire via the global hook.
  const exeName = path.basename(process.execPath);
  hook.setGlobalFilterMode(SelectionHook.FilterMode.EXCLUDE_LIST, [exeName]);

  hook.on('text-selection', (data: TextSelectionData) => {
    if (!data.text?.trim()) return;
    const cfg = getSettings().selectionToolbar;
    if (!cfg?.enabled || cfg.globalMode !== 'auto') return;
    pushToRenderer(data.text.trim(), resolveCoords(data));
  });

  hook.on('error', (err) => {
    console.warn('[selection-hook] error:', err.message);
  });
}

export function syncSelectionConfig(): void {
  const cfg = getSettings().selectionToolbar;
  const mode = cfg?.globalMode ?? 'off';
  const enabled = cfg?.enabled ?? false;

  const desired: HookState =
    !enabled || mode === 'off' ? 'off' :
    mode === 'shortcut' ? 'passive' :
    'active';

  const desiredShortcut =
    enabled && mode === 'shortcut' ? (cfg?.globalShortcut || '') : '';

  if (desiredShortcut !== registeredShortcut) {
    if (registeredShortcut) {
      try { globalShortcut.unregister(registeredShortcut); } catch { /* ignore */ }
      registeredShortcut = '';
    }
    if (desiredShortcut) {
      try {
        globalShortcut.register(desiredShortcut, () => {
          const data = hook.getCurrentSelection();
          if (data?.text?.trim()) {
            pushToRenderer(data.text.trim(), resolveCoords(data));
          }
        });
        registeredShortcut = desiredShortcut;
      } catch (e) {
        console.warn(`[selection] cannot register shortcut "${desiredShortcut}": ${(e as Error).message}`);
      }
    }
  }

  if (desired !== hookState) {
    if (hookState !== 'off') {
      hook.stop();
    }
    hookState = desired;
    if (desired !== 'off') {
      hook.setSelectionPassiveMode(desired === 'passive');
      const ok = hook.start();
      if (!ok) {
        console.warn('[selection-hook] failed to start');
        hookState = 'off';
      }
    }
  }
}

export function teardownSelectionIpc(): void {
  if (hookState !== 'off') {
    hook.stop();
    hookState = 'off';
  }
  hook.cleanup();
  if (registeredShortcut) {
    try { globalShortcut.unregister(registeredShortcut); } catch { /* ignore */ }
    registeredShortcut = '';
  }
}

function resolveCoords(data: TextSelectionData): { dipX: number; dipY: number } | null {
  const { SEL_FULL, SEL_DETAILED, MOUSE_DUAL, MOUSE_SINGLE } = SelectionHook.PositionLevel;

  let screenX: number | null = null;
  let screenY: number | null = null;

  if (data.posLevel === SEL_FULL || data.posLevel === SEL_DETAILED) {
    if (data.endBottom.x !== INVALID && data.endBottom.y !== INVALID) {
      screenX = data.endBottom.x;
      screenY = data.endBottom.y;
    }
  }

  if (screenX === null && (data.posLevel === MOUSE_DUAL || data.posLevel === MOUSE_SINGLE)) {
    if (data.mousePosEnd.x !== INVALID && data.mousePosEnd.y !== INVALID) {
      screenX = data.mousePosEnd.x;
      screenY = data.mousePosEnd.y;
    }
  }

  if (screenX === null || screenY === null) return null;

  const dip = screen.screenToDipPoint({ x: screenX, y: screenY });
  return { dipX: dip.x, dipY: dip.y };
}

function pushToRenderer(
  text: string,
  coords: { dipX: number; dipY: number } | null,
): void {
  const win = mainWindowRef?.();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send('selection:fromClipboard', {
    text,
    dipX: coords?.dipX ?? null,
    dipY: coords?.dipY ?? null,
  });
}
