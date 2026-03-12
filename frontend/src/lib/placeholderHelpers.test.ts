/**
 * Tests for Notion-style placeholder behavior.
 * Placeholder must never be content: not in serialized state, not selectable, not in document model.
 */
import { describe, it, expect } from 'vitest';
import {
  isContentEditableEmpty,
  hasChips,
  computePlaceholderForSlotEditor,
  PLACEHOLDER_A,
  PLACEHOLDER_B,
  getPlaceholderAfterSegment,
} from './placeholderHelpers';

describe('placeholderHelpers', () => {
  describe('PLACEHOLDER_A and PLACEHOLDER_B', () => {
    it('are non-empty strings used only for display', () => {
      expect(PLACEHOLDER_A.length).toBeGreaterThan(0);
      expect(PLACEHOLDER_B).toBe('Start typing or insert using /');
    });
  });

  describe('isContentEditableEmpty', () => {
    it('returns true for null element', () => {
      expect(isContentEditableEmpty(null)).toBe(true);
    });

    it('returns true for element with no text', () => {
      const el = document.createElement('div');
      expect(isContentEditableEmpty(el)).toBe(true);
    });

    it('returns true for element with only whitespace', () => {
      const el = document.createElement('div');
      el.appendChild(document.createTextNode('   \n\t'));
      expect(isContentEditableEmpty(el)).toBe(true);
    });

    it('returns false for element with text', () => {
      const el = document.createElement('div');
      el.appendChild(document.createTextNode('hello'));
      expect(isContentEditableEmpty(el)).toBe(false);
    });
  });

  describe('computePlaceholderForSlotEditor', () => {
    it('returns PLACEHOLDER_A when no segments and no slots from config', () => {
      expect(computePlaceholderForSlotEditor([], false)).toBe(PLACEHOLDER_A);
    });

    it('returns PLACEHOLDER_B when no segments but has slots from config', () => {
      expect(computePlaceholderForSlotEditor([], true)).toBe(PLACEHOLDER_B);
    });

    it('returns PLACEHOLDER_B when only chips/whitespace segments', () => {
      expect(
        computePlaceholderForSlotEditor([{ type: 'slot_ref' }], true)
      ).toBe(PLACEHOLDER_B);
    });
  });

  describe('getPlaceholderAfterSegment', () => {
    it('returns null when segments empty', () => {
      expect(getPlaceholderAfterSegment([])).toBeNull();
    });

    it('returns value placeholder when last segment is contains validation', () => {
      expect(
        getPlaceholderAfterSegment([
          { type: 'validation', validationType: 'contains' },
        ])
      ).toBe('start typing @ to define a value name');
    });
  });

  describe('hasChips', () => {
    it('returns false for null', () => {
      expect(hasChips(null)).toBe(false);
    });

    it('returns true when element contains data-slot-ref', () => {
      const el = document.createElement('div');
      const chip = document.createElement('span');
      chip.setAttribute('data-slot-ref', 'foo');
      el.appendChild(chip);
      expect(hasChips(el)).toBe(true);
    });
  });
});
