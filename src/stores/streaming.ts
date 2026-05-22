import { create } from 'zustand';
import type { ToolCall } from '@shared/types';

export interface StreamingToolCall extends ToolCall {
  result?: { ok: boolean; preview: string };
}

interface StreamingState {
  streamId: string | null;
  conversationId: string | null;
  text: string;
  thinking: string;
  toolCalls: StreamingToolCall[];
  error: string | null;

  begin: (params: { streamId: string; conversationId: string }) => void;
  appendText: (delta: string) => void;
  appendThinking: (delta: string) => void;
  toolCallStart: (id: string, name: string) => void;
  toolCallArgs: (id: string, delta: string) => void;
  toolCallEnd: (id: string) => void;
  toolResult: (id: string, ok: boolean, preview: string) => void;
  setError: (message: string) => void;
  /** Clear the in-flight assistant draft but keep the stream active. Used when a
   *  steering interjection lands mid-run: the prior draft is committed to the
   *  message list by the caller, then the next turn streams into a fresh draft. */
  flushForSteer: () => void;
  reset: () => void;
}

export const useStreamingStore = create<StreamingState>((set) => ({
  streamId: null,
  conversationId: null,
  text: '',
  thinking: '',
  toolCalls: [],
  error: null,

  begin: ({ streamId, conversationId }) =>
    set({ streamId, conversationId, text: '', thinking: '', toolCalls: [], error: null }),

  appendText: (delta) => set((s) => ({ text: s.text + delta })),

  appendThinking: (delta) => set((s) => ({ thinking: s.thinking + delta })),

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

  flushForSteer: () => set({ text: '', thinking: '', toolCalls: [] }),

  reset: () =>
    set({ streamId: null, conversationId: null, text: '', thinking: '', toolCalls: [], error: null }),
}));
