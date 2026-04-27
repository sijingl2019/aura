import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@shared/types';

const INPUT_BAR_HEIGHT = 52;

interface AttachedPath {
  label: string;
  fullPath: string;
}

export function QuickQuestionRoute() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<AttachedPath[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamId, setStreamId] = useState('');
  const [expanded, setExpanded] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const resetState = () => {
    setMessages([]);
    setInput('');
    setAttached([]);
    setStreaming(false);
    setStreamingText('');
    setConversationId(null);
    setStreamId('');
    setExpanded(false);
  };

  // Transparent background
  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
    inputRef.current?.focus();
  }, []);

  // Listen for reset signal from main (when window is toggled on again)
  useEffect(() => {
    const off = window.api.quickQuestion.onReset(() => {
      resetState();
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    return off;
  }, []);

  // Scroll messages to bottom
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // LLM event listener
  useEffect(() => {
    const off = window.api.llm.onEvent((ev) => {
      if (ev.streamId !== streamId) return;
      if (ev.type === 'text') {
        setStreamingText((t) => t + (ev.delta ?? ''));
      } else if (ev.type === 'done' || ev.type === 'error') {
        setStreaming(false);
        if (conversationId) {
          void window.api.db.listMessages({ conversationId }).then((msgs) => {
            setMessages(msgs.filter((m) => m.role === 'user' || m.role === 'assistant'));
            setStreamingText('');
          });
        }
      }
    });
    return off;
  }, [streamId, conversationId]);

  // Esc closes (extra safety; blur-hide handles most cases)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void window.api.quickQuestion.close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleAttachClick = async () => {
    const paths = await window.api.quickQuestion.openAttachMenu();
    if (paths.length === 0) return;
    setAttached((prev) => [
      ...prev,
      ...paths.map((p) => ({ label: p.split(/[\\/]/).pop() ?? p, fullPath: p })),
    ]);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    let userText = text;
    if (attached.length > 0) {
      const refs = attached.map((a) => `[文件: ${a.label}](${a.fullPath})`).join('\n');
      userText = `${refs}\n\n${text}`;
    }

    setInput('');
    setAttached([]);
    setStreamingText('');

    if (!expanded) {
      setExpanded(true);
      await window.api.quickQuestion.expand();
    }

    let convId = conversationId;
    if (!convId) {
      const conv = await window.api.db.createConversation({ title: text.slice(0, 40) });
      convId = conv.id;
      setConversationId(convId);
    }

    // Optimistically show the user message immediately
    const optimisticUser: ChatMessage = {
      id: `pending-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: userText,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    const { streamId: sid } = await window.api.llm.stream({ conversationId: convId, userText });
    setStreamId(sid);
    setStreaming(true);

    // Replace optimistic message with persisted DB rows (user row is already in DB by now)
    void window.api.db.listMessages({ conversationId: convId }).then((msgs) => {
      setMessages(msgs.filter((m) => m.role === 'user' || m.role === 'assistant'));
    });
  };

  const hasMessages = messages.length > 0 || streaming;

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl bg-white text-[13px] text-gray-800 select-none ${expanded ? 'h-screen' : ''}`}>
      {/* Conversation area */}
      {hasMessages && (
        <div
          ref={messagesRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {streaming && (
            <div className="flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <div className="h-6 w-6 shrink-0 rounded-full bg-accent flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">Q</span>
              </div>
              <div className="flex-1 text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block h-3.5 w-0.5 bg-gray-400 animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div
        className={`shrink-0 bg-white px-3 ${hasMessages ? 'border-t border-black/8' : ''}`}
        style={{ WebkitAppRegion: 'no-drag', minHeight: INPUT_BAR_HEIGHT } as React.CSSProperties}
      >
        {attached.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-1">
            {attached.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                <FileIcon />
                {a.label}
                <button
                  type="button"
                  onClick={() => setAttached((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 text-gray-400 hover:text-gray-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2" style={{ minHeight: INPUT_BAR_HEIGHT }}>
          <button
            type="button"
            onClick={() => void handleAttachClick()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
            title="添加文件"
          >
            <PlusIcon />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="输入你的问题…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] leading-normal text-gray-800 outline-none placeholder:text-gray-400"
            style={{ maxHeight: 80, overflowY: 'auto', paddingTop: 0, paddingBottom: 0 }}
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || streaming}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
            title="发送 (Enter)"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="max-w-[80%] rounded-2xl bg-accent/10 px-3 py-1.5 text-[13px] text-gray-800 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="h-6 w-6 shrink-0 rounded-full bg-accent flex items-center justify-center">
        <span className="text-[9px] font-bold text-white">Q</span>
      </div>
      <div className="flex-1 text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 10.5V2.5M2.5 6.5l4-4 4 4" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 1H2.5a1 1 0 00-1 1v7a1 1 0 001 1h6a1 1 0 001-1V4L6.5 1z" />
      <path d="M6.5 1v3h3" />
    </svg>
  );
}
