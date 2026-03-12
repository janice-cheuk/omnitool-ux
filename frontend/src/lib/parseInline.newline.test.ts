import { describe, expect, it } from 'vitest';
import { getInsertNewlineBeforeValidationIndex } from './parseInline';

describe('getInsertNewlineBeforeValidationIndex', () => {
  it('inserts newline once before inline validation keyword', () => {
    const text = '@user_intent contains ';
    expect(getInsertNewlineBeforeValidationIndex(text)).toBe(13);
  });

  it('does not re-insert newline when already split onto next line', () => {
    const text = '@user_intent\n contains ';
    expect(getInsertNewlineBeforeValidationIndex(text)).toBeNull();
  });

  it('does not insert newline when slot and validation are already separated by line break and text', () => {
    const text = '@user_intent\n some context contains ';
    expect(getInsertNewlineBeforeValidationIndex(text)).toBeNull();
  });
});
