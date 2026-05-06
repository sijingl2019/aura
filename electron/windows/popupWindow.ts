import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import type { PopupParams } from '@shared/types';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT ?? '', 'dist');

const pendingParams = new Map<number, PopupParams>();

// Singleton: only ONE unpinned popup exists at a time.
// When the user pins a popup it is "orphaned" — removed from singleton tracking
// so the next toolbar action opens a fresh window without closing the pinned one.
let singletonPopup: BrowserWindow | null = null;

export function createPopupWindow(
  params: PopupParams,
  cursor: { x: number; y: number },
): BrowserWindow {
  // Close the current unpinned popup before opening a new one.
  if (singletonPopup && !singletonPopup.isDestroyed()) {
    singletonPopup.destroy();
  }
  singletonPopup = null;

  const display = screen.getDisplayNearestPoint(cursor);
  const { bounds } = display;

  const W = 420;
  const H = 400;

  const x = Math.min(Math.max(cursor.x, bounds.x), bounds.x + bounds.width - W);
  const y = Math.min(Math.max(cursor.y, bounds.y), bounds.y + bounds.height - H);

  const popup = new BrowserWindow({
    width: W,
    height: H,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: false,
    resizable: true,
    minWidth: 300,
    minHeight: 280,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  singletonPopup = popup;

  const wcId = popup.webContents.id;
  pendingParams.set(wcId, params);
  popup.on('closed', () => {
    pendingParams.delete(wcId);
    if (singletonPopup === popup) singletonPopup = null;
  });

  if (VITE_DEV_SERVER_URL) {
    void popup.loadURL(`${VITE_DEV_SERVER_URL}#/popup`);
  } else {
    void popup.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'popup' });
  }

  return popup;
}

/**
 * Called when the user toggles the pin button on a popup.
 * Pinning a popup orphans it from the singleton — the next toolbar action
 * creates a fresh window without closing the pinned one.
 */
export function setPopupPinned(popup: BrowserWindow, pinned: boolean): void {
  popup.setAlwaysOnTop(pinned);
  if (pinned && singletonPopup === popup) {
    // Orphan: let it live independently; a new singleton starts on the next action.
    singletonPopup = null;
  }
  // Unpinning: popup was already orphaned when pinned, so no change to singleton.
}

/**
 * Close the current unpinned popup (e.g., when new text is selected).
 * Pinned popups are left open intentionally.
 */
export function closeUnpinnedPopup(): void {
  if (singletonPopup && !singletonPopup.isDestroyed()) {
    singletonPopup.destroy();
    singletonPopup = null;
  }
}

export function getPopupParams(webContentsId: number): PopupParams | null {
  return pendingParams.get(webContentsId) ?? null;
}
