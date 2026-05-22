import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import type { GatewayConfig, GatewayPlatform, GatewayRuntimeStatus } from '@shared/types';

const PLATFORMS: { value: GatewayPlatform; label: string; idLabel: string; secretLabel: string; help: string }[] = [
  {
    value: 'lark',
    label: '飞书 / Lark',
    idLabel: 'App ID',
    secretLabel: 'App Secret',
    help: '在飞书开放平台创建企业自建应用，开启「长连接」事件订阅，订阅 im.message.receive_v1 事件，并授予发送消息权限。',
  },
  {
    value: 'dingtalk',
    label: '钉钉 / DingTalk',
    idLabel: 'ClientId (AppKey)',
    secretLabel: 'ClientSecret (AppSecret)',
    help: '在钉钉开放平台创建企业内部应用，使用 Stream 模式接收机器人消息（无需公网回调地址）。',
  },
];

function newGateway(): GatewayConfig {
  return {
    id: crypto.randomUUID(),
    platform: 'lark',
    name: '新网关',
    enabled: false,
    appId: '',
    appSecret: '',
    allowedUserIds: [],
    allowDangerousTools: false,
  };
}

export function GatewaySection() {
  const gateways = useSettingsStore((s) => s.gateways);
  const loadGateways = useSettingsStore((s) => s.loadGateways);
  const applyGatewayStatus = useSettingsStore((s) => s.applyGatewayStatus);

  const [editing, setEditing] = useState<GatewayConfig | null>(null);

  useEffect(() => {
    void loadGateways();
    const off = window.api.gateway.onStatus((status) => applyGatewayStatus(status));
    return off;
  }, [loadGateways, applyGatewayStatus]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-ink">多平台网关</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            将飞书 / 钉钉等 IM 平台的消息桥接到本地 AI（通过长连接，无需公网地址）
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(newGateway())}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-90"
        >
          添加网关
        </button>
      </div>

      {gateways.length === 0 && !editing && (
        <div className="rounded-md border border-dashed border-black/10 p-8 text-center text-sm text-ink-subtle">
          还没有配置任何网关。点击右上角「添加网关」开始接入飞书或钉钉。
        </div>
      )}

      <div className="space-y-3">
        {gateways.map((g) => (
          <GatewayCard
            key={g.config.id}
            config={g.config}
            status={g.status}
            onEdit={() => setEditing(g.config)}
          />
        ))}
      </div>

      {editing && (
        <GatewayEditor
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const STATUS_META: Record<GatewayRuntimeStatus['status'], { label: string; color: string }> = {
  connected: { label: '已连接', color: 'bg-green-500' },
  connecting: { label: '连接中', color: 'bg-amber-500' },
  error: { label: '错误', color: 'bg-red-500' },
  stopped: { label: '已停止', color: 'bg-black/25' },
};

function GatewayCard({
  config,
  status,
  onEdit,
}: {
  config: GatewayConfig;
  status: GatewayRuntimeStatus;
  onEdit: () => void;
}) {
  const startGateway = useSettingsStore((s) => s.startGateway);
  const stopGateway = useSettingsStore((s) => s.stopGateway);
  const meta = STATUS_META[status.status];
  const platform = PLATFORMS.find((p) => p.value === config.platform);
  const running = status.status === 'connected' || status.status === 'connecting';

  return (
    <div className="rounded-lg border border-black/10 bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.color}`} />
          <div>
            <div className="text-sm font-medium text-ink">{config.name}</div>
            <div className="text-xs text-ink-subtle">
              {platform?.label} · {meta.label}
              {status.detail ? ` · ${status.detail}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <button
              type="button"
              onClick={() => void stopGateway(config.id)}
              className="rounded-md border border-black/10 px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
            >
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startGateway(config.id)}
              className="rounded-md border border-black/10 px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
            >
              启动
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-black/10 px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
          >
            编辑
          </button>
        </div>
      </div>
    </div>
  );
}

function GatewayEditor({ initial, onClose }: { initial: GatewayConfig; onClose: () => void }) {
  const upsertGateway = useSettingsStore((s) => s.upsertGateway);
  const deleteGateway = useSettingsStore((s) => s.deleteGateway);

  const [draft, setDraft] = useState<GatewayConfig>(initial);
  const [secretShown, setSecretShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usersText, setUsersText] = useState(initial.allowedUserIds.join('\n'));

  const platform = PLATFORMS.find((p) => p.value === draft.platform)!;
  const patch = (p: Partial<GatewayConfig>) => setDraft((d) => ({ ...d, ...p }));

  const save = async () => {
    setSaving(true);
    try {
      const allowedUserIds = usersText
        .split(/[\n,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await upsertGateway({ ...draft, allowedUserIds });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`确定删除网关「${draft.name}」？`)) return;
    await deleteGateway(draft.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="max-h-[80vh] w-[480px] overflow-y-auto rounded-xl bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-medium text-ink">网关配置</h3>

        <Field label="平台">
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => patch({ platform: p.value })}
                className={
                  'flex-1 rounded-md border px-3 py-2 text-sm transition-colors ' +
                  (draft.platform === p.value
                    ? 'border-accent/40 bg-accent/5 text-ink'
                    : 'border-black/10 text-ink-muted hover:text-ink')
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="名称">
          <input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink focus:border-accent/40 focus:outline-none"
          />
        </Field>

        <Field label={platform.idLabel}>
          <input
            value={draft.appId}
            onChange={(e) => patch({ appId: e.target.value })}
            className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink focus:border-accent/40 focus:outline-none"
          />
        </Field>

        <Field label={platform.secretLabel}>
          <div className="flex items-center rounded-md border border-black/10 bg-surface focus-within:border-accent/40">
            <input
              type={secretShown ? 'text' : 'password'}
              value={draft.appSecret}
              onChange={(e) => patch({ appSecret: e.target.value })}
              className="h-9 flex-1 bg-transparent px-3 text-sm text-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSecretShown((v) => !v)}
              className="px-2 text-xs text-ink-subtle hover:text-ink"
            >
              {secretShown ? '隐藏' : '显示'}
            </button>
          </div>
        </Field>

        <Field label="允许的用户 ID（白名单，每行一个）">
          <textarea
            value={usersText}
            onChange={(e) => setUsersText(e.target.value)}
            rows={3}
            placeholder={draft.platform === 'lark' ? 'open_id 或 user_id' : 'senderStaffId'}
            className="w-full rounded-md border border-black/10 bg-surface p-2 text-sm text-ink focus:border-accent/40 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-subtle">留空表示拒绝所有人（安全默认）。只有列表中的用户能触发 AI。</p>
        </Field>

        <label className="mb-3 flex items-center justify-between rounded-md border border-black/5 bg-surface-muted px-3 py-2">
          <div>
            <div className="text-sm text-ink">允许危险工具</div>
            <div className="text-xs text-ink-subtle">开启后远程用户可驱动 exec_shell / write_file（有本机风险）</div>
          </div>
          <Toggle checked={!!draft.allowDangerousTools} onChange={(v) => patch({ allowDangerousTools: v })} />
        </label>

        <label className="mb-4 flex items-center justify-between rounded-md border border-black/5 bg-surface-muted px-3 py-2">
          <div className="text-sm text-ink">启用（保存后自动连接）</div>
          <Toggle checked={draft.enabled} onChange={(v) => patch({ enabled: v })} />
        </label>

        <div className="rounded-md border border-black/5 bg-surface-muted p-3 text-xs text-ink-subtle">
          {platform.help}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void remove()}
            className="text-xs text-red-500 hover:underline"
          >
            删除
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-black/10 px-4 py-1.5 text-sm text-ink-muted hover:text-ink"
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-md bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-ink-muted">{label}</div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' +
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
