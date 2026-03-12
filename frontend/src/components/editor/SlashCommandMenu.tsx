import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import type { ValidationType } from '../../lib/parseInline';
import type { SlotType } from '../../types';
import {
  SECTION_LABEL_CONTROLS,
  SECTION_LABEL_SLOTS,
  CONTROL_LABEL_DEFINE,
  CONTROL_LABEL_VALIDATE,
  CONTROL_LABEL_CONDITION,
  CONDITION_ACTION_LABELS,
} from '../../lib/slotAuthoring';
import styles from './SlashCommandMenu.module.css';

export type SlashCommand =
  | { kind: 'define_slot' }
  | { kind: 'add_validation' }
  | { kind: 'add_validation_type'; validationType: ValidationType }
  | { kind: 'add_condition' }
  | { kind: 'add_condition_action'; action: string }
  | { kind: 'insert_slot_ref'; slotName: string }
  | { kind: 'paragraph' };

/** Validation intents shown in the Validate submenu (intent-first UI). Maps to ValidationType + insert phrase. */
const VALIDATION_INTENTS: { type: ValidationType; label: string }[] = [
  { type: 'is_not_empty', label: 'Value must be present' },
  { type: 'contains', label: 'Value must contain…' },
  { type: 'does_not_contain', label: 'Value must not contain…' },
  { type: 'is_from_defined_list', label: 'Value from defined list' },
  { type: 'satisfies_numeric_condition', label: 'Numeric condition' },
  { type: 'satisfies_date_condition', label: 'Date condition' },
  { type: 'satisfies_boolean_condition', label: 'Value must be true or false' },
];

const SIMPLE_VALIDATION_INTENTS: { type: ValidationType; label: string }[] = [
  { type: 'contains', label: 'contains' },
  { type: 'does_not_contain', label: 'does not contain' },
  { type: 'is_from_defined_list', label: 'is from a defined list' },
  { type: 'satisfies_numeric_condition', label: 'satisfies a numeric condition' },
  { type: 'satisfies_date_condition', label: 'satisfies a date condition' },
];

interface SlashCommandMenuProps {
  slotNames: string[];
  anchorRect: { top: number; left: number } | null;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
  /** When true, show same Controls + Slots structure (slot definition step). */
  insertOnly?: boolean;
  /** When true, show only validation intents (e.g. after slot ref for type-compatible operators). */
  showOnlyValidationIntents?: boolean;
  /** When true, show only condition actions (after "then"). */
  showOnlyConditionActions?: boolean;
  /** Slot type for the ref after which we're suggesting; filters intents by type. */
  slotType?: SlotType;
  /** Render Figma 842-6525 simple validation options list. */
  simpleValidationList?: boolean;
}

const NUMERIC_VALIDATION_TYPES: ValidationType[] = ['is_not_empty', 'satisfies_numeric_condition'];
const BOOLEAN_VALIDATION_TYPES: ValidationType[] = ['is_not_empty', 'satisfies_boolean_condition'];
const STRING_VALIDATION_TYPES: ValidationType[] = [
  'is_not_empty',
  'contains',
  'does_not_contain',
  'is_from_defined_list',
];

function filterIntentsBySlotType(slotType: SlotType | undefined): { type: ValidationType; label: string }[] {
  if (!slotType) return VALIDATION_INTENTS;
  if (slotType === 'int' || slotType === 'float') {
    return VALIDATION_INTENTS.filter((i) => NUMERIC_VALIDATION_TYPES.includes(i.type));
  }
  if (slotType === 'boolean') {
    return VALIDATION_INTENTS.filter((i) => BOOLEAN_VALIDATION_TYPES.includes(i.type));
  }
  return VALIDATION_INTENTS.filter((i) => STRING_VALIDATION_TYPES.includes(i.type));
}

export function SlashCommandMenu({
  slotNames,
  anchorRect,
  onSelect,
  onClose,
  insertOnly = false,
  showOnlyValidationIntents = false,
  showOnlyConditionActions = false,
  slotType,
  simpleValidationList = false,
}: SlashCommandMenuProps) {
  const keepEditorFocus = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [validationSubmenu, setValidationSubmenu] = useState(false);
  const validationIntents = useMemo(() => filterIntentsBySlotType(slotType), [slotType]);

  if (!anchorRect) return null;

  const showValidationIntents = validationSubmenu || showOnlyValidationIntents;
  const showControlsOnly = insertOnly && !showValidationIntents && !showOnlyConditionActions;

  if (showOnlyValidationIntents && anchorRect) {
    const intents = simpleValidationList ? SIMPLE_VALIDATION_INTENTS : validationIntents;
    return (
      <div
        className={`${styles.menu} ${simpleValidationList ? styles.simpleValidationMenu : ''}`}
        style={{ top: anchorRect.top, left: anchorRect.left }}
        role="listbox"
        aria-label="Validation options"
      >
        <div className={styles.section}>
          {intents.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className={styles.item}
              onMouseDown={(e) => {
                keepEditorFocus(e);
              }}
              onClick={() => onSelect({ kind: 'add_validation_type', validationType: type })}
            >
              <span className={styles.label}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (showOnlyConditionActions && anchorRect) {
    return (
      <div
        className={styles.menu}
        style={{ top: anchorRect.top, left: anchorRect.left }}
        role="listbox"
        aria-label="Condition actions"
      >
        <div className={styles.section}>
          {Object.entries(CONDITION_ACTION_LABELS).map(([action, label]) => (
            <button
              key={action}
              type="button"
              className={styles.item}
              onMouseDown={keepEditorFocus}
              onClick={() => onSelect({ kind: 'add_condition_action', action })}
            >
              <span className={styles.label}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (showControlsOnly) {
    return (
      <div
        className={`${styles.menu} ${styles.controlsMenu}`}
        style={{ top: anchorRect.top, left: anchorRect.left }}
        role="listbox"
        aria-label="Controls"
      >
        <div className={styles.section}>
          <div className={`${styles.sectionLabel} ${styles.controlsSectionLabel}`}>{SECTION_LABEL_CONTROLS}</div>
          <button
            type="button"
            className={styles.controlsItem}
            onMouseDown={(e) => {
              keepEditorFocus(e);
            }}
            onClick={() => onSelect({ kind: 'add_validation' })}
          >
            <span className={`${styles.controlTag} ${styles.validateTag}`}>
              <span className={styles.controlIcon} aria-hidden>✣</span>
              <span className={styles.controlText}>{CONTROL_LABEL_VALIDATE}</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.controlsItem}
            onMouseDown={(e) => {
              keepEditorFocus(e);
            }}
            onClick={() => onSelect({ kind: 'add_condition' })}
          >
            <span className={`${styles.controlTag} ${styles.conditionTag}`}>
              <span className={styles.controlIcon} aria-hidden>⚡</span>
              <span className={styles.controlText}>{CONTROL_LABEL_CONDITION}</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.menu}
      style={{ top: anchorRect.top, left: anchorRect.left }}
      role="listbox"
      aria-label="Commands"
    >
      {!showValidationIntents ? (
        <>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{SECTION_LABEL_CONTROLS}</div>
            <button
              type="button"
              className={styles.item}
              onMouseDown={keepEditorFocus}
              onClick={() => onSelect({ kind: 'define_slot' })}
            >
              <span className={styles.label}>{CONTROL_LABEL_DEFINE}</span>
            </button>
            <button
              type="button"
              className={styles.item}
              onMouseDown={keepEditorFocus}
              onClick={() => setValidationSubmenu(true)}
            >
              <span className={styles.label}>{CONTROL_LABEL_VALIDATE}</span>
            </button>
            <button
              type="button"
              className={styles.item}
              onMouseDown={keepEditorFocus}
              onClick={() => onSelect({ kind: 'add_condition' })}
            >
              <span className={styles.label}>{CONTROL_LABEL_CONDITION}</span>
            </button>
          </div>
          {slotNames.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>{SECTION_LABEL_SLOTS}</div>
              {slotNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={styles.item}
                  onMouseDown={keepEditorFocus}
                  onClick={() => onSelect({ kind: 'insert_slot_ref', slotName: name })}
                >
                  <span className={styles.chip}>@{name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={styles.section}>
          <button
            type="button"
            className={styles.item}
            onMouseDown={keepEditorFocus}
            onClick={() => setValidationSubmenu(false)}
          >
            <span className={styles.label}>← Back</span>
          </button>
          {validationIntents.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className={styles.item}
              onMouseDown={keepEditorFocus}
              onClick={() => {
                onSelect({ kind: 'add_validation_type', validationType: type });
                setValidationSubmenu(false);
              }}
            >
              <span className={styles.label}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
