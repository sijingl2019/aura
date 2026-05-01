import { randomUUID } from 'node:crypto';
import { Agent } from '@mariozechner/pi-agent-core';
import type { AgentEvent } from '@mariozechner/pi-agent-core';
import type { WebContents } from 'electron';
import type { ProviderConfig, StreamEvent } from '@shared/types';
import { appendMessage, listMessages, renameConversation } from '../db/repo';
import { listTools } from '../tools/registry';
import { toPiModel } from '../providers/to-pi-model';
import { toAgentTool } from '../tools/to-agent-tool';
import { chatMessagesToAgent } from './message-bridge';
import type { SkillStore } from '../skills/loader';

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
  const { streamId, conversationId, userText, skillId, skillName, cwd, providerCfg, modelId, skills, webContents } = params;

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

  const model = toPiModel(providerCfg, modelId);
  const agentTools = listTools().map((t) => toAgentTool(t, cwd));
  // Pass history captured BEFORE the new user message — agent.prompt() adds it
  const existingMessages = chatMessagesToAgent(history);

  const agent = new Agent({
    initialState: {
      systemPrompt: systemParts.join('\n\n'),
      model,
      tools: agentTools,
      messages: existingMessages,
    },
    toolExecution: 'parallel',
    getApiKey: async () => providerCfg.apiKey,
  });

  activeAgents.set(streamId, agent);

  let doneSent = false;
  const safeSendDone = () => {
    if (!doneSent) {
      doneSent = true;
      send({ type: 'done', streamId });
    }
  };

  const unsubscribe = agent.subscribe((event: AgentEvent) => {
    switch (event.type) {
      case 'message_update': {
        const ae = event.assistantMessageEvent;
        if (ae.type === 'text_delta') {
          send({ type: 'text', streamId, delta: ae.delta });
        } else if (ae.type === 'toolcall_start') {
          const block = ae.partial.content[ae.contentIndex] as any;
          if (block?.type === 'toolCall') {
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
            model: modelId,
            inputTokens: msg.usage?.input,
            outputTokens: msg.usage?.output,
          });
        }

        // Persist tool results — pi-ai bundles all results from one turn into one ToolResultMessage
        for (const tr of event.toolResults) {
          const results: any[] = (tr as any).content ?? [];
          for (const r of results) {
            const content = ((r.content ?? []) as any[])
              .filter((c) => c.type === 'text')
              .map((c) => c.text as string)
              .join('');
            appendMessage({
              conversationId,
              role: 'tool',
              content,
              toolCallId: r.toolCallId,
            });
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
    await agent.prompt({ role: 'user', content: userText, timestamp: Date.now() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    send({ type: 'error', streamId, message });
  } finally {
    safeSendDone();
    unsubscribe();
    activeAgents.delete(streamId);
  }
}

export function newStreamId(): string {
  return randomUUID();
}
