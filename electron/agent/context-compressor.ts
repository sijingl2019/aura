import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type { ChatMessage, ProviderConfig } from '@shared/types';

// Conservative average: CJK ≈ 1 token/char, Latin ≈ 4 chars/token → ~2.5 chars/token mixed
const CHARS_PER_TOKEN = 2.5;

// Messages to preserve verbatim at each end of the history
const PROTECT_HEAD = 4;  // first N messages (first 1-2 exchanges for context baseline)
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
}

/**
 * Summarize the middle portion of the history when the estimated token count exceeds
 * `thresholdTokens`. Head (first PROTECT_HEAD) and tail (last PROTECT_TAIL) messages
 * are always kept verbatim. The middle is replaced by a synthetic user+assistant pair
 * that contains the LLM-generated summary.
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
  if (estimateTokens(messages) <= thresholdTokens) {
    return { messages, compressed: false };
  }

  const total = messages.length;
  // Need at least one message in the middle that can be summarised
  if (total <= PROTECT_HEAD + PROTECT_TAIL + 1) {
    return { messages, compressed: false };
  }

  const head = messages.slice(0, PROTECT_HEAD);
  const tail = messages.slice(total - PROTECT_TAIL);
  const middle = messages.slice(PROTECT_HEAD, total - PROTECT_TAIL);

  let summary: string;
  try {
    summary = await callForSummary(buildSummaryPrompt(middle), providerCfg, modelId);
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

  const convId = messages[0]?.conversationId ?? '';
  const now = Date.now();

  // Synthetic pair representing the compressed middle
  const summaryMsg: ChatMessage = {
    id: randomUUID(),
    conversationId: convId,
    role: 'user',
    content: `【以下是较早对话的摘要，中间 ${middle.length} 条消息已压缩以节省上下文空间】\n\n${summary}`,
    createdAt: now - 2,
  };
  const ackMsg: ChatMessage = {
    id: randomUUID(),
    conversationId: convId,
    role: 'assistant',
    content: '好的，我已了解之前对话的背景。',
    createdAt: now - 1,
  };

  return {
    messages: [...head, summaryMsg, ackMsg, ...tail],
    compressed: true,
  };
}
