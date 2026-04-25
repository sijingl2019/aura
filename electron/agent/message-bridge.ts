import type { ChatMessage } from '@shared/types';

/**
 * Convert SQLite ChatMessage[] to pi-ai AgentMessage[] for the Agent's initial state.
 *
 * Rules:
 * - role:'system'    → skip (handled via AgentState.systemPrompt)
 * - role:'user'      → UserMessage
 * - role:'assistant' → AssistantMessage with text + toolCall content blocks
 * - role:'tool'      → consecutive tool rows after an assistant are grouped into one
 *                      ToolResultMessage (pi-ai merges all results from one turn)
 */
export function chatMessagesToAgent(messages: ChatMessage[]): any[] {
  const out: any[] = [];
  let pendingToolResults: any[] = [];

  const flushToolResults = (timestamp: number) => {
    if (pendingToolResults.length === 0) return;
    out.push({
      role: 'toolResult',
      content: pendingToolResults,
      timestamp,
    });
    pendingToolResults = [];
  };

  for (const m of messages) {
    if (m.role === 'system') continue;

    if (m.role === 'tool') {
      pendingToolResults.push({
        type: 'toolResult',
        toolCallId: m.toolCallId ?? '',
        content: [{ type: 'text', text: m.content }],
        isError: false,
      });
      continue;
    }

    // Flush pending tool results before any non-tool message
    flushToolResults(m.createdAt);

    if (m.role === 'user') {
      out.push({
        role: 'user',
        content: m.content,
        timestamp: m.createdAt,
      });
    } else if (m.role === 'assistant') {
      const content: any[] = [];
      if (m.content) {
        content.push({ type: 'text', text: m.content });
      }
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = tc.arguments ? JSON.parse(tc.arguments) : {};
          } catch {
            args = {};
          }
          content.push({ type: 'toolCall', id: tc.id, name: tc.name, arguments: args });
        }
      }
      if (content.length === 0) {
        content.push({ type: 'text', text: '' });
      }
      out.push({
        role: 'assistant',
        content,
        stopReason: m.toolCalls?.length ? 'toolUse' : 'stop',
        usage: {
          input: m.inputTokens ?? 0,
          output: m.outputTokens ?? 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: (m.inputTokens ?? 0) + (m.outputTokens ?? 0),
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        timestamp: m.createdAt,
      });
    }
  }

  // Flush any trailing tool results
  flushToolResults(Date.now());

  return out;
}
