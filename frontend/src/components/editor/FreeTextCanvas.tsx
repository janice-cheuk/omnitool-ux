import { useState, useCallback, useRef, useEffect } from 'react';
import type { Document, AssistantStatus, SlotConfig } from '../../types';
import { parseTextToSegmentsForEditor, getSlotNamesFromSegments, getSegmentStarts, getSegmentSerializedLength } from '../../lib/parseInline';
import type { ValidationType } from '../../lib/parseInline';
import type { SlashCommand } from './SlashCommandMenu';
import { FreeTextEditor } from './FreeTextEditor';
import { SlashCommandMenu } from './SlashCommandMenu';
import { SlotsTOCFromSegments } from './SlotsTOCFromSegments';
import { AssistantPanel } from '../AssistantPanel';
import styles from './FreeTextCanvas.module.css';

interface FreeTextCanvasProps {
  document: Document;
  onDocumentChange: (doc: Document) => void;
  toolName: string;
  userPrompt: string | null;
  thoughtDuration: number | null;
  assistantStatus: AssistantStatus;
  createdSlotNames: string[];
  onSendAssistantPrompt: (prompt: string) => void;
  onSlotPillClick: (name: string) => void;
}

export function FreeTextCanvas({
  document,
  onDocumentChange,
  toolName,
  userPrompt,
  thoughtDuration,
  assistantStatus,
  createdSlotNames,
  onSendAssistantPrompt,
  onSlotPillClick,
}: FreeTextCanvasProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [insertMenu, setInsertMenu] = useState<{ anchor: { top: number; left: number }; insertOffset: number } | null>(null);
  const [caretOffset, setCaretOffset] = useState<number | null>(null);
  const [caretAnchor, setCaretAnchor] = useState<{ top: number; left: number } | null>(null);
  const [afterSlotMenu, setAfterSlotMenu] = useState<{ slotName: string; anchor: { top: number; left: number }; insertOffset: number } | null>(null);
  const [afterConditionMenu, setAfterConditionMenu] = useState<{ anchor: { top: number; left: number }; insertOffset: number } | null>(null);
  const [plusButtonTop, setPlusButtonTop] = useState<number>(12);
  const editorRef = useRef<HTMLDivElement>(null);
  const slotRowRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  const content = document.freeTextContent ?? '';
  const segments = parseTextToSegmentsForEditor(content);
  const slotNames = getSlotNamesFromSegments(segments);
  const slotConfigs = document.slotConfigs ?? {};

  useEffect(() => {
    if (insertMenu != null || caretOffset == null || caretAnchor == null) {
      setAfterSlotMenu(null);
      setAfterConditionMenu(null);
      return;
    }
    const textBeforeCaret = content.slice(0, caretOffset);
    if (/then\s*$/.test(textBeforeCaret)) {
      setAfterSlotMenu(null);
      setAfterConditionMenu({ anchor: caretAnchor, insertOffset: caretOffset });
      return;
    }
    const segs = parseTextToSegmentsForEditor(content);
    const starts = getSegmentStarts(segs);
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.type !== 'slot_ref') continue;
      const end = starts[i] + getSegmentSerializedLength(seg);
      if (caretOffset === end) {
        setAfterConditionMenu(null);
        setAfterSlotMenu({ slotName: seg.slotName, anchor: caretAnchor, insertOffset: caretOffset });
        return;
      }
    }
    setAfterSlotMenu(null);
    setAfterConditionMenu(null);
  }, [content, caretOffset, caretAnchor?.top, caretAnchor?.left, insertMenu]);


  const handleContentChange = useCallback(
    (newContent: string) => {
      onDocumentChange({
        ...document,
        freeTextContent: newContent,
      });
    },
    [document, onDocumentChange]
  );

  const handleSlotConfigChange = useCallback(
    (slotName: string, config: SlotConfig) => {
      onDocumentChange({
        ...document,
        slotConfigs: { ...(document.slotConfigs ?? {}), [slotName]: config },
      });
    },
    [document, onDocumentChange]
  );

  const primarySlotName = slotNames[0] ?? '';
  const [editingSlotName, setEditingSlotName] = useState(primarySlotName);
  useEffect(() => {
    setEditingSlotName(primarySlotName);
  }, [primarySlotName]);

  const handleSlotNameRename = useCallback(
    (newName: string) => {
      const trimmed = newName.trim().toLowerCase().replace(/\s+/g, '_');
      if (!trimmed || trimmed === primarySlotName) return;
      const currentContent = document.freeTextContent ?? '';
      const configs = document.slotConfigs ?? {};
      const newContent = currentContent.replace(
        new RegExp(`@${primarySlotName}\\b`, 'g'),
        `@${trimmed}`
      );
      const newConfigs = { ...configs };
      if (configs[primarySlotName]) {
        newConfigs[trimmed] = configs[primarySlotName];
        delete newConfigs[primarySlotName];
      }
      onDocumentChange({
        ...document,
        freeTextContent: newContent,
        slotConfigs: newConfigs,
      });
    },
    [primarySlotName, document, onDocumentChange]
  );

  const handleSelectSlot = useCallback((segmentId: string) => {
    setSelectedSegmentId(segmentId);
    const el = editorRef.current?.querySelector(`[data-segment-id="${segmentId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleCaretPosition = useCallback((rect: DOMRect) => {
    if (!slotRowRef.current) return;
    const rowRect = slotRowRef.current.getBoundingClientRect();
    const lineCenter = rect.top - rowRect.top + rect.height / 2;
    const halfBtn = 12;
    setPlusButtonTop(Math.max(halfBtn, lineCenter - halfBtn));
  }, []);

  const openInsertMenuAtCaret = useCallback((anchor: { top: number; left: number }, insertOffset: number) => {
    setInsertMenu({ anchor, insertOffset });
  }, []);

  const openInsertMenuAtPlus = useCallback(() => {
    const btn = plusButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setInsertMenu({
      anchor: { top: rect.bottom + 4, left: rect.left },
      insertOffset: content.length,
    });
  }, [content.length]);

  const closeInsertMenu = useCallback(() => setInsertMenu(null), []);

  const onCaretOffsetChange = useCallback((offset: number, anchor: { top: number; left: number }) => {
    setCaretOffset(offset);
    setCaretAnchor(anchor);
  }, []);

  const VALIDATION_PHRASE: Record<ValidationType, string> = {
    contains: 'contains',
    does_not_contain: 'does not contain',
    is_from_defined_list: 'is from a defined list',
    satisfies_numeric_condition: 'satisfies a numeric condition',
    satisfies_date_condition: 'satisfies a date condition',
    satisfies_boolean_condition: '== true',
    is_not_empty: 'is not empty',
  };

  const handleAfterSlotSelect = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.kind !== 'add_validation_type' || !afterSlotMenu) return;
      const phrase = VALIDATION_PHRASE[cmd.validationType];
      const newContent =
        content.slice(0, afterSlotMenu.insertOffset) + ' ' + phrase + ' ' + content.slice(afterSlotMenu.insertOffset);
      handleContentChange(newContent);
      setAfterSlotMenu(null);
    },
    [afterSlotMenu, content, handleContentChange]
  );

  const handleAfterConditionSelect = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.kind !== 'add_condition_action' || !afterConditionMenu) return;
      const newContent =
        content.slice(0, afterConditionMenu.insertOffset) + ' ' + cmd.action + ' ' + content.slice(afterConditionMenu.insertOffset);
      handleContentChange(newContent);
      setAfterConditionMenu(null);
    },
    [afterConditionMenu, content, handleContentChange]
  );

  const getInsertTemplate = useCallback(
    (cmd: SlashCommand): string => {
      const prefix = insertMenu ? (content.slice(0, insertMenu.insertOffset) || '').endsWith('\n') ? '' : ' ' : ' ';
      const slot = slotNames[0] || 'slot_name';
      switch (cmd.kind) {
        case 'add_validation_type': {
          const phrase: Record<typeof cmd.validationType, string> = {
            contains: 'contains',
            does_not_contain: 'does not contain',
            is_from_defined_list: 'is from a defined list',
            satisfies_numeric_condition: 'satisfies a numeric condition',
            satisfies_date_condition: 'satisfies a date condition',
            satisfies_boolean_condition: '== true',
            is_not_empty: 'is not empty',
          };
          return `${prefix}@${slot} ${phrase[cmd.validationType]} `;
        }
        case 'add_condition':
          return `${prefix}if  then `;
        case 'insert_slot_ref':
          return `${prefix}@${cmd.slotName} `;
        case 'define_slot':
          return `${prefix}@`;
        default:
          return '';
      }
    },
    [content, insertMenu, slotNames]
  );

  const handleInsertSelect = useCallback(
    (cmd: SlashCommand) => {
      if (!insertMenu) return;
      const template = getInsertTemplate(cmd);
      const { insertOffset } = insertMenu;
      const newContent = content.slice(0, insertOffset) + template + content.slice(insertOffset);
      handleContentChange(newContent);
      closeInsertMenu();
    },
    [insertMenu, content, getInsertTemplate, handleContentChange, closeInsertMenu]
  );

  return (
    <div className={styles.modal}>
      <header className={styles.modalHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.toolType}>Omni Tool</span>
          <span className={styles.toolName}>{toolName}</span>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.actionBtnActive}>
            Omni Tool Assistant
          </button>
          <button type="button" className={styles.actionBtn}>
            Advanced mode
          </button>
          <button type="button" className={styles.actionBtn}>
            Slot Filling Engine
          </button>
        </div>
      </header>

      <div className={styles.modalBody}>
        <aside className={styles.slotPanel}>
          <div className={styles.slotPanelCard}>
            <div className={styles.slotPanelHeader}>
              <span className={styles.slotPanelIcon} aria-hidden>⊞</span>
              <h2 className={styles.slotPanelTitle}>Slots</h2>
              <button type="button" className={styles.infoBtn} aria-label="Info">ⓘ</button>
            </div>
            <SlotsTOCFromSegments
              segments={segments}
              selectedSegmentId={selectedSegmentId}
              onSelectSlot={handleSelectSlot}
            />
          </div>
        </aside>

        <div className={styles.mainContent} ref={editorRef}>
          <section className={styles.descriptionSection}>
            <h3 className={styles.sectionTitle}>Description</h3>
            <ul className={styles.descriptionList}>
              <li>You are an orchestration function tool for NRG.</li>
              <li>On each user turn, you interpret the caller&apos;s request and deterministically decide the next best single action.</li>
              <li>You must follow the rules below exactly and perform only one action per turn.</li>
            </ul>
          </section>

          <div className={styles.slotRow} ref={slotRowRef}>
            <div className={styles.insertBar} aria-hidden="true" />
            <button
              ref={plusButtonRef}
              type="button"
              className={styles.plusBtn}
              style={{ top: plusButtonTop }}
              onClick={openInsertMenuAtPlus}
              title="Insert /"
              aria-label="Insert / (Validate or Conditions)"
            >
              <span className={styles.plusIcon}>+</span>
              <span className={styles.plusTooltip}>Insert /</span>
            </button>
            <div className={styles.slotBlock}>
              <div className={styles.slotBlockHeader}>
                <span className={styles.slotBlockTitle}>Slot 1</span>
                {primarySlotName ? (
                  <input
                    type="text"
                    className={styles.slotNameInput}
                    value={editingSlotName}
                    onChange={(e) => setEditingSlotName(e.target.value)}
                    onBlur={() => {
                      if (
                        editingSlotName.trim() &&
                        editingSlotName !== primarySlotName
                      ) {
                        handleSlotNameRename(editingSlotName);
                      } else {
                        setEditingSlotName(primarySlotName);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    aria-label="Slot name"
                  />
                ) : null}
                <span className={styles.defineTag}>Define</span>
              </div>
              <div className={styles.freeTextArea}>
                <FreeTextEditor
                  content={content}
                  onChange={handleContentChange}
                  slotNames={slotNames}
                  slotConfigs={slotConfigs}
                  onSlotConfigChange={handleSlotConfigChange}
                  onSlashKey={openInsertMenuAtCaret}
                  onCaretOffsetChange={onCaretOffsetChange}
                  onCaretPosition={handleCaretPosition}
                />
              </div>
            </div>
          </div>
          {insertMenu && (
            <SlashCommandMenu
              slotNames={slotNames}
              anchorRect={insertMenu.anchor}
              onSelect={handleInsertSelect}
              onClose={closeInsertMenu}
              insertOnly
            />
          )}
          {afterSlotMenu && !insertMenu && (
            <SlashCommandMenu
              slotNames={slotNames}
              anchorRect={afterSlotMenu.anchor}
              onSelect={handleAfterSlotSelect}
              onClose={() => setAfterSlotMenu(null)}
              showOnlyValidationIntents
            />
          )}
          {afterConditionMenu && !insertMenu && (
            <SlashCommandMenu
              slotNames={slotNames}
              anchorRect={afterConditionMenu.anchor}
              onSelect={handleAfterConditionSelect}
              onClose={() => setAfterConditionMenu(null)}
              showOnlyConditionActions
            />
          )}
        </div>

        <aside className={styles.assistantPanel}>
          <AssistantPanel
            userPrompt={userPrompt}
            thoughtDuration={thoughtDuration}
            assistantStatus={assistantStatus}
            createdSlotNames={createdSlotNames}
            onSendPrompt={onSendAssistantPrompt}
            onSlotPillClick={onSlotPillClick}
          />
        </aside>
      </div>
    </div>
  );
}
