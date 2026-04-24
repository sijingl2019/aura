import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';

export interface DifyKnowledgeConfig {
  apiKey: string;
  apiHost: string;
}

interface DifyDataset {
  id: string;
  name: string;
  description: string;
}

interface DifySearchResponse {
  query: { content: string };
  records: Array<{
    segment: {
      id: string;
      position: number;
      document_id: string;
      content: string;
      keywords: string[];
      document?: { id: string; data_source_type: string; name: string };
    };
    score: number;
  }>;
}

type McpResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

async function performListKnowledges(config: DifyKnowledgeConfig): Promise<McpResponse> {
  try {
    const url = `${config.apiHost.replace(/\/$/, '')}/datasets`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText}`);
    }
    const apiResponse = (await response.json()) as { data?: Array<Record<string, unknown>> };
    const knowledges: DifyDataset[] =
      apiResponse?.data?.map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        description: String(item.description ?? ''),
      })) ?? [];

    const listText =
      knowledges.length > 0
        ? knowledges
            .map((k) => `- **${k.name}** (ID: ${k.id})\n  ${k.description || 'No Description'}`)
            .join('\n')
        : '- No knowledges found.';
    return {
      content: [{ type: 'text', text: `### Available Knowledge Bases:\n\n${listText}` }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[dify-knowledge] list failed:', message);
    return {
      content: [{ type: 'text', text: `Accessing Knowledge Error: ${message}` }],
      isError: true,
    };
  }
}

async function performSearchKnowledge(
  config: DifyKnowledgeConfig,
  id: string,
  query: string,
  topK: number,
): Promise<McpResponse> {
  try {
    const url = `${config.apiHost.replace(/\/$/, '')}/datasets/${id}/retrieve`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        retrieval_model: {
          top_k: topK,
          search_method: 'semantic_search',
          reranking_enable: false,
          score_threshold_enabled: false,
        },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText}`);
    }

    const searchResponse = (await response.json()) as DifySearchResponse;
    if (!searchResponse || !Array.isArray(searchResponse.records)) {
      throw new Error(`Invalid response format: ${JSON.stringify(searchResponse)}`);
    }

    const header = `### Query: ${query}\n\n`;
    let body: string;

    if (searchResponse.records.length === 0) {
      body = 'No results found.';
    } else {
      const resultsText = searchResponse.records
        .map((record, index) => {
          const docName = record.segment.document?.name ?? 'Unknown Document';
          const content = record.segment.content.trim();
          const score = record.score;
          const keywords = record.segment.keywords ?? [];
          let entry = `#### ${index + 1}. ${docName} (Relevant Score: ${(score * 100).toFixed(1)}%)`;
          entry += `\n${content}`;
          if (keywords.length > 0) entry += `\n*Keywords: ${keywords.join(', ')}*`;
          return entry;
        })
        .join('\n\n');
      body = `Found ${searchResponse.records.length} results:\n\n${resultsText}`;
    }

    return { content: [{ type: 'text', text: header + body }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[dify-knowledge] search failed:', message);
    return {
      content: [{ type: 'text', text: `Search Knowledge Error: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Start an in-process Dify Knowledge MCP server and return its client-side transport.
 * Inspired by https://dify.ai/blog/turn-your-dify-app-into-an-mcp-server
 */
export async function startDifyKnowledgeMcpServer(
  config: DifyKnowledgeConfig,
): Promise<{ clientTransport: Transport }> {
  if (!config.apiKey) throw new Error('dify-knowledge: apiKey is required');
  if (!config.apiHost) throw new Error('dify-knowledge: apiHost is required');

  const server = new McpServer({
    name: 'qiko-aura-dify-knowledge',
    version: '0.1.0',
  });

  server.registerTool(
    'list_knowledges',
    {
      description: 'List all Dify knowledge bases available to this API key.',
    },
    async () => performListKnowledges(config),
  );

  server.registerTool(
    'search_knowledge',
    {
      description: 'Search a Dify knowledge base by id with a semantic query.',
      inputSchema: {
        id: z.string().describe('Knowledge ID'),
        query: z.string().describe('Query string'),
        topK: z.number().optional().describe('Number of top results to return (default 6).'),
      },
    },
    async (args) => performSearchKnowledge(config, args.id, args.query, args.topK ?? 6),
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  return { clientTransport };
}
