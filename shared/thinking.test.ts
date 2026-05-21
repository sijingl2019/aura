import { describe, expect, it } from 'vitest';
import { shouldSurfaceThinking } from './thinking';

describe('shouldSurfaceThinking', () => {
  it('surfaces thinking by default unless the user explicitly disables it', () => {
    expect(shouldSurfaceThinking({ enableThinking: false })).toBe(false);
    expect(shouldSurfaceThinking({})).toBe(true);
    expect(shouldSurfaceThinking({ enableThinking: true })).toBe(true);
  });
});
