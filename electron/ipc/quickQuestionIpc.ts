import { BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {
  expandQuickQuestionWindow,
  hideQuickQuestionWindow,
  resizeQuickQuestionWindow,
  setIgnoreBlur,
} from '../windows/quickQuestionWindow';

export interface AppEntry {
  name: string;
  path: string;
}

let appListCache: AppEntry[] | null = null;
let appListCacheTime = 0;
const APP_CACHE_TTL = 5 * 60_000;

function runPowerShellEncoded(script: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    // -EncodedCommand expects base64-encoded UTF-16 LE; eliminates all cmd.exe quoting issues.
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', encoded],
      { windowsHide: true },
    );
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { proc.kill(); } catch { /* ignore */ }
      console.warn('[quickQuestion] powershell timed out');
      resolve('');
    }, timeoutMs);
    proc.stdout.on('data', (d: Buffer) => out.push(d));
    proc.stderr.on('data', (d: Buffer) => err.push(d));
    proc.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.length) {
        const errText = Buffer.concat(err).toString('utf8').trim();
        if (errText) console.warn('[quickQuestion] powershell stderr:', errText.slice(0, 500));
      }
      resolve(Buffer.concat(out).toString('utf8'));
    });
    proc.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.warn('[quickQuestion] powershell spawn error:', e.message);
      resolve('');
    });
  });
}

async function getWindowsApps(): Promise<AppEntry[]> {
  const now = Date.now();
  if (appListCache && appListCache.length > 0 && now - appListCacheTime < APP_CACHE_TTL) {
    return appListCache;
  }

  // Force UTF-8 output so JSON is decoded correctly regardless of system code page.
  // -ErrorAction SilentlyContinue keeps unreadable subdirs from aborting the pipeline.
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
$dirs = @(
  [Environment]::GetFolderPath('CommonPrograms'),
  [Environment]::GetFolderPath('Programs')
)
$results = New-Object System.Collections.Generic.List[Object]
foreach ($d in $dirs) {
  if ($d -and (Test-Path $d)) {
    Get-ChildItem -LiteralPath $d -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
      $results.Add([PSCustomObject]@{ Name = $_.BaseName; Path = $_.FullName })
    }
  }
}
if ($results.Count -eq 0) {
  '[]'
} else {
  $results | Sort-Object Name -Unique | ConvertTo-Json -Compress
}
`;

  const stdout = await runPowerShellEncoded(script, 10_000);
  const trimmed = stdout.trim();
  if (!trimmed) {
    console.warn('[quickQuestion] powershell returned empty stdout');
    return appListCache ?? [];
  }

  try {
    const raw = JSON.parse(trimmed);
    const arr: AppEntry[] = (Array.isArray(raw) ? raw : [raw])
      .filter((x: unknown) => x && typeof x === 'object' && (x as Record<string, unknown>).Name && (x as Record<string, unknown>).Path)
      .map((x: Record<string, unknown>) => ({ name: String(x.Name), path: String(x.Path) }));
    if (arr.length > 0) {
      appListCache = arr;
      appListCacheTime = now;
      console.log(`[quickQuestion] indexed ${arr.length} apps from Start Menu`);
    } else {
      console.warn('[quickQuestion] powershell returned empty app list');
    }
    return arr;
  } catch (e) {
    console.warn('[quickQuestion] failed to parse powershell output:', (e as Error).message, '\nraw:', trimmed.slice(0, 200));
    return appListCache ?? [];
  }
}

export function registerQuickQuestionIpc(): void {
  ipcMain.handle('quickQuestion:close', () => {
    hideQuickQuestionWindow();
  });

  ipcMain.handle('quickQuestion:expand', () => {
    expandQuickQuestionWindow();
  });

  ipcMain.handle('quickQuestion:resize', (_e, height: number) => {
    if (typeof height !== 'number' || height < 52) return;
    resizeQuickQuestionWindow(Math.min(Math.round(height), 600));
  });

  ipcMain.handle('quickQuestion:searchApps', async (_e, query: string) => {
    const apps = await getWindowsApps();
    if (!query) return apps.slice(0, 8);
    const q = query.toLowerCase();
    return apps.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 8);
  });

  ipcMain.handle('quickQuestion:launchApp', async (_e, appPath: string) => {
    try {
      if (path.extname(appPath).toLowerCase() === '.lnk' || fs.existsSync(appPath)) {
        await shell.openPath(appPath);
      }
    } catch {
      // ignore
    }
    hideQuickQuestionWindow();
  });

  ipcMain.handle('quickQuestion:openAttachMenu', async (e) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    if (!window) return [];

    setIgnoreBlur(true);

    return new Promise<string[]>((resolve) => {
      let chose = false;
      const cleanup = () => setTimeout(() => setIgnoreBlur(false), 120);

      const handlePick = async (properties: Electron.OpenDialogOptions['properties']) => {
        chose = true;
        try {
          const result = await dialog.showOpenDialog(window, { properties });
          resolve(result.canceled ? [] : result.filePaths);
        } catch {
          resolve([]);
        } finally {
          cleanup();
        }
      };

      const menu = Menu.buildFromTemplate([
        { label: '添加文件',   click: () => void handlePick(['openFile', 'multiSelections']) },
        { label: '添加文件夹', click: () => void handlePick(['openDirectory']) },
      ]);

      menu.popup({
        window,
        callback: () => {
          // Menu closed without picking — click handlers fire synchronously, so `chose`
          // is already set if an item was selected.
          if (!chose) {
            resolve([]);
            cleanup();
          }
        },
      });
    });
  });
}
