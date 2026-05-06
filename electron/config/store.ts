import type {
  AppSettings,
  DefaultModelRef,
  DifyKnowledgeConfig,
  GeneralConfig,
  McpServerConfig,
  ProviderConfig,
  ProviderConfigInput,
  SelectionAction,
  SelectionToolbarConfig,
  ShortcutDef,
} from '@shared/types';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { defaultProviders } from './defaults';
import { DEFAULT_SHORTCUTS } from './hardcoded';

export const DEFAULT_GENERAL_CONFIG: GeneralConfig = {
  language: 'zh-CN',
  proxyMode: 'system',
  spellCheck: false,
  launchAtStartup: false,
  minimizeToTrayOnStartup: false,
  theme: 'system',
  accentColor: '#d97757',
  transparentWindow: false,
  showTrayIcon: true,
  minimizeToTrayOnClose: true,
};

const FILE_NAME = 'settings.json';

const DEFAULT_SELECTION_ACTIONS: SelectionAction[] = [
  { id: 'translate', label: '翻译', enabled: true, order: 0 },
  { id: 'explain', label: '解释', enabled: true, order: 1 },
  { id: 'summarize', label: '总结', enabled: true, order: 2 },
  { id: 'search', label: '搜索', enabled: true, order: 3 },
  { id: 'copy', label: '复制', enabled: true, order: 4 },
];

export const DEFAULT_SELECTION_TOOLBAR: SelectionToolbarConfig = {
  enabled: true,
  compact: false,
  opacity: 100,
  actions: DEFAULT_SELECTION_ACTIONS,
  searchEngine: 'google',
};

let cached: AppSettings | null = null;

function filePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function load(): AppSettings {
  if (cached) return cached;

  const p = filePath();
  if (!fs.existsSync(p)) {
    cached = { providers: defaultProviders() };
    save(cached);
    return cached;
  }

  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as AppSettings;
    cached = mergeBuiltins(parsed);
    return cached;
  } catch (e) {
    console.warn(`[settings] failed to parse ${p}: ${(e as Error).message}`);
    cached = { providers: defaultProviders() };
    return cached;
  }
}

function mergeBuiltins(settings: AppSettings): AppSettings {
  const builtins = defaultProviders();
  const existing = new Map(settings.providers.map((p) => [p.id, p]));

  for (const b of builtins) {
    if (!existing.has(b.id)) {
      existing.set(b.id, b);
    } else {
      const cur = existing.get(b.id)!;
      existing.set(b.id, { ...cur, builtin: true });
    }
  }

  const providers = Array.from(existing.values()).sort((a, b) => a.order - b.order);
  return {
    providers,
    defaultModel: settings.defaultModel,
    difyKnowledge: settings.difyKnowledge,
    selectionToolbar: { ...DEFAULT_SELECTION_TOOLBAR, ...(settings.selectionToolbar ?? {}) },
    shortcutsOverrides: settings.shortcutsOverrides,
  };
}

function save(settings: AppSettings): void {
  const p = filePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf8');
}

export function getSettings(): AppSettings {
  return load();
}

export function upsertProvider(input: ProviderConfigInput): AppSettings {
  const current = load();
  const idx = current.providers.findIndex((p) => p.id === input.id);

  if (idx >= 0) {
    const prev = current.providers[idx];
    const next: ProviderConfig = {
      ...prev,
      ...input,
      builtin: prev.builtin,
      order: prev.order,
    };
    current.providers[idx] = next;
  } else {
    const maxOrder = current.providers.reduce((m, p) => Math.max(m, p.order), -1);
    const next: ProviderConfig = {
      builtin: false,
      order: maxOrder + 1,
      ...input,
    } as ProviderConfig;
    current.providers.push(next);
  }

  save(current);
  return current;
}

export function deleteProvider(id: string): AppSettings {
  const current = load();
  const target = current.providers.find((p) => p.id === id);
  if (!target || target.builtin) return current;

  current.providers = current.providers.filter((p) => p.id !== id);
  if (current.defaultModel?.providerId === id) current.defaultModel = undefined;
  save(current);
  return current;
}

export function setDefaultModel(ref: DefaultModelRef | null): AppSettings {
  const current = load();
  if (ref === null) {
    current.defaultModel = undefined;
    save(current);
    return current;
  }
  const provider = current.providers.find((p) => p.id === ref.providerId);
  if (!provider) {
    console.warn(`[settings] setDefaultModel: unknown provider ${ref.providerId}`);
    return current;
  }
  if (!provider.models.some((m) => m.id === ref.modelId)) {
    console.warn(
      `[settings] setDefaultModel: model ${ref.modelId} not found on provider ${ref.providerId}`,
    );
    return current;
  }
  current.defaultModel = { providerId: ref.providerId, modelId: ref.modelId };
  save(current);
  return current;
}

export function reorderProviders(ids: string[]): AppSettings {
  const current = load();
  const byId = new Map(current.providers.map((p) => [p.id, p]));
  let order = 0;
  const reordered: ProviderConfig[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) {
      reordered.push({ ...p, order: order++ });
      byId.delete(id);
    }
  }
  for (const p of byId.values()) {
    reordered.push({ ...p, order: order++ });
  }
  current.providers = reordered;
  save(current);
  return current;
}

export function resolveProvider(id: string): ProviderConfig | undefined {
  return load().providers.find((p) => p.id === id);
}

export function getDifyKnowledge(): DifyKnowledgeConfig | null {
  return load().difyKnowledge ?? null;
}

export function setDifyKnowledge(config: DifyKnowledgeConfig | null): AppSettings {
  const current = load();
  current.difyKnowledge = config ?? undefined;
  save(current);
  return current;
}

export function getSelectionToolbar(): SelectionToolbarConfig {
  return load().selectionToolbar ?? DEFAULT_SELECTION_TOOLBAR;
}

export function setSelectionToolbar(config: SelectionToolbarConfig): AppSettings {
  const current = load();
  current.selectionToolbar = config;
  save(current);
  return current;
}

export function upsertMcpServer(server: McpServerConfig): AppSettings {
  const current = load();
  if (!current.mcpServers) current.mcpServers = [];
  const idx = current.mcpServers.findIndex((s) => s.id === server.id);
  if (idx >= 0) {
    current.mcpServers[idx] = server;
  } else {
    current.mcpServers.push(server);
  }
  save(current);
  return current;
}

export function getGeneralConfig(): GeneralConfig {
  return { ...DEFAULT_GENERAL_CONFIG, ...(load().general ?? {}) };
}

export function setGeneralConfig(config: GeneralConfig): AppSettings {
  const current = load();
  current.general = config;
  save(current);
  return current;
}

export function deleteMcpServer(id: string): AppSettings {
  const current = load();
  if (!current.mcpServers) return current;
  const target = current.mcpServers.find((s) => s.id === id);
  if (!target || target.builtin) return current;
  current.mcpServers = current.mcpServers.filter((s) => s.id !== id);
  save(current);
  return current;
}

export function getShortcuts(): ShortcutDef[] {
  const overrides = load().shortcutsOverrides ?? {};
  return DEFAULT_SHORTCUTS.map((s) => ({
    ...s,
    keys: overrides[s.id] ?? s.keys,
  }));
}

export function setShortcutOverride(id: string, keys: string): ShortcutDef[] {
  const current = load();
  current.shortcutsOverrides = { ...(current.shortcutsOverrides ?? {}), [id]: keys };
  save(current);
  return getShortcuts();
}

export function resetShortcut(id: string): ShortcutDef[] {
  const current = load();
  const overrides = { ...(current.shortcutsOverrides ?? {}) };
  delete overrides[id];
  current.shortcutsOverrides = overrides;
  save(current);
  return getShortcuts();
}
