import { useEffect, useRef, useState } from 'react';
import type { ProviderKind } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';

interface AddProviderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function AddProviderDialog({ open, onClose, onCreated }: AddProviderDialogProps) {
  const upsertProvider = useSettingsStore((s) => s.upsertProvider);
  const providers = useSettingsStore((s) => s.providers);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProviderKind>('openai');
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const iconMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setKind('openai');
      setIcon(undefined);
      setIconMenuOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!iconMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!iconMenuRef.current) return;
      if (iconMenuRef.current.contains(e.target as Node)) return;
      setIconMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [iconMenuOpen]);

  if (!open) return null;

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0;
  const letter = (trimmedName || 'P').charAt(0).toUpperCase();

  const handleImageUpload = () => {
    fileRef.current?.click();
    setIconMenuOpen(false);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setIcon(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleBuiltinIcon = () => {
    setIcon(undefined);
    setIconMenuOpen(false);
  };

  const handleReset = () => {
    setIcon(undefined);
    setIconMenuOpen(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    const id = uniqueId(trimmedName, providers.map((p) => p.id));
    await upsertProvider({
      id,
      name: trimmedName,
      kind,
      enabled: false,
      apiKey: '',
      baseURL: '',
      icon,
      iconBg: pickColor(id),
      models: [],
    });
    onCreated?.(id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[380px] rounded-xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-ink">添加提供商</h2>

        <div className="relative mb-5 flex justify-center">
          <button
            type="button"
            onClick={() => setIconMenuOpen((v) => !v)}
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-ink-subtle to-ink-muted text-2xl font-semibold text-white"
          >
            {icon ? (
              <img src={icon} alt="icon" className="h-full w-full object-cover" />
            ) : (
              letter
            )}
          </button>
          {iconMenuOpen && (
            <div
              ref={iconMenuRef}
              className="absolute left-1/2 top-20 z-10 w-[120px] -translate-x-1/2 rounded-md border border-black/10 bg-surface py-1 shadow-lg"
            >
              <IconMenuItem label="图片上传" onClick={handleImageUpload} />
              <IconMenuItem label="内置头像" onClick={handleBuiltinIcon} />
              <IconMenuItem label="重置头像" onClick={handleReset} />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.currentTarget.value = '';
            }}
          />
        </div>

        <Field label="提供商名称">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 OpenAI"
            className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
          />
        </Field>

        <Field label="提供商类型">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProviderKind)}
            className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink focus:border-accent/40 focus:outline-none"
          >
            <option value="openai">OPENAI</option>
            <option value="anthropic">ANTHROPIC</option>
          </select>
        </Field>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-black/10 px-4 text-sm text-ink-muted hover:text-ink"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="h-8 rounded-md bg-accent px-4 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function IconMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
    >
      {label}
    </button>
  );
}

function uniqueId(name: string, taken: string[]): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'provider';
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function pickColor(seed: string): string {
  const palette = ['#ef4444', '#2563eb', '#7c3aed', '#0f172a', '#059669', '#f59e0b', '#db2777'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
