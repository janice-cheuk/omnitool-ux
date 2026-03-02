import type { ValidationBlock as ValidationBlockType } from '../../types';
import styles from './ValidationBlock.module.css';

interface ValidationBlockProps {
  block: ValidationBlockType;
  onUpdate: (updates: Partial<ValidationBlockType>) => void;
}

export function ValidationBlock({ block, onUpdate }: ValidationBlockProps) {
  if (block.intent === 'in_list') {
    const list = (block.value as string[]) || [];
    return (
      <div className={styles.block}>
        <span className={styles.pill}>Validation</span>
        <span className={styles.chip}>@{block.slotRef}</span>
        <span className={styles.op}>is one of</span>
        <span className={styles.list}>
          [
          {list.map((item, i) => (
            <span key={i} className={styles.listItem}>
              <input
                className={styles.listInput}
                value={item}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = e.target.value;
                  onUpdate({ value: next });
                }}
                onBlur={() => {
                  const deduped = [...new Set(list.filter(Boolean))];
                  if (deduped.length !== list.length) onUpdate({ value: deduped });
                }}
              />
              {i < list.length - 1 ? ', ' : ''}
            </span>
          ))}
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onUpdate({ value: [...list, ''] })}
          >
            + add
          </button>
          ]
        </span>
      </div>
    );
  }

  if (block.intent === 'numeric') {
    return (
      <div className={styles.block}>
        <span className={styles.pill}>Validation</span>
        <span className={styles.chip}>@{block.slotRef}</span>
        <select
          className={styles.opSelect}
          value={block.operator || '>='}
          onChange={(e) => onUpdate({ operator: e.target.value })}
        >
          {['>=', '<=', '>', '<', '==', '!='].map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        <input
          type="number"
          className={styles.numInput}
          value={block.value ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Number(e.target.value);
            onUpdate({ value: v });
          }}
          placeholder="0"
        />
      </div>
    );
  }

  if (block.intent === 'required') {
    return (
      <div className={styles.block}>
        <span className={styles.pill}>Validation</span>
        <span className={styles.chip}>@{block.slotRef}</span>
        <span className={styles.op}>is not empty</span>
      </div>
    );
  }

  return null;
}
