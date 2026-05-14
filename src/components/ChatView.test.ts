import { describe, expect, it } from 'vitest';
import { getChatContentWidthClass, getChatScrollKey, getChatWidthToggleLabel } from './ChatView';

describe('getChatScrollKey', () => {
  it('changes when an empty streaming placeholder becomes visible', () => {
    const beforePlaceholder = getChatScrollKey({
      displayedMessageCount: 1,
      streamingText: '',
      streamingToolCallCount: 0,
      hasVisibleStreamingPlaceholder: false,
    });

    const afterPlaceholder = getChatScrollKey({
      displayedMessageCount: 2,
      streamingText: '',
      streamingToolCallCount: 0,
      hasVisibleStreamingPlaceholder: true,
    });

    expect(afterPlaceholder).not.toBe(beforePlaceholder);
  });
});

describe('getChatContentWidthClass', () => {
  it('uses the narrow reading width by default', () => {
    expect(getChatContentWidthClass(false)).toContain('max-w-3xl');
  });

  it('uses a wider message column in wide mode', () => {
    expect(getChatContentWidthClass(true)).toContain('max-w-6xl');
  });
});

describe('getChatWidthToggleLabel', () => {
  it('describes the action that will happen when clicked', () => {
    expect(getChatWidthToggleLabel(false)).toBe('Switch to wide mode');
    expect(getChatWidthToggleLabel(true)).toBe('Switch to narrow mode');
  });
});
