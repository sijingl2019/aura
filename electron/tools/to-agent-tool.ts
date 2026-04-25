import type { Tool } from './types';

/**
 * Wrap our Tool interface into a pi-agent-core AgentTool.
 * Typed as `any` to avoid a direct typebox (TSchema) dependency.
 */
export function toAgentTool(tool: Tool, cwd: string): any {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (
      _toolCallId: string,
      params: unknown,
      signal?: AbortSignal,
    ) => {
      const ctx = { signal: signal ?? new AbortController().signal, cwd };
      const result = await tool.execute(params, ctx);
      return {
        content: [{ type: 'text', text: result.content }],
        details: { ok: result.ok },
      };
    },
  };
}
