/* eslint-disable @typescript-eslint/no-explicit-any -- 飞书 SDK is loaded
   untyped via runtime dynamic import; its surface is necessarily `any`. */
import type { ConnectorDeps, GatewayConnector, OutboundReply } from '../types';

// SDK package loaded at runtime so a missing dependency surfaces as a gateway
// error status rather than a build failure. The computed-string dynamic import
// also keeps TypeScript from requiring @larksuiteoapi/node-sdk's types.
const LARK_PKG = '@larksuiteoapi/node-sdk';

/** Per-chat outbound channel. First render sends a text message; subsequent
 *  renders edit it in place (飞书 supports editing text messages). */
class LarkReply implements OutboundReply {
  private messageId: string | null = null;
  private sending = false;

  constructor(
    private readonly client: any,
    private readonly chatId: string,
  ) {}

  async render(text: string): Promise<void> {
    if (this.sending) return; // drop overlapping edits; sink coalesces via dirty flag
    this.sending = true;
    const content = JSON.stringify({ text });
    try {
      if (!this.messageId) {
        const res = await this.client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: { receive_id: this.chatId, msg_type: 'text', content },
        });
        this.messageId = res?.data?.message_id ?? res?.message_id ?? null;
      } else {
        await this.client.im.message.update({
          path: { message_id: this.messageId },
          data: { msg_type: 'text', content },
        });
      }
    } finally {
      this.sending = false;
    }
  }
}

export class LarkConnector implements GatewayConnector {
  readonly id: string;
  private wsClient: any = null;
  private client: any = null;
  private replies = new Map<string, LarkReply>();

  constructor(private readonly deps: ConnectorDeps) {
    this.id = deps.config.id;
  }

  async start(): Promise<void> {
    const Lark: any = await import(LARK_PKG).catch(() => null);
    if (!Lark) {
      throw new Error(`缺少依赖 ${LARK_PKG}，请在项目根目录运行 npm install ${LARK_PKG}`);
    }
    const { appId, appSecret } = this.deps.config;
    if (!appId || !appSecret) throw new Error('飞书网关缺少 App ID / App Secret');

    this.client = new Lark.Client({ appId, appSecret });
    this.wsClient = new Lark.WSClient({ appId, appSecret });

    const dispatcher = new Lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        try {
          const message = data?.message;
          if (!message) return;
          const sender = data?.sender?.sender_id ?? {};
          const userId: string = sender.open_id || sender.user_id || sender.union_id || '';
          let text = '';
          try {
            text = JSON.parse(message.content)?.text ?? '';
          } catch {
            /* non-text message — ignore */
          }
          // Strip the @bot mention placeholders 飞书 injects (e.g. "@_user_1").
          text = text.replace(/@_user_\d+/g, '').trim();
          if (!text) return;
          this.deps.onMessage({ chatId: message.chat_id, userId, text });
        } catch (e) {
          console.warn(`[gateway:lark] event handling failed: ${(e as Error).message}`);
        }
      },
    });

    // WSClient.start manages its own reconnection loop; it does not reject on
    // transient drops. Treat a successful start() call as "connected".
    await this.wsClient.start({ eventDispatcher: dispatcher });
    this.deps.onStatus('connected');
  }

  async stop(): Promise<void> {
    // 飞书 WSClient has no documented public stop in all versions — best-effort.
    try {
      this.wsClient?.client?.close?.();
      this.wsClient?.stop?.();
    } catch {
      /* ignore */
    }
    this.wsClient = null;
    this.client = null;
    this.replies.clear();
  }

  reply(chatId: string): OutboundReply {
    let r = this.replies.get(chatId);
    if (!r) {
      r = new LarkReply(this.client, chatId);
      this.replies.set(chatId, r);
    }
    return r;
  }
}
