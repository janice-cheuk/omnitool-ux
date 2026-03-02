import { useState, useEffect } from 'react';
import styles from './SlotPicker.module.css';

interface SlotPickerProps {
  slotNames: string[];
  anchorRect: { top: number; left: number } | null;
  filter: string;
  onSelect: (slotName: string) => void;
  onClose: () => void;
}

export function SlotPicker({
  slotNames,
  anchorRect,
  filter,
  onSelect,
  onClose,
}: SlotPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filtered = slotNames.filter((n) =>
    n.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (!anchorRect || slotNames.length === 0) return null;

  return (
    <div
      className={styles.menu}
      style={{ top: anchorRect.top, left: anchorRect.left }}
      role="listbox"
      aria-label="Select slot"
    >
      {filtered.length === 0 ? (
        <div className={styles.empty}>No slots match</div>
      ) : (
        filtered.map((name, i) => (
          <button
            key={name}
            type="button"
            className={`${styles.item} ${i === selectedIndex ? styles.itemSelected : ''}`}
            onClick={() => onSelect(name)}
            role="option"
            aria-selected={i === selectedIndex}
          >
            @{name}
          </button>
        ))
      )}
    </div>
  );
}
