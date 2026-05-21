import { describe, expect, it } from 'vitest';
import { buildPromptText, resolveSystemPromptSnapshot } from './system-prompt-cache';

describe('resolveSystemPromptSnapshot', () => {
  it('reuses a stored prompt snapshot for later turns', () => {
    expect(resolveSystemPromptSnapshot({
      storedPrompt: 'stable prompt',
      freshPrompt: 'changed memory prompt',
      compressedSummary: '',
    })).toEqual({
      prompt: 'stable prompt',
      shouldStore: false,
    });
  });

  it('stores the fresh prompt when no snapshot exists', () => {
    expect(resolveSystemPromptSnapshot({
      storedPrompt: null,
      freshPrompt: 'fresh prompt',
      compressedSummary: '',
    })).toEqual({
      prompt: 'fresh prompt',
      shouldStore: true,
    });
  });

  it('appends compression summaries without replacing the stored snapshot', () => {
    expect(resolveSystemPromptSnapshot({
      storedPrompt: 'stable prompt',
      freshPrompt: 'changed memory prompt',
      compressedSummary: 'summary',
    })).toEqual({
      prompt: 'stable prompt\n\nsummary',
      shouldStore: false,
    });
  });
});

describe('buildPromptText', () => {
  it('injects skill instructions into the current user prompt instead of the system prompt', () => {
    expect(buildPromptText({
      userText: 'write tests',
      expandedUserText: 'write tests',
      skillBody: 'Use TDD.',
    })).toContain('Use TDD.');
  });
});
