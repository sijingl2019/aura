import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { WorkspaceFile } from '@shared/types';
import { workspaceStore } from '../workspace/store';

const IGNORE_DIRS = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.next', 'dist', 'build', '.cache']);
const MAX_RESULTS = 60;

/** Recursive search: walk the tree and collect entries whose basename matches q (case-insensitive). */
function searchRecursive(rootDir: string, cwd: string, q: string, results: WorkspaceFile[]): void {
  if (results.length >= MAX_RESULTS) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (results.length >= MAX_RESULTS) return;
    if (e.name.startsWith('.') && !q.startsWith('.')) continue;
    if (IGNORE_DIRS.has(e.name)) continue;
    if (e.name.toLowerCase().includes(q)) {
      results.push({
        name: e.name,
        isDir: e.isDirectory(),
        path: path.relative(cwd, path.join(rootDir, e.name)),
      });
    }
    if (e.isDirectory()) {
      searchRecursive(path.join(rootDir, e.name), cwd, q, results);
    }
  }
}

export function registerWorkspaceIpc(): void {
  ipcMain.handle('workspace:getCwd', () => workspaceStore.getCwd());

  ipcMain.handle('workspace:setCwd', (_e, newCwd: string) => {
    workspaceStore.setCwd(newCwd);
    broadcastCwdChanged(newCwd);
    return newCwd;
  });

  ipcMain.handle('workspace:openFolderDialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择工作空间目录',
      defaultPath: workspaceStore.getCwd(),
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const chosen = result.filePaths[0];
    workspaceStore.setCwd(chosen);
    broadcastCwdChanged(chosen);
    return chosen;
  });

  ipcMain.handle('workspace:listFiles', (_e, params: { dir?: string; query?: string }) => {
    const cwd = workspaceStore.getCwd();
    const q = (params.query ?? '').toLowerCase();
    const rel = params.dir ?? '';

    // If an explicit directory was given, list that directory filtered by query (nav mode)
    if (rel) {
      const targetDir = path.resolve(cwd, rel);
      if (!targetDir.startsWith(cwd)) return [];
      try {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const results: WorkspaceFile[] = entries
          .filter((e) => {
            if (e.name.startsWith('.') && !q.startsWith('.')) return false;
            if (q && !e.name.toLowerCase().includes(q)) return false;
            return true;
          })
          .slice(0, MAX_RESULTS)
          .map((e) => ({
            name: e.name,
            isDir: e.isDirectory(),
            path: path.relative(cwd, path.join(targetDir, e.name)),
          }));
        results.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
        return results;
      } catch {
        return [];
      }
    }

    // No explicit dir: empty query → list cwd root; non-empty query → recursive search
    if (!q) {
      try {
        const entries = fs.readdirSync(cwd, { withFileTypes: true });
        const results: WorkspaceFile[] = entries
          .filter((e) => !e.name.startsWith('.') && !IGNORE_DIRS.has(e.name))
          .slice(0, MAX_RESULTS)
          .map((e) => ({ name: e.name, isDir: e.isDirectory(), path: e.name }));
        results.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
        return results;
      } catch {
        return [];
      }
    }

    // Recursive search across the whole workspace
    const results: WorkspaceFile[] = [];
    searchRecursive(cwd, cwd, q, results);
    // Dirs first, then by depth (shallow paths first), then alphabetically
    results.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      const depthDiff = a.path.split(path.sep).length - b.path.split(path.sep).length;
      if (depthDiff !== 0) return depthDiff;
      return a.name.localeCompare(b.name);
    });
    return results;
  });
}

function broadcastCwdChanged(cwd: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('workspace:cwdChanged', cwd);
  }
}
