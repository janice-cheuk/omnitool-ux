import type { Slot } from '../types';
import styles from './SlotList.module.css';

interface SlotListProps {
  slots: Slot[];
  selectedSlotId: string | null;
  onSelectSlot: (id: string) => void;
}

function statusDot(status: Slot['status']) {
  if (status === 'error') return styles.dotError;
  if (status === 'loading') return styles.dotLoading;
  return styles.dotOk;
}

export function SlotList({ slots, selectedSlotId, onSelectSlot }: SlotListProps) {
  if (slots.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No slots yet. Add a slot or ask the assistant to create slots.</p>
        <button type="button" className={styles.emptyCta}>Add slot</button>
      </div>
    );
  }

  return (
    <ul className={styles.list} role="list">
      {slots.map((slot) => (
        <li key={slot.id} role="listitem">
          <button
            type="button"
            className={`${styles.item} ${selectedSlotId === slot.id ? styles.itemSelected : ''}`}
            onClick={() => onSelectSlot(slot.id)}
            aria-current={selectedSlotId === slot.id ? 'true' : undefined}
            aria-label={`Slot ${slot.order}: ${slot.name}`}
          >
            <span className={styles.badge}>{slot.order}</span>
            <span className={styles.name}>{slot.name}</span>
            <span className={`${styles.dot} ${statusDot(slot.status)}`} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
