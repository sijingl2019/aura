import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import type { PopupParams } from '@shared/types';
import { createProvider } from '../providers';
import { getSettings } from '../config/store';
import { createPopupWindow, getPopupParams } from '../windows/popupWindow';

const ACTION_PROMPTS: Record<string, (text: string) => string> = {
  translate: (t) => `请将以下内容翻译为中文，直接输出译文，不要添加任何解释：\n\n${t}`,
  explain: (t) => `请解释以下内容：\n\n${t}`,
  summarize: (t) => `请总结以下内容的要点：\n\n${t}`,
};

const activeStreams = new Map<string, AbortController>();

export function registerPopupIpc(): void {
  ipcMain.handle(
    'popup:open',
    (_e, params: { action: string; text: string; screenX: number; screenY: number }) => {
      const streamId = `popup_${randomUUID()}`;
      const query: PopupParams = { action: params.action, text: params.text, streamId };
      createPopupWindow(query, { x: params.screenX + 12, y: params.screenY + 12 });
    },
  );

  ipcMain.handle('popup:getParams', (e) => getPopupParams(e.sender.id));

  ipcMain.handle('popup:query', async (e, params: PopupParams) => {
    const settings = getSettings();
    if (!settings.defaultModel) {
      e.sender.send('popup:event', {
        type: 'error',
        streamId: params.streamId,
        message: '未设置默认模型，请在设置中配置',
      });
      return;
    }

    let provider;
    try {
      provider = createProvider({
        providerId: settings.defaultModel.providerId,
        modelId: settings.defaultModel.modelId,
      });
    } catch (err) {
      e.sender.send('popup:event', {
        type: 'error',
        streamId: params.streamId,
        message: (err as Error).message,
      });
      return;
    }

    const promptFn = ACTION_PROMPTS[params.action];
    if (!promptFn) {
      e.sender.send('popup:event', {
        type: 'error',
        streamId: params.streamId,
        message: `未知操作: ${params.action}`,
      });
      return;
    }

    const prompt = promptFn(params.text);
    const ac = new AbortController();
    activeStreams.set(params.streamId, ac);

    const sender = e.sender;

    void (async () => {
      try {
        const gen = provider.stream({
          messages: [
            {
              id: 'u1',
              conversationId: 'popup',
              role: 'user',
              content: prompt,
              createdAt: Date.now(),
            },
          ],
          tools: [],
          system: '',
          signal: ac.signal,
        });

        for await (const event of gen) {
          if (sender.isDestroyed()) break;
          if (event.type === 'text_delta') {
            sender.send('popup:event', { type: 'text', streamId: params.streamId, delta: event.delta });
          }
          if (event.type === 'round_end') break;
        }

        if (!sender.isDestroyed()) {
          sender.send('popup:event', { type: 'done', streamId: params.streamId });
        }
      } catch (err) {
        if (!sender.isDestroyed() && !ac.signal.aborted) {
          sender.send('popup:event', {
            type: 'error',
            streamId: params.streamId,
            message: (err as Error).message,
          });
        }
      } finally {
        activeStreams.delete(params.streamId);
      }
    })();
  });

  ipcMain.handle('popup:abort', (_e, params: { streamId: string }) => {
    activeStreams.get(params.streamId)?.abort();
    activeStreams.delete(params.streamId);
  });

  ipcMain.handle('popup:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });

  ipcMain.handle('popup:setPin', (e, pinned: boolean) => {
    BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(pinned);
  });

  ipcMain.handle('popup:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
}
