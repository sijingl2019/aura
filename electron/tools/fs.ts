import fs from 'node:fs/promises';
import path from 'node:path';
import { type Tool, type ToolContext, fail, ok, truncate } from './types';

const MAX_READ_BYTES = 1024 * 1024;
const MAX_WRITE_BYTES = 1024 * 1024;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', 'release']);

function resolveWithin(ctx: ToolContext, p: string): string | null {
  const abs = path.resolve(ctx.cwd, p);
  const rel = path.relative(ctx.cwd, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}

function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  for (const b of sample) {
    if (b === 0) return true;
  }
  return false;
}

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read a UTF-8 text file under the workspace. Rejects binary files and paths outside the workspace.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from workspace root.' },
    },
    required: ['path'],
  },
  async execute(input, ctx) {
    const { path: p } = (input as { path?: string }) ?? {};
    if (!p) return fail('missing "path"');
    const abs = resolveWithin(ctx, p);
    if (!abs) return fail(`path outside workspace: ${p}`);
    try {
      const stat = await fs.stat(abs);
      if (!stat.isFile()) return fail(`not a file: ${p}`);
      if (stat.size > MAX_READ_BYTES) return fail(`file too large (${stat.size} bytes, max ${MAX_READ_BYTES})`);
      const buf = await fs.readFile(abs);
      if (looksBinary(buf)) return fail(`binary file refused: ${p}`);
      return ok(buf.toString('utf8'));
    } catch (e) {
      return fail(`read failed: ${(e as Error).message}`);
    }
  },
};

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write UTF-8 text to a file under the workspace. Overwrites existing files. Creates parent directories.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from workspace root.' },
      content: { type: 'string', description: 'Full file content to write.' },
    },
    required: ['path', 'content'],
  },
  async execute(input, ctx) {
    const { path: p, content } = (input as { path?: string; content?: string }) ?? {};
    if (!p) return fail('missing "path"');
    if (typeof content !== 'string') return fail('missing "content"');
    if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) {
      return fail(`content too large (max ${MAX_WRITE_BYTES} bytes)`);
    }
    const abs = resolveWithin(ctx, p);
    if (!abs) return fail(`path outside workspace: ${p}`);
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, 'utf8');
      return ok(`wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${p}`);
    } catch (e) {
      return fail(`write failed: ${(e as Error).message}`);
    }
  },
};

export const listDirTool: Tool = {
  name: 'list_dir',
  description: 'List entries of a directory under the workspace. Skips node_modules, .git, dist.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative directory path (use "." for root).' },
    },
    required: ['path'],
  },
  async execute(input, ctx) {
    const { path: p } = (input as { path?: string }) ?? {};
    if (!p) return fail('missing "path"');
    const abs = resolveWithin(ctx, p);
    if (!abs) return fail(`path outside workspace: ${p}`);
    try {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const lines = entries
        .filter((e) => !SKIP_DIRS.has(e.name))
        .map((e) => `${e.isDirectory() ? 'd' : '-'} ${e.name}`)
        .sort();
      return ok(truncate(lines.join('\n'), 16 * 1024));
    } catch (e) {
      return fail(`list failed: ${(e as Error).message}`);
    }
  },
};
