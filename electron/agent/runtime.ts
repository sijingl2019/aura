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
import { getSettings, resolveProvider } from '../config/store';
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

// MiniMax and other Anthropic-compatible third-party endpoints do not support
// Anthropic prompt-caching headers (cache_control). Passing cacheRetention:'none'
// tells pi-ai's anthropic provider to omit the cache_control field so these
// endpoints don't silently drop the system prompt.
function makeStreamFn(baseUrl: string) {
  const isNativeAnthropic = baseUrl.includes('api.anthropic.com');
  if (isNativeAnthropic) return undefined; // use pi-ai default behaviour
  return (
    model: Parameters<typeof streamSimple>[0],
    context: Parameters<typeof streamSimple>[1],
    options?: Parameters<typeof streamSimple>[2],
  ) => streamSimple(model, context, { ...options, cacheRetention: 'none' });
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

  const systemPrompt = systemParts.join('\n\n');

  // Compress history when estimated token count exceeds threshold.
  // The result is ephemeral — the full history remains in the DB.
  const { messages: workingHistory, compressed } = await compressHistoryIfNeeded(
    history,
    providerCfg,
    modelId,
    AGENT_LIMITS.contextCompressThreshold,
  );
  if (compressed) {
    console.log(`[context-compressor] ${history.length} → ${workingHistory.length} messages`);
  }

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

  for (let attempt = 0; attempt < chain.length; attempt++) {
    const { cfg: attemptCfg, mid: attemptModelId } = chain[attempt];

    if (attempt > 0) {
      console.log(
        `[fallback] attempt ${attempt + 1}/${chain.length}: ${attemptCfg.name} / ${attemptModelId}`,
      );
    }

    const model = toPiModel(attemptCfg, attemptModelId);
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools: agentTools,
        messages: existingMessages,
      },
      toolExecution: 'parallel',
      getApiKey: async () => attemptCfg.apiKey,
      streamFn: makeStreamFn(attemptCfg.baseURL),
    });

    activeAgents.set(streamId, agent);

    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case 'message_update': {
          const ae = event.assistantMessageEvent;
          if (ae.type === 'text_delta') {
            contentSent = true;
            send({ type: 'text', streamId, delta: ae.delta });
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
          // Persist assistant message
          const msg = event.message as any;
          if (msg.role === 'assistant') {
            const textContent = ((msg.content ?? []) as any[])
              .filter((c) => c.type === 'text')
              .map((c) => c.text as string)
              .join('');
            const toolCalls = ((msg.content ?? []) as any[])
              .filter((c) => c.type === 'toolCall')
              .map((c) => ({ id: c.id, name: c.name, arguments: JSON.stringify(c.arguments) }));
            appendMessage({
              conversationId,
              role: 'assistant',
              content: textContent,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              model: attemptModelId,
              inputTokens: msg.usage?.input,
              outputTokens: msg.usage?.output,
            });
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

  if (lastErrorMsg) {
    send({ type: 'error', streamId, message: lastErrorMsg });
  }
  safeSendDone();
}

export function newStreamId(): string {
  return randomUUID();
}
