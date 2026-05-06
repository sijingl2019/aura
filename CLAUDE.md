# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server + Electron with HMR (renderer only)
npm run build        # tsc -b && vite build — always verify after main-process changes
npx tsc -b           # type-check only (fast; use during edits)
npm run rebuild      # electron-rebuild better-sqlite3 against Electron's Node ABI
npm run lint         # eslint
```

Ad-hoc DB inspection via `node -e` fails with `NODE_MODULE_VERSION` mismatch — `better-sqlite3` is compiled for Electron's Node ABI, not system Node. Use the app itself, or delete `%APPDATA%\qiko-aura\aura.db{,-shm,-wal}` to reset.

No test suite is wired yet (vitest is installed but unused).

## Architecture

Electron desktop AI chat. Renderer speaks **only** to main via `window.api.{window,db,llm,skills}` (contextBridge in [electron/preload.ts](electron/preload.ts)); `sandbox: true`, no `nodeIntegration`. All network/FS/DB work lives in main.

### Conversation turn — end-to-end flow

1. Renderer `sendMessage` in [src/lib/ipc.ts](src/lib/ipc.ts) **optimistically** inserts the user bubble, then calls `window.api.llm.stream({conversationId, userText, skillId?})`.
2. Main's `ipcMain.handle('llm:stream', ...)` in [electron/ipc/llm.ts](electron/ipc/llm.ts) generates `streamId`, fires `void run(...)` (not awaited — the **sync prefix** of `run()` includes `appendMessage(user)` before the first `await`, so by the time the IPC returns, the user row is in the DB).
3. [electron/agent/runtime.ts](electron/agent/runtime.ts) loops up to `AGENT_LIMITS.maxToolRounds` rounds: each round reads full history via `listMessages`, calls `provider.stream({messages, tools, system, signal})`, persists the assistant row (with `toolCalls` JSON), executes every tool call, persists each tool row (`role='tool'`, `toolCallId=call.id`), repeats until `finishReason==='stop'` or no tool calls.
4. All streaming pushes go out on the `'llm:event'` channel as `StreamEvent` (see [shared/types.ts](shared/types.ts)): `text | tool_call_start | tool_call_args | tool_call_end | tool_result | done | error`.
5. On `done`, [src/lib/ipc.ts](src/lib/ipc.ts) does `loadMessages` + `loadList`, which replaces the optimistic user row with the real DB rows and flushes streaming state.

### Settings & configuration

User-visible provider and model settings are stored in `app.getPath('userData')/settings.json` and managed by [electron/config/store.ts](electron/config/store.ts). On first load, `mergeBuiltins()` injects the four preset providers (MiniMax / 智谱 / 硅基流动 / 月之暗面) from [electron/config/defaults.ts](electron/config/defaults.ts) if they're absent — so builtins are always present even on a fresh install. Builtin providers carry `builtin: true` and cannot be deleted from the UI.

IPC surface (all registered in [electron/ipc/settings.ts](electron/ipc/settings.ts)):

| channel | action |
|---|---|
| `settings:get` | return full `AppSettings` |
| `settings:upsertProvider` | add or update a `ProviderConfig` |
| `settings:deleteProvider` | remove a non-builtin provider |
| `settings:setDefaultModel` | persist `{providerId, modelId}` as the global default (validates that the provider exists and the model is in its list) |
| `settings:reorderProviders` | persist a new `order` array |

`window.api.settings.*` mirrors all of the above via contextBridge.

`defaultModel` can be `null` — in that case starting a conversation without a per-conversation override emits an `error` event to the renderer with a human-readable message instead of crashing.

[electron/config/hardcoded.ts](electron/config/hardcoded.ts) now only holds `AGENT_LIMITS` and `DIFY_MCP`. `LLM_CONFIG` has been removed — do not re-add it.

### LLM provider layer

`createProvider({providerId, modelId})` in [electron/providers/index.ts](electron/providers/index.ts) resolves `ProviderConfig` from settings at call time (not at startup), validates that the provider is enabled and the model is listed, then dispatches to the per-protocol factory based on `kind`. Two implementations: OpenAI-compatible (`chat.completions`) in [electron/providers/openai.ts](electron/providers/openai.ts) and Anthropic messages API in [electron/providers/anthropic.ts](electron/providers/anthropic.ts) (covers MiniMax's `/anthropic` endpoint). Both yield the same `ProviderEvent` union so the agent runtime is protocol-agnostic.

**Provider resolution order per `llm:stream`** (in [electron/ipc/llm.ts](electron/ipc/llm.ts)):
1. `conversation.provider` + `conversation.model` (per-conversation pin, set by ModelSwitcher)
2. `settings.defaultModel` (global default from Settings → 默认模型)
3. Neither set → persist the user message to DB, then emit `{ type: 'error' }` + `{ type: 'done' }` with a descriptive message; no stream is started.

Anthropic conversion lives in [electron/providers/anthropic.ts](electron/providers/anthropic.ts) `toAnthropicMessages()`: consecutive `role='tool'` messages must be **merged into a single `role='user'` message with multiple `tool_result` content blocks**, placed immediately after the assistant message that declared the matching `tool_use` blocks. Breaking that adjacency invariant produces `tool id not found` 400 errors.

### Tool registry

Tools implement the `Tool` interface in [electron/tools/types.ts](electron/tools/types.ts) (`name`, `description`, JSON-Schema `parameters`, `execute(input, ctx)`). The registry ([electron/tools/registry.ts](electron/tools/registry.ts)) is a mutable array seeded with built-ins (`read_file`, `write_file`, `list_dir`, `exec_shell`, `web_fetch`) and extended at startup via `registerTools(...)`.

`ctx.cwd` is the sandbox root for FS tools — `read_file`/`write_file`/`list_dir` all resolve paths via `resolveWithin(ctx, p)` and reject anything outside. Binary files are refused in `read_file`.

`exec_shell` on Windows prepends `chcp 65001 >nul 2>&1 & <command>` to force UTF-8 cmd output, and decodes output with a UTF-8-then-GBK fallback via `TextDecoder`. Do not revert this — Chinese Windows cmd otherwise returns cp936 bytes that render as `�����`.

### MCP

Each MCP server is started in-process and paired with its client via `InMemoryTransport.createLinkedPair()` (no subprocess). The `McpClientManager` in [electron/mcp/client.ts](electron/mcp/client.ts) calls `listTools()` on each connected server and adapts every tool to our native `Tool` interface with a namespaced name `mcp__<serverId>__<toolName>`. MCP tools are then `registerTools(...)`-ed alongside built-ins, so the agent invokes them through the same path.

Use `server.registerTool(name, {description, inputSchema}, cb)` — the older `server.tool()` overload is deprecated.

[electron/mcp/builtin-server.ts](electron/mcp/builtin-server.ts) is a one-tool demo server. [electron/mcp/dify-knowledge.ts](electron/mcp/dify-knowledge.ts) follows the same factory pattern `start…McpServer(config): Promise<{clientTransport}>`; it's wired in [electron/main.ts](electron/main.ts) guarded by `DIFY_MCP` being non-null.

### Skills

Claude-Code-style skills: scan `userData/skills/<id>/SKILL.md` + `resourcesPath/skills/<id>/SKILL.md`, parse frontmatter (simple regex, no `gray-matter` dep), require `name` and `description`. When a conversation is sent with `skillId`, the agent prepends `skill.body` to the system message for that turn. Skills are **not** exposed to the model as tools — system-prompt injection only.

### Persistence invariants

- SQLite via better-sqlite3 at `app.getPath('userData')/aura.db`; WAL mode; `PRAGMA user_version`-driven migrations wrapped in `db.transaction(...)` so a partial migration rolls back rather than leaving a broken schema.
- `listMessages` must `ORDER BY created_at ASC, rowid ASC`. `created_at` alone ties at millisecond granularity; `id` (UUID) tiebreaks non-deterministically and reorders assistant/tool rows written inside the same ms, which then breaks Anthropic message construction. `rowid` is guaranteed monotonic per insert.
- Conversation title auto-renames to the first ~8 words of the first user message (see `isFirstUserMsg` branch in `runtime.ts`).
- **System conversations** (`is_system = 1`): added in migration v2. The quick question window always writes to a single system conversation (created on-demand via `getOrCreateSystemConversation()` in [electron/db/repo.ts](electron/db/repo.ts)). `listConversations` and `searchConversations` both filter `WHERE is_system = 0` so system conversations never appear in the sidebar or search. Do not remove this filter.

### Settings UI

Settings are opened via **File → Settings…** in the app menu ([src/components/AppMenu.tsx](src/components/AppMenu.tsx)), which calls `openSettings('providers')` on [src/stores/ui.ts](src/stores/ui.ts). The modal ([src/components/Settings/SettingsModal.tsx](src/components/Settings/SettingsModal.tsx)) has a left icon rail with three tabs:

- **模型服务** (`section = 'providers'`): `ProviderList` (searchable, reorderable) + `ProviderDetail` (API key show/hide, base URL reset, model add/remove, delete for non-builtins). Adding a new provider goes through `AddProviderDialog` with an icon picker.
- **默认模型** (`section = 'default-model'`): `DefaultModelSection` — a `ModelCombobox` restricted to enabled providers, with a clear button.
- **快捷键** (`section = 'shortcuts'`): `KeyboardShortcutsSection` ([src/components/Settings/KeyboardShortcutsSection.tsx](src/components/Settings/KeyboardShortcutsSection.tsx)) — table of all shortcuts with click-to-record editing and per-shortcut reset. Shortcut definitions live in `DEFAULT_SHORTCUTS` in [electron/config/hardcoded.ts](electron/config/hardcoded.ts); only overrides are persisted to `settings.json` via `getShortcuts() / setShortcutOverride() / resetShortcut()` in [electron/config/store.ts](electron/config/store.ts). IPC channels: `shortcuts:get`, `shortcuts:set`, `shortcuts:reset`.

`ModelCombobox` ([src/components/Settings/ModelCombobox.tsx](src/components/Settings/ModelCombobox.tsx)) is a reusable searchable grouped dropdown that accepts `size: 'sm' | 'md'`. It is used both in `DefaultModelSection` and in `ModelSwitcher`.

`ModelSwitcher` ([src/components/ModelSwitcher.tsx](src/components/ModelSwitcher.tsx)) sits above the Composer textarea. Resolution: pinned conv model → pendingModel (local state before conv is created) → global default. A "跟随默认" label appears when following the global default. Picking a model on an existing conversation calls `db:updateConversationModel` and updates the store; on a new conversation the choice is held in local state in `Composer` and applied right after the conversation row is created.

Renderer stores:
- [src/stores/settings.ts](src/stores/settings.ts) — mirrors `AppSettings`; exposes `load / upsertProvider / deleteProvider / setDefaultModel / reorderProviders`.
- [src/stores/ui.ts](src/stores/ui.ts) — `settingsOpen`, `settingsSection`, `openSettings(section?)`, `closeSettings()`.

### Quick Question Window

A frameless, transparent, always-on-top floating window opened via global shortcut (default `CmdOrCtrl+Space`, configurable). Managed by [electron/windows/quickQuestionWindow.ts](electron/windows/quickQuestionWindow.ts); IPC in [electron/ipc/quickQuestionIpc.ts](electron/ipc/quickQuestionIpc.ts); renderer at [src/routes/QuickQuestionRoute.tsx](src/routes/QuickQuestionRoute.tsx).

**Lifecycle**: starts at 52px (input only), positioned at screen-center × 2/3 height. `quickQuestion:expand` grows to `screenHeight / 3`. `quickQuestion:resize(height)` sets an arbitrary height. On hide → `win.hide()` (not destroy) + sends `quickQuestion:reset` to renderer after 50ms; blur auto-hides with 120ms debounce + `ignoreBlur` guard for dialogs.

**Special input modes** (detected by prefix, no LLM call):
- `= <expr>` — **calculator**: evaluates math in a CSP-safe recursive-descent parser (no `eval`/`new Function` — blocked by `script-src 'self'` in index.html). Shows result above input; "复制到剪贴板" copies and closes.
- `. <query>` — **app launcher**: searches Windows Start Menu `.lnk` files via PowerShell using `-EncodedCommand` (base64 UTF-16LE) to avoid cmd.exe escaping issues. UTF-8 output forced with `[Console]::OutputEncoding`. Results cached 5 min (empty results not cached). Arrow keys navigate, Enter launches via `shell.openPath()`.

**Chat mode**: reuses existing `llm:stream` + `llm:event` IPC. All messages are stored in a single system conversation (`is_system = 1`) fetched via `db:getOrCreateSystemConversation` — never shown in the main conversation list.

**Window resize on mode change**: renderer calls `quickQuestion:resize(height)` whenever the mode/content changes — calc: 132px, launcher: `52 + 16 + N×38` rows.

### Selection Toolbar

Frameless, transparent, `focusable: false` window shown near selected text. Managed by [electron/windows/toolbarWindow.ts](electron/windows/toolbarWindow.ts).

**Deduplication invariant**: `hideToolbar()` uses `win.hide()` (synchronous), NOT `win.close()`. Using `close()` was a race condition — `toolbarWindow` was nulled immediately but the async `closed` event fires later; a new text-selection between the two created a second window. The single `toolbarWindow` instance is reused across selections; only `destroyToolbar()` (called from `syncSelectionConfig` when feature is disabled and from `teardownSelectionIpc` on quit) actually destroys it.

## Conventions

- **Config single-point**: user-configurable LLM settings (API keys, base URLs, models, default model) live in `userData/settings.json` managed by [electron/config/store.ts](electron/config/store.ts). Optional MCP config and agent limits remain in [electron/config/hardcoded.ts](electron/config/hardcoded.ts). Do not hard-code `baseURL` or `apiKey` anywhere else.
- **IPC naming**: `域:动作` (e.g. `db:listMessages`, `llm:abort`). Every IPC channel's payload/return type goes in [shared/types.ts](shared/types.ts), not duplicated in preload.
- **Path aliases**: `@/*` → `src/*`, `@shared/*` → `shared/*`. Both renderer tsconfig and the electron main vite config resolve these.
- **Streaming store vs conversations store**: [src/stores/streaming.ts](src/stores/streaming.ts) only holds the currently-streaming assistant draft (text + active tool_calls). Historical messages live in [src/stores/conversations.ts](src/stores/conversations.ts). `ChatView` merges the two for the last assistant bubble.
- **Shell tool safety**: the TODO for user-confirm UI is deliberate — do not silently execute destructive commands without adding a confirmation flow.
