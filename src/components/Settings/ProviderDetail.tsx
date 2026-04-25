import { useEffect, useMemo, useState } from 'react';
import type { ProviderConfig, ProviderModel } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';

interface ProviderDetailProps {
  providerId: string | null;
}

export function ProviderDetail({ providerId }: ProviderDetailProps) {
  const provider = useSettingsStore((s) =>
    providerId ? s.providers.find((p) => p.id === providerId) : undefined,
  );

  if (!provider) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink-subtle">
        未选择提供商
      </div>
    );
  }

  return <ProviderDetailInner provider={provider} />;
}

function ProviderDetailInner({ provider }: { provider: ProviderConfig }) {
  const upsertProvider = useSettingsStore((s) => s.upsertProvider);
  const deleteProvider = useSettingsStore((s) => s.deleteProvider);

  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [apiKeyShown, setApiKeyShown] = useState(false);
  const [baseURL, setBaseURL] = useState(provider.baseURL);
  const [enabled, setEnabled] = useState(provider.enabled);
  const [newModelOpen, setNewModelOpen] = useState(false);

  useEffect(() => {
    setApiKey(provider.apiKey);
    setBaseURL(provider.baseURL);
    setEnabled(provider.enabled);
    setApiKeyShown(false);
  }, [provider.id, provider.apiKey, provider.baseURL, provider.enabled]);

  const persist = (patch: Partial<ProviderConfig>) => {
    void upsertProvider({ ...provider, ...patch });
  };

  const persistEnabled = (next: boolean) => {
    setEnabled(next);
    persist({ enabled: next });
  };

  const persistApiKey = () => {
    if (apiKey !== provider.apiKey) persist({ apiKey });
  };

  const persistBaseURL = () => {
    if (baseURL !== provider.baseURL) persist({ baseURL });
  };

  const resetBaseURL = () => {
    setBaseURL('');
    persist({ baseURL: '' });
  };

  const handleAddModel = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    if (provider.models.some((m) => m.id === trimmed)) return;
    persist({ models: [...provider.models, { id: trimmed }] });
  };

  const handleRemoveModel = (id: string) => {
    persist({ models: provider.models.filter((m) => m.id !== id) });
  };

  const handleDeleteProvider = () => {
    if (provider.builtin) return;
    if (!confirm(`确认删除 ${provider.name}？`)) return;
    void deleteProvider(provider.id);
  };

  const previewURL = buildPreviewURL(baseURL, provider.kind);

  const groupedModels = useMemo(() => groupModels(provider.models), [provider.models]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-black/5 pl-8 pr-14 py-5">
        <div className="flex items-center gap-2 text-base font-medium text-ink">
          <span>{provider.name}</span>
          <ExternalIcon />
        </div>
        <Toggle checked={enabled} onChange={persistEnabled} />
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <Section
          title="API 密钥"
          extra={
            <button
              type="button"
              className="text-ink-subtle hover:text-ink"
              title="高级设置"
            >
              <SettingsSmallIcon />
            </button>
          }
        >
          <div className="flex items-stretch gap-2">
            <div className="flex flex-1 items-center rounded-md border border-black/10 bg-surface focus-within:border-accent/40">
              <input
                type={apiKeyShown ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={persistApiKey}
                placeholder="在此输入 API 密钥"
                className="h-9 flex-1 bg-transparent px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setApiKeyShown((v) => !v)}
                className="px-2 text-ink-subtle hover:text-ink"
                title={apiKeyShown ? '隐藏' : '显示'}
              >
                {apiKeyShown ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <button
              type="button"
              className="h-9 rounded-md border border-black/10 px-4 text-sm text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
              title="检测"
            >
              检测
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <a className="text-accent hover:underline" href="#" onClick={(e) => e.preventDefault()}>
              点击这里获取密钥
            </a>
            <span className="text-ink-subtle">多个密钥使用逗号分隔</span>
          </div>
        </Section>

        <Section
          title="API 地址"
          titleSuffix={<HelpIcon />}
          extra={
            <button
              type="button"
              className="text-ink-subtle hover:text-ink"
              title="高级设置"
            >
              <SettingsSmallIcon />
            </button>
          }
        >
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              onBlur={persistBaseURL}
              placeholder="https://..."
              className="h-9 flex-1 rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={resetBaseURL}
              className="h-9 rounded-md border border-red-300 px-4 text-sm text-red-500 transition-colors hover:bg-red-50"
            >
              重置
            </button>
          </div>
          {previewURL && (
            <div className="mt-1.5 text-xs text-ink-subtle">
              预选：<span className="font-mono text-[11px]">{previewURL}</span>
            </div>
          )}
        </Section>

        <Section
          title={
            <span className="flex items-center gap-2">
              模型
              <span className="rounded-full bg-surface-sunken px-1.5 text-[10px] font-medium text-ink-muted">
                {provider.models.length}
              </span>
            </span>
          }
          extra={
            <button
              type="button"
              onClick={() => setNewModelOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs text-ink-muted hover:border-accent/40 hover:text-ink"
            >
              <PlusIcon />
              添加
            </button>
          }
        >
          <div className="space-y-3">
            {groupedModels.map((g) => (
              <div key={g.key} className="rounded-md border border-black/5 bg-surface">
                {g.label && (
                  <div className="flex items-center justify-between px-3 py-2 text-xs text-ink-muted">
                    <span className="font-medium">{g.label}</span>
                  </div>
                )}
                <ul className="divide-y divide-black/5">
                  {g.models.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink"
                    >
                      <span className="flex-1 truncate">{m.name ?? m.id}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveModel(m.id)}
                        className="text-ink-subtle hover:text-red-500"
                        title="移除"
                      >
                        <MinusIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {provider.models.length === 0 && (
              <div className="rounded-md border border-dashed border-black/10 px-4 py-6 text-center text-xs text-ink-subtle">
                暂无模型，点击右上角添加
              </div>
            )}
          </div>

          {newModelOpen && (
            <AddModelInline
              onCancel={() => setNewModelOpen(false)}
              onConfirm={(id) => {
                handleAddModel(id);
                setNewModelOpen(false);
              }}
            />
          )}
        </Section>

        {!provider.builtin && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteProvider}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
            >
              删除提供商
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: React.ReactNode;
  titleSuffix?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, titleSuffix, extra, children }: SectionProps) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm font-medium text-ink">
          <span>{title}</span>
          {titleSuffix && <span className="text-ink-subtle">{titleSuffix}</span>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors ' +
        (checked ? 'bg-emerald-500' : 'bg-black/15')
      }
    >
      <span
        className={
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' +
          (checked ? 'translate-x-[18px]' : 'translate-x-0.5')
        }
      />
    </button>
  );
}

function AddModelInline({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  const [id, setId] = useState('');
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-accent/30 bg-surface px-3 py-2">
      <input
        autoFocus
        type="text"
        value={id}
        onChange={(e) => setId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm(id);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="模型 ID"
        className="h-8 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onConfirm(id)}
        className="rounded-md bg-accent px-3 py-1 text-xs text-white hover:opacity-90"
      >
        添加
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-black/10 px-3 py-1 text-xs text-ink-muted hover:text-ink"
      >
        取消
      </button>
    </div>
  );
}

interface Group {
  key: string;
  label: string | null;
  models: ProviderModel[];
}

function groupModels(models: ProviderModel[]): Group[] {
  const ungrouped: ProviderModel[] = [];
  const byGroup = new Map<string, ProviderModel[]>();
  for (const m of models) {
    if (m.group) {
      const arr = byGroup.get(m.group) ?? [];
      arr.push(m);
      byGroup.set(m.group, arr);
    } else {
      ungrouped.push(m);
    }
  }
  const out: Group[] = [];
  for (const [label, arr] of byGroup) out.push({ key: label, label, models: arr });
  if (ungrouped.length > 0) out.push({ key: '__ungrouped__', label: null, models: ungrouped });
  return out;
}

function buildPreviewURL(baseURL: string, kind: 'openai' | 'anthropic'): string {
  const b = baseURL.trim().replace(/\/$/, '');
  if (!b) return '';
  return kind === 'anthropic' ? `${b}/messages` : `${b}/chat/completions`;
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l12 12M6.5 4.5C9.5 3.5 13 5 14.5 8c-.5 1-1.3 1.9-2.3 2.6M9.5 11.5C6.5 12.5 3 11 1.5 8c.5-1 1.3-1.9 2.3-2.6" />
      <path d="M6.3 6.3a2 2 0 002.8 2.8" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2H2v8h8V8" />
      <path d="M7 2h3v3M5 7l5-5" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M4.8 4.8a1.2 1.2 0 012.4.2c0 .8-1 1-1 1.8M6 8.5v.1" />
    </svg>
  );
}

function SettingsSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3 3l1.5 1.5M9.5 9.5L11 11M3 11l1.5-1.5M9.5 4.5L11 3" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 1v8M1 5h8" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 6h8" />
    </svg>
  );
}
