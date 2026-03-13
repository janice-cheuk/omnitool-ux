import type { SlotConfig } from '../../types';
import { parseTextToSegmentsForEditor } from '../../lib/parseInline';
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
  caretResetSeq?: number;
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
  caretResetSeq = 0,
}: FreeTextEditorProps) {
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
        caretResetSeq={caretResetSeq}
      />
    </div>
  );
}
