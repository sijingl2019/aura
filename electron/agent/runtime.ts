import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import type { ChatMessage, StreamEvent, ToolCall } from '@shared/types';
import { AGENT_LIMITS } from '../config/hardcoded';
import { appendMessage, listMessages, renameConversation } from '../db/repo';
import { getTool, listTools, toOpenAISchemas } from '../tools/registry';
import type { LLMProvider } from '../providers/types';
import type { SkillStore } from '../skills/loader';

interface RunParams {
  streamId: string;
  conversationId: string;
  userText: string;
  skillId?: string;
  cwd: string;
  provider: LLMProvider;
  skills: SkillStore;
  webContents: WebContents;
}

const activeRuns = new Map<string, AbortController>();

export function abortRun(streamId: string): void {
  activeRuns.get(streamId)?.abort();
}

export async function run(params: RunParams): Promise<void> {
  const { streamId, conversationId, userText, skillId, cwd, provider, skills, webContents } = params;

  const send = (event: StreamEvent) => {
    if (!webContents.isDestroyed()) webContents.send('llm:event', event);
  };

  const ac = new AbortController();
  activeRuns.set(streamId, ac);

  try {
    const history = listMessages(conversationId);
    const isFirstUserMsg = history.every((m) => m.role !== 'user');

    appendMessage({ conversationId, role: 'user', content: userText });
    if (isFirstUserMsg) {
      const title = userText.trim().split(/\s+/).slice(0, 8).join(' ').slice(0, 60) || '新对话';
      renameConversation(conversationId, title);
    }

    const systemParts: string[] = [];
    if (skillId) {
      const skill = skills.get(skillId);
      if (skill) systemParts.push(skill.body);
    }
    const system = systemParts.join('\n\n');

    const tools = listTools();
    const toolSchemas = toOpenAISchemas(tools);

    for (let round = 0; round < AGENT_LIMITS.maxToolRounds; round++) {
      const messages: ChatMessage[] = listMessages(conversationId);

      let textAccum = '';
      const toolCallState = new Map<string, { id: string; name: string; args: string }>();

      const events = provider.stream({ messages, tools: toolSchemas, system, signal: ac.signal });

      let finishReason: 'stop' | 'tool_calls' | 'length' | 'unknown' = 'unknown';
      let usage: { input: number; output: number } | undefined;

      for await (const evt of events) {
        if (ac.signal.aborted) break;
        switch (evt.type) {
          case 'text_delta':
            textAccum += evt.delta;
            send({ type: 'text', streamId, delta: evt.delta });
            break;
          case 'tool_call_start':
            toolCallState.set(evt.id, { id: evt.id, name: evt.name, args: '' });
            send({ type: 'tool_call_start', streamId, id: evt.id, name: evt.name });
            break;
          case 'tool_call_args_delta': {
            const st = toolCallState.get(evt.id);
            if (st) st.args += evt.delta;
            send({ type: 'tool_call_args', streamId, id: evt.id, delta: evt.delta });
            break;
          }
          case 'tool_call_end':
            send({ type: 'tool_call_end', streamId, id: evt.id });
            break;
          case 'round_end':
            finishReason = evt.reason;
            break;
          case 'usage':
            usage = { input: evt.input, output: evt.output };
            break;
        }
      }

      const toolCalls: ToolCall[] = Array.from(toolCallState.values()).map((s) => ({
        id: s.id,
        name: s.name,
        arguments: s.args,
      }));

      appendMessage({
        conversationId,
        role: 'assistant',
        content: textAccum,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: provider.model,
        inputTokens: usage?.input,
        outputTokens: usage?.output,
      });

      if (ac.signal.aborted) break;

      if (toolCalls.length === 0 || finishReason === 'stop') break;

      for (const call of toolCalls) {
        const tool = getTool(call.name);
        let resultContent: string;
        let ok = false;
        if (!tool) {
          resultContent = `tool "${call.name}" not found`;
        } else {
          let parsedInput: unknown = {};
          try {
            parsedInput = call.arguments ? JSON.parse(call.arguments) : {};
          } catch (e) {
            resultContent = `invalid tool arguments JSON: ${(e as Error).message}`;
            appendMessage({
              conversationId,
              role: 'tool',
              content: resultContent,
              toolCallId: call.id,
            });
            send({
              type: 'tool_result',
              streamId,
              id: call.id,
              ok: false,
              preview: resultContent.slice(0, 200),
            });
            continue;
          }
          try {
            const res = await tool.execute(parsedInput, { signal: ac.signal, cwd });
            ok = res.ok;
            resultContent = res.content;
          } catch (e) {
            resultContent = `tool threw: ${(e as Error).message}`;
          }
        }

        appendMessage({
          conversationId,
          role: 'tool',
          content: resultContent,
          toolCallId: call.id,
        });
        send({
          type: 'tool_result',
          streamId,
          id: call.id,
          ok,
          preview: resultContent.slice(0, 200),
        });
      }
    }

    send({ type: 'done', streamId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    send({ type: 'error', streamId, message });
  } finally {
    activeRuns.delete(streamId);
  }
}

export function newStreamId(): string {
  return randomUUID();
}
