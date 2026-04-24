import OpenAI from 'openai';
import type { ChatMessage } from '@shared/types';
import type { LLMProvider, ProviderEvent, StreamParams } from './types';

type OpenAIChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function toOpenAIMessages(messages: ChatMessage[], system?: string): OpenAIChatMessage[] {
  const out: OpenAIChatMessage[] = [];
  if (system && system.trim()) out.push({ role: 'system', content: system });

  for (const m of messages) {
    if (m.role === 'system') {
      out.push({ role: 'system', content: m.content });
    } else if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const msg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: m.content || null,
      };
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments || '{}' },
        }));
      }
      out.push(msg);
    } else if (m.role === 'tool') {
      out.push({
        role: 'tool',
        tool_call_id: m.toolCallId ?? '',
        content: m.content,
      });
    }
  }
  return out;
}

export interface OpenAIProviderOptions {
  id: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export function createOpenAIProvider(opts: OpenAIProviderOptions): LLMProvider {
  const client = new OpenAI({
    baseURL: opts.baseURL,
    apiKey: opts.apiKey,
  });

  return {
    id: opts.id,
    model: opts.model,

    async *stream(params: StreamParams): AsyncGenerator<ProviderEvent> {
      const { messages, tools, system, signal } = params;

      const tool_defs: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const stream = await client.chat.completions.create(
        {
          model: opts.model,
          messages: toOpenAIMessages(messages, system),
          tools: tool_defs.length > 0 ? tool_defs : undefined,
          tool_choice: tool_defs.length > 0 ? 'auto' : undefined,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      );

      const active = new Map<number, { id: string; name: string; started: boolean }>();
      let finishReason: ProviderEvent & { type: 'round_end' } = { type: 'round_end', reason: 'unknown' };

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (choice) {
          const delta = choice.delta;
          if (delta?.content) {
            yield { type: 'text_delta', delta: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              let state = active.get(idx);
              if (!state) {
                state = { id: tc.id ?? '', name: tc.function?.name ?? '', started: false };
                active.set(idx, state);
              } else {
                if (tc.id && !state.id) state.id = tc.id;
                if (tc.function?.name && !state.name) state.name = tc.function.name;
              }
              if (!state.started && state.id && state.name) {
                state.started = true;
                yield { type: 'tool_call_start', id: state.id, name: state.name };
              }
              if (state.started && tc.function?.arguments) {
                yield { type: 'tool_call_args_delta', id: state.id, delta: tc.function.arguments };
              }
            }
          }
          if (choice.finish_reason) {
            for (const [, state] of active) {
              if (state.started) yield { type: 'tool_call_end', id: state.id };
            }
            const reason = choice.finish_reason;
            finishReason = {
              type: 'round_end',
              reason:
                reason === 'stop' || reason === 'tool_calls' || reason === 'length'
                  ? reason
                  : 'unknown',
            };
          }
        }
        if (chunk.usage) {
          yield {
            type: 'usage',
            input: chunk.usage.prompt_tokens ?? 0,
            output: chunk.usage.completion_tokens ?? 0,
          };
        }
      }

      yield finishReason;
    },
  };
}
