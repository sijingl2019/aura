import { ipcMain } from 'electron';
import type { DefaultModelRef, ProviderConfigInput } from '@shared/types';
import {
  deleteProvider,
  getSettings,
  reorderProviders,
  setDefaultModel,
  upsertProvider,
} from '../config/store';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:upsertProvider', (_e, provider: ProviderConfigInput) =>
    upsertProvider(provider),
  );

  ipcMain.handle('settings:deleteProvider', (_e, params: { id: string }) =>
    deleteProvider(params.id),
  );

  ipcMain.handle('settings:setDefaultModel', (_e, params: DefaultModelRef | null) =>
    setDefaultModel(params),
  );

  ipcMain.handle('settings:reorderProviders', (_e, params: { ids: string[] }) =>
    reorderProviders(params.ids),
  );
}
