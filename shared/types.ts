export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  createdAt: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  skillName?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model?: string;
  provider?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  dir: string;
}

export type StreamEvent =
  | { type: 'text'; streamId: string; delta: string }
  | { type: 'tool_call_start'; streamId: string; id: string; name: string }
  | { type: 'tool_call_args'; streamId: string; id: string; delta: string }
  | { type: 'tool_call_end'; streamId: string; id: string }
  | { type: 'tool_result'; streamId: string; id: string; ok: boolean; preview: string }
  | { type: 'done'; streamId: string; usage?: { input: number; output: number } }
  | { type: 'error'; streamId: string; message: string };

export interface WindowAPI {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
}

export interface DbAPI {
  listConversations: () => Promise<Conversation[]>;
  createConversation: (params: { title?: string }) => Promise<Conversation>;
  deleteConversation: (params: { id: string }) => Promise<void>;
  renameConversation: (params: { id: string; title: string }) => Promise<void>;
  updateConversationModel: (params: {
    id: string;
    providerId: string;
    modelId: string;
  }) => Promise<void>;
  listMessages: (params: { conversationId: string }) => Promise<ChatMessage[]>;
}

export interface LlmStreamParams {
  conversationId: string;
  userText: string;
  skillId?: string;
  skillName?: string;
}

export interface LlmAPI {
  stream: (params: LlmStreamParams) => Promise<{ streamId: string }>;
  abort: (params: { streamId: string }) => Promise<void>;
  onEvent: (cb: (event: StreamEvent) => void) => () => void;
}

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
}

export interface SkillsAPI {
  list: () => Promise<SkillListItem[]>;
  get: (params: { id: string }) => Promise<Skill | null>;
  create: (params: { name: string; description: string; body: string }) => Promise<Skill>;
  update: (params: { id: string; name: string; description: string; body: string }) => Promise<Skill>;
  delete: (params: { id: string }) => Promise<void>;
  onUpdated: (cb: () => void) => () => void;
}

export type ProviderKind = 'openai' | 'anthropic';

export interface ProviderModel {
  id: string;
  name?: string;
  group?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  kind: ProviderKind;
  enabled: boolean;
  builtin: boolean;
  apiKey: string;
  baseURL: string;
  icon?: string;
  iconBg?: string;
  models: ProviderModel[];
  order: number;
}

export interface DefaultModelRef {
  providerId: string;
  modelId: string;
}

export interface DifyKnowledgeConfig {
  apiKey: string;
  apiHost: string;
  enabled: boolean;
}

export interface DifyKnowledge {
  id: string;
  name: string;
  description: string;
}

export type SelectionActionId = 'translate' | 'explain' | 'summarize' | 'search' | 'copy';

export interface SelectionAction {
  id: SelectionActionId;
  label: string;
  enabled: boolean;
  order: number;
}

export type SearchEngine = 'google' | 'baidu' | 'bing';

export interface SelectionToolbarConfig {
  enabled: boolean;
  compact: boolean;
  opacity: number;
  actions: SelectionAction[];
  searchEngine: SearchEngine;
}

export interface ToolbarParams {
  text: string;
  compact: boolean;
  opacity: number;
  actions: SelectionAction[];
}

export interface PopupParams {
  action: string;
  text: string;
  streamId: string;
}

export interface PopupStreamEvent {
  type: 'text' | 'done' | 'error';
  streamId: string;
  delta?: string;
  message?: string;
}

export interface PopupAPI {
  open: (params: { action: string; text: string; screenX: number; screenY: number }) => Promise<void>;
  getParams: () => Promise<PopupParams | null>;
  query: (params: PopupParams) => Promise<void>;
  abort: (params: { streamId: string }) => Promise<void>;
  onEvent: (cb: (event: PopupStreamEvent) => void) => () => void;
  close: () => Promise<void>;
  setPin: (pinned: boolean) => Promise<void>;
  minimize: () => Promise<void>;
}

export interface ToolbarAPI {
  getParams: () => Promise<ToolbarParams | null>;
  onUpdate: (cb: (data: { text: string }) => void) => () => void;
  performAction: (params: { actionId: SelectionActionId; text: string }) => Promise<void>;
  resize: (params: { width: number; height: number }) => Promise<void>;
  close: () => Promise<void>;
}

export interface AppSettings {
  providers: ProviderConfig[];
  defaultModel?: DefaultModelRef;
  difyKnowledge?: DifyKnowledgeConfig;
  selectionToolbar?: SelectionToolbarConfig;
}

export type ProviderConfigInput = Omit<ProviderConfig, 'builtin' | 'order'> &
  Partial<Pick<ProviderConfig, 'builtin' | 'order'>>;

export interface SettingsAPI {
  get: () => Promise<AppSettings>;
  upsertProvider: (provider: ProviderConfigInput) => Promise<AppSettings>;
  deleteProvider: (params: { id: string }) => Promise<AppSettings>;
  setDefaultModel: (params: DefaultModelRef | null) => Promise<AppSettings>;
  reorderProviders: (params: { ids: string[] }) => Promise<AppSettings>;
  setDifyKnowledge: (params: DifyKnowledgeConfig | null) => Promise<AppSettings>;
  listDifyKnowledges: () => Promise<DifyKnowledge[]>;
  setSelectionToolbar: (params: SelectionToolbarConfig) => Promise<AppSettings>;
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  window: WindowAPI;
  db: DbAPI;
  llm: LlmAPI;
  skills: SkillsAPI;
  settings: SettingsAPI;
  popup: PopupAPI;
  toolbar: ToolbarAPI;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
