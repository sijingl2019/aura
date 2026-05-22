import type { GatewayConfig, ProviderConfig } from '@shared/types';
import { getSettings, resolveProvider } from '../config/store';
import { getOrCreateGatewayConversation } from '../db/repo';
import { newStreamId, run } from '../agent/runtime';
import { workspaceStore } from '../workspace/store';
import type { SkillStore } from '../skills/loader';
import { GatewaySink } from './sink';
import { gatewayToolFilter } from './tool-policy';
import type { InboundMessage, OutboundReply } from './types';

interface ResolvedModel {
  providerCfg: ProviderConfig;
  modelId: string;
}

/** Resolve provider+model for a gateway: per-gateway override, else global default.
 *  Returns a human-readable error string when nothing usable is configured. */
function resolveModel(config: GatewayConfig): ResolvedModel | { error: string } {
  const ref = config.defaultModel ?? getSettings().defaultModel;
  if (!ref) return { error: '未配置模型：请在设置中为该网关或全局选择默认模型' };

  const providerCfg = resolveProvider(ref.providerId);
  if (!providerCfg) return { error: `未知的模型提供商 "${ref.providerId}"` };
  if (!providerCfg.enabled) return { error: `提供商 "${providerCfg.name}" 已停用` };
  if (!providerCfg.apiKey.trim()) return { error: `提供商 "${providerCfg.name}" 未配置 API 密钥` };
  if (!providerCfg.models.some((m) => m.id === ref.modelId)) {
    return { error: `模型 "${ref.modelId}" 不在提供商 "${providerCfg.name}" 的列表中` };
  }
  return { providerCfg, modelId: ref.modelId };
}

/**
 * Entry point for an inbound platform message. Enforces the per-gateway user
 * allow-list, maps the chat to a conversation, then drives runtime.run() with a
 * throttling sink that posts the reply back through the connector.
 */
export async function handleInbound(
  config: GatewayConfig,
  msg: InboundMessage,
  reply: OutboundReply,
  skills: SkillStore,
): Promise<void> {
  // Authorization — empty allow-list denies everyone (safe default).
  if (!config.allowedUserIds.includes(msg.userId)) {
    console.log(`[gateway:${config.platform}] denied user ${msg.userId} (not in allow-list)`);
    try {
      await reply.render('⚠️ 你没有使用该机器人的权限。', { final: true });
    } catch {
      /* best-effort */
    }
    return;
  }

  const text = msg.text.trim();
  if (!text) return;

  const resolved = resolveModel(config);
  if ('error' in resolved) {
    await reply.render(`⚠️ ${resolved.error}`, { final: true });
    return;
  }

  const conv = getOrCreateGatewayConversation(
    config.platform,
    msg.chatId,
    text.split(/\s+/).slice(0, 8).join(' ').slice(0, 60),
  );

  const sink = new GatewaySink(reply);

  await run({
    streamId: newStreamId(),
    conversationId: conv.id,
    userText: text,
    cwd: workspaceStore.getCwd(),
    providerCfg: resolved.providerCfg,
    modelId: resolved.modelId,
    skills,
    send: sink.handle,
    toolFilter: gatewayToolFilter(config.allowDangerousTools),
  });
}
