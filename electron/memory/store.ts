import fs from 'node:fs';
import path from 'node:path';

export type MemoryKey = 'facts' | 'profile';

const FILE_MAP: Record<MemoryKey, string> = {
  facts: 'MEMORY.md',
  profile: 'USER.md',
};

let _dir: string | null = null;

/** Call once at app startup before any memory operations. */
export function initMemoryStore(dir: string): void {
  _dir = dir;
  fs.mkdirSync(dir, { recursive: true });
}

function dir(): string {
  if (!_dir) throw new Error('[memory] store not initialized — call initMemoryStore() first');
  return _dir;
}

export function readMemoryFile(key: MemoryKey): string {
  try {
    return fs.readFileSync(path.join(dir(), FILE_MAP[key]), 'utf8');
  } catch {
    return '';
  }
}

export function writeMemoryFile(key: MemoryKey, content: string): void {
  fs.writeFileSync(path.join(dir(), FILE_MAP[key]), content, 'utf8');
}

/** Append a timestamped entry under a new H2 heading. */
export function appendMemoryFile(key: MemoryKey, entry: string): void {
  const date = new Date().toISOString().slice(0, 10);
  const block = `\n\n## ${date}\n${entry.trim()}`;
  fs.appendFileSync(path.join(dir(), FILE_MAP[key]), block, 'utf8');
}

export function clearMemoryFile(key: MemoryKey): void {
  fs.writeFileSync(path.join(dir(), FILE_MAP[key]), '', 'utf8');
}

export function getMemoryDir(): string {
  return dir();
}
