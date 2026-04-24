import { create } from 'zustand';

type SettingsSection = 'providers' | 'default-model';

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
