import { ipcMain } from 'electron';
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  renameConversation,
  searchConversations,
  setConversationModel,
} from '../db/repo';

export function registerDbIpc(): void {
  ipcMain.handle('db:listConversations', () => listConversations());

  ipcMain.handle('db:createConversation', (_e, params: { title?: string } = {}) =>
    createConversation(params.title),
  );

  ipcMain.handle('db:deleteConversation', (_e, params: { id: string }) => {
    deleteConversation(params.id);
  });

  ipcMain.handle('db:renameConversation', (_e, params: { id: string; title: string }) => {
    renameConversation(params.id, params.title);
  });

  ipcMain.handle(
    'db:updateConversationModel',
    (_e, params: { id: string; providerId: string; modelId: string }) => {
      setConversationModel(params.id, params.providerId, params.modelId);
    },
  );

  ipcMain.handle('db:listMessages', (_e, params: { conversationId: string }) =>
    listMessages(params.conversationId),
  );

  ipcMain.handle('db:searchConversations', (_e, params: { query: string }) =>
    searchConversations(params.query),
  );
}
