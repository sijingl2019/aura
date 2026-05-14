# Qiko Aura

Cross-platform desktop AI chat (Electron + React + TypeScript). Multi-provider streaming (Anthropic / OpenAI / Ollama), SQLite-backed local history.

## Features

- **Multi-provider streaming** — Anthropic & OpenAI-compatible endpoints, per-conversation or global default model, prompt-caching aware.
- **Agentic tool loop** — built-in `read_file` / `write_file` / `list_dir` / `exec_shell` / `web_fetch` plus in-process MCP servers, all through a unified tool registry.
- **Context compression** — long histories are automatically summarized (head/tail preserved) once the token estimate crosses a threshold, so conversations never hit the context limit. DB keeps the full history.
- **Persistent memory** — cross-session `MEMORY.md` (facts) and `USER.md` (profile) in `userData/memory/`; the model reads and updates them via `memory_*` tools, injected into every conversation's system prompt.
- **Fallback model chain** — configure ordered backup `{provider, model}` entries; on rate-limit / overload / model-not-found the request transparently retries the next provider (only before any output has streamed).
- **Reasoning / thinking** — opt-in extended thinking; reasoning content streams live, persists per message, and renders in a collapsible "思考过程" block.
- **Skills** — Claude-Code-style `SKILL.md` packages injected as system prompts.
- **Quick Question window** — global-hotkey floating window with calculator and Windows app-launcher modes.
- **Selection toolbar** — translate / explain / summarize / search on selected text anywhere.

## Stack

- Electron 33 · Vite 5 · React 18 · TypeScript 5 (strict)
- Tailwind 3 · Zustand · React Router
- better-sqlite3 · safeStorage for API keys
- electron-builder for Win / macOS / Linux packaging

## Commands

```bash
npm install         # first install; runs electron-rebuild for better-sqlite3
npm run dev         # Vite dev server + Electron (HMR for renderer)
npm run build       # tsc + vite build (outputs dist/ and dist-electron/)
npm run build:electron  # build + electron-builder → release/
npm run lint
npm run format
```

## Layout

```
electron/     main / preload / ipc / db / providers
src/          React renderer (routes, components, stores)
shared/       types shared across main & renderer
resources/    app icons
```

See `C:\Users\linsj\.claude\plans\claude-cheerful-volcano.md` for the full roadmap.
