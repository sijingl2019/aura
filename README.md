# Qiko Aura

Cross-platform desktop AI chat (Electron + React + TypeScript). Multi-provider streaming (Anthropic / OpenAI / Ollama), SQLite-backed local history.

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
