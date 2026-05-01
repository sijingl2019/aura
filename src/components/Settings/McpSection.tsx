import { useState } from 'react';
import type { McpMarketItem, McpServerConfig } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';

// ── Static marketplace catalogue ─────────────────────────────────────────────

const MARKET_ITEMS: McpMarketItem[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: '读写本地文件和目录，支持递归列目录、创建/移动/删除文件。',
    tags: ['官方', '文件'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '管理 GitHub 仓库、Issue、PR，执行搜索和文件操作。需要 GITHUB_PERSONAL_ACCESS_TOKEN。',
    tags: ['官方', 'Git'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: '通过 Brave Search API 进行网页和本地搜索。需要 BRAVE_API_KEY。',
    tags: ['官方', '搜索'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: '抓取 URL 内容并转换为 Markdown，适合阅读网页、文档。',
    tags: ['官方', '网络'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: '查询和操作本地 SQLite 数据库，支持运行 SQL 和探索 Schema。',
    tags: ['官方', '数据库'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '/path/to/db.sqlite'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: '只读连接 PostgreSQL，查询数据和浏览 Schema。',
    tags: ['官方', '数据库'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:pass@host/db'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: '用 Puppeteer 控制浏览器，支持截图、点击、填表单等自动化。',
    tags: ['官方', '浏览器'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
  },
  {
    id: 'memory',
    name: 'Memory',
    description: '基于知识图谱的持久记忆，存储和检索实体与关系。',
    tags: ['官方', '记忆'],
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
  },
];

// ── Built-in servers (always present in main, shown read-only) ────────────────

const BUILTIN_SERVERS: McpServerConfig[] = [
  {
    id: 'builtin',
    name: '内置测试工具',
    description: '随应用内置的测试 MCP 工具（test_mcp），验证 MCP 管道是否正常。',
    enabled: true,
    builtin: true,
    type: 'builtin',
  },
  {
    id: 'dify-knowledge',
    name: 'Dify 知识库',
    description: '连接 Dify 知识库，为对话提供 RAG 检索能力。需在「知识库」配置中启用。',
    enabled: true,
    builtin: true,
    type: 'builtin',
  },
];

// ── Add / Edit dialog ─────────────────────────────────────────────────────────

interface EditDialogProps {
  initial?: McpServerConfig;
  onSave: (s: McpServerConfig) => void;
  onClose: () => void;
}

function EditDialog({ initial, onSave, onClose }: EditDialogProps) {
  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<'stdio' | 'sse'>(
    (initial?.type === 'stdio' || initial?.type === 'sse') ? initial.type : 'stdio',
  );
  const [command, setCommand] = useState(initial?.command ?? '');
  const [args, setArgs] = useState((initial?.args ?? []).join(' '));
  const [url, setUrl] = useState(initial?.url ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const canSave = name.trim().length > 0 && (type === 'stdio' ? command.trim().length > 0 : url.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    const id = initial?.id ?? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    onSave({
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      enabled,
      builtin: false,
      type,
      command: type === 'stdio' ? command.trim() : undefined,
      args: type === 'stdio' ? args.split(/\s+/).filter(Boolean) : undefined,
      url: type === 'sse' ? url.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-sm font-semibold text-ink">{isNew ? '添加 MCP 服务' : '编辑 MCP 服务'}</h2>

        <Field label="名称">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My MCP Server"
            className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
          />
        </Field>

        <Field label="描述（可选）">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简短描述此服务的功能"
            className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
          />
        </Field>

        <Field label="类型">
          <select
            aria-label="类型"
            value={type}
            onChange={(e) => setType(e.target.value as 'stdio' | 'sse')}
            className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
          >
            <option value="stdio">STDIO（本地进程）</option>
            <option value="sse">SSE（HTTP 端点）</option>
          </select>
        </Field>

        {type === 'stdio' ? (
          <>
            <Field label="命令">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx"
                className="input-base font-mono"
              />
            </Field>
            <Field label="参数（空格分隔）">
              <input
                type="text"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-filesystem /path"
                className="input-base font-mono"
              />
            </Field>
          </>
        ) : (
          <Field label="SSE URL">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000/sse"
              className="input-base font-mono"
            />
          </Field>
        )}

        <div className="mb-4 flex items-center gap-2">
          <input
            id="mcp-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-accent"
          />
          <label htmlFor="mcp-enabled" className="text-xs text-ink-muted">启用</label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 rounded-md border border-black/10 px-4 text-sm text-ink-muted hover:text-ink">
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="h-8 rounded-md bg-accent px-4 text-sm text-white hover:opacity-90 disabled:opacity-40"
          >
            保存
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

// ── Main section ──────────────────────────────────────────────────────────────

export function McpSection() {
  const mcpServers = useSettingsStore((s) => s.mcpServers);
  const upsertMcpServer = useSettingsStore((s) => s.upsertMcpServer);
  const deleteMcpServer = useSettingsStore((s) => s.deleteMcpServer);

  const [editTarget, setEditTarget] = useState<McpServerConfig | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [marketSearch, setMarketSearch] = useState('');

  const userServers = mcpServers.filter((s) => !s.builtin);

  const installedIds = new Set(mcpServers.map((s) => s.id));

  const filteredMarket = marketSearch
    ? MARKET_ITEMS.filter(
        (item) =>
          item.name.toLowerCase().includes(marketSearch.toLowerCase()) ||
          item.description.includes(marketSearch) ||
          item.tags.some((t) => t.includes(marketSearch)),
      )
    : MARKET_ITEMS;

  const handleToggle = async (server: McpServerConfig) => {
    await upsertMcpServer({ ...server, enabled: !server.enabled });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除 MCP 服务「${name}」吗？`)) return;
    await deleteMcpServer(id);
  };

  const handleInstall = (item: McpMarketItem) => {
    const prefill: McpServerConfig = {
      id: item.id,
      name: item.name,
      description: item.description,
      enabled: true,
      builtin: false,
      type: item.type,
      command: item.command,
      args: item.args,
      url: item.url,
    };
    setEditTarget(prefill);
  };

  const handleSave = async (server: McpServerConfig) => {
    await upsertMcpServer(server);
    setEditTarget(null);
    setShowAddDialog(false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">

        {/* ── System / configured servers ─────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">已安装 MCP 服务</h3>
            <button
              type="button"
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs text-white hover:opacity-90"
            >
              <span>+</span>
              <span>自定义</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {/* Built-in (read-only) */}
            {BUILTIN_SERVERS.map((s) => (
              <ServerCard
                key={s.id}
                server={s}
                readonly
              />
            ))}

            {/* User-configured */}
            {userServers.length === 0 && (
              <p className="py-3 text-center text-xs text-ink-subtle">
                暂无自定义 MCP 服务，从下方仓库安装或点击「自定义」添加。
              </p>
            )}
            {userServers.map((s) => (
              <ServerCard
                key={s.id}
                server={s}
                onToggle={() => handleToggle(s)}
                onEdit={() => setEditTarget(s)}
                onDelete={() => handleDelete(s.id, s.name)}
              />
            ))}
          </div>
        </section>

        {/* ── Marketplace ─────────────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">MCP 仓库</h3>
            <input
              type="text"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder="搜索…"
              className="h-7 w-40 rounded-md border border-black/10 bg-surface px-2 text-xs text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            {filteredMarket.map((item) => {
              const installed = installedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-black/5 bg-surface p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-base">
                    {mcpTypeEmoji(item.tags)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{item.name}</span>
                      {item.tags.map((t) => (
                        <span key={t} className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-subtle">{t}</span>
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{item.description}</p>
                    <code className="mt-1 block truncate text-[10px] text-ink-subtle">
                      {item.command} {(item.args ?? []).join(' ')}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => !installed && handleInstall(item)}
                    disabled={installed}
                    className={`shrink-0 rounded-md px-3 py-1 text-xs transition-colors ${
                      installed
                        ? 'border border-black/10 text-ink-subtle cursor-default'
                        : 'bg-accent/10 text-accent hover:bg-accent/20'
                    }`}
                  >
                    {installed ? '已安装' : '安装'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Dialogs */}
      {(showAddDialog && !editTarget) && (
        <EditDialog
          onSave={handleSave}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {editTarget && (
        <EditDialog
          initial={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// ── Server card ───────────────────────────────────────────────────────────────

function ServerCard({
  server,
  readonly,
  onToggle,
  onEdit,
  onDelete,
}: {
  server: McpServerConfig;
  readonly?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/5 bg-surface px-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-sm">
        {server.type === 'builtin' ? '⚙️' : server.type === 'sse' ? '🌐' : '📦'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-ink">{server.name}</span>
          {server.builtin && (
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-subtle">内置</span>
          )}
          <span className={`h-1.5 w-1.5 rounded-full ${server.enabled ? 'bg-green-500' : 'bg-ink-subtle/40'}`} />
        </div>
        {server.description && (
          <p className="text-xs text-ink-muted">{server.description}</p>
        )}
        {server.type === 'stdio' && server.command && (
          <code className="text-[10px] text-ink-subtle">{server.command} {(server.args ?? []).join(' ')}</code>
        )}
        {server.type === 'sse' && server.url && (
          <code className="text-[10px] text-ink-subtle">{server.url}</code>
        )}
      </div>
      {!readonly && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            title={server.enabled ? '禁用' : '启用'}
            className={`h-5 w-9 rounded-full transition-colors ${server.enabled ? 'bg-accent' : 'bg-ink-subtle/30'}`}
          >
            <span className={`block h-4 w-4 translate-y-0 rounded-full bg-white shadow transition-transform ${server.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="ml-1 rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
            title="编辑"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-ink-subtle hover:bg-red-500/10 hover:text-red-500"
            title="删除"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function mcpTypeEmoji(tags: string[]): string {
  if (tags.includes('数据库')) return '🗄️';
  if (tags.includes('搜索')) return '🔍';
  if (tags.includes('文件')) return '📁';
  if (tags.includes('Git')) return '🐙';
  if (tags.includes('浏览器')) return '🌐';
  if (tags.includes('记忆')) return '🧠';
  if (tags.includes('网络')) return '📡';
  return '📦';
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2l2 2-7 7H2v-2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h9M5 4V2.5h3V4M4.5 4l.5 6h3l.5-6" />
    </svg>
  );
}

