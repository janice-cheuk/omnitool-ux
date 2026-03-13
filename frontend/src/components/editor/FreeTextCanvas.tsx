import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Document, AssistantStatus, SlotConfig, SlotCardDraft } from '../../types';
import { parseTextToSegmentsForEditor, getSlotNamesFromSegments, getSegmentStarts, getSegmentSerializedLength } from '../../lib/parseInline';
import type { ValidationType } from '../../lib/parseInline';
import { ensureValidateRowState } from '../../lib/validateRow';
import { getNextShortcutTrigger } from '../../lib/shortcutTriggers';
import { appendSlotCard, getDocumentSlotCards, getSlotNamesAcrossCards, updateSlotCardContent } from '../../lib/slotCards';
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
  const [validationPromptMenu, setValidationPromptMenu] = useState<{ anchor: { top: number; left: number }; insertOffset: number } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ seq: number; offset: number; reason: string } | null>(null);
  const [caretResetSeq, setCaretResetSeq] = useState(0);
  const [caretOffset, setCaretOffset] = useState<number | null>(null);
  const [caretAnchor, setCaretAnchor] = useState<{ top: number; left: number } | null>(null);
  const [afterSlotMenu, setAfterSlotMenu] = useState<{ slotName: string; anchor: { top: number; left: number }; insertOffset: number } | null>(null);
  const [afterConditionMenu, setAfterConditionMenu] = useState<{ anchor: { top: number; left: number }; insertOffset: number } | null>(null);
  const [plusButtonTop, setPlusButtonTop] = useState<number>(12);
  const [activeSlotId, setActiveSlotId] = useState<string>('slot-1');
  const editorRef = useRef<HTMLDivElement>(null);
  const slotRowRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const focusSeqRef = useRef(0);

  const slotCards = useMemo<SlotCardDraft[]>(() => getDocumentSlotCards(document), [document]);
  const activeSlot = slotCards.find((card) => card.id === activeSlotId) ?? slotCards[0];
  const content = activeSlot?.content ?? '';
  const segments = parseTextToSegmentsForEditor(content);
  const slotNames = useMemo(() => getSlotNamesAcrossCards(slotCards), [slotCards]);
  const currentSlotNames = getSlotNamesFromSegments(segments);
  const canShowInsertAffordance = currentSlotNames.length > 0;
  const slotConfigs = document.slotConfigs ?? {};

  useEffect(() => {
    if (!activeSlot) return;
    if (!slotCards.some((card) => card.id === activeSlotId)) {
      setActiveSlotId(slotCards[0]?.id ?? 'slot-1');
    }
  }, [activeSlot, activeSlotId, slotCards]);

  useEffect(() => {
    if (insertMenu != null || validationPromptMenu != null || caretOffset == null || caretAnchor == null) {
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
  }, [content, caretOffset, caretAnchor?.top, caretAnchor?.left, insertMenu, validationPromptMenu]);


  const handleSlotContentChange = useCallback(
    (slotId: string, newContent: string) => {
      onDocumentChange(updateSlotCardContent(document, slotCards, slotId, newContent));
    },
    [activeSlotId, document, onDocumentChange, slotCards]
  );

  const handleContentChange = useCallback(
    (newContent: string) => {
      handleSlotContentChange(activeSlot.id, newContent);
    },
    [activeSlot.id, handleSlotContentChange]
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

  const triggerInlineCommandMenu = useCallback(
    ({
      slotId,
      editorId,
      source,
      trigger,
      anchor,
      insertOffset,
    }: {
      slotId: string;
      editorId: string;
      source: 'keyboard' | 'insertButton';
      trigger: string;
      anchor: { top: number; left: number };
      insertOffset: number;
    }) => {
      if (trigger !== '/') return;
      setInsertMenu({ anchor, insertOffset });
      focusSeqRef.current += 1;
      setFocusRequest({ seq: focusSeqRef.current, offset: insertOffset, reason: `${source}-${slotId}-${editorId}` });
    },
    []
  );

  const openInsertMenuAtCaret = useCallback(
    (anchor: { top: number; left: number }, insertOffset: number, slotId: string = activeSlot.id) => {
      setActiveSlotId(slotId);
      triggerInlineCommandMenu({
        slotId,
        editorId: 'slot-editor',
        source: 'keyboard',
        trigger: '/',
        anchor,
        insertOffset,
      });
    },
    [activeSlot.id, triggerInlineCommandMenu]
  );

  const openInsertMenuAtPlus = useCallback(() => {
    const trigger = getNextShortcutTrigger({ slotId: activeSlot.id, editorId: 'slot-editor' });
    const editorEl = editorRef.current?.querySelector(`[data-slot-card-id="${activeSlot.id}"] [data-role="slot-editor"]`) as HTMLElement | null;
    const editorRect = editorEl?.getBoundingClientRect();
    const anchor = caretAnchor ?? {
      top: (editorRect?.top ?? 0) + 24,
      left: (editorRect?.left ?? 0) + 16,
    };
    const insertOffset = caretOffset ?? content.length;
    triggerInlineCommandMenu({
      slotId: activeSlot.id,
      editorId: 'slot-editor',
      source: 'insertButton',
      trigger,
      anchor,
      insertOffset,
    });
  }, [activeSlot.id, caretAnchor, caretOffset, content.length, triggerInlineCommandMenu]);

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
      if (segments.some((s) => s.type === 'validation')) {
        focusSeqRef.current += 1;
        setFocusRequest({ seq: focusSeqRef.current, offset: content.length, reason: 'after-slot-existing-validation' });
        setAfterSlotMenu(null);
        return;
      }
      const newContent =
        content.slice(0, afterSlotMenu.insertOffset) + ' ' + phrase + ' ' + content.slice(afterSlotMenu.insertOffset);
      setCaretResetSeq((v) => v + 1);
      handleContentChange(newContent);
      focusSeqRef.current += 1;
      setFocusRequest({ seq: focusSeqRef.current, offset: newContent.length, reason: 'after-slot-validation-type' });
      setAfterSlotMenu(null);
      setValidationPromptMenu(null);
    },
    [afterSlotMenu, content, handleContentChange]
  );

  const handleAfterConditionSelect = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.kind !== 'add_condition_action' || !afterConditionMenu) return;
      const newContent =
        content.slice(0, afterConditionMenu.insertOffset) + ' ' + cmd.action + ' ' + content.slice(afterConditionMenu.insertOffset);
      setCaretResetSeq((v) => v + 1);
      handleContentChange(newContent);
      focusSeqRef.current += 1;
      setFocusRequest({ seq: focusSeqRef.current, offset: newContent.length, reason: 'after-condition-action' });
      setAfterConditionMenu(null);
    },
    [afterConditionMenu, content, handleContentChange]
  );

  const handleValidationPromptSelect = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.kind !== 'add_validation_type' || !validationPromptMenu) return;
      const phrase = VALIDATION_PHRASE[cmd.validationType];
      if (segments.some((s) => s.type === 'validation')) {
        focusSeqRef.current += 1;
        setFocusRequest({ seq: focusSeqRef.current, offset: content.length, reason: 'validation-prompt-existing-validation' });
        setValidationPromptMenu(null);
        return;
      }
      const newContent =
        content.slice(0, validationPromptMenu.insertOffset) +
        ' ' +
        phrase +
        ' ' +
        content.slice(validationPromptMenu.insertOffset);
      setCaretResetSeq((v) => v + 1);
      handleContentChange(newContent);
      focusSeqRef.current += 1;
      setFocusRequest({ seq: focusSeqRef.current, offset: newContent.length, reason: 'validation-prompt-select' });
      setValidationPromptMenu(null);
    },
    [afterSlotMenu, content, handleContentChange, segments, validationPromptMenu]
  );

  const ensureValidateRow = useCallback(
    (insertOffset: number) => {
      const hasValidation = segments.some((s) => s.type === 'validation');
      const hasPrompt = validationPromptMenu != null;
      const plan = ensureValidateRowState({
        content,
        hasValidation,
        hasPrompt,
        requestedOffset: insertOffset,
      });
      if (plan.ensuredContent !== content) {
        handleContentChange(plan.ensuredContent);
      }
      return {
        created: plan.shouldOpenPrompt,
        ensuredInsertOffset: plan.ensuredInsertOffset,
      };
    },
    [content, handleContentChange, segments, validationPromptMenu]
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
      if (cmd.kind === 'add_validation') {
        const ensureResult = ensureValidateRow(insertMenu.insertOffset);
        const slotRect = slotRowRef.current?.getBoundingClientRect();
        const anchor = slotRect
          ? { top: insertMenu.anchor.top + 24, left: slotRect.left + 115 }
          : { top: insertMenu.anchor.top + 24, left: insertMenu.anchor.left + 99 };
        if (ensureResult.created) {
          setValidationPromptMenu({ anchor, insertOffset: ensureResult.ensuredInsertOffset });
          focusSeqRef.current += 1;
          setFocusRequest({ seq: focusSeqRef.current, offset: ensureResult.ensuredInsertOffset, reason: 'slash-validate' });
        } else {
          focusSeqRef.current += 1;
          setFocusRequest({ seq: focusSeqRef.current, offset: content.length, reason: 'slash-validate-existing' });
        }
        closeInsertMenu();
        return;
      }
      const template = getInsertTemplate(cmd);
      const { insertOffset } = insertMenu;
      const newContent = content.slice(0, insertOffset) + template + content.slice(insertOffset);
      setCaretResetSeq((v) => v + 1);
      handleContentChange(newContent);
      focusSeqRef.current += 1;
      setFocusRequest({ seq: focusSeqRef.current, offset: newContent.length, reason: `insert-${cmd.kind}` });
      closeInsertMenu();
    },
    [insertMenu, afterSlotMenu, validationPromptMenu, segments, ensureValidateRow, content, getInsertTemplate, handleContentChange, closeInsertMenu]
  );

  useEffect(() => {
    if (segments.some((s) => s.type === 'validation')) {
      setValidationPromptMenu(null);
    }
  }, [segments]);


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
            <textarea
              className={styles.descriptionInput}
              value={document.description ?? ''}
              onChange={(e) => onDocumentChange({ ...document, description: e.target.value })}
              placeholder="Enter a description for your Omni Tool…"
              aria-label="Description"
              rows={4}
            />
          </section>

          {slotCards.map((card, idx) => {
            const cardSegments = parseTextToSegmentsForEditor(card.content ?? '');
            const cardSlotNames = getSlotNamesFromSegments(cardSegments);
            const cardPrimarySlotName = cardSlotNames[0] ?? '';
            const isActiveCard = card.id === activeSlot.id;
            return (
              <div
                className={styles.slotRow}
                ref={isActiveCard ? slotRowRef : null}
                key={card.id}
                data-slot-card-id={card.id}
              >
                <div className={styles.insertBar} aria-hidden="true" />
                {isActiveCard && canShowInsertAffordance ? (
                  <button
                    ref={plusButtonRef}
                    type="button"
                    className={styles.plusBtn}
                    style={{ top: plusButtonTop }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openInsertMenuAtPlus}
                    title="Insert /"
                    aria-label="Insert / (Validate or Conditions)"
                  >
                    <span className={styles.plusIcon}>+</span>
                    <span className={styles.plusTooltip}>Insert <span className={styles.plusShortcut}>/</span></span>
                  </button>
                ) : null}
                <div className={styles.slotBlock} data-node-id="842:6674" onMouseDown={() => setActiveSlotId(card.id)}>
                  <div className={styles.slotBlockHeader}>
                    <div className={styles.slotBlockHeaderLeft}>
                      <div className={styles.slotHeaderTag}>
                        <span className={styles.slotBlockTitle}>Slot {idx + 1}</span>
                      </div>
                      {cardPrimarySlotName ? (
                        <>
                          <span className={styles.slotHeaderName}>{cardPrimarySlotName}</span>
                          <span className={styles.slotHeaderPencil} aria-hidden title="Edit slot name">✎</span>
                        </>
                      ) : null}
                    </div>
                    <span className={styles.slotHeaderChevron} aria-hidden>▾</span>
                  </div>
                  <div className={styles.freeTextArea}>
                    <FreeTextEditor
                      content={card.content ?? ''}
                      onChange={(newContent) => {
                        setActiveSlotId(card.id);
                        handleSlotContentChange(card.id, newContent);
                      }}
                      slotNames={slotNames}
                      slotConfigs={slotConfigs}
                      onSlotConfigChange={handleSlotConfigChange}
                      onSlashKey={(anchor, insertOffset) => openInsertMenuAtCaret(anchor, insertOffset, card.id)}
                      onCaretOffsetChange={(offset, anchor) => {
                        setActiveSlotId(card.id);
                        onCaretOffsetChange(offset, anchor);
                      }}
                      onCaretPosition={(rect) => {
                        if (card.id !== activeSlot.id) return;
                        handleCaretPosition(rect);
                      }}
                      validationPromptActive={isActiveCard && validationPromptMenu != null}
                      focusRequest={isActiveCard ? focusRequest : null}
                      caretResetSeq={caretResetSeq}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className={styles.addSlotButton}
            onClick={() => {
              const nextCards = appendSlotCard(slotCards);
              const nextId = nextCards[nextCards.length - 1]?.id ?? `slot-${slotCards.length + 1}`;
              onDocumentChange({
                ...document,
                slotCards: nextCards,
              });
              setActiveSlotId(nextId);
            }}
            data-node-id="842:8241"
            aria-label="Add a slot"
          >
            <span className={styles.addSlotLabel}>
              <span className={styles.addSlotIcon} aria-hidden>+</span>
              Add a slot
            </span>
            <span className={styles.addSlotHint}>
              Add a slot to represent information that will be collected, validated, and reused throughout the flow.
            </span>
          </button>
          {insertMenu && (
            <SlashCommandMenu
              slotNames={slotNames}
              anchorRect={insertMenu.anchor}
              onSelect={handleInsertSelect}
              onClose={closeInsertMenu}
              insertOnly
            />
          )}
          {afterSlotMenu && !insertMenu && !validationPromptMenu && (
            <SlashCommandMenu
              slotNames={slotNames}
              anchorRect={afterSlotMenu.anchor}
              onSelect={handleAfterSlotSelect}
              onClose={() => setAfterSlotMenu(null)}
              showOnlyValidationIntents
              slotType={slotConfigs[afterSlotMenu.slotName]?.slotType}
            />
          )}
          {validationPromptMenu && !insertMenu && (
            <SlashCommandMenu
              slotNames={slotNames}
              anchorRect={validationPromptMenu.anchor}
              onSelect={handleValidationPromptSelect}
              onClose={() => setValidationPromptMenu(null)}
              showOnlyValidationIntents
              simpleValidationList
            />
          )}
          {afterConditionMenu && !insertMenu && !validationPromptMenu && (
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
