import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from '@shared/types';
import { useConversationsStore } from '@/stores/conversations';
import { useStreamingStore } from '@/stores/streaming';
import { MessageBubble } from './MessageBubble';

interface ChatViewProps {
  conversationId: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const messages = useConversationsStore((s) => s.messages[conversationId] ?? []);
  const loadMessages = useConversationsStore((s) => s.loadMessages);
  const streaming = useStreamingStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages(conversationId);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streaming.text, streaming.toolCalls.length]);

  const isActiveStream =
    streaming.streamId !== null && streaming.conversationId === conversationId;

  // Map toolCallId → stored tool result content for historical messages
  const toolResultsMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      if (m.role === 'tool' && m.toolCallId) {
        map.set(m.toolCallId, m.content);
      }
    }
    return map;
  }, [messages]);

  const displayed = useMemo<ChatMessage[]>(() => {
    // Never show standalone tool-result bubbles; their content surfaces inside ToolCallCard
    const filtered = messages.filter((m) => m.role !== 'tool');

    if (!isActiveStream) return filtered;
    if (!streaming.text && streaming.toolCalls.length === 0) {
      const placeholder: ChatMessage = {
        id: '__streaming__',
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };
      return [...filtered, placeholder];
    }
    const streamingMsg: ChatMessage = {
      id: '__streaming__',
      conversationId,
      role: 'assistant',
      content: streaming.text,
      toolCalls: streaming.toolCalls.map((c) => ({
        id: c.id,
        name: c.name,
        arguments: c.arguments,
      })),
      createdAt: Date.now(),
    };
    return [...filtered, streamingMsg];
  }, [isActiveStream, messages, streaming.text, streaming.toolCalls, conversationId]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {displayed.length === 0 && (
          <div className="mt-12 text-center text-ink-muted">
            <p className="text-2xl font-semibold text-ink">
              <span className="text-accent">✷</span> Let&apos;s knock something off your list
            </p>
            <p className="mt-2 text-sm">在下方输入消息开始对话。</p>
          </div>
        )}
        {displayed.map((m) => {
          const isStreamingThis = isActiveStream && m.id === '__streaming__';
          return (
            <MessageBubble
              key={m.id}
              message={m}
              streamingToolCalls={isStreamingThis ? streaming.toolCalls : undefined}
              isStreaming={isStreamingThis}
              toolResultsMap={isStreamingThis ? undefined : toolResultsMap}
            />
          );
        })}
        {streaming.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            错误: {streaming.error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
