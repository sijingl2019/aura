export interface ToolContext {
  signal: AbortSignal;
  cwd: string;
}

export interface ToolResult {
  ok: boolean;
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n\n[... truncated ${s.length - max} chars]`;
}

export function ok(content: string): ToolResult {
  return { ok: true, content };
}

export function fail(content: string): ToolResult {
  return { ok: false, content };
}
