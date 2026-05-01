import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  DefaultModelRef,
  DifyKnowledge,
  DifyKnowledgeConfig,
  LlmStreamParams,
  PopupParams,
  PopupStreamEvent,
  ProviderConfigInput,
  SelectionActionId,
  SelectionToolbarConfig,
  Skill,
  SkillListItem,
  StreamEvent,
  ToolbarParams,
} from '@shared/types';

const api = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<string>,
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<void>,
    close: () => ipcRenderer.invoke('window:close') as Promise<void>,
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    onMaximizedChange: (cb: (maximized: boolean) => void) => {
      const listener = (_: unknown, value: boolean) => cb(value);
      ipcRenderer.on('window:maximized-change', listener);
      return () => ipcRenderer.off('window:maximized-change', listener);
    },
    openExternal: (url: string) =>
      ipcRenderer.invoke('window:openExternal', url) as Promise<void>,
  },
  db: {
    listConversations: () =>
      ipcRenderer.invoke('db:listConversations') as Promise<Conversation[]>,
    createConversation: (params: { title?: string } = {}) =>
      ipcRenderer.invoke('db:createConversation', params) as Promise<Conversation>,
    deleteConversation: (params: { id: string }) =>
      ipcRenderer.invoke('db:deleteConversation', params) as Promise<void>,
    renameConversation: (params: { id: string; title: string }) =>
      ipcRenderer.invoke('db:renameConversation', params) as Promise<void>,
    updateConversationModel: (params: { id: string; providerId: string; modelId: string }) =>
      ipcRenderer.invoke('db:updateConversationModel', params) as Promise<void>,
    listMessages: (params: { conversationId: string }) =>
      ipcRenderer.invoke('db:listMessages', params) as Promise<ChatMessage[]>,
  },
  llm: {
    stream: (params: LlmStreamParams) =>
      ipcRenderer.invoke('llm:stream', params) as Promise<{ streamId: string }>,
    abort: (params: { streamId: string }) =>
      ipcRenderer.invoke('llm:abort', params) as Promise<void>,
    onEvent: (cb: (event: StreamEvent) => void) => {
      const listener = (_: unknown, event: StreamEvent) => cb(event);
      ipcRenderer.on('llm:event', listener);
      return () => ipcRenderer.off('llm:event', listener);
    },
  },
  skills: {
    list: () => ipcRenderer.invoke('skills:list') as Promise<SkillListItem[]>,
    get: (params: { id: string }) =>
      ipcRenderer.invoke('skills:get', params) as Promise<Skill | null>,
    create: (params: { name: string; description: string; body: string }) =>
      ipcRenderer.invoke('skills:create', params) as Promise<Skill>,
    update: (params: { id: string; name: string; description: string; body: string }) =>
      ipcRenderer.invoke('skills:update', params) as Promise<Skill>,
    delete: (params: { id: string }) =>
      ipcRenderer.invoke('skills:delete', params) as Promise<void>,
    onUpdated: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('skills:updated', listener);
      return () => ipcRenderer.off('skills:updated', listener);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
    upsertProvider: (provider: ProviderConfigInput) =>
      ipcRenderer.invoke('settings:upsertProvider', provider) as Promise<AppSettings>,
    deleteProvider: (params: { id: string }) =>
      ipcRenderer.invoke('settings:deleteProvider', params) as Promise<AppSettings>,
    setDefaultModel: (params: DefaultModelRef | null) =>
      ipcRenderer.invoke('settings:setDefaultModel', params) as Promise<AppSettings>,
    reorderProviders: (params: { ids: string[] }) =>
      ipcRenderer.invoke('settings:reorderProviders', params) as Promise<AppSettings>,
    setDifyKnowledge: (params: DifyKnowledgeConfig | null) =>
      ipcRenderer.invoke('settings:setDifyKnowledge', params) as Promise<AppSettings>,
    listDifyKnowledges: () =>
      ipcRenderer.invoke('settings:listDifyKnowledges') as Promise<DifyKnowledge[]>,
    setSelectionToolbar: (params: SelectionToolbarConfig) =>
      ipcRenderer.invoke('settings:setSelectionToolbar', params) as Promise<AppSettings>,
  },
  popup: {
    open: (params: { action: string; text: string; screenX: number; screenY: number }) =>
      ipcRenderer.invoke('popup:open', params) as Promise<void>,
    getParams: () => ipcRenderer.invoke('popup:getParams') as Promise<PopupParams | null>,
    query: (params: PopupParams) => ipcRenderer.invoke('popup:query', params) as Promise<void>,
    abort: (params: { streamId: string }) => ipcRenderer.invoke('popup:abort', params) as Promise<void>,
    onEvent: (cb: (event: PopupStreamEvent) => void) => {
      const listener = (_: unknown, event: PopupStreamEvent) => cb(event);
      ipcRenderer.on('popup:event', listener);
      return () => ipcRenderer.off('popup:event', listener);
    },
    close: () => ipcRenderer.invoke('popup:close') as Promise<void>,
    setPin: (pinned: boolean) => ipcRenderer.invoke('popup:setPin', pinned) as Promise<void>,
    minimize: () => ipcRenderer.invoke('popup:minimize') as Promise<void>,
  },
  toolbar: {
    getParams: () => ipcRenderer.invoke('toolbar:getParams') as Promise<ToolbarParams | null>,
    onUpdate: (cb: (data: { text: string }) => void) => {
      const listener = (_: unknown, data: { text: string }) => cb(data);
      ipcRenderer.on('toolbar:onUpdate', listener);
      return () => ipcRenderer.off('toolbar:onUpdate', listener);
    },
    performAction: (params: { actionId: SelectionActionId; text: string }) =>
      ipcRenderer.invoke('toolbar:performAction', params) as Promise<void>,
    resize: (params: { width: number; height: number }) =>
      ipcRenderer.invoke('toolbar:resize', params) as Promise<void>,
    close: () => ipcRenderer.invoke('toolbar:close') as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('api', api);
