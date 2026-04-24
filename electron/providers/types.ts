import type { ChatMessage } from '@shared/types';

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ProviderEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_args_delta'; id: string; delta: string }
  | { type: 'tool_call_end'; id: string }
  | { type: 'round_end'; reason: 'stop' | 'tool_calls' | 'length' | 'unknown' }
  | { type: 'usage'; input: number; output: number };

export interface StreamParams {
  messages: ChatMessage[];
  tools: ToolSchema[];
  system?: string;
  signal: AbortSignal;
}

export interface LLMProvider {
  id: string;
  model: string;
  stream(params: StreamParams): AsyncGenerator<ProviderEvent>;
}
