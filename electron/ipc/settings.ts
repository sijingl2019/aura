import type {
  DefaultModelRef,
  DifyKnowledge,
  DifyKnowledgeConfig,
  FallbackChainEntry,
  GeneralConfig,
  McpServerConfig,
  ProviderConfigInput,
  SelectionToolbarConfig,
  WebSearchConfig,
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
  setFallbackChain,
  setGeneralConfig,
  setSelectionToolbar,
  setShortcutOverride,
  setWebSearch,
  upsertMcpServer,
  upsertProvider,
} from '../config/store';
import { syncSelectionConfig } from './selectionIpc';

export interface SettingsIpcCallbacks {
  onTrayControl: (show: boolean) => void;
  onShortcutsChanged: () => void;
}

export function registerSettingsIpc(callbacks?: SettingsIpcCallbacks): void {
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

  ipcMain.handle(
    'settings:setFallbackChain',
    (_e, params: { chain: FallbackChainEntry[] }) => setFallbackChain(params.chain),
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
    callbacks?.onShortcutsChanged?.();
    return result;
  });

  ipcMain.handle('shortcuts:reset', (_e, params: { id: string }) => {
    const result = resetShortcut(params.id);
    callbacks?.onShortcutsChanged?.();
    return result;
  });

  ipcMain.handle('settings:setWebSearch', (_e, params: WebSearchConfig | null) =>
    setWebSearch(params),
  );

  ipcMain.handle(
    'settings:detectProvider',
    async (
      _e,
      params: { kind: string; apiKey: string; baseURL: string },
    ): Promise<{ success: boolean; message: string }> => {
      if (!params.apiKey?.trim()) {
        return { success: false, message: '请先输入 API 密钥' };
      }
      const base = params.baseURL?.trim() || '';
      if (!base) {
        return { success: false, message: '请先输入 API 地址' };
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          if (params.kind === 'openai') {
            const response = await fetch(`${base.replace(/\/$/, '')}/models`, {
              method: 'GET',
              headers: { Authorization: `Bearer ${params.apiKey.trim()}` },
              signal: controller.signal,
            });
            if (!response.ok) {
              return { success: false, message: `连接失败: ${response.status} ${response.statusText}` };
            }
            return { success: true, message: '连接成功！' };
          } else {
            const response = await fetch(`${base.replace(/\/$/, '')}/messages`, {
              method: 'POST',
              headers: {
                'x-api-key': params.apiKey.trim(),
                'content-type': 'application/json',
              },
              body: JSON.stringify({ model: 'test', messages: [] }),
              signal: controller.signal,
            });
            if (response.status === 401 || response.status === 403) {
              return { success: false, message: 'API 密钥无效' };
            }
            return { success: true, message: '连接成功！' };
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        return { success: false, message: `检测失败: ${(error as Error).message}` };
      }
    },
  );
}
