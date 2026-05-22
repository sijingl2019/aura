import type { GatewayConfig, GatewayListItem, GatewayRuntimeStatus } from '@shared/types';
import { getGateways, resolveGateway } from '../config/store';
import type { SkillStore } from '../skills/loader';
import { createConnector } from './connectors';
import { handleInbound } from './router';
import type { GatewayConnector, StatusListener } from './types';

/**
 * Owns the lifecycle of every platform connector: starts enabled gateways on
 * app launch, hot-restarts them on config change, routes inbound messages to
 * the agent, and reports connection status to the renderer.
 */
class GatewayManager {
  private connectors = new Map<string, GatewayConnector>();
  private statuses = new Map<string, GatewayRuntimeStatus>();
  private skills: SkillStore | null = null;
  private listeners = new Set<StatusListener>();

  init(skills: SkillStore): void {
    this.skills = skills;
  }

  onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(id: string, status: GatewayRuntimeStatus['status'], detail?: string): void {
    const next: GatewayRuntimeStatus = { id, status, detail };
    this.statuses.set(id, next);
    for (const l of this.listeners) l(next);
  }

  list(): GatewayListItem[] {
    return getGateways().map((config) => ({
      config,
      status: this.statuses.get(config.id) ?? { id: config.id, status: 'stopped' },
    }));
  }

  async startAll(): Promise<void> {
    for (const config of getGateways()) {
      if (config.enabled) await this.start(config.id);
    }
  }

  async start(id: string): Promise<void> {
    const config = resolveGateway(id);
    if (!config) return;
    if (this.connectors.has(id)) await this.stop(id);
    if (!this.skills) {
      console.warn('[gateway] manager not initialized (no skills store)');
      return;
    }
    const skills = this.skills;

    let connector: GatewayConnector;
    try {
      connector = createConnector(config, {
        config,
        onMessage: (msg) => {
          void handleInbound(config, msg, connector.reply(msg.chatId), skills).catch((e) => {
            console.warn(`[gateway:${config.platform}] handleInbound failed: ${(e as Error).message}`);
          });
        },
        onStatus: (status, detail) => this.setStatus(id, status, detail),
      });
    } catch (e) {
      this.setStatus(id, 'error', (e as Error).message);
      return;
    }

    this.connectors.set(id, connector);
    this.setStatus(id, 'connecting');
    try {
      await connector.start();
    } catch (e) {
      this.setStatus(id, 'error', (e as Error).message);
      this.connectors.delete(id);
    }
  }

  async stop(id: string): Promise<void> {
    const connector = this.connectors.get(id);
    if (!connector) {
      this.setStatus(id, 'stopped');
      return;
    }
    try {
      await connector.stop();
    } catch (e) {
      console.warn(`[gateway] stop failed for ${id}: ${(e as Error).message}`);
    }
    this.connectors.delete(id);
    this.setStatus(id, 'stopped');
  }

  /** Re-apply config after an upsert: restart if enabled, stop if disabled. */
  async restart(config: GatewayConfig): Promise<void> {
    await this.stop(config.id);
    if (config.enabled) await this.start(config.id);
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.connectors.keys()].map((id) => this.stop(id)));
  }
}

export const gatewayManager = new GatewayManager();
