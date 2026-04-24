import type { Tool } from './types';
import type { ToolSchema } from '../providers/types';
import { listDirTool, readFileTool, writeFileTool } from './fs';
import { execShellTool } from './shell';
import { webFetchTool } from './web';

const BUILTIN_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  listDirTool,
  execShellTool,
  webFetchTool,
];

const tools: Tool[] = [...BUILTIN_TOOLS];
const byName = new Map<string, Tool>(tools.map((t) => [t.name, t]));

export function registerTools(newTools: Tool[]): void {
  for (const t of newTools) {
    if (byName.has(t.name)) {
      console.warn(`[tools] duplicate tool name "${t.name}", skipping`);
      continue;
    }
    tools.push(t);
    byName.set(t.name, t);
  }
}

export function listTools(): Tool[] {
  return tools;
}

export function getTool(name: string): Tool | undefined {
  return byName.get(name);
}

export function toOpenAISchemas(input: Tool[] = tools): ToolSchema[] {
  return input.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
