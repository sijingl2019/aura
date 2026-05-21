import type { ProviderConfig } from '@shared/types';

/**
 * Parse a comma-separated API key string into individual keys.
 * Trims whitespace and filters empty segments.
 */
export function parseApiKeys(raw: string): string[] {
  return raw.split(',').map((k) => k.trim()).filter(Boolean);
}

/**
 * Expand a ProviderConfig into one entry per API key.
 * If the config has only one key the original object is returned as-is (no allocation).
 * Used by buildProviderChain so the existing attempt loop naturally tries each key
 * before moving on to a different provider.
 */
export function expandConfigByKeys(cfg: ProviderConfig): ProviderConfig[] {
  const keys = parseApiKeys(cfg.apiKey);
  if (keys.length <= 1) return [cfg];
  return keys.map((key) => ({ ...cfg, apiKey: key }));
}
