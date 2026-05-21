import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, ProviderConfig } from '@shared/types';
import OpenAI from 'openai';

// Conservative average: CJK ≈ 1 token/char, Latin ≈ 4 chars/token → ~2.5 chars/token mixed
const CHARS_PER_TOKEN = 2.5;

// Messages to preserve verbatim at each end of the history
const PROTECT_TAIL = 20; // last N messages (most recent and relevant)

/** Rough token estimate for a list of ChatMessages. */
export function estimateTokens(messages: ChatMessage[]): number {
  const chars = messages.reduce((sum, m) => {
    let c = m.content.length;
    if (m.toolCalls) c += m.toolCalls.reduce((s, tc) => s + tc.arguments.length, 0);
    return sum + c;
  }, 0);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function buildSummaryPrompt(messages: ChatMessage[]): string {
  const lines: string[] = [
    '请将以下对话片段总结为简洁摘要（500字以内），保留关键信息、决策和重要上下文：\n',
  ];
  for (const m of messages) {
    if (m.role === 'tool') {
      lines.push('[工具结果] (已省略)');
    } else {
      const label = m.role === 'user' ? '用户' : '助手';
      const preview = m.content.slice(0, 400);
      lines.push(`[${label}]: ${preview}${m.content.length > 400 ? '...' : ''}`);
    }
  }
  lines.push('\n摘要（请包含：对话目标、关键操作、重要发现、文件变更等）：');
  return lines.join('\n');
}

async function callForSummary(
  prompt: string,
  cfg: ProviderConfig,
  modelId: string,
): Promise<string> {
  if (cfg.kind === 'anthropic') {
    const client = new Anthropic({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
    const resp = await client.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    return block?.type === 'text' ? block.text : '';
  } else {
    const client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
    const resp = await client.chat.completions.create({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return resp.choices[0]?.message?.content ?? '';
  }
}

export interface CompressResult {
  messages: ChatMessage[];
  compressed: boolean;
  /** When compressed, the summary block to append to the system prompt. */
  summary?: string;
}

/**
 * When the estimated token count exceeds `thresholdTokens`, summarize the older
 * portion of the history into a text block (returned via `summary`, to be appended
 * to the system prompt) and keep only a recent tail of real messages.
 *
 * The tail is a contiguous suffix that **starts at a user message** so user/assistant
 * alternation stays valid — injecting synthetic messages mid-history could create
 * consecutive same-role messages and break Anthropic's alternation requirement.
 *
 * Falls back to the original array on any error so the caller always gets a usable result.
 *
 * IMPORTANT: the returned array is ephemeral — it MUST NOT be persisted to the DB.
 */
export async function compressHistoryIfNeeded(
  messages: ChatMessage[],
  providerCfg: ProviderConfig,
  modelId: string,
  thresholdTokens: number,
): Promise<CompressResult> {
  const est = estimateTokens(messages); // TEMP(诊断功能1): remove this block
  console.log(
    `[context-compressor] check: estimate=${est} threshold=${thresholdTokens} messages=${messages.length}`,
  );
  if (est <= thresholdTokens) {
    console.log('[context-compressor] skip: under token threshold');
    return { messages, compressed: false };
  }

  const total = messages.length;

  // Keep ~PROTECT_TAIL recent messages, but the tail must START at a user message
  // so user/assistant alternation stays valid. Search backward from the target
  // for the nearest user boundary (tail may be a bit larger than PROTECT_TAIL);
  // fall back to the nearest user message after the target.
  const target = Math.max(0, total - PROTECT_TAIL);
  let startIdx = -1;
  for (let i = target; i >= 0; i--) {
    if (messages[i].role === 'user') {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) {
    for (let i = target + 1; i < total; i++) {
      if (messages[i].role === 'user') {
        startIdx = i;
        break;
      }
    }
  }

  // Nothing older to summarize (boundary is the first message), or no user boundary.
  if (startIdx <= 0 || startIdx >= total) {
    console.log(
      `[context-compressor] skip: no older messages to summarize (startIdx=${startIdx}, total=${total})`,
    );
    return { messages, compressed: false };
  }

  const older = messages.slice(0, startIdx);
  const tail = messages.slice(startIdx);

  let summary: string;
  try {
    summary = await callForSummary(buildSummaryPrompt(older), providerCfg, modelId);
  } catch (e) {
    console.warn(
      '[context-compressor] summarization failed, keeping full history:',
      (e as Error).message,
    );
    return { messages, compressed: false };
  }

  if (!summary.trim()) {
    return { messages, compressed: false };
  }

  const summaryBlock = `## 之前对话的摘要\n（以下是较早 ${older.length} 条消息的摘要，用于在压缩上下文后保留背景；完整记录仍在本地数据库中）\n\n${summary.trim()}`;

  return { messages: tail, compressed: true, summary: summaryBlock };
}
