import type { ValidationRule } from '../types';
import styles from './ValidationRow.module.css';

interface ValidationRowProps {
  rule: ValidationRule;
  slotType: import('../types').SlotType;
  onChange: (rule: ValidationRule) => void;
  onRemove: () => void;
}

const NUMERIC_OPS: Array<ValidationRule['numericOp']> = ['>=', '>', '<=', '<', '==', '!='];

export function ValidationRow({ rule, onChange, onRemove }: ValidationRowProps) {
  if (rule.kind === 'defined_list') {
    const list = rule.definedList ?? [];
    return (
      <div className={styles.rule}>
        <span className={styles.label}>is from a defined list</span>
        <ul className={styles.list}>
          {list.map((item, i) => (
            <li key={i} className={styles.listItem}>
              <input
                className={styles.listInput}
                value={item}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = e.target.value.trim();
                  onChange({ ...rule, definedList: next });
                }}
                onBlur={() => {
                  const deduped = [...new Set(list.filter(Boolean))];
                  if (deduped.length !== list.length) {
                    onChange({ ...rule, definedList: deduped });
                  }
                }}
                aria-label={`List value ${i + 1}`}
              />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => onChange({ ...rule, definedList: list.filter((_, j) => j !== i) })}
                aria-label="Remove value"
              >
                ×
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={styles.addItem}
              onClick={() => onChange({ ...rule, definedList: [...list, ''] })}
            >
              + Add value
            </button>
          </li>
        </ul>
        <button type="button" className={styles.removeRule} onClick={onRemove} aria-label="Remove validation">
          Remove
        </button>
      </div>
    );
  }

  if (rule.kind === 'numeric') {
    return (
      <div className={styles.rule}>
        <select
          className={styles.opSelect}
          value={rule.numericOp ?? '>='}
          onChange={(e) => onChange({ ...rule, numericOp: e.target.value as ValidationRule['numericOp'] })}
          aria-label="Numeric operator"
        >
          {NUMERIC_OPS.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        <input
          type="number"
          className={styles.numInput}
          value={rule.numericValue ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Number(e.target.value);
            onChange({ ...rule, numericValue: v });
          }}
          placeholder="0"
          aria-label="Numeric value"
        />
        <button type="button" className={styles.removeRule} onClick={onRemove} aria-label="Remove validation">
          Remove
        </button>
      </div>
    );
  }

  return null;
}
