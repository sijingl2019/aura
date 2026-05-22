/* eslint-disable @typescript-eslint/no-explicit-any -- 钉钉 SDK is loaded
   untyped via runtime dynamic import; its surface is necessarily `any`. */
import type { ConnectorDeps, GatewayConnector, OutboundReply } from '../types';

// SDK loaded at runtime (computed-string dynamic import) — missing dep becomes
// a gateway error status instead of a build failure, and no @types are needed.
const DINGTALK_PKG = 'dingtalk-stream';

/**
 * 钉钉 group robots cannot edit a sent message, so streaming edits are not
 * possible — we send a single message when the run completes (final render).
 * Replies go to the per-message sessionWebhook, which the connector refreshes
 * on every inbound message for the chat.
 */
class DingTalkReply implements OutboundReply {
  private sent = false;
  constructor(private readonly getWebhook: () => string | undefined) {}

  async render(text: string, opts?: { final?: boolean }): Promise<void> {
    if (!opts?.final || this.sent) return;
    const url = this.getWebhook();
    if (!url) {
      console.warn('[gateway:dingtalk] no sessionWebhook available for reply');
      return;
    }
    this.sent = true;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
    });
    if (!res.ok) {
      throw new Error(`钉钉回复失败: HTTP ${res.status}`);
    }
  }
}

export class DingTalkConnector implements GatewayConnector {
  readonly id: string;
  private client: any = null;
  // chatId → latest sessionWebhook (refreshed on each inbound message).
  private webhooks = new Map<string, string>();

  constructor(private readonly deps: ConnectorDeps) {
    this.id = deps.config.id;
  }

  async start(): Promise<void> {
    const mod: any = await import(DINGTALK_PKG).catch(() => null);
    if (!mod) {
      throw new Error(`缺少依赖 ${DINGTALK_PKG}，请在项目根目录运行 npm install ${DINGTALK_PKG}`);
    }
    const { DWClient, TOPIC_ROBOT } = mod;
    const { appId, appSecret } = this.deps.config;
    if (!appId || !appSecret) throw new Error('钉钉网关缺少 ClientId / ClientSecret');

    this.client = new DWClient({ clientId: appId, clientSecret: appSecret });

    this.client.registerCallbackListener(TOPIC_ROBOT, (res: any) => {
      try {
        const body = JSON.parse(res.data);
        const text: string = (body?.text?.content ?? '').trim();
        const chatId: string = body?.conversationId ?? '';
        const userId: string = body?.senderStaffId ?? body?.senderId ?? '';
        if (body?.sessionWebhook) this.webhooks.set(chatId, body.sessionWebhook);

        // Acknowledge receipt so 钉钉 does not redeliver.
        try {
          this.client.send(res.headers.messageId, {});
        } catch {
          /* some SDK versions auto-ack — ignore */
        }

        if (chatId && text) {
          this.deps.onMessage({ chatId, userId, userName: body?.senderNick, text });
        }
      } catch (e) {
        console.warn(`[gateway:dingtalk] event handling failed: ${(e as Error).message}`);
      }
    });

    await this.client.connect();
    this.deps.onStatus('connected');
  }

  async stop(): Promise<void> {
    try {
      this.client?.disconnect?.();
    } catch {
      /* ignore */
    }
    this.client = null;
    this.webhooks.clear();
  }

  reply(chatId: string): OutboundReply {
    return new DingTalkReply(() => this.webhooks.get(chatId));
  }
}
