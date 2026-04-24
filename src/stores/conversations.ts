import { create } from 'zustand';
import type { ChatMessage, Conversation } from '@shared/types';

interface ConversationsState {
  list: Conversation[];
  activeId: string | null;
  messages: Record<string, ChatMessage[]>;

  loadList: () => Promise<void>;
  create: (title?: string) => Promise<Conversation>;
  remove: (id: string) => Promise<void>;
  select: (id: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  replaceMessages: (conversationId: string, messages: ChatMessage[]) => void;
  setConversationModel: (id: string, providerId: string, modelId: string) => Promise<void>;
}

export const useConversationsStore = create<ConversationsState>((set) => ({
  list: [],
  activeId: null,
  messages: {},

  loadList: async () => {
    const list = await window.api.db.listConversations();
    set({ list });
  },

  create: async (title) => {
    const conv = await window.api.db.createConversation({ title });
    set((s) => ({ list: [conv, ...s.list], activeId: conv.id }));
    return conv;
  },

  remove: async (id) => {
    await window.api.db.deleteConversation({ id });
    set((s) => {
      const list = s.list.filter((c) => c.id !== id);
      const messages = { ...s.messages };
      delete messages[id];
      const activeId = s.activeId === id ? (list[0]?.id ?? null) : s.activeId;
      return { list, activeId, messages };
    });
  },

  select: (id) => set({ activeId: id }),

  loadMessages: async (conversationId) => {
    const messages = await window.api.db.listMessages({ conversationId });
    set((s) => ({ messages: { ...s.messages, [conversationId]: messages } }));
  },

  replaceMessages: (conversationId, messages) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: messages } })),

  setConversationModel: async (id, providerId, modelId) => {
    await window.api.db.updateConversationModel({ id, providerId, modelId });
    set((s) => ({
      list: s.list.map((c) =>
        c.id === id ? { ...c, provider: providerId, model: modelId } : c,
      ),
    }));
  },
}));

export function getActiveMessages(): ChatMessage[] {
  const { activeId, messages } = useConversationsStore.getState();
  if (!activeId) return [];
  return messages[activeId] ?? [];
}
