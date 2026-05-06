import type {
  DefaultModelRef,
  DifyKnowledge,
  DifyKnowledgeConfig,
  GeneralConfig,
  McpServerConfig,
  ProviderConfigInput,
  SelectionToolbarConfig,
} from '@shared/types';
import { ipcMain } from 'electron';
import {
  deleteMcpServer,
  deleteProvider,
  getDifyKnowledge,
  getGeneralConfig,
  getSettings,
  getShortcuts,
  reorderProviders,
  resetShortcut,
  setDefaultModel,
  setDifyKnowledge,
  setGeneralConfig,
  setSelectionToolbar,
  setShortcutOverride,
  upsertMcpServer,
  upsertProvider,
} from '../config/store';
import { syncSelectionConfig } from './selectionIpc';

export interface SettingsIpcCallbacks {
  onTrayControl: (show: boolean) => void;
}

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

  ipcMain.handle('settings:upsertMcpServer', (_e, server: McpServerConfig) =>
    upsertMcpServer(server),
  );

  ipcMain.handle('settings:deleteMcpServer', (_e, params: { id: string }) =>
    deleteMcpServer(params.id),
  );

  ipcMain.handle('settings:setGeneral', async (_e, config: GeneralConfig) => {
    const prev = getGeneralConfig();
    const result = setGeneralConfig(config);

    const { session, app } = await import('electron');

    // Proxy
    if (config.proxyMode === 'system') {
      await session.defaultSession.setProxy({ mode: 'system' });
    } else if (config.proxyMode === 'none') {
      await session.defaultSession.setProxy({ mode: 'direct' });
    } else if (config.proxyMode === 'manual' && config.proxyHost) {
      await session.defaultSession.setProxy({
        proxyRules: `${config.proxyHost}:${config.proxyPort ?? 8080}`,
      });
    }

    // Launch at startup
    if (app.isPackaged) {
      try {
        app.setLoginItemSettings({ openAtLogin: config.launchAtStartup });
      } catch (e) {
        console.warn(`[login-item] failed to set: ${(e as Error).message}`);
      }
    }

    // Tray visibility
    if (config.showTrayIcon !== prev.showTrayIcon) {
      callbacks?.onTrayControl(config.showTrayIcon);
    }

    return result;
  });

  ipcMain.handle('settings:getGeneral', () => getGeneralConfig());
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
