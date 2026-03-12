import { useEffect } from 'react';
import type { SlotConfig } from '../../types';
import { parseTextToSegmentsForEditor, getInsertNewlineBeforeValidationIndex } from '../../lib/parseInline';
import { PLACEHOLDER_B } from '../../lib/placeholderHelpers';
import { InlineSegmentEditor } from './InlineSegmentEditor';
import styles from './FreeTextEditor.module.css';

const PLACEHOLDER_INITIAL =
  'Start typing using @ to define a slot name. Make sure it is:\n• in snake_case\n• a unique name';

interface FreeTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  slotNames: string[];
  slotConfigs: Record<string, SlotConfig>;
  onSlotConfigChange: (slotName: string, config: SlotConfig) => void;
  onSlashKey?: (anchor: { top: number; left: number }, insertOffset: number) => void;
  onCaretPosition?: (rect: DOMRect) => void;
  onCaretOffsetChange?: (offset: number, anchor: { top: number; left: number }) => void;
  validationPromptActive?: boolean;
  focusRequest?: { seq: number; offset: number; reason: string } | null;
  onFocusRequestConsumed?: (seq: number) => void;
  caretResetSeq?: number;
  debugInteractionId?: string | null;
  debugSlotId?: string;
}

/**
 * Free-text slot editor: type @slot_name then space → green chip.
 * Dropdown opens by default only the first time a slot is defined (no saved config yet).
 * Config from the dropdown is saved globally and reused when opening that slot's chip again.
 */
export function FreeTextEditor({
  content,
  onChange,
  placeholder,
  slotNames,
  slotConfigs,
  onSlotConfigChange,
  onSlashKey,
  onCaretPosition,
  onCaretOffsetChange,
  validationPromptActive = false,
  focusRequest = null,
  onFocusRequestConsumed,
  caretResetSeq = 0,
  debugInteractionId = null,
  debugSlotId = 'slot-1',
}: FreeTextEditorProps) {
  // #region agent log
  const logFreeTextNormalization = (message: string, data: Record<string, unknown>, hypothesisId: string) => {
    if (typeof fetch === 'undefined') return;
    fetch('http://127.0.0.1:7475/ingest/85fb0133-7344-44d6-adaa-9a6e88888095', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '24a1d3' },
      body: JSON.stringify({
        sessionId: '24a1d3',
        runId: 'ghost-empty-row-debug',
        hypothesisId,
        location: 'FreeTextEditor.tsx',
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  };
  // #endregion

  const segments = parseTextToSegmentsForEditor(content);
  const slotRefs = segments.filter((s) => s.type === 'slot_ref');
  const lastSlotRef = slotRefs[slotRefs.length - 1];
  const isFirstTimeDefining =
    lastSlotRef != null && !(lastSlotRef.slotName in slotConfigs);
  const chipDefaultOpenId = isFirstTimeDefining ? lastSlotRef.id : null;
  /* Show "after slot" placeholder when content has slot refs OR user has saved slot config (so it still shows after they clear the editor) */
  const hasSlots = slotNames.length > 0 || Object.keys(slotConfigs).length > 0;
  const effectivePlaceholder =
    placeholder ?? (hasSlots ? PLACEHOLDER_B : PLACEHOLDER_INITIAL);

  /* When validation is present but not on its own line, insert newline before validation keyword so it moves to line 2. */
  useEffect(() => {
    const insertAt = getInsertNewlineBeforeValidationIndex(content);
    if (insertAt != null) {
      // #region agent log
      logFreeTextNormalization(
        'newline normalization before validation',
        {
          interactionId: debugInteractionId,
          insertAt,
          contentLen: content.length,
          newlineCount: (content.match(/\n/g) ?? []).length,
          hasValidationKeyword: /\b(contains|does not contain|is from a defined list|satisfies a numeric condition|satisfies a date condition|== true|is not empty)\b/.test(
            content
          ),
        },
        'H2'
      );
      // #endregion
      const newContent = content.slice(0, insertAt) + '\n' + content.slice(insertAt);
      onChange(newContent);
    }
  }, [content, debugInteractionId, onChange]);

  return (
    <div className={styles.wrapper}>
      <InlineSegmentEditor
        content={content}
        onChange={onChange}
        placeholder={effectivePlaceholder}
        slotNames={slotNames}
        slotConfigs={slotConfigs}
        onSlotConfigChange={onSlotConfigChange}
        chipDefaultOpenId={chipDefaultOpenId}
        onSlashKey={onSlashKey}
        onCaretPosition={onCaretPosition}
        onCaretOffsetChange={onCaretOffsetChange}
        validationPromptActive={validationPromptActive}
        focusRequest={focusRequest}
        onFocusRequestConsumed={onFocusRequestConsumed}
        caretResetSeq={caretResetSeq}
        debugInteractionId={debugInteractionId}
        debugSlotId={debugSlotId}
      />
    </div>
  );
}
