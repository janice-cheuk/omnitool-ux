import { useEffect } from 'react';
import styles from './ValidationOperatorMenu.module.css';

const OPERATORS = [
  'contains',
  'does not contain',
  'is from a defined list',
  'satisfies a numeric condition',
  'satisfies a date condition',
] as const;

interface ValidationOperatorMenuProps {
  anchorRect: { top: number; left: number };
  onSelect: (operator: string) => void;
  onClose: () => void;
}

export function ValidationOperatorMenu({
  anchorRect,
  onSelect,
  onClose,
}: ValidationOperatorMenuProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.menu}
      style={{ top: anchorRect.top, left: anchorRect.left }}
      role="listbox"
      aria-label="Validation operators"
    >
      {OPERATORS.map((op) => (
        <button
          key={op}
          type="button"
          className={styles.item}
          onClick={() => onSelect(op)}
          role="option"
        >
          {op}
        </button>
      ))}
    </div>
  );
}
