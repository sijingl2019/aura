import { create } from 'zustand';
import type { ToolCall } from '@shared/types';

export interface StreamingToolCall extends ToolCall {
  result?: { ok: boolean; preview: string };
}

interface StreamingState {
  streamId: string | null;
  conversationId: string | null;
  text: string;
  toolCalls: StreamingToolCall[];
  error: string | null;

  begin: (params: { streamId: string; conversationId: string }) => void;
  appendText: (delta: string) => void;
  toolCallStart: (id: string, name: string) => void;
  toolCallArgs: (id: string, delta: string) => void;
  toolCallEnd: (id: string) => void;
  toolResult: (id: string, ok: boolean, preview: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useStreamingStore = create<StreamingState>((set) => ({
  streamId: null,
  conversationId: null,
  text: '',
  toolCalls: [],
  error: null,

  begin: ({ streamId, conversationId }) =>
    set({ streamId, conversationId, text: '', toolCalls: [], error: null }),

  appendText: (delta) => set((s) => ({ text: s.text + delta })),

  toolCallStart: (id, name) =>
    set((s) => ({
      toolCalls: s.toolCalls.some((c) => c.id === id)
        ? s.toolCalls
        : [...s.toolCalls, { id, name, arguments: '' }],
    })),

  toolCallArgs: (id, delta) =>
    set((s) => ({
      toolCalls: s.toolCalls.map((c) =>
        c.id === id ? { ...c, arguments: c.arguments + delta } : c,
      ),
    })),

  toolCallEnd: () => {
    /* no-op: args already accumulated */
  },

  toolResult: (id, ok, preview) =>
    set((s) => ({
      toolCalls: s.toolCalls.map((c) =>
        c.id === id ? { ...c, result: { ok, preview } } : c,
      ),
    })),

  setError: (message) => set({ error: message }),

  reset: () =>
    set({ streamId: null, conversationId: null, text: '', toolCalls: [], error: null }),
}));
