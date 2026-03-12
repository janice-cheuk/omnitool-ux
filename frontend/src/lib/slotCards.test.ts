import { describe, expect, it } from 'vitest';
import type { Document } from '../types';
import { appendSlotCard, getDocumentSlotCards, getSlotNamesAcrossCards, updateSlotCardContent } from './slotCards';

const baseDocument: Document = {
  id: 'doc-1',
  title: 't',
  description: 'd',
  blocks: [],
  freeTextContent: '@user_intent ',
};

describe('slotCards helpers', () => {
  it('creates a default slot card when none exist', () => {
    const cards = getDocumentSlotCards(baseDocument);
    expect(cards).toEqual([{ id: 'slot-1', content: '@user_intent ' }]);
  });

  it('updates only the targeted slot card content', () => {
    const withCards: Document = {
      ...baseDocument,
      slotCards: [
        { id: 'slot-1', content: '@user_intent ' },
        { id: 'slot-2', content: '@age ' },
      ],
    };
    const updated = updateSlotCardContent(withCards, withCards.slotCards!, 'slot-2', '@age >= 0');
    expect(updated.slotCards?.[0].content).toBe('@user_intent ');
    expect(updated.slotCards?.[1].content).toBe('@age >= 0');
  });

  it('appends an empty slot card with incremented id', () => {
    const next = appendSlotCard([{ id: 'slot-1', content: '' }]);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ id: 'slot-2', content: '' });
  });

  it('collects unique slot names across cards', () => {
    const names = getSlotNamesAcrossCards([
      { id: 'slot-1', content: '@user_intent ' },
      { id: 'slot-2', content: '@age @user_intent ' },
    ]);
    expect(names).toEqual(['user_intent', 'age']);
  });
});
