import type { GatewayConfig, GatewayRuntimeStatus } from '@shared/types';

/** A message received from an external IM platform, normalized across connectors. */
export interface InboundMessage {
  /** Stable per-conversation key on the platform (group chat id or 1:1 chat id). */
  chatId: string;
  /** The sender's platform user id — checked against the gateway allow-list. */
  userId: string;
  userName?: string;
  /** Plain-text content (mentions / rich blocks already stripped by the connector). */
  text: string;
}

/**
 * Low-level outbound channel for one chat. The connector owns the platform
 * message id: the first `render` sends a new message, later ones edit it.
 * The generic throttling/streaming logic lives in GatewaySink, not here.
 */
export interface OutboundReply {
  render(text: string, opts?: { final?: boolean }): Promise<void>;
}

/**
 * A platform connector maintains a long-lived (WebSocket) connection, emits
 * normalized InboundMessages, and hands out OutboundReply channels per chat.
 */
export interface GatewayConnector {
  readonly id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  reply(chatId: string): OutboundReply;
}

export type StatusListener = (status: GatewayRuntimeStatus) => void;

export interface ConnectorDeps {
  config: GatewayConfig;
  /** Called by the connector for every inbound message it receives. */
  onMessage: (msg: InboundMessage) => void;
  /** Report connection state transitions back to the manager. */
  onStatus: (status: GatewayRuntimeStatus['status'], detail?: string) => void;
}
