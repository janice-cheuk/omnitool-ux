import { describe, it, expect } from 'vitest';
import { ensureValidateRowState } from './validateRow';

describe('ensureValidateRowState', () => {
  it('creates exactly one validate row plan on first validate', () => {
    const out = ensureValidateRowState({
      content: '@user_intent',
      hasValidation: false,
      hasPrompt: false,
      requestedOffset: 11,
    });
    expect(out.ensuredContent).toBe('@user_intent\n');
    expect(out.ensuredInsertOffset).toBe(12);
    expect(out.shouldOpenPrompt).toBe(true);
  });

  it('does not open another validate prompt when validate exists', () => {
    const out = ensureValidateRowState({
      content: '@user_intent\n contains ',
      hasValidation: true,
      hasPrompt: false,
      requestedOffset: 20,
    });
    expect(out.shouldOpenPrompt).toBe(false);
    expect(out.ensuredContent).toBe('@user_intent\n contains ');
  });

  it('does not open another prompt while prompt is already active', () => {
    const out = ensureValidateRowState({
      content: '@user_intent\n',
      hasValidation: false,
      hasPrompt: true,
      requestedOffset: 12,
    });
    expect(out.shouldOpenPrompt).toBe(false);
    expect(out.ensuredInsertOffset).toBe(12);
  });
});
