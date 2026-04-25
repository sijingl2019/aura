import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDb } from './db/index';
import { registerDbIpc } from './ipc/db';
import { registerLlmIpc } from './ipc/llm';
import { registerSkillsIpc } from './ipc/skills';
import { registerSettingsIpc } from './ipc/settings';
import { registerPopupIpc } from './ipc/popupIpc';
import { registerToolbarIpc } from './ipc/toolbarIpc';
import { initSelectionIpc, syncSelectionConfig, teardownSelectionIpc } from './ipc/selectionIpc';
import { SkillStore } from './skills/loader';
import { McpClientManager } from './mcp/client';
import { startBuiltinMcpServer } from './mcp/builtin-server';
import { startDifyKnowledgeMcpServer } from './mcp/dify-knowledge';
import { registerTools } from './tools/registry';
import { getDifyKnowledge } from './config/store';

process.env.APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    title: 'Qiko Aura',
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
    },
  });

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

  const userSkillsDir = path.join(app.getPath('userData'), 'skills');
  const resourceSkillsDir = path.join(process.resourcesPath ?? app.getAppPath(), 'skills');
  if (!fs.existsSync(userSkillsDir)) fs.mkdirSync(userSkillsDir, { recursive: true });

  const skills = new SkillStore([userSkillsDir, resourceSkillsDir]);
  await skills.reload();

  const mcpSetups: Array<{
    id: string;
    start: () => Promise<{ clientTransport: Awaited<ReturnType<typeof startBuiltinMcpServer>>['clientTransport'] }>;
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

  const cwd = process.cwd();

  registerDbIpc();
  registerLlmIpc({ skills, cwd });
  registerSkillsIpc(skills);
  registerSettingsIpc();
  registerPopupIpc();
  registerToolbarIpc();

  createWindow();
  initSelectionIpc();
  syncSelectionConfig();
});

app.on('will-quit', () => {
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
