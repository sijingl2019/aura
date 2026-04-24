import { clipboard, ipcMain, shell } from 'electron';
import type { SearchEngine, SelectionActionId } from '@shared/types';
import { createPopupWindow } from '../windows/popupWindow';
import { getSelectionToolbar } from '../config/store';
import { getToolbarBounds, getToolbarParams, hideToolbar, setToolbarSize } from '../windows/toolbarWindow';
import { randomUUID } from 'node:crypto';

const SEARCH_URLS: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  baidu: 'https://www.baidu.com/s?wd=',
  bing: 'https://www.bing.com/search?q=',
};

const POPUP_ACTIONS = new Set<SelectionActionId>(['translate', 'explain', 'summarize']);

export function registerToolbarIpc(): void {
  ipcMain.handle('toolbar:getParams', () => getToolbarParams());

  ipcMain.handle('toolbar:close', () => {
    hideToolbar();
  });

  ipcMain.handle('toolbar:resize', (_e, params: { width: number; height: number }) => {
    setToolbarSize(Math.max(1, Math.ceil(params.width)), Math.max(1, Math.ceil(params.height)));
  });

  ipcMain.handle(
    'toolbar:performAction',
    (_e, params: { actionId: SelectionActionId; text: string }) => {
      const { actionId, text } = params;

      if (actionId === 'copy') {
        clipboard.writeText(text);
        hideToolbar();
        return;
      }

      if (actionId === 'search') {
        const engine: SearchEngine = getSelectionToolbar().searchEngine ?? 'google';
        const url = SEARCH_URLS[engine] + encodeURIComponent(text);
        void shell.openExternal(url);
        hideToolbar();
        return;
      }

      if (POPUP_ACTIONS.has(actionId)) {
        const streamId = `popup_${randomUUID()}`;
        // Position popup at toolbar location (get bounds before hiding).
        const tbBounds = getToolbarBounds();
        const origin = tbBounds
          ? { x: tbBounds.x, y: tbBounds.y }
          : { x: 0, y: 0 };
        createPopupWindow({ action: actionId, text, streamId }, origin);
        hideToolbar();
        return;
      }
    },
  );
}
