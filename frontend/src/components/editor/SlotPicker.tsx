import { useState, useEffect } from 'react';
import styles from './SlotPicker.module.css';

interface SlotPickerProps {
  slotNames: string[];
  anchorRect: { top: number; left: number } | null;
  filter: string;
  onSelect: (slotName: string) => void;
  onClose: () => void;
  allowCreate?: boolean;
}

function isValidSlotName(s: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(s);
}

export function SlotPicker({
  slotNames,
  anchorRect,
  filter,
  onSelect,
  onClose,
  allowCreate = false,
}: SlotPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filtered = slotNames.filter((n) =>
    n.toLowerCase().includes(filter.toLowerCase())
  );
  const canCreate = allowCreate && filter.length > 0 && isValidSlotName(filter) && !slotNames.includes(filter);
  const options = canCreate ? [filter, ...filtered] : filtered;

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, canCreate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, options.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && options[selectedIndex]) {
        e.preventDefault();
        onSelect(options[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, selectedIndex, onSelect, onClose]);

  if (!anchorRect) return null;

  return (
    <div
      className={styles.menu}
      style={{ top: anchorRect.top, left: anchorRect.left }}
      role="listbox"
      aria-label="Select or create slot"
    >
      {options.length === 0 ? (
        <div className={styles.empty}>
          {filter.length > 0
            ? 'Use snake_case (e.g. user_intent)'
            : 'Type a slot name or select existing'}
        </div>
      ) : (
        options.map((name, i) => (
          <button
            key={name}
            type="button"
            className={`${styles.item} ${i === selectedIndex ? styles.itemSelected : ''}`}
            onClick={() => onSelect(name)}
            role="option"
            aria-selected={i === selectedIndex}
          >
            {i === 0 && canCreate ? (
              <span className={styles.createLabel}>Create @{name}</span>
            ) : (
              `@${name}`
            )}
          </button>
        ))
      )}
    </div>
  );
}
