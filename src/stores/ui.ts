import { create } from 'zustand';

export type SettingsSection = 'providers' | 'default-model' | 'fallback' | 'knowledge' | 'selection' | 'shortcuts' | 'skills' | 'mcp' | 'general' | 'web-search' | 'gateway';

interface UiState {
  chatWideMode: boolean;
  toggleChatWideMode: () => void;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  chatWideMode: false,
  toggleChatWideMode: () => set((state) => ({ chatWideMode: !state.chatWideMode })),
  settingsOpen: false,
  settingsSection: 'providers',
  openSettings: (section = 'providers') => set({ settingsOpen: true, settingsSection: section }),
  closeSettings: () => set({ settingsOpen: false }),
  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
