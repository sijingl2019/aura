import { useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import type { WebSearchConfig, WebSearchProvider } from '@shared/types';

const PROVIDERS: { value: WebSearchProvider; label: string; keyLabel: string; href: string }[] = [
  {
    value: 'tavily',
    label: 'Tavily',
    keyLabel: 'tvly-...',
    href: 'https://app.tavily.com/home',
  },
  {
    value: 'serper',
    label: 'Serper (Google)',
    keyLabel: 'serper API key',
    href: 'https://serper.dev/api-key',
  },
];

export function WebSearchSection() {
  const webSearch = useSettingsStore((s) => s.webSearch);
  const setWebSearch = useSettingsStore((s) => s.setWebSearch);

  const [provider, setProvider] = useState<WebSearchProvider>(webSearch?.provider ?? 'tavily');
  const [apiKey, setApiKey] = useState(webSearch?.apiKey ?? '');
  const [enabled, setEnabled] = useState(webSearch?.enabled ?? false);
  const [keyShown, setKeyShown] = useState(false);
  const [saving, setSaving] = useState(false);

  const persist = async (patch: Partial<WebSearchConfig>) => {
    setSaving(true);
    try {
      const next: WebSearchConfig = {
        enabled,
        provider,
        apiKey,
        ...patch,
      };
      await setWebSearch(next.apiKey.trim() ? next : null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (v: boolean) => {
    setEnabled(v);
    void persist({ enabled: v });
  };

  const handleProviderChange = (v: WebSearchProvider) => {
    setProvider(v);
    void persist({ provider: v });
  };

  const providerInfo = PROVIDERS.find((p) => p.value === provider)!;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-ink">网络搜索</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            为 AI 提供实时网络搜索能力（web_search 工具）
          </p>
        </div>
        <Toggle checked={enabled} onChange={handleToggle} disabled={saving} />
      </div>

      <Section title="搜索引擎">
        <div className="flex gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handleProviderChange(p.value)}
              className={
                'flex-1 rounded-md border px-3 py-2 text-sm transition-colors ' +
                (provider === p.value
                  ? 'border-accent/40 bg-accent/5 text-ink'
                  : 'border-black/10 text-ink-muted hover:border-black/20 hover:text-ink')
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="API 密钥">
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-md border border-black/10 bg-surface focus-within:border-accent/40">
            <input
              type={keyShown ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={() => void persist({})}
              placeholder={providerInfo.keyLabel}
              className="h-9 flex-1 bg-transparent px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setKeyShown((v) => !v)}
              className="px-2 text-ink-subtle hover:text-ink"
              title={keyShown ? '隐藏' : '显示'}
            >
              {keyShown ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
        <div className="mt-1.5 text-xs text-ink-subtle">
          <a
            className="text-accent hover:underline"
            href={providerInfo.href}
            onClick={(e) => {
              e.preventDefault();
              window.api.window.openExternal(providerInfo.href).catch(() => {});
            }}
          >
            点击这里获取 {providerInfo.label} 密钥
          </a>
        </div>
      </Section>

      <Section title="说明">
        <div className="space-y-1.5 rounded-md border border-black/5 bg-surface-muted p-3 text-xs text-ink-subtle">
          <p>启用后，AI 可通过 <code className="rounded bg-surface px-1 text-ink">web_search</code> 工具搜索网页获取最新信息。</p>
          <p>
            <span className="font-medium text-ink">Tavily</span> 专为 AI 设计，结果简洁，推荐使用。免费计划每月 1000 次。
          </p>
          <p>
            <span className="font-medium text-ink">Serper</span> 使用 Google 搜索，结果更全面。免费计划每月 2500 次。
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 text-sm font-medium text-ink">{title}</div>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ' +
        (checked ? 'bg-accent' : 'bg-black/15')
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
