import { create } from 'zustand';
import type {
  AppSettings,
  DefaultModelRef,
  DifyKnowledgeConfig,
  McpServerConfig,
  ProviderConfig,
  ProviderConfigInput,
  SelectionToolbarConfig,
} from '@shared/types';

interface SettingsState {
  loaded: boolean;
  providers: ProviderConfig[];
  defaultModel?: DefaultModelRef;
  difyKnowledge?: DifyKnowledgeConfig;
  selectionToolbar?: SelectionToolbarConfig;
  mcpServers: McpServerConfig[];

  load: () => Promise<void>;
  upsertProvider: (provider: ProviderConfigInput) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setDefaultModel: (ref: DefaultModelRef | null) => Promise<void>;
  reorderProviders: (ids: string[]) => Promise<void>;
  setDifyKnowledge: (config: DifyKnowledgeConfig | null) => Promise<void>;
  setSelectionToolbar: (config: SelectionToolbarConfig) => Promise<void>;
  upsertMcpServer: (server: McpServerConfig) => Promise<void>;
  deleteMcpServer: (id: string) => Promise<void>;
}

function apply(set: (partial: Partial<SettingsState>) => void, next: AppSettings) {
  set({
    loaded: true,
    providers: [...next.providers].sort((a, b) => a.order - b.order),
    defaultModel: next.defaultModel,
    difyKnowledge: next.difyKnowledge,
    selectionToolbar: next.selectionToolbar,
    mcpServers: next.mcpServers ?? [],
  });
}

export const useSettingsStore = create<SettingsState>((set) => ({
  loaded: false,
  providers: [],
  defaultModel: undefined,
  difyKnowledge: undefined,
  selectionToolbar: undefined,
  mcpServers: [],

  load: async () => {
    const data = await window.api.settings.get();
    apply(set, data);
  },

  upsertProvider: async (provider) => {
    const data = await window.api.settings.upsertProvider(provider);
    apply(set, data);
  },

  deleteProvider: async (id) => {
    const data = await window.api.settings.deleteProvider({ id });
    apply(set, data);
  },

  setDefaultModel: async (ref) => {
    const data = await window.api.settings.setDefaultModel(ref);
    apply(set, data);
  },

  reorderProviders: async (ids) => {
    const data = await window.api.settings.reorderProviders({ ids });
    apply(set, data);
  },

  setDifyKnowledge: async (config) => {
    const data = await window.api.settings.setDifyKnowledge(config);
    apply(set, data);
  },

  setSelectionToolbar: async (config) => {
    const data = await window.api.settings.setSelectionToolbar(config);
    apply(set, data);
  },

  upsertMcpServer: async (server) => {
    const data = await window.api.settings.upsertMcpServer(server);
    apply(set, data);
  },

  deleteMcpServer: async (id) => {
    const data = await window.api.settings.deleteMcpServer({ id });
    apply(set, data);
  },
}));
