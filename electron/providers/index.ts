import { resolveProvider } from '../config/store';
import { createAnthropicProvider } from './anthropic';
import { createOpenAIProvider } from './openai';
import type { LLMProvider } from './types';

export interface ResolveProviderInput {
  providerId: string;
  modelId: string;
}

export function createProvider({ providerId, modelId }: ResolveProviderInput): LLMProvider {
  const cfg = resolveProvider(providerId);
  if (!cfg) {
    throw new Error(`未知的模型提供商 "${providerId}"，请在设置中检查`);
  }
  if (!cfg.enabled) {
    throw new Error(`提供商 "${cfg.name}" 已停用，请在设置中启用或换一个提供商`);
  }
  if (!cfg.apiKey.trim()) {
    throw new Error(`提供商 "${cfg.name}" 未配置 API 密钥`);
  }
  if (!cfg.baseURL.trim()) {
    throw new Error(`提供商 "${cfg.name}" 未配置 API 地址`);
  }
  if (!cfg.models.some((m) => m.id === modelId)) {
    throw new Error(`模型 "${modelId}" 不在提供商 "${cfg.name}" 的模型列表中`);
  }

  const common = {
    id: cfg.id,
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
    model: modelId,
  };

  switch (cfg.kind) {
    case 'anthropic':
      return createAnthropicProvider(common);
    case 'openai':
      return createOpenAIProvider(common);
    default: {
      const _exhaustive: never = cfg.kind;
      throw new Error(`unsupported provider kind: ${String(_exhaustive)}`);
    }
  }
}
