import { create } from 'zustand';

export type SettingsSection = 'providers' | 'default-model' | 'knowledge' | 'selection' | 'skills' | 'mcp' | 'general';

interface UiState {
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  settingsSection: 'providers',
  openSettings: (section = 'providers') => set({ settingsOpen: true, settingsSection: section }),
  closeSettings: () => set({ settingsOpen: false }),
}));
