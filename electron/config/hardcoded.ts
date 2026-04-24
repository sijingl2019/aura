export const AGENT_LIMITS = {
  maxToolRounds: 10,
} as const;

export const DIFY_MCP: { apiKey: string; apiHost: string } | null = {
  apiKey: 'knowledge-o45sIqfi',
  apiHost: 'http://172.21.12.12/v1',
};
// Example to enable:
// { apiKey: 'dataset-xxxxxxxxxxxxxxxx', apiHost: 'https://api.dify.ai/v1' };
