import type { Block as BlockType } from '../../types';
import { BlockHandle } from './BlockHandle';
import { ParagraphBlock } from './ParagraphBlock';
import { SlotDefinitionBlock } from './SlotDefinitionBlock';
import { ValidationBlock } from './ValidationBlock';
import { ConditionBlock } from './ConditionBlock';
import styles from './Block.module.css';

interface BlockProps {
  block: BlockType;
  isSelected?: boolean;
  parseSuggestion?: string;
  parseWarning?: string;
  onUpdate: (updates: Partial<BlockType>) => void;
  onDelete: () => void;
  onConvert: (toType: BlockType['type']) => void;
  onSelect?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onParagraphContentChange?: (content: string) => void;
  onSlash?: (blockId: string) => void;
  onAt?: (blockId: string) => void;
  onSuggestionAccept?: () => void;
}

export function Block({
  block,
  isSelected,
  parseSuggestion,
  parseWarning,
  onUpdate,
  onDelete,
  onConvert,
  onSelect,
  onKeyDown,
  onParagraphContentChange,
  onSlash,
  onAt,
  onSuggestionAccept,
}: BlockProps) {
  const handleConvert = (toType: BlockType['type']) => {
    onConvert(toType);
  };

  return (
    <div
      className={`${styles.blockRow} ${isSelected ? styles.blockRowSelected : ''}`}
      data-block-id={block.id}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[contenteditable]')) return;
        onSelect?.();
      }}
    >
      <BlockHandle
        block={block}
        onDelete={onDelete}
        onConvert={handleConvert}
      />
      <div className={styles.blockContent}>
        {block.type === 'paragraph' && (
          <ParagraphBlock
            block={block}
            onContentChange={(content) =>
              onParagraphContentChange
                ? onParagraphContentChange(content)
                : onUpdate({ content })
            }
            onKeyDown={onKeyDown || (() => {})}
            onSlash={onSlash ? () => onSlash(block.id) : undefined}
            onAt={onAt ? () => onAt(block.id) : undefined}
            isSelected={isSelected}
          />
        )}
        {block.type === 'slot_definition' && (
          <SlotDefinitionBlock
            block={block}
            onUpdate={(u) => onUpdate(u)}
          />
        )}
        {block.type === 'validation' && (
          <ValidationBlock
            block={block}
            onUpdate={(u) => onUpdate(u)}
          />
        )}
        {block.type === 'condition' && (
          <ConditionBlock
            block={block}
            onUpdate={(u) => onUpdate(u)}
          />
        )}
        {parseSuggestion && (
          <button
            type="button"
            className={styles.suggestionPill}
            onClick={onSuggestionAccept}
          >
            {parseSuggestion} (Tab)
          </button>
        )}
        {parseWarning && (
          <span className={styles.warningPill}>{parseWarning}</span>
        )}
      </div>
    </div>
  );
}
