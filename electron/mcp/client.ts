import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Tool as NativeTool, ToolResult } from '../tools/types';

interface McpServerHandle {
  serverId: string;
  client: Client;
}

/**
 * Manages MCP client connections. Each connected server's tools are adapted to the
 * native Tool interface so they can be registered alongside built-in tools and
 * invoked uniformly by the agent runtime.
 *
 * Tool names are namespaced `mcp__<serverId>__<toolName>` to avoid collisions with
 * built-ins and across servers.
 */
export class McpClientManager {
  private servers: McpServerHandle[] = [];

  async connect(serverId: string, transport: Transport): Promise<void> {
    const client = new Client({ name: 'qiko-aura', version: '0.0.1' });
    await client.connect(transport);
    this.servers.push({ serverId, client });
  }

  async listAdaptedTools(): Promise<NativeTool[]> {
    const out: NativeTool[] = [];
    for (const { serverId, client } of this.servers) {
      try {
        const { tools } = await client.listTools();
        for (const t of tools) {
          const namespaced = `mcp__${serverId}__${t.name}`;
          out.push({
            name: namespaced,
            description: t.description
              ? `[MCP:${serverId}] ${t.description}`
              : `[MCP:${serverId}] ${t.name}`,
            parameters: (t.inputSchema as Record<string, unknown>) ?? {
              type: 'object',
              properties: {},
            },
            execute: async (input, ctx): Promise<ToolResult> => {
              try {
                const res = await client.callTool(
                  {
                    name: t.name,
                    arguments: (input as Record<string, unknown>) ?? {},
                  },
                  undefined,
                  { signal: ctx.signal },
                );
                const textChunks: string[] = [];
                const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
                for (const c of content) {
                  if (c.type === 'text' && typeof c.text === 'string') {
                    textChunks.push(c.text);
                  } else {
                    textChunks.push(JSON.stringify(c));
                  }
                }
                return {
                  ok: !res.isError,
                  content: textChunks.join('\n') || '(empty)',
                };
              } catch (e) {
                return { ok: false, content: `MCP callTool failed: ${(e as Error).message}` };
              }
            },
          });
        }
      } catch (e) {
        console.warn(
          `[mcp] failed to list tools from server "${serverId}": ${(e as Error).message}`,
        );
      }
    }
    return out;
  }

  async closeAll(): Promise<void> {
    for (const { client } of this.servers) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
    }
    this.servers = [];
  }
}
