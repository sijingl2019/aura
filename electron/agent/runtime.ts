import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Agent } from '@mariozechner/pi-agent-core';
import type { AgentEvent } from '@mariozechner/pi-agent-core';
import { streamSimple } from '@mariozechner/pi-ai';
import type { WebContents } from 'electron';
import type { FallbackChainEntry, ProviderConfig, StreamEvent } from '@shared/types';
import { appendMessage, listMessages, renameConversation } from '../db/repo';
import { listTools } from '../tools/registry';
import { toPiModel } from '../providers/to-pi-model';
import { toAgentTool } from '../tools/to-agent-tool';
import { chatMessagesToAgent } from './message-bridge';
import { compressHistoryIfNeeded } from './context-compressor';
import { classifyError, isRetryableWithFallback } from './error-classifier';
import { buildMemorySection } from '../memory/prompt';
import { AGENT_LIMITS } from '../config/hardcoded';
import { getGeneralConfig, getSettings, resolveProvider } from '../config/store';
import type { SkillStore } from '../skills/loader';

const AT_REF_RE = /@([\w./\\-]+)/g;
const MAX_FILE_BYTES = 200_000; // 200 KB per file

/**
 * Find @filepath references in the message, read each file, and append their
 * contents below the original text so the LLM has the actual source available.
 */
function expandAtReferences(text: string, cwd: string): string {
  const refs = [...text.matchAll(AT_REF_RE)];
  if (refs.length === 0) return text;

  const blocks: string[] = [];
  const seen = new Set<string>();

  for (const [, relPath] of refs) {
    if (relPath.endsWith('/') || seen.has(relPath)) continue;
    seen.add(relPath);

    const fullPath = path.resolve(cwd, relPath);
    if (!fullPath.startsWith(cwd + path.sep) && fullPath !== cwd) continue; // security

    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) continue;
      if (stat.size > MAX_FILE_BYTES) {
        blocks.push(`@${relPath} (文件过大 ${Math.round(stat.size / 1024)} KB，已跳过)`);
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      const ext = path.extname(relPath).slice(1);
      blocks.push(`\`${relPath}\`:\n\`\`\`${ext}\n${content}\n\`\`\``);
    } catch {
      // file not found or binary — silently skip
    }
  }

  if (blocks.length === 0) return text;
  return `${text}\n\n${blocks.join('\n\n')}`;
}

// Whether to enable Anthropic cache_control prompt caching for this provider.
// Explicit `promptCaching` wins; otherwise default to on only for the native
// api.anthropic.com endpoint. MiniMax and most third-party Anthropic-compatible
// endpoints reject cache_control, so they stay off by default.
function effectivePromptCaching(cfg: ProviderConfig): boolean {
  return cfg.promptCaching ?? cfg.baseURL.includes('api.anthropic.com');
}

// Build the streamFn passed to the Agent. We always wrap streamSimple so we can
// pin cacheRetention: 'short' (caching on) or 'none' (off) while preserving the
// reasoning/thinking options the agent loop injects.
function makeStreamFn(cfg: ProviderConfig) {
  const cacheRetention: 'short' | 'none' = effectivePromptCaching(cfg) ? 'short' : 'none';
  return (
    model: Parameters<typeof streamSimple>[0],
    context: Parameters<typeof streamSimple>[1],
    options?: Parameters<typeof streamSimple>[2],
  ) => streamSimple(model, context, { ...options, cacheRetention });
}

interface ChainEntry {
  cfg: ProviderConfig;
  mid: string;
}

/** Build the ordered list of providers to try: primary first, then validated fallbacks. */
function buildProviderChain(
  primary: ProviderConfig,
  primaryModelId: string,
  fallbacks: FallbackChainEntry[],
): ChainEntry[] {
  const chain: ChainEntry[] = [{ cfg: primary, mid: primaryModelId }];
  for (const fb of fallbacks) {
    const cfg = resolveProvider(fb.providerId);
    if (!cfg || !cfg.enabled || !cfg.apiKey.trim()) continue;
    if (!cfg.models.some((m) => m.id === fb.modelId)) continue;
    chain.push({ cfg, mid: fb.modelId });
  }
  return chain;
}

interface RunParams {
  streamId: string;
  conversationId: string;
  userText: string;
  skillId?: string;
  skillName?: string;
  cwd: string;
  providerCfg: ProviderConfig;
  modelId: string;
  skills: SkillStore;
  webContents: WebContents;
}

const activeAgents = new Map<string, Agent>();

export function abortRun(streamId: string): void {
  activeAgents.get(streamId)?.abort();
}

export async function run(params: RunParams): Promise<void> {
  const {
    streamId,
    conversationId,
    userText,
    skillId,
    skillName,
    cwd,
    providerCfg,
    modelId,
    skills,
    webContents,
  } = params;

  const send = (event: StreamEvent) => {
    if (!webContents.isDestroyed()) webContents.send('llm:event', event);
  };

  // Sync prefix: persist user message before any await so a crash won't lose it
  const history = listMessages(conversationId);
  const isFirstUserMsg = history.every((m) => m.role !== 'user');
  appendMessage({ conversationId, role: 'user', content: userText, skillName });
  if (isFirstUserMsg) {
    const title = userText.trim().split(/\s+/).slice(0, 8).join(' ').slice(0, 60) || '新对话';
    renameConversation(conversationId, title);
  }

  const systemParts: string[] = [];
  if (skillId) {
    const skill = skills.get(skillId);
    if (skill) systemParts.push(skill.body);
  }

  // Inject persistent memory context into every conversation
  systemParts.push(buildMemorySection());

  // Compress history when estimated token count exceeds threshold.
  // The summary goes into the system prompt; only a recent tail of real messages
  // is kept. The result is ephemeral — the full history remains in the DB.
  const { messages: workingHistory, compressed, summary } = await compressHistoryIfNeeded(
    history,
    providerCfg,
    modelId,
    AGENT_LIMITS.contextCompressThreshold,
  );
  if (compressed) {
    console.log(`[context-compressor] compressed ${history.length} -> ${workingHistory.length} messages`);
    if (summary) systemParts.push(summary);
  }

  const systemPrompt = systemParts.join('\n\n');

  const agentTools = listTools().map((t) => toAgentTool(t, cwd));
  // Pass history captured BEFORE the new user message — agent.prompt() adds it
  const existingMessages = chatMessagesToAgent(workingHistory);

  // Build provider chain: primary + configured fallbacks
  const chain = buildProviderChain(
    providerCfg,
    modelId,
    getSettings().fallbackChain ?? [],
  );

  // Prompt text (with @file expansion) is identical across all fallback attempts
  const promptText = expandAtReferences(userText, cwd);

  // Extended thinking / reasoning — opt-in via the enableThinking setting.
  // When 'off', the agent loop omits reasoning params entirely.
  const thinkingLevel: 'off' | 'medium' = getGeneralConfig().enableThinking ? 'medium' : 'off';

  // contentSent tracks whether any streaming output has been delivered to the renderer.
  // Once content is in flight we cannot transparently retry with a different provider.
  let contentSent = false;

  let doneSent = false;
  const safeSendDone = () => {
    if (!doneSent) {
      doneSent = true;
      send({ type: 'done', streamId });
    }
  };

  let lastErrorMsg: string | null = null;

  // Continuation buffer (Feature 7) — declared outside the attempt loop so a
  // fragment buffered mid-continuation can still be flushed after the loop.
  let pendingAssistant: { text: string; thinking: string } | null = null;
  let activeModelId = modelId;

  const maxRounds = AGENT_LIMITS.maxToolRounds;

  for (let attempt = 0; attempt < chain.length; attempt++) {
    const { cfg: attemptCfg, mid: attemptModelId } = chain[attempt];
    activeModelId = attemptModelId;

    if (attempt > 0) {
      console.log(
        `[fallback] attempt ${attempt + 1}/${chain.length}: ${attemptCfg.name} / ${attemptModelId}`,
      );
    }

    // Per-attempt budget + continuation state (reset for each fallback attempt)
    let toolRoundsUsed = 0;
    const warnedThresholds = new Set<number>();
    let continuationCount = 0;
    pendingAssistant = null;

    const model = toPiModel(attemptCfg, attemptModelId);
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools: agentTools,
        messages: existingMessages,
        thinkingLevel,
      },
      toolExecution: 'parallel',
      getApiKey: async () => attemptCfg.apiKey,
      streamFn: makeStreamFn(attemptCfg),
      // Feature 6 — hard cap: refuse tool calls once the round budget is spent.
      beforeToolCall: async () => {
        if (toolRoundsUsed >= maxRounds) {
          return {
            block: true,
            reason: `⚠️ 已达到工具调用上限（${maxRounds} 轮）。请勿再调用工具，直接基于已有信息给出最终回答。`,
          };
        }
        return undefined;
      },
      // Feature 6 — soft warning: append a wrap-up notice to the tool result
      // when round usage crosses a configured ratio (rides inside the tool
      // result to avoid breaking user/assistant alternation).
      afterToolCall: async (ctx) => {
        const currentRound = toolRoundsUsed + 1;
        for (const ratio of AGENT_LIMITS.toolBudgetWarnRatios) {
          const threshold = Math.ceil(maxRounds * ratio);
          if (currentRound === threshold && !warnedThresholds.has(threshold)) {
            warnedThresholds.add(threshold);
            return {
              content: [
                ...ctx.result.content,
                {
                  type: 'text' as const,
                  text: `\n[系统提示：已使用 ${currentRound}/${maxRounds} 轮工具调用，请尽快收尾并给出最终答案。]`,
                },
              ],
            };
          }
        }
        return undefined;
      },
    });

    activeAgents.set(streamId, agent);

    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case 'message_update': {
          const ae = event.assistantMessageEvent;
          if (ae.type === 'text_delta') {
            contentSent = true;
            send({ type: 'text', streamId, delta: ae.delta });
          } else if (ae.type === 'thinking_delta') {
            contentSent = true;
            send({ type: 'thinking', streamId, delta: ae.delta });
          } else if (ae.type === 'toolcall_start') {
            const block = ae.partial.content[ae.contentIndex] as any;
            if (block?.type === 'toolCall') {
              contentSent = true;
              send({ type: 'tool_call_start', streamId, id: block.id, name: block.name });
            }
          } else if (ae.type === 'toolcall_delta') {
            const block = ae.partial.content[ae.contentIndex] as any;
            if (block?.type === 'toolCall') {
              send({ type: 'tool_call_args', streamId, id: block.id, delta: ae.delta });
            }
          } else if (ae.type === 'toolcall_end') {
            send({ type: 'tool_call_end', streamId, id: ae.toolCall.id });
          }
          break;
        }

        case 'tool_execution_end': {
          contentSent = true;
          const resultText = ((event.result?.content ?? []) as any[])
            .filter((c) => c.type === 'text')
            .map((c) => c.text as string)
            .join('');
          send({
            type: 'tool_result',
            streamId,
            id: event.toolCallId,
            ok: !event.isError,
            preview: resultText.slice(0, 200),
          });
          break;
        }

        case 'turn_end': {
          const msg = event.message as any;
          if (msg.role === 'assistant') {
            const textContent = ((msg.content ?? []) as any[])
              .filter((c) => c.type === 'text')
              .map((c) => c.text as string)
              .join('');
            const thinkingContent = ((msg.content ?? []) as any[])
              .filter((c) => c.type === 'thinking')
              .map((c) => c.thinking as string)
              .join('');
            const toolCalls = ((msg.content ?? []) as any[])
              .filter((c) => c.type === 'toolCall')
              .map((c) => ({ id: c.id, name: c.name, arguments: JSON.stringify(c.arguments) }));

            // Feature 7 — auto-continue when truncated by max_tokens.
            const willContinue =
              msg.stopReason === 'length' &&
              toolCalls.length === 0 &&
              continuationCount < AGENT_LIMITS.maxContinuations;

            if (willContinue) {
              // Buffer the fragment; do not persist yet. Queue a follow-up so the
              // loop continues the response within this same agent.prompt() call.
              pendingAssistant = {
                text: (pendingAssistant?.text ?? '') + textContent,
                thinking: (pendingAssistant?.thinking ?? '') + thinkingContent,
              };
              continuationCount++;
              agent.followUp({
                role: 'user',
                content: '(接上文继续输出，不要重复已经输出的内容)',
                timestamp: Date.now(),
              });
            } else {
              // Final (or non-truncated) turn: persist buffered fragments + this
              // turn merged into a single assistant row.
              const mergedText = (pendingAssistant?.text ?? '') + textContent;
              const mergedThinking = (pendingAssistant?.thinking ?? '') + thinkingContent;
              pendingAssistant = null;
              appendMessage({
                conversationId,
                role: 'assistant',
                content: mergedText,
                thinking: mergedThinking || undefined,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                model: attemptModelId,
                inputTokens: msg.usage?.input,
                outputTokens: msg.usage?.output,
              });
            }
          }

          // Persist tool results
          for (const tr of event.toolResults) {
            const trMsg = tr as unknown as {
              toolCallId: string;
              content: { type: string; text: string }[];
            };
            const content = (trMsg.content ?? [])
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('');
            appendMessage({
              conversationId,
              role: 'tool',
              content,
              toolCallId: trMsg.toolCallId,
            });
          }

          // Feature 6 — count completed tool rounds; force-abort if the model
          // ignores the block and keeps calling tools well past the budget.
          if (event.toolResults.length > 0) {
            toolRoundsUsed++;
            if (toolRoundsUsed > maxRounds + AGENT_LIMITS.toolRoundsHardStopGrace) {
              console.warn(
                `[budget] toolRoundsUsed=${toolRoundsUsed} exceeded hard stop, aborting`,
              );
              agent.abort();
            }
          }
          break;
        }

        case 'agent_end':
          safeSendDone();
          break;
      }
    });

    try {
      await agent.prompt({ role: 'user', content: promptText, timestamp: Date.now() });
      lastErrorMsg = null;
      break; // success — exit retry loop
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const kind = classifyError(e);
      const hasMore = attempt < chain.length - 1;

      if (isRetryableWithFallback(kind) && hasMore && !contentSent) {
        console.log(
          `[fallback] ${attemptCfg.name}/${attemptModelId} failed (${kind}): ${errMsg}`,
        );
        lastErrorMsg = errMsg; // may be overwritten on next successful attempt
        // do NOT break — loop continues to next provider
      } else {
        lastErrorMsg = errMsg;
        break;
      }
    } finally {
      unsubscribe();
      activeAgents.delete(streamId);
    }
  }

  // Flush any continuation fragment that was buffered but never reached a final
  // turn (e.g. the continuing turn errored). Avoids losing already-streamed text.
  // Cast resets CFA narrowing — pendingAssistant is mutated inside the subscribe closure.
  const buffered = pendingAssistant as { text: string; thinking: string } | null;
  if (buffered && (buffered.text || buffered.thinking)) {
    appendMessage({
      conversationId,
      role: 'assistant',
      content: buffered.text,
      thinking: buffered.thinking || undefined,
      model: activeModelId,
    });
    pendingAssistant = null;
  }

  if (lastErrorMsg) {
    send({ type: 'error', streamId, message: lastErrorMsg });
  }
  safeSendDone();
}

export function newStreamId(): string {
  return randomUUID();
}
