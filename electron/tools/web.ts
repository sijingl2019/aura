import { type Tool, fail, ok, truncate } from './types';

const TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 16 * 1024;

export const webFetchTool: Tool = {
  name: 'web_fetch',
  description: 'HTTP GET a URL (http/https only). Returns response headers and body (truncated to 16KB).',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Absolute http(s) URL.' },
    },
    required: ['url'],
  },
  async execute(input, ctx) {
    const { url } = (input as { url?: string }) ?? {};
    if (!url) return fail('missing "url"');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return fail(`invalid URL: ${url}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fail(`unsupported protocol: ${parsed.protocol}`);
    }

    const timeoutAc = new AbortController();
    const timer = setTimeout(() => timeoutAc.abort(), TIMEOUT_MS);
    const abortListener = () => timeoutAc.abort();
    ctx.signal.addEventListener('abort', abortListener, { once: true });

    try {
      const res = await fetch(url, { signal: timeoutAc.signal, redirect: 'follow' });
      const headerLines = [`HTTP ${res.status} ${res.statusText}`];
      res.headers.forEach((v, k) => headerLines.push(`${k}: ${v}`));
      const text = await res.text();
      return ok(`${headerLines.join('\n')}\n\n${truncate(text, MAX_BODY_BYTES)}`);
    } catch (e) {
      return fail(`fetch failed: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
      ctx.signal.removeEventListener('abort', abortListener);
    }
  },
};
