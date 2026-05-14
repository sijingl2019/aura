import { describe, expect, it } from 'vitest';
import { getChatScrollKey } from './ChatView';

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
