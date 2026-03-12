import type { Document, SlotCardDraft } from '../types';
import { getSlotNamesFromSegments, parseTextToSegmentsForEditor } from './parseInline';

export function getDocumentSlotCards(document: Document): SlotCardDraft[] {
  if (document.slotCards && document.slotCards.length > 0) {
    return document.slotCards;
  }
  return [{ id: 'slot-1', content: document.freeTextContent ?? '' }];
}

export function updateSlotCardContent(
  document: Document,
  slotCards: SlotCardDraft[],
  slotId: string,
  newContent: string
): Document {
  const nextCards = slotCards.map((card) => (card.id === slotId ? { ...card, content: newContent } : card));
  return {
    ...document,
    freeTextContent: slotId === slotCards[0]?.id ? newContent : document.freeTextContent,
    slotCards: nextCards,
  };
}

export function appendSlotCard(slotCards: SlotCardDraft[]): SlotCardDraft[] {
  const nextId = `slot-${slotCards.length + 1}`;
  return [...slotCards, { id: nextId, content: '' }];
}

export function getSlotNamesAcrossCards(slotCards: SlotCardDraft[]): string[] {
  return Array.from(
    new Set(slotCards.flatMap((card) => getSlotNamesFromSegments(parseTextToSegmentsForEditor(card.content ?? ''))))
  );
}
