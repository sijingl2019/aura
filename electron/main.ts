import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDifyKnowledge, getGeneralConfig, getShortcuts } from './config/store';
import { initDb } from './db/index';
import { registerDbIpc } from './ipc/db';
import { registerLlmIpc } from './ipc/llm';
import { registerPopupIpc } from './ipc/popupIpc';
import { registerQuickQuestionIpc } from './ipc/quickQuestionIpc';
import { initSelectionIpc, syncSelectionConfig, teardownSelectionIpc } from './ipc/selectionIpc';
import { registerSettingsIpc } from './ipc/settings';
import { registerSkillsIpc } from './ipc/skills';
import { registerToolbarIpc } from './ipc/toolbarIpc';
import { registerWorkspaceIpc } from './ipc/workspace';
import { startBuiltinMcpServer } from './mcp/builtin-server';
import { McpClientManager } from './mcp/client';
import { startDifyKnowledgeMcpServer } from './mcp/dify-knowledge';
import { SkillStore } from './skills/loader';
import { registerTools } from './tools/registry';
import { toggleQuickQuestionWindow } from './windows/quickQuestionWindow';

process.env.APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

// Resolve image assets from src/ in dev, and from extraResources in prod packaging
function resolveAssetPath(relative: string): string {
  if (VITE_DEV_SERVER_URL) {
    return path.join(process.env.APP_ROOT!, 'src/assets/images', relative);
  }
  return path.join(process.resourcesPath, 'assets', relative);
}

const APP_ICON_PATH = resolveAssetPath('logo.png');
const TRAY_ICON_PATH = resolveAssetPath('tray.png');

// Install a minimal application menu so OS-level shortcuts (Cmd/Ctrl+C/V/X/A, Z/Y) work.
// Without a menu, Electron strips all default edit shortcuts and inputs can't paste.
// `autoHideMenuBar: true` on the BrowserWindow keeps it hidden on Windows/Linux;
// on macOS it appears in the system menu bar as expected.
const isMac = process.platform === 'darwin';
Menu.setApplicationMenu(
  Menu.buildFromTemplate([
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? ([
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
            ] as Electron.MenuItemConstructorOptions[])
          : ([
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' },
            ] as Electron.MenuItemConstructorOptions[])),
      ],
    },
  ]),
);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  const generalCfg = getGeneralConfig();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    title: 'Qiko Aura',
    icon: APP_ICON_PATH,
    backgroundColor: '#ffffff',
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: generalCfg.spellCheck,
    },
  });
  if (generalCfg.minimizeToTrayOnStartup) {
    mainWindow.once('ready-to-show', () => mainWindow?.hide());
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    const cfg = getGeneralConfig();
    if (cfg.minimizeToTrayOnClose && cfg.showTrayIcon && tray && !tray.isDestroyed()) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  if (tray) return;
  const image = nativeImage.createFromPath(TRAY_ICON_PATH);
  // macOS menu-bar icons should be templates so they auto-invert in dark mode
  if (process.platform === 'darwin') image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip('Qiko Aura');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (!mainWindow) {
            createWindow();
            return;
          }
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' },
      { role: 'quit', label: '退出' },
    ]),
  );
  tray.on('click', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
  for (const s of getShortcuts().filter((s) => s.global)) {
    const ok = globalShortcut.register(s.keys, () => {
      if (s.id === 'quick-question') toggleQuickQuestionWindow();
    });
    const verified = globalShortcut.isRegistered(s.keys);
    if (!ok || !verified) {
      console.warn(
        `[shortcut] global shortcut "${s.keys}" registration failed (register=${ok}, isRegistered=${verified}). ` +
          `On Windows this often means the OS or input method (IME) has reserved it — try a different combination in Settings → 快捷键.`,
      );
    } else {
      console.log(`[shortcut] global shortcut "${s.keys}" registered (id=${s.id})`);
    }
  }
}

ipcMain.handle('app:ping', () => 'pong from main');

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('window:openExternal', (_e, url: string) => shell.openExternal(url));

const mcpManager = new McpClientManager();

app.whenReady().then(async () => {
  initDb();

  // Apply saved general config at startup
  const generalCfg = getGeneralConfig();
  if (app.isPackaged) {
    try {
      app.setLoginItemSettings({ openAtLogin: generalCfg.launchAtStartup });
    } catch (e) {
      console.warn(`[login-item] failed to set: ${(e as Error).message}`);
    }
  }
  if (generalCfg.proxyMode === 'none') {
    const { session } = await import('electron');
    await session.defaultSession.setProxy({ mode: 'direct' });
  } else if (generalCfg.proxyMode === 'manual' && generalCfg.proxyHost) {
    const { session } = await import('electron');
    await session.defaultSession.setProxy({
      proxyRules: `${generalCfg.proxyHost}:${generalCfg.proxyPort ?? 8080}`,
    });
  }

  const userSkillsDir = path.join(os.homedir(), '.qiko-aura', 'skills');
  const resourceSkillsDir = path.join(process.resourcesPath ?? app.getAppPath(), 'skills');
  if (!fs.existsSync(userSkillsDir)) fs.mkdirSync(userSkillsDir, { recursive: true });

  const skills = new SkillStore([userSkillsDir, resourceSkillsDir]);
  await skills.reload();

  // Watch for file system changes in userSkillsDir and auto-reload
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  fs.watch(userSkillsDir, { recursive: true }, () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      await skills.reload();
      // Notify all renderer windows to refresh the skill list
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('skills:updated');
      }
    }, 300);
  });

  const mcpSetups: Array<{
    id: string;
    start: () => Promise<{
      clientTransport: Awaited<ReturnType<typeof startBuiltinMcpServer>>['clientTransport'];
    }>;
  }> = [
    { id: 'builtin', start: startBuiltinMcpServer },
    { id: 'dify-knowledge', start: () => startDifyKnowledgeMcpServer(getDifyKnowledge) },
  ];

  for (const setup of mcpSetups) {
    try {
      const { clientTransport } = await setup.start();
      await mcpManager.connect(setup.id, clientTransport);
    } catch (e) {
      console.warn(`[mcp] failed to start server "${setup.id}": ${(e as Error).message}`);
    }
  }

  try {
    const mcpTools = await mcpManager.listAdaptedTools();
    registerTools(mcpTools);
    console.log(
      `[mcp] registered ${mcpTools.length} tool(s): ${mcpTools.map((t) => t.name).join(', ')}`,
    );
  } catch (e) {
    console.warn(`[mcp] failed to list tools: ${(e as Error).message}`);
  }

  registerDbIpc();
  registerLlmIpc({ skills });
  registerSkillsIpc(skills);
  registerSettingsIpc(
    {
      onTrayControl: (show) => {
        if (show) {
          if (!tray) createTray();
        } else {
          tray?.destroy();
          tray = null;
        }
      },
    },
    updateGlobalShortcuts,
  );
  registerWorkspaceIpc();
  registerPopupIpc();
  registerToolbarIpc();
  registerQuickQuestionIpc();

  createWindow();
  createTray();
  updateGlobalShortcuts();
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(APP_ICON_PATH));
    } catch (e) {
      console.warn(`[dock] failed to set icon: ${(e as Error).message}`);
    }
  }
  initSelectionIpc();
  syncSelectionConfig();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  teardownSelectionIpc();
  void mcpManager.closeAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
