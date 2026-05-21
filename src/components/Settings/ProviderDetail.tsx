import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProviderConfig, ProviderModel } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  const isSuccess = toast.type === 'success';
  return (
    <div
      className={
        'fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ' +
        (isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800')
      }
    >
      <span className="text-base">{isSuccess ? '✓' : '✕'}</span>
      <span className="text-sm font-medium">{toast.message}</span>
      <button type="button" onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">
        <CloseIcon />
      </button>
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onCancel} />
      <div className="relative w-72 rounded-xl border border-black/8 bg-white shadow-xl">
        <div className="px-5 py-4">
          <p className="text-sm text-ink">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-black/5 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-black/10 px-4 py-1.5 text-sm text-ink-muted hover:border-black/20 hover:text-ink"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [detecting, setDetecting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingModelIdValue, setEditingModelIdValue] = useState('');
  const [editingModelDisplayName, setEditingModelDisplayName] = useState('');

  // name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(provider.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(provider.apiKey);
    setBaseURL(provider.baseURL);
    setEnabled(provider.enabled);
    setApiKeyShown(false);
    setNameValue(provider.name);
    setEditingName(false);
  }, [provider.id, provider.apiKey, provider.baseURL, provider.enabled, provider.name]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

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

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== provider.name) persist({ name: trimmed });
    else setNameValue(provider.name);
    setEditingName(false);
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await window.api.settings.detectProvider({
        kind: provider.kind,
        apiKey,
        baseURL: baseURL || provider.baseURL,
      });
      setToast({ message: result.message, type: 'success' });
    } catch (error) {
      setToast({ message: `检测失败: ${(error as Error).message}`, type: 'error' });
    } finally {
      setDetecting(false);
    }
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

  const startEditingModel = (m: ProviderModel) => {
    setEditingModelId(m.id);
    setEditingModelIdValue(m.id);
    setEditingModelDisplayName(m.name ?? '');
  };

  const commitModelEdit = (originalId: string) => {
    const newId = editingModelIdValue.trim();
    if (!newId) { setEditingModelId(null); return; }
    const newName = editingModelDisplayName.trim();
    persist({
      models: provider.models.map((m) =>
        m.id === originalId
          ? { ...m, id: newId, name: newName && newName !== newId ? newName : undefined }
          : m,
      ),
    });
    setEditingModelId(null);
  };

  const handleDeleteProvider = () => {
    if (provider.builtin) return;
    setConfirmDelete(true);
  };

  const previewURL = buildPreviewURL(baseURL, provider.kind);

  const groupedModels = useMemo(() => groupModels(provider.models), [provider.models]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      {confirmDelete && (
        <ConfirmDialog
          message={`确认删除 ${provider.name}？`}
          onConfirm={() => { setConfirmDelete(false); void deleteProvider(provider.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <header className="flex items-center justify-between border-b border-black/5 pl-8 pr-14 py-5">
        <div className="flex items-center gap-2 text-base font-medium text-ink">
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') { setNameValue(provider.name); setEditingName(false); }
              }}
              className="h-7 rounded border border-accent/40 bg-transparent px-2 text-base font-medium text-ink focus:outline-none"
            />
          ) : (
            <span>{provider.name}</span>
          )}
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="text-ink-subtle transition-colors hover:text-ink"
            title="编辑名称"
          >
            <EditIcon />
          </button>
        </div>
        <Toggle checked={enabled} onChange={persistEnabled} />
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <Section
          title="API 密钥"
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
              onClick={handleDetect}
              disabled={detecting}
              className="h-9 rounded-md border border-black/10 px-4 text-sm text-ink-muted transition-colors hover:border-accent/40 hover:text-ink disabled:opacity-50"
              title="检测"
            >
              {detecting ? '检测中...' : '检测'}
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

        {provider.kind === 'anthropic' && (
          <Section title="提示缓存">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-ink-subtle">
                在系统提示与近期消息上启用 Anthropic cache_control 断点，可显著降低重复前缀的 token 费用。官方 Anthropic 端点默认开启；多数第三方兼容端点不支持，开启可能报错。
              </span>
              <Toggle
                checked={provider.promptCaching ?? provider.baseURL.includes('api.anthropic.com')}
                onChange={(v) => persist({ promptCaching: v })}
              />
            </div>
          </Section>
        )}

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
                      className="group flex items-center gap-2 px-3 py-2 text-sm text-ink"
                    >
                      {editingModelId === m.id ? (
                        <div
                          className="flex flex-1 flex-col gap-1 py-0.5"
                          onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              commitModelEdit(m.id);
                            }
                          }}
                        >
                          <input
                            autoFocus
                            type="text"
                            value={editingModelIdValue}
                            onChange={(e) => setEditingModelIdValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitModelEdit(m.id);
                              if (e.key === 'Escape') setEditingModelId(null);
                            }}
                            placeholder="模型 ID"
                            className="h-6 rounded border border-accent/40 bg-transparent px-1.5 text-xs text-ink placeholder:text-ink-subtle focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editingModelDisplayName}
                            onChange={(e) => setEditingModelDisplayName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitModelEdit(m.id);
                              if (e.key === 'Escape') setEditingModelId(null);
                            }}
                            placeholder="显示名称（可选）"
                            className="h-6 rounded border border-black/10 bg-transparent px-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 truncate">{m.name ?? m.id}</span>
                          {m.name && m.name !== m.id && (
                            <span className="truncate text-xs text-ink-subtle">{m.id}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditingModel(m)}
                            className="opacity-0 group-hover:opacity-100 text-ink-subtle hover:text-ink transition-opacity"
                            title="重命名"
                          >
                            <EditIcon />
                          </button>
                        </>
                      )}
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

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2l2 2L4 11H2V9L9 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 2l8 8M10 2l-8 8" />
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
