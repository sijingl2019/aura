import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from '@shared/types';
import type { LLMProvider, ProviderEvent, StreamParams } from './types';

type MessageParam = Anthropic.Messages.MessageParam;
type ContentBlockParam =
  | Anthropic.Messages.TextBlockParam
  | Anthropic.Messages.ToolUseBlockParam
  | Anthropic.Messages.ToolResultBlockParam
  | Anthropic.Messages.ImageBlockParam;

function toAnthropicMessages(messages: ChatMessage[]): MessageParam[] {
  const out: MessageParam[] = [];
  let pendingToolResults: ContentBlockParam[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length > 0) {
      out.push({ role: 'user', content: pendingToolResults });
      pendingToolResults = [];
    }
  };

  for (const m of messages) {
    if (m.role === 'system') continue;

    if (m.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: m.toolCallId ?? '',
        content: m.content,
      });
      continue;
    }

    flushToolResults();

    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const blocks: ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          let input: unknown = {};
          try {
            input = tc.arguments ? JSON.parse(tc.arguments) : {};
          } catch {
            input = {};
          }
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: input as Record<string, unknown>,
          });
        }
      }
      if (blocks.length === 0) blocks.push({ type: 'text', text: '' });
      out.push({ role: 'assistant', content: blocks });
    }
  }

  flushToolResults();
  return out;
}

export interface AnthropicProviderOptions {
  id: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export function createAnthropicProvider(opts: AnthropicProviderOptions): LLMProvider {
  const client = new Anthropic({
    baseURL: opts.baseURL,
    apiKey: opts.apiKey,
  });

  return {
    id: opts.id,
    model: opts.model,

    async *stream(params: StreamParams): AsyncGenerator<ProviderEvent> {
      const { messages, tools, system, signal } = params;

      const anthropicTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
      }));

      const stream = client.messages.stream(
        {
          model: opts.model,
          messages: toAnthropicMessages(messages),
          system: system && system.trim() ? system : undefined,
          tools: anthropicTools.length > 0 ? anthropicTools : undefined,
          max_tokens: 8192,
        },
        { signal },
      );

      const blockToToolId = new Map<number, string>();
      let inputTokens = 0;
      let outputTokens = 0;
      let finishReason: ProviderEvent & { type: 'round_end' } = {
        type: 'round_end',
        reason: 'unknown',
      };

      for await (const event of stream) {
        if (event.type === 'message_start') {
          inputTokens = event.message.usage?.input_tokens ?? 0;
          outputTokens = event.message.usage?.output_tokens ?? 0;
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            blockToToolId.set(event.index, event.content_block.id);
            yield {
              type: 'tool_call_start',
              id: event.content_block.id,
              name: event.content_block.name,
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', delta: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            const toolId = blockToToolId.get(event.index);
            if (toolId) {
              yield {
                type: 'tool_call_args_delta',
                id: toolId,
                delta: event.delta.partial_json,
              };
            }
          }
        } else if (event.type === 'content_block_stop') {
          const toolId = blockToToolId.get(event.index);
          if (toolId) yield { type: 'tool_call_end', id: toolId };
        } else if (event.type === 'message_delta') {
          const reason = event.delta.stop_reason;
          finishReason = {
            type: 'round_end',
            reason:
              reason === 'end_turn'
                ? 'stop'
                : reason === 'tool_use'
                  ? 'tool_calls'
                  : reason === 'max_tokens'
                    ? 'length'
                    : 'unknown',
          };
          if (event.usage?.output_tokens != null) outputTokens = event.usage.output_tokens;
        }
      }

      yield { type: 'usage', input: inputTokens, output: outputTokens };
      yield finishReason;
    },
  };
}
