import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import type { ToolbarParams } from '@shared/types';
import { getSelectionToolbar } from '../config/store';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT ?? '', 'dist');

// Initial size before the renderer reports its measured dimensions. Wide enough
// that the chip can lay out horizontally without wrapping; the renderer measures
// the natural chip width via ResizeObserver and reports back to shrink the window.
const INITIAL_WIDTH = 600;
const INITIAL_HEIGHT = 40;
const MARGIN = 8;

export interface Anchor {
  bottom: { x: number; y: number } | null;
  top: { x: number; y: number } | null;
  mouse: { x: number; y: number } | null;
}

let toolbarWindow: BrowserWindow | null = null;
let latestParams: ToolbarParams | null = null;
let measuredWidth: number | null = null;
let measuredHeight: number | null = null;

export function showToolbar(text: string, anchor: Anchor): void {
  const cfg = getSelectionToolbar();

  latestParams = {
    text,
    compact: cfg.compact,
    opacity: cfg.opacity,
    actions: cfg.actions,
  };

  const width = measuredWidth ?? INITIAL_WIDTH;
  const height = measuredHeight ?? INITIAL_HEIGHT;
  const position = positionToolbar(anchor, width, height);

  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.setBounds({ x: position.x, y: position.y, width, height });
    toolbarWindow.showInactive();
    toolbarWindow.webContents.send('toolbar:onUpdate', { text });
    return;
  }

  const win = new BrowserWindow({
    width,
    height,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  toolbarWindow = win;

  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setOpacity(cfg.opacity / 100);

  win.on('closed', () => {
    if (toolbarWindow === win) {
      toolbarWindow = null;
      latestParams = null;
      measuredWidth = null;
      measuredHeight = null;
    }
  });

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.showInactive();
  });

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(`${VITE_DEV_SERVER_URL}#/toolbar`);
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'toolbar' });
  }
}

export function hideToolbar(): void {
  // Use hide() instead of close()/destroy() so the window object stays alive.
  // close() is async — if a new selection fires before the 'closed' event the old
  // window hasn't been destroyed yet, toolbarWindow is already null, and showToolbar()
  // creates a second window, leaving two visible simultaneously.
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.hide();
  }
  latestParams = null;
}

export function destroyToolbar(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.destroy();
  }
  toolbarWindow = null;
  latestParams = null;
  measuredWidth = null;
  measuredHeight = null;
}

export function getToolbarParams(): ToolbarParams | null {
  return latestParams;
}

export function getToolbarBounds(): { x: number; y: number; width: number; height: number } | null {
  if (!toolbarWindow || toolbarWindow.isDestroyed()) return null;
  return toolbarWindow.getBounds();
}

export function setToolbarSize(width: number, height: number): void {
  measuredWidth = width;
  measuredHeight = height;
  if (!toolbarWindow || toolbarWindow.isDestroyed()) return;
  const bounds = toolbarWindow.getBounds();
  // Keep the chip centered over the same anchor when width grows from INITIAL.
  const deltaX = Math.round((width - bounds.width) / 2);
  toolbarWindow.setBounds({
    x: bounds.x - deltaX,
    y: bounds.y,
    width,
    height,
  });
}

function positionToolbar(
  anchor: Anchor,
  width: number,
  height: number,
): { x: number; y: number } {
  const below = anchor.bottom ?? anchor.mouse;
  const above = anchor.top ?? anchor.mouse;
  const center = below ?? above ?? { x: 0, y: 0 };

  const display = screen.getDisplayNearestPoint({
    x: Math.round(center.x),
    y: Math.round(center.y),
  });
  const { bounds } = display;

  let x = Math.round(center.x - width / 2);
  x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width));

  let y = below ? Math.round(below.y + MARGIN) : Math.round(center.y + MARGIN);

  if (y + height > bounds.y + bounds.height) {
    const topY = above ? above.y : center.y;
    y = Math.round(topY - height - MARGIN);
  }
  y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height));

  return { x, y };
}
