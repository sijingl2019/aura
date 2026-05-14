import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage, ProviderConfig } from '@shared/types';
import { useConversationsStore } from '@/stores/conversations';
import { useStreamingStore } from '@/stores/streaming';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
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

export function getChatContentWidthClass(isWide: boolean) {
  return isWide ? 'max-w-screen-2xl' : 'max-w-3xl';
}

export function getChatWidthToggleLabel(isWide: boolean) {
  return isWide ? 'Switch to narrow mode' : 'Switch to wide mode';
}

export function getChatWidthToggleButtonClass() {
  return 'absolute right-4 top-4 z-10 inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded border border-black/10 bg-surface/90 text-ink-muted shadow-sm backdrop-blur transition-colors hover:bg-surface-sunken hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/30';
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
  const chatWideMode = useUiStore((s) => s.chatWideMode);
  const toggleChatWideMode = useUiStore((s) => s.toggleChatWideMode);

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

  // Map toolCallId to stored tool result content for historical messages
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
    if (!streaming.text && !streaming.thinking && streaming.toolCalls.length === 0) {
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
      thinking: streaming.thinking || undefined,
      toolCalls: streaming.toolCalls.map((c) => ({
        id: c.id,
        name: c.name,
        arguments: c.arguments,
      })),
      createdAt: Date.now(),
    };
    return [...filtered, streamingMsg];
  }, [isActiveStream, messages, streaming.text, streaming.thinking, streaming.toolCalls, conversationId]);

  const hasVisibleStreamingPlaceholder =
    isActiveStream && !streaming.text && !streaming.thinking && streaming.toolCalls.length === 0;

  const scrollKey = getChatScrollKey({
    displayedMessageCount: displayed.length,
    streamingText: streaming.text + streaming.thinking,
    streamingToolCallCount: streaming.toolCalls.length,
    hasVisibleStreamingPlaceholder,
  });

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [scrollKey]);

  const widthToggleLabel = getChatWidthToggleLabel(chatWideMode);

  return (
    <div className="relative flex-1 overflow-hidden">
      <button
        type="button"
        title={widthToggleLabel}
        aria-label={widthToggleLabel}
        onClick={toggleChatWideMode}
        className={getChatWidthToggleButtonClass()}
      >
        {chatWideMode ? <NarrowModeIcon /> : <WideModeIcon />}
      </button>
      <div ref={containerRef} className="h-full overflow-y-auto px-6 py-6">
        <div className={`mx-auto flex w-full ${getChatContentWidthClass(chatWideMode)} flex-col gap-4 transition-[max-width] duration-200`}>
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
    </div>
  );
}

function WideModeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4H4v3" />
      <path d="M11 4h3v3" />
      <path d="M7 14H4v-3" />
      <path d="M11 14h3v-3" />
      <path d="M4.5 4.5 7 7" />
      <path d="M13.5 4.5 11 7" />
      <path d="M4.5 13.5 7 11" />
      <path d="M13.5 13.5 11 11" />
    </svg>
  );
}

function NarrowModeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h3V4" />
      <path d="M14 7h-3V4" />
      <path d="M4 11h3v3" />
      <path d="M14 11h-3v3" />
      <path d="M7 7 4.5 4.5" />
      <path d="M11 7l2.5-2.5" />
      <path d="M7 11l-2.5 2.5" />
      <path d="M11 11l2.5 2.5" />
    </svg>
  );
}
