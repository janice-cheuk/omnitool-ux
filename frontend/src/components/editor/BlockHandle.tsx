import { useState, useRef, useEffect } from 'react';
import type { Block } from '../../types';
import styles from './BlockHandle.module.css';

interface BlockHandleProps {
  block: Block;
  onDelete: () => void;
  onConvert: (toType: Block['type']) => void;
}

export function BlockHandle({
  block,
  onDelete,
  onConvert,
}: BlockHandleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const convertOptions = (
    [
      { type: 'paragraph' as const, label: 'Convert to paragraph' },
      { type: 'slot_definition' as const, label: 'Convert to slot' },
      { type: 'validation' as const, label: 'Convert to validation' },
      { type: 'condition' as const, label: 'Convert to condition' },
    ] as const
  ).filter((o) => o.type !== block.type);

  return (
    <div className={styles.handle} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={styles.handleIcon}
        onClick={toggleMenu}
        aria-label="Block actions"
        aria-expanded={menuOpen}
      >
        ⋮⋮
      </button>
      {menuOpen && (
        <div ref={menuRef} className={styles.menu} role="menu">
          {convertOptions.map((opt) => (
            <button
              key={opt.type}
              type="button"
              className={styles.menuItem}
              onClick={() => {
                onConvert(opt.type);
                setMenuOpen(false);
              }}
              role="menuitem"
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
            role="menuitem"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
