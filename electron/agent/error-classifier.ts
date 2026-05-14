export type ErrorKind =
  | 'rate_limit'      // 429 — retry with fallback
  | 'overloaded'      // 503 / 529 — retry with fallback
  | 'model_not_found' // 404 — retry with fallback
  | 'server_error'    // 5xx — retry with fallback
  | 'auth'            // 401 / 403 — do NOT retry (wrong key)
  | 'other';          // anything else — do NOT retry

export function classifyError(e: unknown): ErrorKind {
  const status: number =
    (e as any)?.status ??
    (e as any)?.statusCode ??
    (e as any)?.response?.status ??
    0;

  const message = String((e as any)?.message ?? '').toLowerCase();

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
  if (status === 401 || status === 403 || message.includes('auth') || message.includes('unauthorized')) {
    return 'auth';
  }
  if (status >= 500) {
    return 'server_error';
  }
  return 'other';
}

export function isRetryableWithFallback(kind: ErrorKind): boolean {
  return (
    kind === 'rate_limit' ||
    kind === 'overloaded' ||
    kind === 'model_not_found' ||
    kind === 'server_error'
  );
}
