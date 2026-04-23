import { useEffect, useState, type KeyboardEvent } from 'react';
import { TitleBar } from './components/TitleBar';

export default function App() {
  const [pong, setPong] = useState<string>('…');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');

  useEffect(() => {
    window.api.ping().then(setPong).catch((e) => setPong(`error: ${String(e)}`));
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    console.log('send:', text);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-surface text-ink">
      <TitleBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <aside className="w-[260px] shrink-0 bg-surface-muted px-3 py-4">
            <button className="w-full rounded-xl bg-surface px-3 py-2 text-left text-sm shadow-sm hover:bg-surface-sunken">
              + New conversation
            </button>
            <div className="mt-4 text-xs text-ink-subtle">No conversations yet</div>
          </aside>
        )}

        <main className="flex flex-1 flex-col items-center justify-center px-8">
          <div className="flex w-full max-w-2xl flex-col items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="text-accent">✷</span> Let&apos;s knock something off your list
            </h1>
            <p className="text-sm text-ink-muted">Scaffold is running. IPC says: {pong}</p>
            <div className="mt-4 w-full rounded-2xl bg-surface-muted p-4 shadow-sm">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="How can I help you today?"
                rows={2}
                className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
              />
              <div className="mt-4 flex items-center justify-between text-ink-subtle">
                <button type="button" className="rounded-md px-2 py-1 hover:bg-surface-sunken" title="Attach">
                  +
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="rounded-md px-2 py-1 hover:bg-surface-sunken disabled:opacity-40"
                  title="Send"
                >
                  🎙
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
