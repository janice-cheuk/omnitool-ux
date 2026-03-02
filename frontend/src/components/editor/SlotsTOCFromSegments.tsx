import type { InlineSegment } from '../../lib/parseInline';
import styles from './SlotsTOC.module.css';

interface SlotsTOCFromSegmentsProps {
  segments: InlineSegment[];
  selectedSegmentId: string | null;
  onSelectSlot: (segmentId: string) => void;
}

export function SlotsTOCFromSegments({
  segments,
  selectedSegmentId,
  onSelectSlot,
}: SlotsTOCFromSegmentsProps) {
  const slotDefs = segments.filter((s): s is InlineSegment & { type: 'slot_def' } => s.type === 'slot_def');
  const seen = new Set<string>();
  const ordered = slotDefs.filter((s) => {
    if (seen.has(s.slotName)) return false;
    seen.add(s.slotName);
    return true;
  });

  if (ordered.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No slots yet.</p>
        <p className={styles.emptyHint}>Type &quot;slot name&quot; or use / to add.</p>
      </div>
    );
  }

  return (
    <ul className={styles.list} role="list">
      {ordered.map((s, i) => (
        <li key={s.id} role="listitem">
          <button
            type="button"
            className={`${styles.item} ${selectedSegmentId === s.id ? styles.itemSelected : ''}`}
            onClick={() => onSelectSlot(s.id)}
            aria-current={selectedSegmentId === s.id ? 'true' : undefined}
          >
            <span className={styles.badge}>{i + 1}</span>
            <span className={styles.name}>{s.slotName}</span>
            <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
