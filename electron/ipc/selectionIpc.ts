import { screen } from 'electron';
import type { SelectionHookConstructor, SelectionHookInstance, TextSelectionData } from 'selection-hook';
import { getSettings } from '../config/store';
import {
  getToolbarBounds,
  hideToolbar,
  showToolbar,
  type Anchor,
} from '../windows/toolbarWindow';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SelectionHook: SelectionHookConstructor = require('selection-hook');

const INVALID = SelectionHook.INVALID_COORDINATE;
const hook: SelectionHookInstance = new SelectionHook();

let hookRunning = false;

export function initSelectionIpc(): void {
  hook.on('text-selection', (data: TextSelectionData) => {
    const cfg = getSettings().selectionToolbar;
    if (!cfg?.enabled) return;
    const text = data.text?.trim();
    if (!text) return;

    showToolbar(text, resolveAnchor(data));
  });

  hook.on('mouse-down', (e) => {
    const cfg = getSettings().selectionToolbar;
    if (!cfg?.enabled) return;
    const bounds = getToolbarBounds();
    if (!bounds) return;
    if (e.x === INVALID || e.y === INVALID) return;
    const dip = screen.screenToDipPoint({ x: e.x, y: e.y });
    const inside =
      dip.x >= bounds.x &&
      dip.x <= bounds.x + bounds.width &&
      dip.y >= bounds.y &&
      dip.y <= bounds.y + bounds.height;
    if (!inside) hideToolbar();
  });

  hook.on('error', (err) => {
    console.warn('[selection-hook] error:', err.message);
  });
}

export function syncSelectionConfig(): void {
  const cfg = getSettings().selectionToolbar;
  const needHook = !!cfg?.enabled;

  if (needHook && !hookRunning) {
    const ok = hook.start();
    if (!ok) {
      console.warn('[selection-hook] failed to start');
      return;
    }
    hookRunning = true;
  } else if (!needHook && hookRunning) {
    hook.stop();
    hookRunning = false;
    hideToolbar();
  }
}

export function teardownSelectionIpc(): void {
  if (hookRunning) {
    hook.stop();
    hookRunning = false;
  }
  hook.cleanup();
  hideToolbar();
}

function resolveAnchor(data: TextSelectionData): Anchor {
  const { SEL_FULL, SEL_DETAILED } = SelectionHook.PositionLevel;

  const mouse = toDip(data.mousePosEnd);
  let bottom: Anchor['bottom'] = null;
  let top: Anchor['top'] = null;

  if (data.posLevel === SEL_FULL || data.posLevel === SEL_DETAILED) {
    bottom = toDip(data.endBottom);
    top = toDip(data.startTop);
  }

  // Fallback: use mouse-end as the "below" anchor if no selection rect is available.
  if (!bottom) bottom = mouse;
  if (!top) top = mouse;

  return { bottom, top, mouse };
}

function toDip(p: { x: number; y: number }): { x: number; y: number } | null {
  if (p.x === INVALID || p.y === INVALID) return null;
  const dip = screen.screenToDipPoint({ x: p.x, y: p.y });
  return { x: dip.x, y: dip.y };
}

