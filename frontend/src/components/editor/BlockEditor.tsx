import { useState, useCallback, useRef, useEffect } from 'react';
import type { Block, Document, ParagraphBlock, SlotDefinitionBlock, ValidationBlock, ConditionBlock } from '../../types';
import type { SlashCommand } from './SlashCommandMenu';
import { parseBlockText, getSlotNamesFromBlocks } from '../../lib/parse';
import { Block as BlockComponent } from './Block';
import { SlotsTOC } from './SlotsTOC';
import { SlashCommandMenu } from './SlashCommandMenu';
import { SlotPicker } from './SlotPicker';
import styles from './BlockEditor.module.css';

function genId(): string {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createParagraphBlock(content = ''): ParagraphBlock {
  return { id: genId(), type: 'paragraph', content };
}

function createSlotBlock(slotName = 'new_slot'): SlotDefinitionBlock {
  return { id: genId(), type: 'slot_definition', slotName, slotType: 'string' };
}

function createValidationBlock(slotRef: string): ValidationBlock {
  return {
    id: genId(),
    type: 'validation',
    slotRef,
    intent: 'in_list',
    value: [],
  };
}

function createConditionBlock(slotRef: string): ConditionBlock {
  return {
    id: genId(),
    type: 'condition',
    slotRef,
    operator: '==',
    value: '',
    action: { kind: 'respond', message: '' },
  };
}

interface BlockEditorProps {
  document: Document;
  onDocumentChange: (doc: Document) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
}

export function BlockEditor({
  document,
  onDocumentChange,
  selectedBlockId,
  onSelectBlock,
}: BlockEditorProps) {
  const [slashMenuAnchor, setSlashMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slotPickerAnchor, setSlotPickerAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [atFilter, setAtFilter] = useState('');
  const [atBlockId, setAtBlockId] = useState<string | null>(null);
  const [parseState, setParseState] = useState<Record<string, { suggestion?: string; warning?: string }>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const blocksRef = useRef<HTMLDivElement>(null);

  const slotNames = getSlotNamesFromBlocks(document.blocks);

  const updateBlocks = useCallback(
    (updater: (blocks: Block[]) => Block[]) => {
      onDocumentChange({
        ...document,
        blocks: updater(document.blocks),
      });
    },
    [document, onDocumentChange]
  );

  const getBlockRect = useCallback((blockId: string) => {
    const el = blocksRef.current?.querySelector(`[data-block-id="${blockId}"]`);
    return el?.getBoundingClientRect() ?? null;
  }, []);

  const handleBlockUpdate = useCallback(
    (blockId: string, updates: Partial<Block>) => {
      updateBlocks((blocks) =>
        blocks.map((b) => (b.id === blockId ? ({ ...b, ...updates } as Block) : b))
      );
      setParseState((prev) => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    },
    [updateBlocks]
  );

  const handleBlockDelete = useCallback(
    (blockId: string) => {
      const idx = document.blocks.findIndex((b) => b.id === blockId);
      updateBlocks((blocks) => blocks.filter((b) => b.id !== blockId));
      if (idx > 0) onSelectBlock(document.blocks[idx - 1].id);
      else if (document.blocks.length > 1) onSelectBlock(document.blocks[1].id);
      else onSelectBlock(null);
    },
    [document.blocks, updateBlocks, onSelectBlock]
  );

  const handleBlockConvert = useCallback(
    (blockId: string, toType: Block['type']) => {
      const block = document.blocks.find((b) => b.id === blockId);
      if (!block) return;

      let newBlock: Block;
      if (toType === 'paragraph') {
        newBlock = createParagraphBlock('');
      } else if (toType === 'slot_definition') {
        newBlock = createSlotBlock('new_slot');
      } else if (toType === 'validation') {
        newBlock = createValidationBlock(slotNames[0] || 'slot_name');
      } else if (toType === 'condition') {
        newBlock = createConditionBlock(slotNames[0] || 'slot_name');
      } else {
        return;
      }

      newBlock = { ...newBlock, id: blockId } as Block;
      updateBlocks((blocks) =>
        blocks.map((b) => (b.id === blockId ? newBlock : b))
      );
      setParseState((prev) => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    },
    [document.blocks, slotNames, updateBlocks]
  );

  const handleParagraphContentChange = useCallback(
    (blockId: string, content: string) => {
      updateBlocks((blocks) =>
        blocks.map((b) => (b.id === blockId ? { ...b, content } : b))
      );

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const result = parseBlockText(content, slotNames);
        if (!result) {
          setParseState((prev) => ({ ...prev, [blockId]: {} }));
          return;
        }
        if (result.warning) {
          setParseState((prev) => ({ ...prev, [blockId]: { warning: result.warning } }));
          return;
        }
      if (result.block && (result.confidence === 'high' || result.confidence === 'medium')) {
        if (result.confidence === 'high') {
          const newBlock = result.block;
          updateBlocks((blocks) =>
            blocks.map((b) => (b.id === blockId ? newBlock : b))
          );
            setParseState((prev) => {
              const next = { ...prev };
              delete next[blockId];
              return next;
            });
          } else {
            setParseState((prev) => ({
              ...prev,
              [blockId]: { suggestion: `Convert to ${result.block!.type.replace('_', ' ')}` },
            }));
          }
        } else {
          setParseState((prev) => ({ ...prev, [blockId]: {} }));
        }
      }, 400);
    },
    [slotNames, updateBlocks]
  );

  const handleSuggestionAccept = useCallback(
    (blockId: string) => {
      const block = document.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== 'paragraph') return;
      const result = parseBlockText(block.content, slotNames);
      if (result?.block) {
        updateBlocks((blocks) =>
          blocks.map((b) => (b.id === blockId ? result.block! : b))
        );
        setParseState((prev) => {
          const next = { ...prev };
          delete next[blockId];
          return next;
        });
      }
    },
    [document.blocks, slotNames, updateBlocks]
  );

  const handleSlash = useCallback(
    (blockId: string) => {
      const rect = getBlockRect(blockId);
      if (rect) {
        setSlashMenuAnchor({ top: rect.bottom + 4, left: rect.left });
        setSlashMenuBlockId(blockId);
      }
    },
    [getBlockRect]
  );

  const handleAt = useCallback(
    (blockId: string) => {
      const rect = getBlockRect(blockId);
      if (rect) {
        setSlotPickerAnchor({ top: rect.bottom + 4, left: rect.left });
        setAtBlockId(blockId);
        setAtFilter('');
      }
    },
    [getBlockRect]
  );

  const handleSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      setSlashMenuAnchor(null);
      const blockId = slashMenuBlockId;
      setSlashMenuBlockId(null);

      if (cmd.kind === 'define_slot') {
        const newBlock = createSlotBlock();
        updateBlocks((blocks) => {
          const idx = blockId ? blocks.findIndex((b) => b.id === blockId) + 1 : blocks.length;
          const next = [...blocks];
          next.splice(idx, 0, newBlock);
          return next;
        });
        onSelectBlock(newBlock.id);
      } else if (cmd.kind === 'add_validation') {
        const newBlock = createValidationBlock(slotNames[0] || 'slot_name');
        updateBlocks((blocks) => {
          const idx = blockId ? blocks.findIndex((b) => b.id === blockId) + 1 : blocks.length;
          const next = [...blocks];
          next.splice(idx, 0, newBlock);
          return next;
        });
        onSelectBlock(newBlock.id);
      } else if (cmd.kind === 'add_condition') {
        const newBlock = createConditionBlock(slotNames[0] || 'slot_name');
        updateBlocks((blocks) => {
          const idx = blockId ? blocks.findIndex((b) => b.id === blockId) + 1 : blocks.length;
          const next = [...blocks];
          next.splice(idx, 0, newBlock);
          return next;
        });
        onSelectBlock(newBlock.id);
      } else if (cmd.kind === 'insert_slot_ref' && blockId) {
        const block = document.blocks.find((b) => b.id === blockId);
        if (block?.type === 'paragraph') {
          handleBlockUpdate(blockId, {
            content: block.content + `@${cmd.slotName} `,
          });
        }
      }
    },
    [slashMenuBlockId, slotNames, document.blocks, updateBlocks, onSelectBlock, handleBlockUpdate]
  );

  const handleSlotSelect = useCallback(
    (slotName: string) => {
      setSlotPickerAnchor(null);
      const blockId = atBlockId;
      setAtBlockId(null);
      if (!blockId) return;
      const block = document.blocks.find((b) => b.id === blockId);
      if (block?.type === 'paragraph') {
        handleBlockUpdate(blockId, { content: block.content + `@${slotName} ` });
      }
    },
    [atBlockId, document.blocks, handleBlockUpdate]
  );

  const handleKeyDown = useCallback(
    (blockId: string, e: React.KeyboardEvent) => {
      const block = document.blocks.find((b) => b.id === blockId);
      if (!block) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const idx = document.blocks.findIndex((b) => b.id === blockId);
        const newBlock = createParagraphBlock();
        updateBlocks((blocks) => {
          const next = [...blocks];
          next.splice(idx + 1, 0, newBlock);
          return next;
        });
        onSelectBlock(newBlock.id);
        setTimeout(() => {
          const el = blocksRef.current?.querySelector(`[data-block-id="${newBlock.id}"] [contenteditable]`);
          (el as HTMLElement)?.focus();
        }, 0);
      }

      if (e.key === 'Backspace' && block.type === 'paragraph' && block.content === '') {
        e.preventDefault();
        const idx = document.blocks.findIndex((b) => b.id === blockId);
        if (idx > 0) {
          const prev = document.blocks[idx - 1];
          updateBlocks((blocks) => blocks.filter((b) => b.id !== blockId));
          onSelectBlock(prev.id);
          if (prev.type === 'paragraph') {
            setTimeout(() => {
              const el = blocksRef.current?.querySelector(`[data-block-id="${prev.id}"] [contenteditable]`);
              const node = el as HTMLElement;
              if (node) {
                node.focus();
                const range = window.document.createRange();
                range.selectNodeContents(node);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }, 0);
          }
        }
      }
    },
    [document.blocks, updateBlocks, onSelectBlock, handleBlockUpdate, handleBlockDelete]
  );

  const handleSlotSelectFromTOC = useCallback(
    (blockId: string) => {
      onSelectBlock(blockId);
      const el = blocksRef.current?.querySelector(`[data-block-id="${blockId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    [onSelectBlock]
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className={styles.editor}>
      <div className={styles.docArea}>
        <aside className={styles.toc}>
          <h2 className={styles.tocTitle}>Slots</h2>
          <SlotsTOC
            blocks={document.blocks}
            selectedBlockId={selectedBlockId}
            onSelectSlot={handleSlotSelectFromTOC}
          />
        </aside>

        <div className={styles.blocks} ref={blocksRef}>
          <div className={styles.titleRow}>
            <input
              type="text"
              className={styles.titleInput}
              value={document.title}
              onChange={(e) => onDocumentChange({ ...document, title: e.target.value })}
              placeholder="Document title"
            />
          </div>
          <div className={styles.descriptionRow}>
            <textarea
              className={styles.descriptionInput}
              value={document.description}
              onChange={(e) => onDocumentChange({ ...document, description: e.target.value })}
              placeholder="Description"
              rows={2}
            />
          </div>
          {document.blocks.map((block) => (
            <BlockComponent
              key={block.id}
              block={block}
              isSelected={selectedBlockId === block.id}
              onSelect={() => onSelectBlock(block.id)}
              parseSuggestion={parseState[block.id]?.suggestion}
              parseWarning={parseState[block.id]?.warning}
              onUpdate={(u: Partial<Block>) => handleBlockUpdate(block.id, u)}
              onDelete={() => handleBlockDelete(block.id)}
              onConvert={(toType: Block['type']) => handleBlockConvert(block.id, toType)}
              onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(block.id, e)}
              onParagraphContentChange={
                block.type === 'paragraph'
                  ? (content: string) => handleParagraphContentChange(block.id, content)
                  : undefined
              }
              onSlash={handleSlash}
              onAt={handleAt}
              onSuggestionAccept={
                parseState[block.id]?.suggestion
                  ? () => handleSuggestionAccept(block.id)
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {slashMenuAnchor && (
        <SlashCommandMenu
          slotNames={slotNames}
          anchorRect={slashMenuAnchor}
          onSelect={handleSlashCommand}
          onClose={() => {
            setSlashMenuAnchor(null);
            setSlashMenuBlockId(null);
          }}
        />
      )}

      {slotPickerAnchor && (
        <SlotPicker
          slotNames={slotNames}
          anchorRect={slotPickerAnchor}
          filter={atFilter}
          onSelect={handleSlotSelect}
          onClose={() => {
            setSlotPickerAnchor(null);
            setAtBlockId(null);
          }}
        />
      )}
    </div>
  );
}
