import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FILE = () => path.join(app.getPath('userData'), 'workspace.json');

function load(): string {
  try {
    const raw = fs.readFileSync(FILE(), 'utf8');
    const { cwd } = JSON.parse(raw) as { cwd: string };
    if (cwd && fs.existsSync(cwd)) return cwd;
  } catch {
    // ignore
  }
  return os.homedir();
}

function persist(cwd: string): void {
  try {
    fs.writeFileSync(FILE(), JSON.stringify({ cwd }), 'utf8');
  } catch {
    // ignore
  }
}

let _cwd: string | null = null;

export const workspaceStore = {
  getCwd(): string {
    if (_cwd === null) _cwd = load();
    return _cwd;
  },
  setCwd(newCwd: string): void {
    _cwd = newCwd;
    persist(newCwd);
  },
};
