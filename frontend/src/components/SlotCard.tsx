import { useState, useRef, useEffect } from 'react';
import type { Slot, ValidationRule } from '../types';
import { ValidationRow } from './ValidationRow';
import styles from './SlotCard.module.css';

interface SlotCardProps {
  slot: Slot;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onAddValidation: () => void;
  onUpdate: (slot: Slot) => void;
}

export function SlotCard({
  slot,
  isSelected,
  onSelect,
  onRename,
  onAddValidation,
  onUpdate,
}: SlotCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(slot.name);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setNameValue(slot.name);
  }, [slot.name]);

  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const commitName = () => {
    setEditingName(false);
    const v = nameValue.trim().replace(/\s+/g, '_').toLowerCase() || slot.name;
    setNameValue(v);
    if (v !== slot.name) onRename(v);
  };

  const toggleExpand = () => {
    onUpdate({ ...slot, expanded: !slot.expanded });
  };

  const hasError = slot.status === 'error';

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${hasError ? styles.cardError : ''} ${isSelected ? styles.cardSelected : ''}`}
      aria-expanded={slot.expanded}
      data-slot-id={slot.id}
    >
      <header className={styles.header} onClick={onSelect}>
        <button
          type="button"
          className={styles.caret}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand();
          }}
          aria-label={slot.expanded ? 'Collapse slot' : 'Expand slot'}
        >
          {slot.expanded ? '▾' : '▸'}
        </button>
        <span className={styles.pill}>Slot {slot.order}</span>
        {editingName ? (
          <input
            className={styles.nameInput}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setNameValue(slot.name);
                setEditingName(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            aria-label="Edit slot name"
          />
        ) : (
          <>
            <span className={styles.name}>{slot.name}</span>
            <button
              type="button"
              className={styles.editBtn}
              onClick={(e) => {
                e.stopPropagation();
                setEditingName(true);
              }}
              aria-label="Edit slot name"
            >
              ✎
            </button>
          </>
        )}
      </header>

      {slot.expanded && (
        <div className={styles.body}>
          <div className={styles.defineRow}>
            <span className={styles.chip}>Define</span>
            <select
              className={styles.typeSelect}
              value={slot.type}
              onChange={(e) => onUpdate({ ...slot, type: e.target.value as Slot['type'] })}
              aria-label="Slot type"
            >
              <option value="string">string</option>
              <option value="int">int</option>
              <option value="float">float</option>
              <option value="enum">enum</option>
              <option value="boolean">boolean</option>
            </select>
            <span className={styles.slotNameRef}>{slot.name}</span>
          </div>

          <div className={styles.validationRow}>
            <span className={styles.chip}>Validation</span>
            <div className={styles.validationRules}>
              {slot.validations.map((rule) => (
                <ValidationRow
                  key={rule.id}
                  rule={rule as ValidationRule}
                  slotType={slot.type}
                  onChange={(updated) => {
                    onUpdate({
                      ...slot,
                      validations: slot.validations.map((r) => (r.id === rule.id ? updated : r)),
                    });
                  }}
                  onRemove={() => {
                    onUpdate({
                      ...slot,
                      validations: slot.validations.filter((r) => r.id !== rule.id),
                    });
                  }}
                />
              ))}
              <button
                type="button"
                className={styles.addValidation}
                onClick={onAddValidation}
                aria-label="Add validation"
              >
                + Add validation
              </button>
            </div>
          </div>

          <p className={styles.hint}>Start typing or insert using /</p>
        </div>
      )}
    </article>
  );
}
