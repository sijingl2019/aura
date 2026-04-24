import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import type { PopupParams } from '@shared/types';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT ?? '', 'dist');

const pendingParams = new Map<number, PopupParams>();

export function createPopupWindow(
  params: PopupParams,
  cursor: { x: number; y: number },
): BrowserWindow {
  const display = screen.getDisplayNearestPoint(cursor);
  const { bounds } = display;

  const W = 420;
  const H = 400;

  // cursor is the anchor point (already offset by caller); clamp to display
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

  const wcId = popup.webContents.id;
  pendingParams.set(wcId, params);
  popup.on('closed', () => pendingParams.delete(wcId));

  if (VITE_DEV_SERVER_URL) {
    void popup.loadURL(`${VITE_DEV_SERVER_URL}#/popup`);
  } else {
    void popup.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'popup' });
  }

  return popup;
}

export function getPopupParams(webContentsId: number): PopupParams | null {
  return pendingParams.get(webContentsId) ?? null;
}
