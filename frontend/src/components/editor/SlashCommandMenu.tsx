import { useEffect } from 'react';
import styles from './SlashCommandMenu.module.css';

export type SlashCommand =
  | { kind: 'define_slot' }
  | { kind: 'add_validation' }
  | { kind: 'add_condition' }
  | { kind: 'insert_slot_ref'; slotName: string }
  | { kind: 'paragraph' };

interface SlashCommandMenuProps {
  slotNames: string[];
  anchorRect: { top: number; left: number } | null;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  slotNames,
  anchorRect,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!anchorRect) return null;

  return (
    <div
      className={styles.menu}
      style={{ top: anchorRect.top, left: anchorRect.left }}
      role="listbox"
      aria-label="Commands"
    >
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Blocks</div>
        <button
          type="button"
          className={styles.item}
          onClick={() => onSelect({ kind: 'define_slot' })}
        >
          <span className={styles.label}>Define slot</span>
        </button>
        <button
          type="button"
          className={styles.item}
          onClick={() => onSelect({ kind: 'add_validation' })}
        >
          <span className={styles.label}>Add validation</span>
        </button>
        <button
          type="button"
          className={styles.item}
          onClick={() => onSelect({ kind: 'add_condition' })}
        >
          <span className={styles.label}>Add condition</span>
        </button>
      </div>
      {slotNames.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Insert slot reference</div>
          {slotNames.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.item}
              onClick={() => onSelect({ kind: 'insert_slot_ref', slotName: name })}
            >
              <span className={styles.chip}>@{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
