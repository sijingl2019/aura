import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  DefaultModelRef,
  LlmStreamParams,
  ProviderConfigInput,
  Skill,
  SkillListItem,
  StreamEvent,
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
  },
};

contextBridge.exposeInMainWorld('api', api);
