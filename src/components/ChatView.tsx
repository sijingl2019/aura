import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage, ProviderConfig } from '@shared/types';
import { useConversationsStore } from '@/stores/conversations';
import { useStreamingStore } from '@/stores/streaming';
import { useSettingsStore } from '@/stores/settings';
import { MessageBubble } from './MessageBubble';

interface ChatViewProps {
  conversationId: string;
}

interface ChatScrollKeyInput {
  displayedMessageCount: number;
  streamingText: string;
  streamingToolCallCount: number;
  hasVisibleStreamingPlaceholder: boolean;
}

export function getChatScrollKey({
  displayedMessageCount,
  streamingText,
  streamingToolCallCount,
  hasVisibleStreamingPlaceholder,
}: ChatScrollKeyInput) {
  return [
    displayedMessageCount,
    streamingText,
    streamingToolCallCount,
    hasVisibleStreamingPlaceholder ? 'placeholder' : 'content',
  ].join(':');
}

export function ChatView({ conversationId }: ChatViewProps) {
  const messages = useConversationsStore((s) => s.messages[conversationId] ?? []);
  const loadMessages = useConversationsStore((s) => s.loadMessages);
  const conversation = useConversationsStore((s) => s.list.find((c) => c.id === conversationId));
  const streaming = useStreamingStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const providers = useSettingsStore((s) => s.providers);
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const userAvatar = useSettingsStore((s) => s.general.userAvatar);

  const providerInfo = useMemo<Pick<ProviderConfig, 'id' | 'name' | 'icon' | 'iconBg'> | undefined>(() => {
    const providerId = conversation?.provider ?? defaultModel?.providerId;
    if (!providerId) return undefined;
    const p = providers.find((pr) => pr.id === providerId);
    if (!p) return undefined;
    return { id: p.id, name: p.name, icon: p.icon, iconBg: p.iconBg };
  }, [conversation?.provider, defaultModel?.providerId, providers]);

  useEffect(() => {
    loadMessages(conversationId);
  }, [conversationId, loadMessages]);

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

  const hasVisibleStreamingPlaceholder =
    isActiveStream && !streaming.text && streaming.toolCalls.length === 0;

  const scrollKey = getChatScrollKey({
    displayedMessageCount: displayed.length,
    streamingText: streaming.text,
    streamingToolCallCount: streaming.toolCalls.length,
    hasVisibleStreamingPlaceholder,
  });

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [scrollKey]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {displayed.length === 0 && (
          <div className="mt-12 text-center text-ink-muted">
            <p className="text-2xl font-semibold text-ink">
              <span className="text-accent">✷</span> Let&apos;s knock something off your list
            </p>
            <p className="mt-2 text-sm">在下方输入消息开始对话。</p>
          </div>
        )}
        {displayed.map((m, i) => {
          const isStreamingThis = isActiveStream && m.id === '__streaming__';
          const prev = i > 0 ? displayed[i - 1] : null;
          const showAvatar = m.role !== 'assistant' || prev?.role !== 'assistant';
          return (
            <MessageBubble
              key={m.id}
              message={m}
              showAvatar={showAvatar}
              streamingToolCalls={isStreamingThis ? streaming.toolCalls : undefined}
              isStreaming={isStreamingThis}
              toolResultsMap={isStreamingThis ? undefined : toolResultsMap}
              providerInfo={providerInfo}
              userAvatar={userAvatar}
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
