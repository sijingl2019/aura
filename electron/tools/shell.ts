import { spawn } from 'node:child_process';
import { type Tool, fail, truncate } from './types';

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 8 * 1024;
const IS_WIN = process.platform === 'win32';

function decodeOutput(buf: Buffer): string {
  if (!IS_WIN) return buf.toString('utf8');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch {
      return buf.toString('utf8');
    }
  }
}

export const execShellTool: Tool = {
  name: 'exec_shell',
  description:
    'Execute a shell command in the workspace directory. 30s timeout. Output truncated to 8KB. Use for quick, read-only operations (ls, git status, cat). Do not start long-running servers.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to run.' },
    },
    required: ['command'],
  },
  async execute(input, ctx) {
    // TODO: user confirm UI before execution (shell is high-risk)
    const { command } = (input as { command?: string }) ?? {};
    if (!command) return fail('missing "command"');

    const actualCommand = IS_WIN ? `chcp 65001 >nul 2>&1 & ${command}` : command;

    return new Promise((resolve) => {
      const child = spawn(actualCommand, {
        shell: true,
        cwd: ctx.cwd,
        windowsHide: true,
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill();
      }, TIMEOUT_MS);

      const abortListener = () => {
        killed = true;
        child.kill();
      };
      ctx.signal.addEventListener('abort', abortListener, { once: true });

      child.stdout?.on('data', (b: Buffer) => {
        if (stdoutBytes < MAX_OUTPUT_BYTES) {
          stdoutChunks.push(b);
          stdoutBytes += b.length;
        }
      });
      child.stderr?.on('data', (b: Buffer) => {
        if (stderrBytes < MAX_OUTPUT_BYTES) {
          stderrChunks.push(b);
          stderrBytes += b.length;
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        ctx.signal.removeEventListener('abort', abortListener);
        resolve(fail(`spawn failed: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        ctx.signal.removeEventListener('abort', abortListener);
        const stdout = truncate(decodeOutput(Buffer.concat(stdoutChunks)), MAX_OUTPUT_BYTES);
        const stderr = truncate(decodeOutput(Buffer.concat(stderrChunks)), MAX_OUTPUT_BYTES);
        const parts = [`exit code: ${code ?? 'null'}${killed ? ' (killed)' : ''}`];
        if (stdout) parts.push(`--- stdout ---\n${stdout}`);
        if (stderr) parts.push(`--- stderr ---\n${stderr}`);
        resolve({ ok: code === 0 && !killed, content: parts.join('\n') });
      });
    });
  },
};
