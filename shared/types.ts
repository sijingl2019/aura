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
  thinking?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  createdAt: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  skillName?: string;
  // Error messages are shown as assistant bubbles but excluded from LLM context.
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  model?: string;
  provider?: string;
  createdAt: number;
  updatedAt: number;
  // Origin of the conversation. Undefined / 'app' = created in the desktop UI.
  // A gateway platform id ('lark' | 'dingtalk' | ...) marks an external chat
  // bridged in through the multi-platform gateway, shown in its own sidebar group.
  source?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  dir: string;
  icon?: string;
  isBuiltin?: boolean;
}

export type StreamEvent =
  | { type: 'text'; streamId: string; delta: string }
  | { type: 'thinking'; streamId: string; delta: string }
  | { type: 'tool_call_start'; streamId: string; id: string; name: string }
  | { type: 'tool_call_args'; streamId: string; id: string; delta: string }
  | { type: 'tool_call_end'; streamId: string; id: string }
  | { type: 'tool_result'; streamId: string; id: string; ok: boolean; preview: string }
  // Steering: a user interjection injected mid-run. Emitted when the running
  // agent actually consumes the message (after the current step), so the
  // renderer can flush the in-flight assistant bubble before showing it.
  | { type: 'steering'; streamId: string; text: string }
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

export interface ConversationSearchResult {
  conversationId: string;
  conversationTitle: string;
  updatedAt: number;
  snippet?: string;
}

export interface ShortcutDef {
  id: string;
  label: string;
  keys: string; // Electron accelerator format, e.g. 'CmdOrCtrl+N'
  global: boolean;
}

export interface ShortcutsSettings {
  overrides: Record<string, string>; // id → keys
}

export interface QuickQuestionEvent {
  type: 'text' | 'done' | 'error';
  streamId: string;
  delta?: string;
  message?: string;
}

export interface DbAPI {
  listConversations: () => Promise<Conversation[]>;
  getOrCreateSystemConversation: () => Promise<Conversation>;
  createConversation: (params: { title?: string }) => Promise<Conversation>;
  deleteConversation: (params: { id: string }) => Promise<void>;
  renameConversation: (params: { id: string; title: string }) => Promise<void>;
  updateConversationModel: (params: {
    id: string;
    providerId: string;
    modelId: string;
  }) => Promise<void>;
  listMessages: (params: { conversationId: string }) => Promise<ChatMessage[]>;
  searchConversations: (params: { query: string }) => Promise<ConversationSearchResult[]>;
}

export interface LlmStreamParams {
  conversationId: string;
  userText: string;
  skillId?: string;
  skillName?: string;
}

export interface LlmSteerParams {
  streamId: string;
  text: string;
}

export interface ToolInfo {
  name: string;
  description: string;
}

export interface MemoryReadResult {
  facts: string;
  profile: string;
}

export interface MemoryAPI {
  read: () => Promise<MemoryReadResult>;
}

export interface LlmAPI {
  stream: (params: LlmStreamParams) => Promise<{ streamId: string }>;
  abort: (params: { streamId: string }) => Promise<void>;
  steer: (params: LlmSteerParams) => Promise<void>;
  onEvent: (cb: (event: StreamEvent) => void) => () => void;
  listTools: () => Promise<ToolInfo[]>;
}

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
  isBuiltin?: boolean;
}

export interface SkillsAPI {
  list: () => Promise<SkillListItem[]>;
  get: (params: { id: string }) => Promise<Skill | null>;
  create: (params: { name: string; description: string; body: string; id?: string }) => Promise<Skill>;
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
  // Enable Anthropic cache_control prompt caching. `undefined` = auto
  // (on for the native api.anthropic.com endpoint, off elsewhere).
  promptCaching?: boolean;
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

export type AppLanguage = 'zh-CN' | 'en' | 'zh-TW';
export type ProxyMode = 'system' | 'none' | 'manual';
export type AppTheme = 'light' | 'dark' | 'system';

export interface GeneralConfig {
  language: AppLanguage;
  proxyMode: ProxyMode;
  proxyHost?: string;
  proxyPort?: number;
  spellCheck: boolean;
  launchAtStartup: boolean;
  minimizeToTrayOnStartup: boolean;
  // Display
  theme: AppTheme;
  accentColor: string;
  transparentWindow: boolean;
  // Tray
  showTrayIcon: boolean;
  minimizeToTrayOnClose: boolean;
  // Avatar
  userAvatar?: string; // data URL (image) or single emoji/char
  // Agent
  enableThinking?: boolean; // request extended thinking / reasoning from models that support it
}

export type McpTransportType = 'builtin' | 'stdio' | 'sse';

export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  builtin?: boolean;
  type: McpTransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface McpMarketItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  homepage?: string;
}

export interface FallbackChainEntry {
  providerId: string;
  modelId: string;
}

export type WebSearchProvider = 'tavily' | 'serper';

export interface WebSearchConfig {
  enabled: boolean;
  provider: WebSearchProvider;
  apiKey: string;
}

// ── Multi-platform gateway ──────────────────────────────────────────────────
// Bridges external IM platforms (飞书/Lark, 钉钉/DingTalk, …) to the agent.
// Both supported platforms use an outbound long-lived WebSocket connection, so
// no public callback URL is required (desktop-friendly).
export type GatewayPlatform = 'lark' | 'dingtalk';

export interface GatewayConfig {
  id: string;
  platform: GatewayPlatform;
  name: string;
  enabled: boolean;
  // Credentials. Both platforms authenticate with an app key + secret pair:
  //   飞书:  appId = App ID,     appSecret = App Secret
  //   钉钉:  appId = ClientId(AppKey), appSecret = ClientSecret(AppSecret)
  appId: string;
  appSecret: string;
  // Authorization: only these external user ids may trigger the agent.
  // Empty array = deny everyone (safe default — a misconfigured bot does nothing).
  allowedUserIds: string[];
  // Per-gateway model override; falls back to the global defaultModel when unset.
  defaultModel?: DefaultModelRef;
  // When false (default), exec_shell / write_file are stripped from gateway
  // runs so a remote IM user cannot drive the local shell or filesystem.
  allowDangerousTools?: boolean;
}

export type GatewayStatus = 'stopped' | 'connecting' | 'connected' | 'error';

export interface GatewayRuntimeStatus {
  id: string;
  status: GatewayStatus;
  detail?: string;
}

export interface GatewayListItem {
  config: GatewayConfig;
  status: GatewayRuntimeStatus;
}

export interface GatewayAPI {
  list: () => Promise<GatewayListItem[]>;
  upsert: (config: GatewayConfig) => Promise<AppSettings>;
  delete: (params: { id: string }) => Promise<AppSettings>;
  start: (params: { id: string }) => Promise<void>;
  stop: (params: { id: string }) => Promise<void>;
  onStatus: (cb: (status: GatewayRuntimeStatus) => void) => () => void;
}

export interface AppSettings {
  providers: ProviderConfig[];
  defaultModel?: DefaultModelRef;
  fallbackChain?: FallbackChainEntry[];
  difyKnowledge?: DifyKnowledgeConfig;
  selectionToolbar?: SelectionToolbarConfig;
  shortcutsOverrides?: Record<string, string>;
  mcpServers?: McpServerConfig[];
  general?: GeneralConfig;
  webSearch?: WebSearchConfig;
  gateways?: GatewayConfig[];
}

export type ProviderConfigInput = Omit<ProviderConfig, 'builtin' | 'order'> &
  Partial<Pick<ProviderConfig, 'builtin' | 'order'>>;

export interface SettingsAPI {
  get: () => Promise<AppSettings>;
  upsertProvider: (provider: ProviderConfigInput) => Promise<AppSettings>;
  deleteProvider: (params: { id: string }) => Promise<AppSettings>;
  setDefaultModel: (params: DefaultModelRef | null) => Promise<AppSettings>;
  reorderProviders: (params: { ids: string[] }) => Promise<AppSettings>;
  setFallbackChain: (params: { chain: FallbackChainEntry[] }) => Promise<AppSettings>;
  setDifyKnowledge: (params: DifyKnowledgeConfig | null) => Promise<AppSettings>;
  listDifyKnowledges: () => Promise<DifyKnowledge[]>;
  setSelectionToolbar: (params: SelectionToolbarConfig) => Promise<AppSettings>;
  upsertMcpServer: (server: McpServerConfig) => Promise<AppSettings>;
  deleteMcpServer: (params: { id: string }) => Promise<AppSettings>;
  getGeneral: () => Promise<GeneralConfig>;
  setGeneral: (config: GeneralConfig) => Promise<AppSettings>;
  detectProvider: (params: { kind: ProviderKind; apiKey: string; baseURL: string }) => Promise<{ success: boolean; message: string }>;
  setWebSearch: (params: WebSearchConfig | null) => Promise<AppSettings>;
}

export interface WorkspaceFile {
  name: string;
  path: string; // relative to cwd
  isDir: boolean;
}

export interface WorkspaceAPI {
  getCwd: () => Promise<string>;
  setCwd: (cwd: string) => Promise<string>;
  openFolderDialog: () => Promise<string | null>;
  listFiles: (params: { dir?: string; query?: string }) => Promise<WorkspaceFile[]>;
  onCwdChanged: (cb: (cwd: string) => void) => () => void;
}

export interface ShortcutsAPI {
  get: () => Promise<ShortcutDef[]>;
  set: (params: { id: string; keys: string }) => Promise<ShortcutDef[]>;
  reset: (params: { id: string }) => Promise<ShortcutDef[]>;
}

export interface AppLaunchEntry {
  name: string;
  path: string;
}

export interface QuickQuestionAPI {
  close: () => Promise<void>;
  expand: () => Promise<void>;
  resize: (height: number) => Promise<void>;
  openAttachMenu: () => Promise<string[]>;
  searchApps: (query: string) => Promise<AppLaunchEntry[]>;
  launchApp: (appPath: string) => Promise<void>;
  onReset: (cb: () => void) => () => void;
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  window: WindowAPI;
  db: DbAPI;
  llm: LlmAPI;
  memory: MemoryAPI;
  skills: SkillsAPI;
  settings: SettingsAPI;
  popup: PopupAPI;
  toolbar: ToolbarAPI;
  quickQuestion: QuickQuestionAPI;
  shortcuts: ShortcutsAPI;
  workspace: WorkspaceAPI;
  gateway: GatewayAPI;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
