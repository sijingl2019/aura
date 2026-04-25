import type { ProviderConfig } from '@shared/types';

/**
 * Build a pi-ai Model object from our ProviderConfig.
 * Typed as `any` to avoid importing pi-ai's Model type directly;
 * pi-ai uses structural typing so the plain object works at runtime.
 */
export function toPiModel(cfg: ProviderConfig, modelId: string): any {
  return {
    id: modelId,
    name: modelId,
    api: cfg.kind === 'anthropic' ? 'anthropic-messages' : 'openai-completions',
    provider: cfg.kind === 'anthropic' ? 'anthropic' : 'openai',
    baseUrl: cfg.baseURL,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 131072,
    maxTokens: 8192,
  };
}
