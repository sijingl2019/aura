import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT ?? '', 'dist');

const WIN_WIDTH = 600;
const WIN_HEIGHT_MIN = 52;   // input bar only

let win: BrowserWindow | null = null;
let ignoreBlur = false;

export function setIgnoreBlur(value: boolean): void {
  ignoreBlur = value;
}

function getExpandedHeight(): number {
  const { height: sh } = screen.getPrimaryDisplay().workAreaSize;
  return Math.round(sh / 3);
}

function calcBounds(height: number): { x: number; y: number; width: number; height: number } {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const x = Math.round((sw - WIN_WIDTH) / 2);
  // Bottom edge sits at 2/3 of workarea height
  const y = Math.round((sh * 2) / 3) - height;
  return { x, y, width: WIN_WIDTH, height };
}

export function expandQuickQuestionWindow(): void {
  if (!win || win.isDestroyed()) return;
  win.setBounds(calcBounds(getExpandedHeight()));
}

export function createQuickQuestionWindow(): BrowserWindow {
  const bounds = calcBounds(WIN_HEIGHT_MIN);

  win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.on('closed', () => { win = null; });

  win.on('blur', () => {
    if (ignoreBlur) return;
    // Short debounce — avoids hiding during rapid focus shifts (e.g. sub-dialogs)
    setTimeout(() => {
      if (!ignoreBlur && win && !win.isDestroyed() && !win.isFocused()) {
        win.hide();
      }
    }, 120);
  });

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(`${VITE_DEV_SERVER_URL}#/quick-question`);
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'quick-question' });
  }

  return win;
}

export function toggleQuickQuestionWindow(): void {
  if (!win || win.isDestroyed()) {
    createQuickQuestionWindow();
    return;
  }
  if (win.isVisible()) {
    win.hide();
  } else {
    win.setBounds(calcBounds(WIN_HEIGHT_MIN));
    win.show();
    win.focus();
    // Reset React state after window is visible
    setTimeout(() => win?.webContents.send('quickQuestion:reset'), 50);
  }
}

export function hideQuickQuestionWindow(): void {
  if (win && !win.isDestroyed()) win.hide();
}

export function resizeQuickQuestionWindow(height: number): void {
  if (!win || win.isDestroyed()) return;
  win.setBounds(calcBounds(height));
}

export function getQuickQuestionWebContentsId(): number | null {
  return win?.webContents.id ?? null;
}
