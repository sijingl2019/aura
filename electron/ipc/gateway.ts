import { BrowserWindow, ipcMain } from 'electron';
import type { GatewayConfig } from '@shared/types';
import { deleteGateway, upsertGateway } from '../config/store';
import { gatewayManager } from '../gateway/manager';

export function registerGatewayIpc(): void {
  // Broadcast connection-status changes to every renderer window.
  gatewayManager.onStatus((status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('gateway:status', status);
    }
  });

  ipcMain.handle('gateway:list', () => gatewayManager.list());

  ipcMain.handle('gateway:upsert', async (_e, config: GatewayConfig) => {
    const settings = upsertGateway(config);
    await gatewayManager.restart(config);
    return settings;
  });

  ipcMain.handle('gateway:delete', async (_e, params: { id: string }) => {
    await gatewayManager.stop(params.id);
    return deleteGateway(params.id);
  });

  ipcMain.handle('gateway:start', (_e, params: { id: string }) => gatewayManager.start(params.id));

  ipcMain.handle('gateway:stop', (_e, params: { id: string }) => gatewayManager.stop(params.id));
}
