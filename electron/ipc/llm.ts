import { BrowserWindow, ipcMain } from 'electron';
import type { LlmStreamParams, StreamEvent } from '@shared/types';
import { abortRun, newStreamId, run } from '../agent/runtime';
import { getSettings, resolveProvider } from '../config/store';
import { appendMessage, getConversation, listMessages, renameConversation } from '../db/repo';
import type { SkillStore } from '../skills/loader';

export function registerLlmIpc(deps: { skills: SkillStore; cwd: string }): void {
  ipcMain.handle('llm:stream', (event, params: LlmStreamParams) => {
    const streamId = newStreamId();
    const wc = event.sender;
    const win = BrowserWindow.fromWebContents(wc);
    const webContents = win?.webContents ?? wc;

    const persistUserMessageOnError = () => {
      const history = listMessages(params.conversationId);
      const isFirstUser = history.every((m) => m.role !== 'user');
      appendMessage({
        conversationId: params.conversationId,
        role: 'user',
        content: params.userText,
      });
      if (isFirstUser) {
        const title =
          params.userText.trim().split(/\s+/).slice(0, 8).join(' ').slice(0, 60) || '新对话';
        renameConversation(params.conversationId, title);
      }
    };

    const emitError = (message: string) => {
      try {
        persistUserMessageOnError();
      } catch (e) {
        console.warn(`[llm:stream] failed to persist user message: ${(e as Error).message}`);
      }
      const ev: StreamEvent = { type: 'error', streamId, message };
      const doneEv: StreamEvent = { type: 'done', streamId };
      if (!webContents.isDestroyed()) {
        webContents.send('llm:event', ev);
        webContents.send('llm:event', doneEv);
      }
    };

    let providerId: string | undefined;
    let modelId: string | undefined;

    const conv = getConversation(params.conversationId);
    if (conv?.provider && conv.model) {
      providerId = conv.provider;
      modelId = conv.model;
    } else {
      const def = getSettings().defaultModel;
      if (def) {
        providerId = def.providerId;
        modelId = def.modelId;
      }
    }

    if (!providerId || !modelId) {
      emitError('请先在设置中选择默认模型');
      return { streamId };
    }

    const providerCfg = resolveProvider(providerId);
    if (!providerCfg) {
      emitError(`未知的模型提供商 "${providerId}"，请在设置中检查`);
      return { streamId };
    }
    if (!providerCfg.enabled) {
      emitError(`提供商 "${providerCfg.name}" 已停用，请在设置中启用或换一个提供商`);
      return { streamId };
    }
    if (!providerCfg.apiKey.trim()) {
      emitError(`提供商 "${providerCfg.name}" 未配置 API 密钥`);
      return { streamId };
    }
    if (!providerCfg.models.some((m) => m.id === modelId)) {
      emitError(`模型 "${modelId}" 不在提供商 "${providerCfg.name}" 的模型列表中`);
      return { streamId };
    }

    void run({
      streamId,
      conversationId: params.conversationId,
      userText: params.userText,
      skillId: params.skillId,
      skillName: params.skillName,
      cwd: deps.cwd,
      providerCfg,
      modelId,
      skills: deps.skills,
      webContents,
    });

    return { streamId };
  });

  ipcMain.handle('llm:abort', (_e, params: { streamId: string }) => {
    abortRun(params.streamId);
  });
}
