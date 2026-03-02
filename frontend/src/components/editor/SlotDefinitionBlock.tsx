import { useState } from 'react';
import type { SlotDefinitionBlock as SlotDefBlock, SlotType } from '../../types';
import styles from './SlotDefinitionBlock.module.css';

const SLOT_TYPES: SlotType[] = ['string', 'int', 'float', 'enum', 'boolean'];

interface SlotDefinitionBlockProps {
  block: SlotDefBlock;
  onUpdate: (updates: Partial<SlotDefBlock>) => void;
}

export function SlotDefinitionBlock({ block, onUpdate }: SlotDefinitionBlockProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(block.slotName);

  const commitName = () => {
    setEditingName(false);
    const v = nameValue.trim().toLowerCase().replace(/\s+/g, '_') || block.slotName;
    setNameValue(v);
    if (v !== block.slotName) onUpdate({ slotName: v });
  };

  return (
    <div className={styles.block}>
      <span className={styles.pill}>Slot</span>
      {editingName ? (
        <input
          className={styles.nameInput}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') {
              setNameValue(block.slotName);
              setEditingName(false);
            }
          }}
          autoFocus
          aria-label="Slot name"
        />
      ) : (
        <button
          type="button"
          className={styles.chip}
          onClick={() => setEditingName(true)}
          aria-label="Edit slot name"
        >
          {block.slotName}
        </button>
      )}
      <select
        className={styles.typeChip}
        value={block.slotType}
        onChange={(e) => onUpdate({ slotType: e.target.value as SlotType })}
        aria-label="Slot type"
      >
        {SLOT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}
