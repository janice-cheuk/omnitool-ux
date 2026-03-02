import { useRef, useState } from 'react';
import { parseTextToSegments, getSlotNamesFromSegments } from '../../lib/parseInline';
import { SlashCommandMenu } from './SlashCommandMenu';
import { SlotPicker } from './SlotPicker';
import styles from './FreeTextEditor.module.css';

interface FreeTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function FreeTextEditor({
  content,
  onChange,
  placeholder = "Type freely. Say 'slot user_intent', 'validate X in [a,b,c]', 'if X == Y then respond' — objects auto-detect as chips. Use / for commands, @ for slot refs.",
}: FreeTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slashAnchor, setSlashAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slotPickerAnchor, setSlotPickerAnchor] = useState<{ top: number; left: number } | null>(null);

  const segments = parseTextToSegments(content);
  const slotNames = getSlotNamesFromSegments(segments);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '/') {
      e.preventDefault();
      const el = textareaRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlashAnchor({ top: rect.bottom + 4, left: rect.left });
      }
    } else if (e.key === '@') {
      e.preventDefault();
      const el = textareaRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlotPickerAnchor({ top: rect.bottom + 4, left: rect.left });
      }
    }
  };

  return (
    <div className={styles.wrapper}>
      <textarea
        ref={textareaRef}
        className={styles.editor}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Free text editor"
        spellCheck={false}
      />
      {segments.some((s) => s.type !== 'text') && (
        <div className={styles.preview} aria-label="Auto-detected objects">
          <span className={styles.previewLabel}>Parsed:</span>
          {segments.map((seg) =>
            seg.type === 'text' ? (
              <span key={seg.id}>{seg.value}</span>
            ) : seg.type === 'slot_def' ? (
              <span key={seg.id} className={styles.chip} data-segment-id={seg.id}>
                slot {seg.slotName}
              </span>
            ) : seg.type === 'validation' ? (
              <span key={seg.id} className={styles.chip} data-segment-id={seg.id}>
                {seg.slotRef}
                {seg.intent === 'in_list' && ` in [${((seg.value as string[]) || []).join(', ')}]`}
                {seg.intent === 'numeric' && ` ${seg.operator} ${seg.value}`}
                {seg.intent === 'required' && ' is not empty'}
              </span>
            ) : seg.type === 'condition' ? (
              <span key={seg.id} className={styles.chipCondition} data-segment-id={seg.id}>
                if {seg.slotRef} {seg.operator} {seg.value} then {seg.action}
              </span>
            ) : null
          )}
        </div>
      )}
      {slashAnchor && (
        <SlashCommandMenu
          slotNames={slotNames}
          anchorRect={slashAnchor}
          onSelect={(cmd) => {
            setSlashAnchor(null);
            if (cmd.kind === 'insert_slot_ref' && cmd.slotName) {
              onChange(content + `@${cmd.slotName} `);
            } else if (cmd.kind === 'define_slot') {
              onChange(content + (content ? ' ' : '') + 'slot ');
            } else if (cmd.kind === 'add_validation') {
              onChange(content + (content ? ' ' : '') + 'validate ');
            } else if (cmd.kind === 'add_condition') {
              onChange(content + (content ? ' ' : '') + 'if  then ');
            }
          }}
          onClose={() => setSlashAnchor(null)}
        />
      )}
      {slotPickerAnchor && (
        <SlotPicker
          slotNames={slotNames}
          anchorRect={slotPickerAnchor}
          filter=""
          onSelect={(name) => {
            setSlotPickerAnchor(null);
            onChange(content + `@${name} `);
          }}
          onClose={() => setSlotPickerAnchor(null)}
        />
      )}
    </div>
  );
}
