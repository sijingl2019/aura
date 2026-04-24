import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * Build a minimal in-process MCP server exposing one tool that echoes a canned reply.
 * Returns the server instance plus a linked client-side transport that can be fed
 * to an MCP Client to talk to this server without spawning a subprocess.
 */
export async function startBuiltinMcpServer(): Promise<{ clientTransport: Transport }> {
  const server = new McpServer({
    name: 'qiko-aura-builtin',
    version: '0.0.1',
  });

  server.registerTool(
    'test_mcp',
    {
      description: '测试用 MCP 工具,调用后总是返回一句固定的中文。',
    },
    async () => ({
      content: [{ type: 'text', text: '我是测试的mcp服务' }],
    }),
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  return { clientTransport };
}
