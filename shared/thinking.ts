export function shouldSurfaceThinking(config: { enableThinking?: boolean }): boolean {
  return config.enableThinking !== false;
}
