export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface Conversation {
  id: string;
  title: string;
  model?: string;
  provider?: ProviderId;
  createdAt: number;
  updatedAt: number;
}

export type ProviderId = 'anthropic' | 'openai' | 'ollama';

export interface ModelInfo {
  id: string;
  label: string;
  provider: ProviderId;
}

export interface AppSettings {
  activeProvider: ProviderId;
  activeModel: string;
  anthropicKey?: string;
  openaiKey?: string;
  ollamaBaseUrl?: string;
}

export interface WindowAPI {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  window: WindowAPI;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
