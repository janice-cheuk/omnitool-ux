import { useRef, useState, useCallback, useLayoutEffect, useEffect, useMemo } from 'react';
import type { SlotConfig } from '../../types';
import type { InlineSegment } from '../../lib/parseInline';
import { parseTextToSegmentsForEditor, type ValidationType } from '../../lib/parseInline';
import { getPlaceholderAfterSegment, PLACEHOLDER_A, PLACEHOLDER_B } from '../../lib/placeholderHelpers';
import { CONTROL_LABEL_DEFINE, VALIDATION_LINE_LABEL } from '../../lib/slotAuthoring';
import { SlotChip } from './SlotChip';
import { ValidationChip } from './ValidationChip';
import styles from './InlineSegmentEditor.module.css';

const VALIDATION_PHRASE: Record<ValidationType, string> = {
  contains: 'contains',
  does_not_contain: 'does not contain',
  is_from_defined_list: 'is from a defined list',
  satisfies_numeric_condition: 'satisfies a numeric condition',
  satisfies_date_condition: 'satisfies a date condition',
  satisfies_boolean_condition: '== true',
  is_not_empty: 'is not empty',
};

const CONTAINS_VALUE_PLACEHOLDER =
  'Start typing using @ to define a value name. Make sure it is:\n                                                   • in snake_case\n                                                   • a unique name';

function getSegmentSerializedLength(seg: InlineSegment): number {
  if (seg.type === 'text') return seg.value.length;
  if (seg.type === 'slot_ref') return 1 + seg.slotName.length;
  if (seg.type === 'value_ref') return 1 + seg.valueName.length;
  if (seg.type === 'validation') {
    if (seg.validationType === 'satisfies_boolean_condition') {
      const val = seg.value === true || seg.value === 'true' ? 'true' : 'false';
      return 3 + val.length;
    }
    return 1 + (VALIDATION_PHRASE[seg.validationType]?.length ?? 0);
  }
  return 0;
}

function serializeDom(container: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent || '';
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') return;
      if (el.getAttribute('data-placeholder-inline')) return;
      if (el.getAttribute('data-line-label')) return;
      if (el.getAttribute('data-cursor-anchor')) {
        return;
      }
      const valType = el.getAttribute('data-validation-type') as ValidationType | null;
      if (valType && VALIDATION_PHRASE[valType]) {
        out += ` ${VALIDATION_PHRASE[valType]}`;
        return;
      }
      const valueRef = el.getAttribute('data-value-ref');
      if (valueRef) {
        out += `@${valueRef}`;
        return;
      }
      const slotRef = el.getAttribute('data-slot-ref');
      if (slotRef) {
        out += `@${slotRef}`;
        return;
      }
    }
    node.childNodes.forEach(walk);
  };
  walk(container);
  return out;
}

function getCaretOffset(container: HTMLElement, selection: Selection): number {
  const range = selection.getRangeAt(0);
  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const temp = document.createElement('div');
  temp.appendChild(preRange.cloneContents());
  return serializeDom(temp).length;
}

function getCaretCoordinates(container: HTMLElement, selection: Selection): { top: number; left: number } {
  if (!selection || selection.rangeCount === 0) {
    const rect = container.getBoundingClientRect();
    return { top: rect.top + 16, left: rect.left + 16 };
  }
  const anchorNode = selection.anchorNode as Node | null;
  const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as HTMLElement)
    : (anchorNode?.parentElement as HTMLElement | null);
  const cursorAnchorEl = anchorEl?.closest?.('[data-cursor-anchor][data-line2-placeholder]') as HTMLElement | null;
  if (cursorAnchorEl?.parentElement === container) {
    let prev: HTMLElement | null = cursorAnchorEl.previousElementSibling as HTMLElement | null;
    while (prev && prev.getAttribute('data-line-label')) {
      prev = prev.previousElementSibling as HTMLElement | null;
    }
    const prevRect = prev?.getBoundingClientRect();
    if (prevRect) {
      return { top: prevRect.bottom + 4, left: prevRect.right + 8 };
    }
  }
  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  const looksInvalid = !rect || ((rect.left === 0 && rect.top === 0) || (rect.width === 0 && rect.height === 0));
  if (looksInvalid) {
    if (anchorNode && container.contains(anchorNode)) {
      const anchorRect = anchorEl?.getBoundingClientRect();
      if (anchorRect && (anchorRect.width > 0 || anchorRect.height > 0)) {
        return { top: anchorRect.bottom + 4, left: anchorRect.left };
      }
    }
    const fallback = container.getBoundingClientRect();
    return { top: fallback.top + 20, left: fallback.left + 16 };
  }
  return { top: rect.bottom + 4, left: rect.left };
}

function setCaretAtOffset(container: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const serialLen = serializeDom(container).length;
  if (offset === 0 && serialLen === 0) {
    range.setStart(container, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  let current = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.getAttribute('data-placeholder-inline') || el.getAttribute('data-line-label')) return false;
      if (el.getAttribute('data-cursor-anchor')) {
        const anchorText = (el.textContent || '').replace(/\u200B/g, '');
        const anchorLen = anchorText.length;
        if (current + anchorLen >= offset) {
          if (anchorLen === 0) {
            range.setStart(el, 0);
            range.collapse(true);
            return true;
          }
          const textNode = el.firstChild;
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            const pos = Math.min(offset - current, anchorLen);
            range.setStart(textNode, pos);
            range.collapse(true);
            return true;
          }
          range.setStart(el, 0);
          range.collapse(true);
          return true;
        }
        current += anchorLen;
        return false;
      }
      const valType = el.getAttribute('data-validation-type');
      if (valType && VALIDATION_PHRASE[valType as ValidationType]) {
        const phrase = VALIDATION_PHRASE[valType as ValidationType];
        const len = 1 + phrase.length;
        if (current + len >= offset) {
          range.setStart(el, 0);
          range.collapse(true);
          return true;
        }
        current += len;
        return false;
      }
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (current + len >= offset) {
        if (offset === current + len) {
          const span = node.parentElement;
          if (span?.parentElement === container) {
            const idx = Array.from(container.children).indexOf(span);
            for (let j = idx + 1; j < container.children.length; j++) {
              const sib = container.children[j] as HTMLElement;
              if (sib.getAttribute('data-cursor-anchor')) {
                current += len;
                return false;
              }
              if (sib.getAttribute('data-placeholder-inline') || sib.getAttribute('data-line-label')) continue;
              break;
            }
          }
        }
        range.setStart(node, Math.min(offset - current, len));
        range.collapse(true);
        return true;
      }
      current += len;
      return false;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const valueRef = el.getAttribute('data-value-ref');
      if (valueRef) {
        const len = valueRef.length + 1;
        if (current + len >= offset) {
          range.setStart(el, 0);
          range.collapse(true);
          return true;
        }
        current += len;
        return false;
      }
      const slotRef = el.getAttribute('data-slot-ref');
      if (slotRef) {
        const len = slotRef.length + 1;
        if (current + len >= offset) {
          range.setStart(el, 0);
          range.collapse(true);
          return true;
        }
        current += len;
        return false;
      }
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      if (walk(node.childNodes[i])) return true;
    }
    return false;
  };
  const walked = walk(container);
  if (!walked) {
    if (offset === 0) {
      range.setStart(container, 0);
      range.collapse(true);
    } else {
      range.selectNodeContents(container);
      range.collapse(false);
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function isBadFocusTarget(node: HTMLElement | null): boolean {
  if (!node || !node.isConnected) return true;
  const rect = node.getBoundingClientRect();
  if (rect.height <= 0) return true;
  if (node.getAttribute('data-line-label')) return true;
  if (node.getAttribute('data-cursor-anchor') && !node.getAttribute('data-line2-placeholder')) return true;
  return false;
}

interface InlineSegmentEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  slotNames: string[];
  slotConfigs: Record<string, SlotConfig>;
  onSlotConfigChange: (slotName: string, config: SlotConfig) => void;
  chipDefaultOpenId?: string | null;
  onSlashKey?: (anchor: { top: number; left: number }, insertOffset: number) => void;
  onCaretPosition?: (rect: DOMRect) => void;
  /** Called when caret offset changes (for context-aware suggestions, e.g. after slot ref). */
  onCaretOffsetChange?: (offset: number, anchor: { top: number; left: number }) => void;
  /** When true, show Validation prompt state (Figma 842-6525) before a validation type is selected. */
  validationPromptActive?: boolean;
  /** Explicit global focus request from parent transaction manager. */
  focusRequest?: { seq: number; offset: number; reason: string } | null;
  /** Increment to invalidate stale local caret refs after external inserts. */
  caretResetSeq?: number;
  debugInteractionId?: string | null;
  debugSlotId?: string;
}

/**
 * Contenteditable that:
 * - Intercepts typing in beforeinput/keydown and applies changes ourselves so there's no duplication.
 * - On re-render, @slot_name (after space) is replaced by a green chip; chip fully replaces the text.
 */
export function InlineSegmentEditor({
  content,
  onChange,
  placeholder,
  slotNames,
  slotConfigs,
  onSlotConfigChange,
  chipDefaultOpenId = null,
  onSlashKey,
  onCaretPosition,
  onCaretOffsetChange,
  validationPromptActive = false,
  focusRequest = null,
  caretResetSeq = 0,
  debugInteractionId = null,
  debugSlotId = 'slot-1',
}: InlineSegmentEditorProps) {
  // #region agent log
  const logInlineRender = (message: string, data: Record<string, unknown>, hypothesisId: string) => {
    if (typeof fetch === 'undefined') return;
    fetch('http://127.0.0.1:7475/ingest/85fb0133-7344-44d6-adaa-9a6e88888095', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '24a1d3' },
      body: JSON.stringify({
        sessionId: '24a1d3',
        runId: 'dup-validate-focus-debug',
        hypothesisId,
        location: 'InlineSegmentEditor.tsx',
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  };
  // #endregion

  const containerRef = useRef<HTMLDivElement>(null);
  const lastAppliedFocusSeqRef = useRef<number>(0);
  const isComposingRef = useRef(false);
  const caretOffsetRef = useRef<number | null>(null);
  const justAppliedRef = useRef(false);

  const segments = parseTextToSegmentsForEditor(content);
  const afterContainsPlaceholder = getPlaceholderAfterSegment(segments);

  type RenderItem =
    | { type: 'label'; kind: 'define' | 'validation'; lineIndex: number }
    | { type: 'segment'; segment: InlineSegment; lineIndex: number; segStart: number; segEnd: number }
    | { type: 'validation_line_placeholder'; lineIndex: number };

  const renderItems = useMemo((): RenderItem[] => {
    if (segments.length === 0) return [];
    const segStarts: number[] = [];
    let pos = 0;
    for (const seg of segments) {
      segStarts.push(pos);
      pos += getSegmentSerializedLength(seg);
    }
    const newlineIndices: number[] = [];
    for (let i = 0; i < content.length; i++) if (content[i] === '\n') newlineIndices.push(i);
    const newlineIdx = newlineIndices.length > 0 ? newlineIndices[0] : -1;
    const lineRanges: [number, number][] = [];
    for (let L = 0; L <= newlineIndices.length; L++) {
      const start = L === 0 ? 0 : newlineIndices[L - 1] + 1;
      const end = L < newlineIndices.length ? newlineIndices[L] + 1 : content.length;
      lineRanges.push([start, end]);
    }
    const segmentLineIndex = (segStart: number): number => {
      const idx = lineRanges.findIndex(([s, e]) => segStart >= s && segStart < e);
      return idx >= 0 ? idx : 0;
    };
    const hasSlotRef: boolean[] = [];
    const hasValidation: boolean[] = [];
    for (let L = 0; L < lineRanges.length; L++) {
      hasSlotRef[L] = false;
      hasValidation[L] = false;
    }
    for (let i = 0; i < segments.length; i++) {
      const lineIndex = segmentLineIndex(segStarts[i]);
      const seg = segments[i];
      if (seg.type === 'slot_ref') hasSlotRef[lineIndex] = true;
      if (seg.type === 'validation') hasValidation[lineIndex] = true;
    }
    const containsValidationIndex = segments.findIndex(
      (s): s is InlineSegment & { type: 'validation' } => s.type === 'validation' && s.validationType === 'contains'
    );
    let containsValueProvided = false;
    if (containsValidationIndex >= 0) {
      const containsSeg = segments[containsValidationIndex] as InlineSegment & { type: 'validation' };
      const val = containsSeg.value;
      if (Array.isArray(val)) containsValueProvided = val.length > 0;
      else if (typeof val === 'string') containsValueProvided = val.trim().length > 0;
      else if (val != null) containsValueProvided = true;
      if (!containsValueProvided) {
        for (let i = containsValidationIndex + 1; i < segments.length; i++) {
          const seg = segments[i];
          if (seg.type === 'value_ref') {
            containsValueProvided = true;
            break;
          }
          if (seg.type === 'text') {
            const newlineIdxInText = seg.value.indexOf('\n');
            const sameLineText = newlineIdxInText >= 0 ? seg.value.slice(0, newlineIdxInText) : seg.value;
            if (sameLineText.trim().length > 0) {
              containsValueProvided = true;
              break;
            }
            if (newlineIdxInText >= 0) break;
            continue;
          }
          if (seg.type === 'validation') break;
        }
      }
    }
    const shouldShowContainsValuePlaceholder = containsValidationIndex >= 0 && !containsValueProvided;
    /* Show "Validation" label only when there is an actual validation segment on that line (Figma 842-6690). Do not show it when only slot + second line. */
    const items: RenderItem[] = [];
    const validationLabelLines = new Set<number>();
    const pushValidationLabel = (lineIndex: number) => {
      if (!hasValidation[lineIndex] || validationLabelLines.has(lineIndex)) return;
      items.push({ type: 'label', kind: 'validation', lineIndex });
      validationLabelLines.add(lineIndex);
    };
    let previousLineIndex = -1;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segStart = segStarts[i];
      const segLen = getSegmentSerializedLength(seg);
      const segEnd = segStart + segLen;
      if (seg.type === 'text' && seg.value.includes('\n')) {
        const firstNewline = seg.value.indexOf('\n');
        const beforePart = seg.value.slice(0, firstNewline + 1);
        const afterPart = seg.value.slice(firstNewline + 1);
        const line0End = segStart + beforePart.length;
        const line1Start = line0End;
        const lineIndex0 = segmentLineIndex(segStart);
        if (lineIndex0 > previousLineIndex) {
          if (lineIndex0 === 0 && hasSlotRef[0]) items.push({ type: 'label', kind: 'define', lineIndex: 0 });
          pushValidationLabel(lineIndex0);
        }
        items.push({
          type: 'segment',
          segment: { ...seg, id: `${seg.id}-before`, value: beforePart },
          lineIndex: lineIndex0,
          segStart,
          segEnd: line0End,
        });
        previousLineIndex = lineIndex0;
        if (afterPart.length > 0 && lineRanges.length > 1) {
          pushValidationLabel(1);
          items.push({
            type: 'segment',
            segment: { ...seg, id: `${seg.id}-after`, value: afterPart },
            lineIndex: 1,
            segStart: line1Start,
            segEnd,
          });
          previousLineIndex = 1;
        }
        continue;
      }
      const lineIndex = segmentLineIndex(segStart);
      if (newlineIdx >= 0 && segStart > newlineIdx && previousLineIndex < 1 && hasValidation[1]) {
        pushValidationLabel(1);
        previousLineIndex = 1;
      }
      if (lineIndex > previousLineIndex) {
        if (lineIndex === 0 && hasSlotRef[0]) items.push({ type: 'label', kind: 'define', lineIndex: 0 });
        pushValidationLabel(lineIndex);
      }
      items.push({ type: 'segment', segment: seg, lineIndex, segStart, segEnd });
      previousLineIndex = lineIndex;
    }
    /* Emit Validation label for empty line 1 only when there is a validation segment on that line. */
    if (lineRanges.length > 1 && hasValidation[1] && previousLineIndex < 1) {
      pushValidationLabel(1);
    }
    const line2Text = lineRanges.length > 1 ? content.slice(lineRanges[1][0], lineRanges[1][1]) : '';
    const line2HasVisibleText = line2Text.replace(/\u200B/g, '').trim().length > 0;
    /* Figma 842-6690: show line-2 placeholder only while line 2 has no user text. */
    const hasAnyValidation = hasValidation.some(Boolean);
    const shouldShowValuePlaceholder = shouldShowContainsValuePlaceholder || Boolean(afterContainsPlaceholder && !line2HasVisibleText);
    if (shouldShowValuePlaceholder) {
      items.push({ type: 'validation_line_placeholder', lineIndex: 1 });
    } else if (lineRanges.length > 1 && hasSlotRef[0] && !hasAnyValidation && !line2HasVisibleText) {
      if (validationPromptActive) {
        items.push({ type: 'label', kind: 'validation', lineIndex: 1 });
      }
      items.push({ type: 'validation_line_placeholder', lineIndex: 1 });
    }
    // #region agent log
    logInlineRender(
      'renderItems built',
      {
        contentLen: content.length,
        segmentValidations: segments.filter((s) => s.type === 'validation').length,
        validationLabelCount: items.filter((i) => i.type === 'label' && i.kind === 'validation').length,
        linePlaceholderCount: items.filter((i) => i.type === 'validation_line_placeholder').length,
        validationPromptActive,
        shouldShowContainsValuePlaceholder,
      },
      'H3'
    );
    // #endregion
    return items;
  }, [afterContainsPlaceholder, content, segments, validationPromptActive]);

  /* Caret offset in serialized content so we can place placeholder at (cursor) placeholder text */
  const [caretOffset, setCaretOffsetState] = useState<number | null>(null);
  const effectiveCaretOffset = caretOffset ?? content.length;

  /* Inline placeholder (Notion-style): real span so it's always visible at typing position. */
  const placeholderText: string =
    afterContainsPlaceholder ??
    (segments.length === 0 ? (placeholder ?? PLACEHOLDER_A) : PLACEHOLDER_B);

  const isEmpty = segments.length === 0;

  type DisplayItem =
    | RenderItem
    | { type: 'cursor_anchor' };

  const displayItems = useMemo((): DisplayItem[] => {
    const cursorAnchor: DisplayItem = { type: 'cursor_anchor' };
    if (renderItems.length === 0) return [];
    const out: DisplayItem[] = [];
    for (const item of renderItems) {
      if (item.type === 'label') {
        out.push(item);
        continue;
      }
      if (item.type === 'validation_line_placeholder') {
        out.push(cursorAnchor);
        continue;
      }
      if (item.type !== 'segment') continue;
      const { segment, segStart, segEnd } = item;
      const caretInSegment = effectiveCaretOffset >= segStart && effectiveCaretOffset < segEnd;
      if (!caretInSegment) {
        out.push(item);
        continue;
      }
      if (segment.type === 'text') {
        const offsetInSeg = effectiveCaretOffset - segStart;
        const before = segment.value.slice(0, offsetInSeg);
        const after = segment.value.slice(offsetInSeg);
        if (before) out.push({ ...item, segment: { ...segment, id: `${segment.id}-before`, value: before } });
        if (after) out.push({ ...item, segment: { ...segment, id: `${segment.id}-after`, value: after } });
      } else {
        out.push(item);
      }
    }
    return out;
  }, [renderItems, effectiveCaretOffset, segments]);

  /* When user has defined a slot and no validation yet, ensure line 2 exists once. */
  useEffect(() => {
    const slotRefs = segments.filter((s): s is InlineSegment & { type: 'slot_ref' } => s.type === 'slot_ref');
    const hasValidation = segments.some((s) => s.type === 'validation');
    if (slotRefs.length === 0 || hasValidation || content.includes('\n')) return;
    // #region agent log
    logInlineRender(
      'line2 ensure newline fired',
      {
        interactionId: debugInteractionId,
        slotRefCount: slotRefs.length,
        hasValidation,
        contentLen: content.length,
        newlineCount: (content.match(/\n/g) ?? []).length,
      },
      'H3'
    );
    // #endregion
    const newContent = content + '\n';
    const newCaret = newContent.length;
    caretOffsetRef.current = newCaret;
    setCaretOffsetState(newCaret);
    justAppliedRef.current = true;
    onChange(newContent);
  }, [content, segments, onChange]);

  const handleWrapperMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEmpty) return;
      const el = containerRef.current;
      if (!el) return;
      e.preventDefault();
      el.focus();
      setCaretAtOffset(el, 0);
      setCaretOffsetState(0);
    },
    [isEmpty]
  );

  const handleWrapperClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isEmpty) return;
      const el = containerRef.current;
      if (!el) return;
      el.focus();
      e.preventDefault();
      setCaretAtOffset(el, 0);
    },
    [isEmpty]
  );

  const applyChange = useCallback(
    (newContent: string, newCaretOffset: number, source: string = 'unknown') => {
      // #region agent log
      logInlineRender(
        'applyChange',
        {
          source,
          interactionId: debugInteractionId,
          slotId: debugSlotId,
          newCaretOffset,
          newContentLen: newContent.length,
          newContentNewlines: (newContent.match(/\n/g) ?? []).length,
          hasValidationAfter: parseTextToSegmentsForEditor(newContent).some((s) => s.type === 'validation'),
        },
        'H6'
      );
      // #endregion
      caretOffsetRef.current = newCaretOffset;
      setCaretOffsetState(newCaretOffset);
      justAppliedRef.current = true;
      onChange(newContent);
    },
    [debugInteractionId, debugSlotId, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el || isComposingRef.current) return;

      const key = e.key;
      const sel = window.getSelection();

      if (key === '/' && onSlashKey && sel && sel.rangeCount > 0) {
        e.preventDefault();
        const anchor = getCaretCoordinates(el, sel);
        const insertOffset = getCaretOffset(el, sel);
        onSlashKey(anchor, insertOffset);
        return;
      }

      const isPrintable = key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      const isBackspace = key === 'Backspace';
      const isDelete = key === 'Delete';

      if (!isPrintable && !isBackspace && !isDelete) return;
      if (!sel || sel.rangeCount === 0) return;

      e.preventDefault();
      const currentContent = serializeDom(el);
      const offset = getCaretOffset(el, sel);

      let newContent: string;
      let newOffset: number;

      if (isPrintable) {
        newContent = currentContent.slice(0, offset) + key + currentContent.slice(offset);
        newOffset = offset + 1;
      } else if (isBackspace) {
        if (offset <= 0) return;
        newContent = currentContent.slice(0, offset - 1) + currentContent.slice(offset);
        newOffset = offset - 1;
      } else {
        if (offset >= currentContent.length) return;
        newContent = currentContent.slice(0, offset) + currentContent.slice(offset + 1);
        newOffset = offset;
      }

      applyChange(newContent, newOffset);
    },
    [applyChange, onSlashKey]
  );

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const native = e.nativeEvent as InputEvent;
      const inputType = native.inputType;

      if (justAppliedRef.current) {
        justAppliedRef.current = false;
        e.preventDefault();
        return;
      }

      const isHandled =
        inputType === 'insertText' ||
        inputType === 'insertLineBreak' ||
        inputType === 'deleteContentBackward' ||
        inputType === 'deleteContentForward';

      if (!isHandled) return;
      if (inputType === 'insertText' && native.data === '/' && onSlashKey) {
        e.preventDefault();
        return;
      }

      const el = containerRef.current;
      if (!el || isComposingRef.current) {
        if (isHandled) e.preventDefault();
        return;
      }

      e.preventDefault();

      const currentContent = serializeDom(el);
      const sel = window.getSelection();
      const offset = sel && sel.rangeCount > 0 ? getCaretOffset(el, sel) : currentContent.length;
      // #region agent log
      logInlineRender(
        'beforeinput start',
        {
          interactionId: debugInteractionId,
          slotId: debugSlotId,
          inputType,
          char: native.data ?? null,
          offset,
          currentContentLen: currentContent.length,
          currentContentNewlines: (currentContent.match(/\n/g) ?? []).length,
          hasValidationNow: segments.some((s) => s.type === 'validation'),
        },
        'H7'
      );
      // #endregion

      let newContent: string;
      let newOffset: number;

      if (inputType === 'insertText') {
        const data = native.data ?? '';
        const validationSeg = segments.find((s): s is InlineSegment & { type: 'validation' } => s.type === 'validation');
        if (validationSeg && data.length > 0) {
          // #region agent log
          logInlineRender(
            'validate value typing input',
            {
              interactionId: `validateValueType:${debugSlotId}:${validationSeg.id}:${Date.now()}`,
              slotId: debugSlotId,
              validationId: validationSeg.id,
              inputType,
              char: data,
              contentLen: currentContent.length,
              newlineCount: (currentContent.match(/\n/g) ?? []).length,
            },
            'H5'
          );
          // #endregion
        }
        const textBeforeCaret = currentContent.slice(0, offset);
        const atBoundary = offset === 0 || /[\s\n]/.test(currentContent[offset - 1] ?? '');
        if (data === ' ' && atBoundary) {
          if (/^\s*define$/.test(textBeforeCaret.trimStart())) {
            const leading = textBeforeCaret.match(/^\s*/)?.[0] ?? '';
            newContent = leading + '@ ' + currentContent.slice(offset);
            newOffset = leading.length + 2;
            applyChange(newContent, newOffset, 'beforeinput:keyword-define');
            return;
          }
          if (/^\s*if$/.test(textBeforeCaret.trimStart())) {
            const leading = textBeforeCaret.match(/^\s*/)?.[0] ?? '';
            newContent = leading + 'if @ ' + currentContent.slice(offset);
            newOffset = leading.length + 5;
            applyChange(newContent, newOffset, 'beforeinput:keyword-if');
            return;
          }
          if (/^\s*validate$/.test(textBeforeCaret.trimStart())) {
            const leading = textBeforeCaret.match(/^\s*/)?.[0] ?? '';
            newContent = leading + ' ' + currentContent.slice(offset);
            newOffset = leading.length + 1;
            applyChange(newContent, newOffset, 'beforeinput:keyword-validate');
            if (onSlashKey) {
              setTimeout(() => {
                const el2 = containerRef.current;
                const sel2 = window.getSelection();
                if (el2 && sel2?.rangeCount && el2.contains(sel2.anchorNode)) {
                  onSlashKey(getCaretCoordinates(el2, sel2), newOffset);
                }
              }, 0);
            }
            return;
          }
        }
        newContent = currentContent.slice(0, offset) + data + currentContent.slice(offset);
        newOffset = offset + data.length;
      } else if (inputType === 'insertLineBreak') {
        newContent = currentContent.slice(0, offset) + '\n' + currentContent.slice(offset);
        newOffset = offset + 1;
        applyChange(newContent, newOffset, 'beforeinput:linebreak');
        if (onSlashKey) {
          setTimeout(() => {
            const el = containerRef.current;
            const sel = window.getSelection();
            if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
              const anchor = getCaretCoordinates(el, sel);
              onSlashKey(anchor, newOffset);
            }
          }, 0);
        }
        return;
      } else if (inputType === 'deleteContentBackward') {
        if (offset <= 0) return;
        newContent = currentContent.slice(0, offset - 1) + currentContent.slice(offset);
        newOffset = offset - 1;
      } else {
        if (offset >= currentContent.length) return;
        newContent = currentContent.slice(0, offset) + currentContent.slice(offset + 1);
        newOffset = offset;
      }

      applyChange(newContent, newOffset, `beforeinput:${inputType}`);
    },
    [applyChange, debugSlotId, onSlashKey, segments]
  );

  const reportCaretRef = useRef<() => void>(() => {});
  useEffect(() => {
    const reportCaret = () => {
      const el = containerRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!el.contains(sel.anchorNode)) return;
      if (onCaretPosition) {
        const range = sel.getRangeAt(0);
        onCaretPosition(range.getBoundingClientRect());
      }
      const off = getCaretOffset(el, sel);
      setCaretOffsetState(off);
      if (onCaretOffsetChange) {
        const anchor = getCaretCoordinates(el, sel);
        onCaretOffsetChange(off, anchor);
      }
    };

    reportCaretRef.current = reportCaret;
    const handleSelectionChange = () => requestAnimationFrame(reportCaret);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [onCaretPosition, onCaretOffsetChange]);

  const handleFocus = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      const len = serializeDom(el).length;
      if (len === 0) {
        setCaretAtOffset(el, 0);
        setCaretOffsetState(0);
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
          setCaretOffsetState(getCaretOffset(el, sel));
        }
      }
    }
    if (onCaretPosition) requestAnimationFrame(() => reportCaretRef.current());
  }, [content.length, onCaretPosition]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    if (justAppliedRef.current) {
      justAppliedRef.current = false;
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const raw = serializeDom(el);
    if (raw === content) return;
    // #region agent log
    logInlineRender(
      'onInput fallback change',
      {
        interactionId: debugInteractionId,
        slotId: debugSlotId,
        rawLen: raw.length,
        rawNewlines: (raw.match(/\n/g) ?? []).length,
        prevContentLen: content.length,
        prevContentNewlines: (content.match(/\n/g) ?? []).length,
        hasValidationRaw: parseTextToSegmentsForEditor(raw).some((s) => s.type === 'validation'),
      },
      'H8'
    );
    // #endregion
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      caretOffsetRef.current = getCaretOffset(el, sel);
    }
    onChange(raw);
  }, [content, onChange]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const text = e.clipboardData.getData('text/plain');
      const currentContent = serializeDom(el);
      const offset = getCaretOffset(el, sel);
      const newContent = currentContent.slice(0, offset) + text + currentContent.slice(offset);
      caretOffsetRef.current = offset + text.length;
      justAppliedRef.current = true;
      onChange(newContent);
    },
    [onChange]
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    handleInput();
  }, [handleInput]);

  const hasValidationLinePlaceholder = renderItems.some((r) => r.type === 'validation_line_placeholder');
  const containsValidationSelected = segments.some(
    (s): s is InlineSegment & { type: 'validation' } => s.type === 'validation' && s.validationType === 'contains'
  );
  const line2PlaceholderText =
    containsValidationSelected
      ? CONTAINS_VALUE_PLACEHOLDER
      : afterContainsPlaceholder ?? (validationPromptActive ? '/ validate that the value' : PLACEHOLDER_B);

  useEffect(() => {
    caretOffsetRef.current = null;
  }, [caretResetSeq]);

  useLayoutEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.seq <= lastAppliedFocusSeqRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    lastAppliedFocusSeqRef.current = focusRequest.seq;
    const len = serializeDom(el).length;
    const targetOffset = Math.max(0, Math.min(focusRequest.offset, len));
    caretOffsetRef.current = targetOffset;
    setCaretOffsetState(targetOffset);
    el.focus();
    setCaretAtOffset(el, targetOffset);
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement =
      anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : (anchorNode?.parentElement ?? null);
    if (isBadFocusTarget(anchorElement)) {
      const endOffset = serializeDom(el).length;
      setCaretAtOffset(el, endOffset);
      caretOffsetRef.current = endOffset;
      setCaretOffsetState(endOffset);
    }
    const anchorRect = anchorElement?.getBoundingClientRect();
    // #region agent log
    logInlineRender(
      'focus request applied',
      {
        interactionId: debugInteractionId,
        seq: focusRequest.seq,
        reason: focusRequest.reason,
        requestedOffset: focusRequest.offset,
        targetOffset,
        serializedLen: len,
        anchorTag: anchorElement?.tagName ?? null,
        anchorDataLineLabel: anchorElement?.getAttribute('data-line-label') ?? null,
        anchorDataCursorAnchor: anchorElement?.getAttribute('data-cursor-anchor') ?? null,
        anchorHeight: anchorRect?.height ?? null,
      },
      'H4'
    );
    // #endregion
  }, [focusRequest]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const fromRef = caretOffsetRef.current;
    const defaultOnLine2 = content.endsWith('\n') && hasValidationLinePlaceholder ? content.length : undefined;
    const desiredOffset = fromRef ?? defaultOnLine2;
    const isFocused = el ? document.activeElement === el : false;
    const willApply = el && desiredOffset != null && (fromRef != null || defaultOnLine2 != null);
    if (willApply) {
      const len = serializeDom(el).length;
      const targetOffset = Math.min(desiredOffset, len);
      if (fromRef != null) caretOffsetRef.current = null;
      if (!isFocused && (fromRef != null || defaultOnLine2 != null)) el.focus();
      setCaretAtOffset(el, targetOffset);
    }
  }, [content, hasValidationLinePlaceholder, renderItems]);

  return (
    <div
      className={styles.editorWrapper}
      data-empty={isEmpty ? 'true' : 'false'}
      data-placeholder={placeholderText}
      data-line2-placeholder={hasValidationLinePlaceholder ? line2PlaceholderText : undefined}
      onMouseDown={handleWrapperMouseDown}
      onClick={handleWrapperClick}
      role="presentation"
    >
      <div
        ref={containerRef}
        className={`${styles.editor} ${styles.ceEditor} ${isEmpty ? styles.editorEmpty : ''}`}
        contentEditable
        data-placeholder={placeholderText}
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        data-role="slot-editor"
        aria-label="Slot definition editor"
      >
        {isEmpty ? (
          <br />
        ) : (
          displayItems.map((item) => {
            if (item.type === 'label') {
              return (
                <span
                  key={`label-${item.kind}-${item.lineIndex}`}
                  contentEditable={false}
                  data-line-label={item.kind}
                  className={item.kind === 'define' ? styles.lineLabelDefine : styles.lineLabelValidation}
                >
                  {item.kind === 'define' ? CONTROL_LABEL_DEFINE : VALIDATION_LINE_LABEL}
                </span>
              );
            }
            if (item.type === 'cursor_anchor') {
              return (
                <span
                  key="cursor-anchor-validation-line"
                  contentEditable={false}
                  className={styles.cursorAnchor}
                  data-placeholder-inline
                  data-cursor-anchor
                  data-line2-placeholder={hasValidationLinePlaceholder ? line2PlaceholderText : undefined}
                >
                  {'\u200B'}
                </span>
              );
            }
            if (item.type !== 'segment') return null;
            const seg = item.segment;
          if (seg.type === 'text') {
            return <span key={seg.id}>{seg.value}</span>;
          }
          if (seg.type === 'slot_ref') {
            const saved = slotConfigs[seg.slotName];
            return (
              <span key={seg.id} contentEditable={false} data-slot-ref={seg.slotName}>
                <SlotChip
                  slotName={seg.slotName}
                  slotType={saved?.slotType ?? 'string'}
                  dependencies={saved?.dependencies ?? []}
                  defaultValues={saved?.defaultValues ?? ''}
                  slotNames={slotNames}
                  dataSegmentId={seg.id}
                  defaultOpen={seg.id === chipDefaultOpenId}
                  onChange={(config) => onSlotConfigChange(seg.slotName, config)}
                />
              </span>
            );
          }
          if (seg.type === 'value_ref') {
            return (
              <span key={seg.id} contentEditable={false} className={styles.valueChip} data-value-ref={seg.valueName}>
                {seg.valueName}
              </span>
            );
          }
          if (seg.type === 'validation') {
            return (
              <span key={seg.id} contentEditable={false} data-validation-type={seg.validationType}>
                <ValidationChip
                  slotRef={seg.slotRef}
                  validationType={seg.validationType}
                  operator={seg.operator}
                  value={seg.value}
                  dataSegmentId={seg.id}
                />
              </span>
            );
          }
          return null;
          })
        )}
      </div>
    </div>
  );
}
