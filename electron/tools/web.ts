import { type Tool, fail, ok, truncate } from './types';
import { getWebSearch } from '../config/store';

const TIMEOUT_MS = 30_000;
const MAX_SEARCH_RESULTS = 5;

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

interface SerperResult {
  link: string;
  title: string;
  snippet: string;
}

async function tavilySearch(query: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: MAX_SEARCH_RESULTS }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { results?: TavilyResult[]; answer?: string };
  const results = data.results ?? [];
  if (results.length === 0) return '（无搜索结果）';

  const lines: string[] = [];
  if (data.answer) lines.push(`**摘要：** ${data.answer}\n`);
  results.forEach((r, i) => {
    lines.push(`${i + 1}. **${r.title}**`);
    lines.push(`   URL: ${r.url}`);
    lines.push(`   ${truncate(r.content, 400)}`);
  });
  return lines.join('\n');
}

async function serperSearch(query: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: MAX_SEARCH_RESULTS }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Serper ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { organic?: SerperResult[] };
  const results = data.organic ?? [];
  if (results.length === 0) return '（无搜索结果）';

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   URL: ${r.link}\n   ${r.snippet}`)
    .join('\n');
}

export const webSearchTool: Tool = {
  name: 'web_search',
  description:
    'Search the web for current information. Returns titles, URLs, and snippets for the top results. Requires a web search API key configured in Settings → 网络搜索.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query.' },
    },
    required: ['query'],
  },
  async execute(input, ctx) {
    const { query } = (input as { query?: string }) ?? {};
    if (!query?.trim()) return fail('missing "query"');

    const cfg = getWebSearch();
    if (!cfg || !cfg.enabled) {
      return fail(
        '网络搜索未启用。请在 设置 → 网络搜索 中配置 API 密钥并启用。',
      );
    }
    if (!cfg.apiKey.trim()) {
      return fail('网络搜索 API 密钥未设置。请在 设置 → 网络搜索 中填写。');
    }

    const timeoutAc = new AbortController();
    const timer = setTimeout(() => timeoutAc.abort(), TIMEOUT_MS);
    const abortListener = () => timeoutAc.abort();
    ctx.signal.addEventListener('abort', abortListener, { once: true });

    try {
      const text =
        cfg.provider === 'tavily'
          ? await tavilySearch(query, cfg.apiKey, timeoutAc.signal)
          : await serperSearch(query, cfg.apiKey, timeoutAc.signal);
      return ok(text);
    } catch (e) {
      return fail(`web_search failed: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
      ctx.signal.removeEventListener('abort', abortListener);
    }
  },
};
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
