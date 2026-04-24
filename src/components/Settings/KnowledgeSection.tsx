import { useEffect, useState } from 'react';
import type { DifyKnowledge } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';

export function KnowledgeSection() {
  const difyKnowledge = useSettingsStore((s) => s.difyKnowledge);
  const setDifyKnowledge = useSettingsStore((s) => s.setDifyKnowledge);

  const [apiHost, setApiHost] = useState(difyKnowledge?.apiHost ?? '');
  const [apiKey, setApiKey] = useState(difyKnowledge?.apiKey ?? '');
  const [enabled, setEnabled] = useState(difyKnowledge?.enabled ?? false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [knowledges, setKnowledges] = useState<DifyKnowledge[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setApiHost(difyKnowledge?.apiHost ?? '');
    setApiKey(difyKnowledge?.apiKey ?? '');
    setEnabled(difyKnowledge?.enabled ?? false);
  }, [difyKnowledge]);

  const canSave = apiHost.trim() !== '' && apiKey.trim() !== '';

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveOk(false);
    try {
      await setDifyKnowledge({ apiHost: apiHost.trim(), apiKey: apiKey.trim(), enabled });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setKnowledges(null);
    try {
      const list = await window.api.settings.listDifyKnowledges();
      setKnowledges(list);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center border-b border-black/5 px-8 py-5">
        <div className="text-base font-medium text-ink">知识库</div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Config card */}
        <section className="rounded-xl border border-black/5 bg-surface-muted p-5 space-y-4">
          {/* Enable toggle */}
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm font-medium text-ink">启用知识库</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={
                'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ' +
                (enabled ? 'bg-accent' : 'bg-black/15')
              }
            >
              <span
                className={
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ' +
                  (enabled ? 'translate-x-4' : 'translate-x-0.5')
                }
              />
            </button>
          </label>

          {/* API Host */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-subtle">API Host</label>
            <input
              type="text"
              value={apiHost}
              onChange={(e) => setApiHost(e.target.value)}
              placeholder="https://api.dify.ai/v1"
              className="h-8 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-subtle">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="dataset-xxxxxxxxxxxxxxxx"
                className="h-8 w-full rounded-md border border-black/10 bg-surface px-3 pr-9 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                title={showKey ? '隐藏' : '显示'}
              >
                {showKey ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="rounded-md bg-accent px-4 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            {saveOk && <span className="text-xs text-green-600">已保存</span>}
          </div>
        </section>

        {/* Knowledge list card */}
        {enabled && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">知识库列表</span>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-xs text-ink hover:bg-surface-sunken disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <SpinnerIcon />
                    同步中…
                  </>
                ) : (
                  <>
                    <SyncIcon />
                    同步知识库
                  </>
                )}
              </button>
            </div>

            {syncError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {syncError}
              </div>
            )}

            {knowledges !== null && knowledges.length === 0 && (
              <p className="text-sm text-ink-subtle">未找到知识库</p>
            )}

            {knowledges !== null && knowledges.length > 0 && (
              <div className="rounded-xl border border-black/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-surface-muted">
                      <th className="px-4 py-2 text-left text-xs font-medium text-ink-subtle">名称</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-ink-subtle">ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-ink-subtle">描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {knowledges.map((k, i) => (
                      <tr
                        key={k.id}
                        className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-muted/50'}
                      >
                        <td className="px-4 py-2.5 font-medium text-ink">{k.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ink-subtle">{k.id}</td>
                        <td className="px-4 py-2.5 text-ink-subtle">{k.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l10 10M5.5 5.6A2 2 0 009.4 9.4M4.1 3.1C2.8 4 1.7 5.4 1 7c1.3 2.8 3.8 4 6 4a7 7 0 002.9-.6M7 3a6.6 6.6 0 016 4 7.7 7.7 0 01-.9 1.5" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2A5 5 0 112 6.5" />
      <path d="M2 2v3h3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="animate-spin">
      <path d="M6 1v2M6 9v2M1 6h2M9 6h2" opacity=".4" />
      <path d="M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4" opacity=".7" />
      <path d="M9.5 2.5L8.1 3.9M3.9 8.1L2.5 9.5" />
    </svg>
  );
}
