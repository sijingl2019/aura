import { ipcMain } from 'electron';
import type { DefaultModelRef, DifyKnowledge, DifyKnowledgeConfig, ProviderConfigInput, SelectionToolbarConfig } from '@shared/types';
import {
  deleteProvider,
  getDifyKnowledge,
  getSettings,
  getShortcuts,
  reorderProviders,
  resetShortcut,
  setDefaultModel,
  setDifyKnowledge,
  setSelectionToolbar,
  setShortcutOverride,
  upsertProvider,
} from '../config/store';
import { syncSelectionConfig } from './selectionIpc';

export function registerSettingsIpc(onShortcutsChanged?: () => void): void {
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

  ipcMain.handle('settings:setDifyKnowledge', (_e, params: DifyKnowledgeConfig | null) =>
    setDifyKnowledge(params),
  );

  ipcMain.handle('settings:listDifyKnowledges', async (): Promise<DifyKnowledge[]> => {
    const config = getDifyKnowledge();
    if (!config || !config.enabled) {
      throw new Error('请先在设置中配置并启用知识库');
    }
    const url = `${config.apiHost.replace(/\/$/, '')}/datasets`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText}`);
    }
    const apiResponse = (await response.json()) as { data?: Array<Record<string, unknown>> };
    return (
      apiResponse?.data?.map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        description: String(item.description ?? ''),
      })) ?? []
    );
  });

  ipcMain.handle('settings:setSelectionToolbar', (_e, params: SelectionToolbarConfig) => {
    const result = setSelectionToolbar(params);
    syncSelectionConfig();
    return result;
  });

  ipcMain.handle('shortcuts:get', () => getShortcuts());

  ipcMain.handle('shortcuts:set', (_e, params: { id: string; keys: string }) => {
    const result = setShortcutOverride(params.id, params.keys);
    onShortcutsChanged?.();
    return result;
  });

  ipcMain.handle('shortcuts:reset', (_e, params: { id: string }) => {
    const result = resetShortcut(params.id);
    onShortcutsChanged?.();
    return result;
  });
}
