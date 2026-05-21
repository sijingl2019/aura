export type ErrorKind =
  | 'rate_limit'      // 429
  | 'overloaded'      // 503 / 529
  | 'model_not_found' // 404
  | 'bad_request'     // 400 / 422 (e.g. unknown model on a lenient endpoint)
  | 'server_error'    // 5xx
  | 'auth'            // 401 / 403 (a fallback provider has its own key, so still worth trying)
  | 'other';          // unknown — likely a local/parse bug; do NOT burn fallbacks

export function classifyError(e: unknown): ErrorKind {
  let status: number =
    (e as any)?.status ??
    (e as any)?.statusCode ??
    (e as any)?.response?.status ??
    0;

  const message = String((e as any)?.message ?? '').toLowerCase();

  // pi-ai often surfaces errors as plain strings without a status field
  // (e.g. "400 status code (no body)"). Parse a 4xx/5xx code from the text.
  if (!status) {
    const m = message.match(/\b([45]\d{2})\b/);
    if (m) status = Number(m[1]);
  }

  if (status === 429 || message.includes('rate limit') || message.includes('too many request')) {
    return 'rate_limit';
  }
  if (
    status === 529 ||
    status === 503 ||
    message.includes('overload') ||
    message.includes('service unavailable')
  ) {
    return 'overloaded';
  }
  if (
    status === 404 ||
    message.includes('model not found') ||
    message.includes('no such model') ||
    message.includes('does not exist')
  ) {
    return 'model_not_found';
  }
  if (
    status === 401 ||
    status === 403 ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('invalid api key')
  ) {
    return 'auth';
  }
  if (status === 400 || status === 422) {
    return 'bad_request';
  }
  if (status >= 500) {
    return 'server_error';
  }
  return 'other';
}

/**
 * Whether to try the next provider in the fallback chain. Almost any provider-side
 * failure may be resolved by a different provider/model/key, so we retry everything
 * except `other` (unknown errors, often a local bug we shouldn't mask).
 */
export function isRetryableWithFallback(kind: ErrorKind): boolean {
  return kind !== 'other';
}
