import { useState } from 'react';
import type { ChatMessage, ToolCall } from '@shared/types';
import { Markdown } from '@/lib/markdown';
import type { StreamingToolCall } from '@/stores/streaming';

interface MessageBubbleProps {
  message: ChatMessage;
  streamingToolCalls?: StreamingToolCall[];
  isStreaming?: boolean;
}

export function MessageBubble({ message, streamingToolCalls, isStreaming }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-surface-muted px-4 py-2 text-sm text-ink whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="flex justify-start">
        <ToolResultCard content={message.content} ok />
      </div>
    );
  }

  if (message.role === 'assistant') {
    const toolCalls = streamingToolCalls ?? message.toolCalls;
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[85%] flex-col gap-2 text-sm text-ink">
          {message.content && (
            <div className="rounded-2xl bg-surface px-4 py-2 shadow-sm">
              <Markdown content={message.content} />
              {isStreaming && <span className="ml-0.5 inline-block animate-pulse">▊</span>}
            </div>
          )}
          {toolCalls && toolCalls.length > 0 && (
            <div className="flex flex-col gap-1">
              {toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} call={tc} />
              ))}
            </div>
          )}
          {!message.content && (!toolCalls || toolCalls.length === 0) && isStreaming && (
            <div className="rounded-2xl bg-surface px-4 py-2 shadow-sm text-ink-subtle">
              <span className="animate-pulse">思考中…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function ToolCallCard({ call }: { call: ToolCall | StreamingToolCall }) {
  const [open, setOpen] = useState(false);
  const streaming = call as StreamingToolCall;
  const result = streaming.result;
  const argsPreview = call.arguments.length > 80 ? call.arguments.slice(0, 80) + '…' : call.arguments;

  return (
    <div className="rounded-xl border border-black/5 bg-surface-muted/60 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span>🔧</span>
          <span className="font-medium">{call.name}</span>
          <span className="text-ink-subtle">{argsPreview}</span>
        </span>
        <span className="text-ink-subtle">
          {result ? (result.ok ? '✓' : '✗') : '…'}
        </span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <pre className="overflow-x-auto rounded bg-surface-sunken p-2 text-[11px] text-ink">
            {call.arguments || '{}'}
          </pre>
          {result && (
            <pre className="overflow-x-auto rounded bg-surface-sunken p-2 text-[11px] text-ink">
              {result.preview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ToolResultCard({ content, ok }: { content: string; ok: boolean }) {
  const [open, setOpen] = useState(false);
  const preview = content.length > 120 ? content.slice(0, 120) + '…' : content;
  return (
    <div className="max-w-[85%] rounded-xl border border-black/5 bg-surface-muted/40 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span>{ok ? '✓' : '✗'}</span>
          <span className="text-ink-subtle">{preview}</span>
        </span>
      </button>
      {open && (
        <pre className="mt-2 overflow-x-auto rounded bg-surface-sunken p-2 text-[11px] text-ink">
          {content}
        </pre>
      )}
    </div>
  );
}
