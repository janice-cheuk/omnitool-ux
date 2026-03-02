import type { Block, SlotDefinitionBlock } from '../../types';
import styles from './SlotsTOC.module.css';

type SlotStatus = 'ok' | 'warning' | 'error';

function getSlotStatus(
  block: SlotDefinitionBlock,
  blocks: Block[]
): SlotStatus {
  const slotName = block.slotName;
  const isReferenced = blocks.some((b) => {
    if (b.type === 'validation' && b.slotRef === slotName) return true;
    if (b.type === 'condition' && b.slotRef === slotName) return true;
    return false;
  });
  const hasConfig = block.missingSlotConfig?.configured ?? false;
  const isReferencedInCondition = blocks.some(
    (b) => b.type === 'condition' && b.slotRef === slotName
  );

  if (!hasConfig && isReferencedInCondition) return 'error';
  if (!isReferenced) return 'warning';
  return 'ok';
}

function getDuplicateSlots(blocks: Block[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const b of blocks) {
    if (b.type === 'slot_definition') {
      if (seen.has(b.slotName)) dupes.add(b.slotName);
      else seen.add(b.slotName);
    }
  }
  return dupes;
}

interface SlotsTOCProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectSlot: (blockId: string) => void;
}

export function SlotsTOC({ blocks, selectedBlockId, onSelectSlot }: SlotsTOCProps) {
  const slotBlocks = blocks.filter(
    (b): b is SlotDefinitionBlock => b.type === 'slot_definition'
  );
  const seen = new Set<string>();
  const dupes = getDuplicateSlots(blocks);
  const ordered = slotBlocks.filter((b) => {
    if (seen.has(b.slotName)) return false;
    seen.add(b.slotName);
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
      {ordered.map((block, i) => {
        let status = getSlotStatus(block, blocks);
        if (dupes.has(block.slotName)) status = 'error';
        return (
          <li key={block.id} role="listitem">
            <button
              type="button"
              className={`${styles.item} ${selectedBlockId === block.id ? styles.itemSelected : ''}`}
              onClick={() => onSelectSlot(block.id)}
              aria-current={selectedBlockId === block.id ? 'true' : undefined}
            >
              <span className={styles.badge}>{i + 1}</span>
              <span className={styles.name}>{block.slotName}</span>
              <span
                className={`${styles.dot} ${styles[`dot${status.charAt(0).toUpperCase() + status.slice(1)}`]}`}
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
