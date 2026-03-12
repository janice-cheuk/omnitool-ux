export interface EnsureValidateRowInput {
  content: string;
  hasValidation: boolean;
  hasPrompt: boolean;
  requestedOffset: number;
}

export interface EnsureValidateRowOutput {
  ensuredContent: string;
  ensuredInsertOffset: number;
  shouldOpenPrompt: boolean;
}

/**
 * Idempotent validate-row planner:
 * - ensures a second line exists
 * - computes insertion offset on/after line 2
 * - opens prompt only if no validation and no prompt currently active
 */
export function ensureValidateRowState({
  content,
  hasValidation,
  hasPrompt,
  requestedOffset,
}: EnsureValidateRowInput): EnsureValidateRowOutput {
  let ensuredContent = content;
  if (!ensuredContent.includes('\n')) {
    ensuredContent += '\n';
  }
  const newlineIdx = ensuredContent.indexOf('\n');
  const ensuredInsertOffset = newlineIdx >= 0 ? Math.max(requestedOffset, newlineIdx + 1) : requestedOffset;
  return {
    ensuredContent,
    ensuredInsertOffset,
    shouldOpenPrompt: !hasValidation && !hasPrompt,
  };
}
