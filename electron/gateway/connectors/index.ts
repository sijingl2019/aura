import type { ConnectorDeps, GatewayConnector } from '../types';
import { LarkConnector } from './lark';
import { DingTalkConnector } from './dingtalk';

/** Instantiate the connector for a gateway's platform. */
export function createConnector(
  config: ConnectorDeps['config'],
  deps: ConnectorDeps,
): GatewayConnector {
  switch (config.platform) {
    case 'lark':
      return new LarkConnector(deps);
    case 'dingtalk':
      return new DingTalkConnector(deps);
    default:
      throw new Error(`不支持的网关平台: ${config.platform}`);
  }
}
