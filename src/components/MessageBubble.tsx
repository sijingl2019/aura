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
        <div className="max-w-[80%] rounded-2xl bg-surface-muted px-4 py-2 text-sm text-ink">
          {message.skillName && (
            <div className="mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                <span className="opacity-60">/</span>
                {message.skillName}
              </span>
            </div>
          )}
          <span className="whitespace-pre-wrap">{message.content}</span>
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

type ToolKind = 'skill' | 'mcp' | 'builtin';

const BUILTIN_TOOLS = new Set(['read_file', 'write_file', 'list_dir', 'exec_shell', 'web_fetch']);

function getToolKind(name: string): ToolKind {
  if (name.startsWith('mcp__')) return 'mcp';
  if (BUILTIN_TOOLS.has(name)) return 'builtin';
  return 'builtin';
}

const TOOL_KIND_STYLES: Record<ToolKind, { badge: string; border: string; icon: string; label: string }> = {
  builtin: {
    badge: 'bg-blue-50 text-blue-600',
    border: 'border-blue-100',
    icon: '🔧',
    label: 'Tool',
  },
  mcp: {
    badge: 'bg-purple-50 text-purple-600',
    border: 'border-purple-100',
    icon: '🔌',
    label: 'MCP',
  },
  skill: {
    badge: 'bg-accent/10 text-accent',
    border: 'border-accent/20',
    icon: '/',
    label: 'Skill',
  },
};

function ToolCallCard({ call }: { call: ToolCall | StreamingToolCall }) {
  const [open, setOpen] = useState(false);
  const streaming = call as StreamingToolCall;
  const result = streaming.result;
  const argsPreview = call.arguments.length > 80 ? call.arguments.slice(0, 80) + '…' : call.arguments;

  const kind = getToolKind(call.name);
  const styles = TOOL_KIND_STYLES[kind];

  // For MCP tools, strip the mcp__serverId__ prefix for display
  const displayName = kind === 'mcp'
    ? call.name.replace(/^mcp__[^_]+__/, '')
    : call.name;

  return (
    <div className={`rounded-xl border bg-surface-muted/60 px-3 py-2 text-xs ${styles.border}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${styles.badge}`}>
            <span>{styles.icon}</span>
            <span>{styles.label}</span>
          </span>
          <span className="font-medium text-ink">{displayName}</span>
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
