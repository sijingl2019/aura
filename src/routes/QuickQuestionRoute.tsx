import { useEffect, useRef, useState, useCallback } from 'react';
import type { AppLaunchEntry, ChatMessage } from '@shared/types';

const INPUT_BAR_HEIGHT = 52;
const COLLAPSED_HEIGHT = 52;
const CALC_HEIGHT = 132;       // input + result panel
const LAUNCHER_ROW = 38;
const LAUNCHER_PAD = 16;
const LAUNCHER_EMPTY = 96;

interface AttachedPath {
  label: string;
  fullPath: string;
}

// ─── CSP-safe math evaluator (recursive descent) ──────────────────────────────
// new Function() / eval() are blocked by Content-Security-Policy `script-src 'self'`,
// so we parse and evaluate the expression ourselves. Supports + - * / % and parens.
function evalMath(input: string): string {
  const expr = input.trim();
  if (!expr) return '';
  let pos = 0;

  const peek = (): string => (pos < expr.length ? expr[pos] : '');
  const skipWs = () => { while (pos < expr.length && /\s/.test(expr[pos])) pos++; };

  const parseNumber = (): number => {
    skipWs();
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
    if (start === pos) throw new Error('expected number');
    const n = parseFloat(expr.slice(start, pos));
    if (isNaN(n)) throw new Error('NaN');
    return n;
  };

  const parseFactor = (): number => {
    skipWs();
    const c = peek();
    if (c === '(') {
      pos++;
      const v = parseAddSub();
      skipWs();
      if (peek() !== ')') throw new Error('expected )');
      pos++;
      return v;
    }
    if (c === '-') { pos++; return -parseFactor(); }
    if (c === '+') { pos++; return parseFactor(); }
    return parseNumber();
  };

  const parseMulDiv = (): number => {
    let v = parseFactor();
    while (true) {
      skipWs();
      const op = peek();
      if (op === '*' || op === '/' || op === '%') {
        pos++;
        const r = parseFactor();
        if (op === '*') v *= r;
        else if (op === '/') v /= r;
        else v %= r;
      } else break;
    }
    return v;
  };

  function parseAddSub(): number {
    let v = parseMulDiv();
    while (true) {
      skipWs();
      const op = peek();
      if (op === '+' || op === '-') {
        pos++;
        const r = parseMulDiv();
        if (op === '+') v += r;
        else v -= r;
      } else break;
    }
    return v;
  }

  try {
    const result = parseAddSub();
    skipWs();
    if (pos < expr.length) return '错误';
    if (typeof result !== 'number' || !isFinite(result)) return '错误';
    // Trim float noise: 0.1 + 0.2 → 0.3 instead of 0.30000000000000004
    const fixed = parseFloat(result.toPrecision(12));
    return String(fixed);
  } catch {
    return '错误';
  }
}

// ─── App launcher panel ────────────────────────────────────────────────────────
function AppLauncherPanel({
  query,
  onLaunch,
  onCountChange,
}: {
  query: string;
  onLaunch: () => void;
  onCountChange: (count: number, loading: boolean) => void;
}) {
  const [apps, setApps] = useState<AppLaunchEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelected(0);
    setLoading(true);
    onCountChange(apps.length, true);
    let cancelled = false;
    void window.api.quickQuestion.searchApps(query).then((results) => {
      if (cancelled) return;
      setApps(results);
      setLoading(false);
      onCountChange(results.length, false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, apps.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter' && apps.length > 0) {
        e.preventDefault();
        const target = apps[selected];
        if (target) {
          void window.api.quickQuestion.launchApp(target.path);
          onLaunch();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [apps, selected, onLaunch]);

  return (
    <div className="px-3 py-2">
      {loading && (
        <div className="py-3 text-xs text-gray-400 text-center">搜索中…</div>
      )}
      {!loading && apps.length === 0 && (
        <div className="py-3 text-xs text-gray-400 text-center">未找到匹配程序</div>
      )}
      {!loading && apps.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {apps.map((app, i) => {
            const colors = [
              'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
              'bg-orange-500', 'bg-cyan-500', 'bg-amber-500', 'bg-rose-500',
            ];
            const colorIdx = app.name.charCodeAt(0) % colors.length;
            const bgColor = colors[colorIdx];
            return (
              <button
                key={app.path}
                type="button"
                onClick={() => {
                  void window.api.quickQuestion.launchApp(app.path);
                  onLaunch();
                }}
                onMouseEnter={() => setSelected(i)}
                className={`flex items-center gap-2 rounded-lg px-3 h-[34px] text-left text-[13px] transition-colors ${
                  i === selected
                    ? 'bg-accent text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center text-white ${i === selected ? 'bg-white/30' : bgColor}`}>
                  <AppIcon size={14} />
                </div>
                <span className="truncate">{app.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Calculator panel ──────────────────────────────────────────────────────────
function CalcPanel({ expr, onCopy }: { expr: string; onCopy: () => void }) {
  const result = evalMath(expr);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (result && result !== '错误') {
      void navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      onCopy();
    }
  };

  return (
    <div className="px-4 py-4 flex items-center justify-between gap-3">
      <span
        className={`text-3xl font-semibold tabular-nums truncate ${result === '错误' ? 'text-red-500' : 'text-gray-800'}`}
      >
        {result || '…'}
      </span>
      {result && result !== '错误' && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-full border border-black/10 px-3 py-1 text-[11px] text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {copied ? '已复制' : '复制到剪贴板'}
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function QuickQuestionRoute() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<AttachedPath[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamId, setStreamId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [launcherInfo, setLauncherInfo] = useState({ count: 0, loading: false });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  // System conversation is created once per app launch and reused across quick-question sessions.
  const systemConvIdRef = useRef<string | null>(null);

  const isCalc = input.startsWith('= ');
  const isLauncher = input.startsWith('. ');
  const calcExpr = isCalc ? input.slice(2) : '';
  const launcherQuery = isLauncher ? input.slice(2) : '';
  const isSpecialMode = isCalc || isLauncher;
  const hasMessages = messages.length > 0 || streaming;

  const resetState = useCallback(() => {
    setMessages([]);
    setInput('');
    setAttached([]);
    setStreaming(false);
    setStreamingText('');
    setConversationId(null);
    setStreamId('');
    setExpanded(false);
    setLauncherInfo({ count: 0, loading: false });
  }, []);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
    inputRef.current?.focus();
    // Pre-fetch (or create) the system conversation so it's ready before the first send.
    void window.api.db.getOrCreateSystemConversation().then((conv) => {
      systemConvIdRef.current = conv.id;
    });
  }, []);

  useEffect(() => {
    const off = window.api.quickQuestion.onReset(() => {
      resetState();
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    return off;
  }, [resetState]);

  // Resize the native window to fit current mode/content.
  // Skip while expanded chat is active — that state has its own height.
  useEffect(() => {
    if (expanded) return;
    let target = COLLAPSED_HEIGHT;
    if (isCalc) {
      target = calcExpr.trim() ? CALC_HEIGHT : COLLAPSED_HEIGHT;
    } else if (isLauncher) {
      const rows = launcherInfo.loading || launcherInfo.count === 0
        ? 0
        : Math.min(launcherInfo.count, 8);
      target = rows > 0
        ? INPUT_BAR_HEIGHT + LAUNCHER_PAD + rows * LAUNCHER_ROW
        : INPUT_BAR_HEIGHT + LAUNCHER_EMPTY;
    }
    void window.api.quickQuestion.resize(target);
  }, [isCalc, isLauncher, calcExpr, launcherInfo, expanded]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

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
    if (isSpecialMode) return;
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
      // Always use the single system conversation for quick questions.
      if (!systemConvIdRef.current) {
        const sysConv = await window.api.db.getOrCreateSystemConversation();
        systemConvIdRef.current = sysConv.id;
      }
      convId = systemConvIdRef.current;
      setConversationId(convId);
    }

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

    void window.api.db.listMessages({ conversationId: convId }).then((msgs) => {
      setMessages(msgs.filter((m) => m.role === 'user' || m.role === 'assistant'));
    });
  };

  const showOverlay = isSpecialMode && !hasMessages;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl bg-white text-[13px] text-gray-800 select-none h-screen`}
    >
      {hasMessages && !isSpecialMode && (
        <div
          ref={messagesRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {streaming && (
            <div
              className="flex gap-2"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
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

      {showOverlay && (
        <div
          className="flex-1 min-h-0 overflow-y-auto border-b border-black/8"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {isCalc && (
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <CalcPanel
                expr={calcExpr}
                onCopy={() => void window.api.quickQuestion.close()}
              />
            </div>
          )}
          {isLauncher && (
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <AppLauncherPanel
                query={launcherQuery}
                onLaunch={() => setInput('')}
                onCountChange={(count, loading) => setLauncherInfo({ count, loading })}
              />
            </div>
          )}
        </div>
      )}

      <div
        className={`shrink-0 bg-white px-3 ${(hasMessages && !isSpecialMode) || showOverlay ? 'border-t border-black/8' : ''}`}
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
          {!isSpecialMode && (
            <button
              type="button"
              onClick={() => void handleAttachClick()}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
              title="添加文件"
            >
              <PlusIcon />
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // In launcher mode, Enter is handled by AppLauncherPanel's keydown listener.
              if (e.key === 'Enter' && !e.shiftKey && !isLauncher) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={isCalc ? '输入数学表达式…' : isLauncher ? '搜索程序…' : '输入你的问题…'}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] leading-normal text-gray-800 outline-none placeholder:text-gray-400"
            style={{ maxHeight: 80, overflowY: 'auto', paddingTop: 0, paddingBottom: 0 }}
          />

          {!isSpecialMode && (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || streaming}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
              title="发送 (Enter)"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div
        className="flex justify-end"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="max-w-[80%] rounded-2xl bg-accent/10 px-3 py-1.5 text-[13px] text-gray-800 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex gap-2"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
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

function AppIcon({ size = 14 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="5" height="5" rx="1" />
      <rect x="8" y="1" width="5" height="5" rx="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" />
      <rect x="8" y="8" width="5" height="5" rx="1" />
    </svg>
  );
}
