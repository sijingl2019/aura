import { create } from 'zustand';
import type {
  AppSettings,
  DefaultModelRef,
  ProviderConfig,
  ProviderConfigInput,
} from '@shared/types';

interface SettingsState {
  loaded: boolean;
  providers: ProviderConfig[];
  defaultModel?: DefaultModelRef;

  load: () => Promise<void>;
  upsertProvider: (provider: ProviderConfigInput) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setDefaultModel: (ref: DefaultModelRef | null) => Promise<void>;
  reorderProviders: (ids: string[]) => Promise<void>;
}

function apply(set: (partial: Partial<SettingsState>) => void, next: AppSettings) {
  set({
    loaded: true,
    providers: [...next.providers].sort((a, b) => a.order - b.order),
    defaultModel: next.defaultModel,
  });
}

export const useSettingsStore = create<SettingsState>((set) => ({
  loaded: false,
  providers: [],
  defaultModel: undefined,

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
}));
