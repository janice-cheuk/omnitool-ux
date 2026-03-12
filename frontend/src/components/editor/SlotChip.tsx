import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SlotType } from '../../types';
import styles from './SlotChip.module.css';

const SLOT_TYPES: SlotType[] = ['string', 'int', 'float', 'enum', 'boolean'];

interface SlotChipProps {
  slotName: string;
  slotType?: SlotType;
  dependencies?: string[];
  defaultValues?: string;
  slotNames: string[];
  onChange?: (config: { slotType: SlotType; dependencies: string[]; defaultValues: string }) => void;
  dataSegmentId?: string;
  /** When true, dropdown is open by default (e.g. right after creating the slot with @name + space) */
  defaultOpen?: boolean;
}

export function SlotChip({
  slotName,
  slotType = 'string',
  dependencies = [],
  defaultValues = '',
  slotNames,
  onChange,
  dataSegmentId,
  defaultOpen = false,
}: SlotChipProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [localType, setLocalType] = useState<SlotType>(slotType);
  const [localDeps, setLocalDeps] = useState<string>(dependencies.join(', '));
  const [localDefaults, setLocalDefaults] = useState(defaultValues);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);
  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setLocalType(slotType);
      setLocalDeps(dependencies.join(', '));
      setLocalDefaults(defaultValues);
    }
    prevOpenRef.current = open;
  }, [open, slotType, dependencies, defaultValues]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom + 4, left: rect.left });
    } else {
      setDropdownRect(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && buttonRef.current && !buttonRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleApply = () => {
    onChange?.({
      slotType: localType,
      dependencies: localDeps.split(',').map((s) => s.trim()).filter(Boolean),
      defaultValues: localDefaults,
    });
    setOpen(false);
  };

  const dropdownContent = open && dropdownRect && (
    <div
      ref={panelRef}
      className={styles.dropdown}
      style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, zIndex: 1000 }}
    >
      <div className={styles.dropdownSection}>
        <label className={styles.label}>Slot Type</label>
        <select
          className={styles.select}
          value={localType}
          onChange={(e) => setLocalType(e.target.value as SlotType)}
        >
          {SLOT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className={styles.dropdownSection}>
        <label className={styles.label}>Dependencies</label>
        <input
          type="text"
          className={styles.input}
          placeholder={slotNames.length > 0 ? `e.g. ${slotNames.slice(0, 2).join(', ')}` : 'Select slot(s)'}
          value={localDeps}
          onChange={(e) => setLocalDeps(e.target.value)}
        />
      </div>
      <div className={styles.dropdownSection}>
        <label className={styles.label}>Default values?</label>
        <input
          type="text"
          className={styles.input}
          placeholder="Enter any default values"
          value={localDefaults}
          onChange={(e) => setLocalDefaults(e.target.value)}
        />
      </div>
      <button type="button" className={styles.applyBtn} onClick={handleApply}>
        Apply
      </button>
    </div>
  );

  return (
    <span className={styles.chipWrapper} data-segment-id={dataSegmentId}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.chip}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={styles.chipIcon} aria-hidden>ⓘ</span>
        {/* Display slot name only (no @); per Figma 842-6673 */}
        <span className={styles.chipName}>{slotName}</span>
        <span className={styles.chipChevron} aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </span>
  );
}
