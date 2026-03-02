import { useRef, useCallback, useEffect, useState } from 'react';
import type { InlineSegment } from '../../lib/parseInline';
import { parseTextToSegments, getSlotNamesFromSegments } from '../../lib/parseInline';
import { SlashCommandMenu } from './SlashCommandMenu';
import { SlotPicker } from './SlotPicker';
import styles from './FreeTextEditor.module.css';

function getChipText(seg: InlineSegment): string {
  if (seg.type === 'slot_def') return `slot ${seg.slotName}`;
  if (seg.type === 'validation') {
    if (seg.intent === 'in_list') return `${seg.slotRef} in [${((seg.value as string[]) || []).join(', ')}]`;
    if (seg.intent === 'numeric') return `${seg.slotRef} ${seg.operator} ${seg.value}`;
    if (seg.intent === 'required') return `${seg.slotRef} is not empty`;
  }
  if (seg.type === 'condition') return `if ${seg.slotRef} ${seg.operator} ${seg.value} then ${seg.action}`;
  return '';
}

interface FreeTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function FreeTextEditor({
  content,
  onChange,
  placeholder = "Type freely. Say 'slot user_intent', 'validate X in [a,b,c]', 'if X == Y then respond' — objects auto-detect as chips.",
}: FreeTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [slashAnchor, setSlashAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slotPickerAnchor, setSlotPickerAnchor] = useState<{ top: number; left: number } | null>(null);
  const isComposing = useRef(false);
  const lastInputTime = useRef(0);

  const segments = parseTextToSegments(content);
  const slotNames = getSlotNamesFromSegments(segments);

  const extractContentFromDom = useCallback(() => {
    const el = ref.current;
    if (!el) return '';
    let text = '';
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement;
        if (elem.getAttribute('contenteditable') === 'false') {
          text += elem.textContent || '';
        } else {
          node.childNodes.forEach(walk);
        }
      }
    };
    el.childNodes.forEach(walk);
    return text;
  }, []);

  const contentRef = useRef(content);
  contentRef.current = content;

  const syncDomFromContent = useCallback((text?: string) => {
    const el = ref.current;
    if (!el) return;
    const textToParse = text ?? contentRef.current;
    const segs = parseTextToSegments(textToParse);
    el.innerHTML = '';
    segs.forEach((seg) => {
      if (seg.type === 'text') {
        el.appendChild(document.createTextNode(seg.value));
      } else {
        const text = getChipText(seg);
        if (text) {
          const span = document.createElement('span');
          span.className = seg.type === 'condition' ? styles.chipCondition : styles.chip;
          span.setAttribute('data-segment-id', seg.id);
          span.contentEditable = 'false';
          span.textContent = text;
          el.appendChild(span);
        }
      }
    });
    el.focus();
    const range = window.document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    lastInputTime.current = Date.now();
    const newContent = extractContentFromDom();
    if (newContent !== content) onChange(newContent);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => syncDomFromContent(newContent), 400);
  }, [content, onChange, extractContentFromDom, syncDomFromContent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault();
        const el = ref.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          setSlashAnchor({ top: rect.bottom + 4, left: rect.left });
        }
        return;
      }
      if (e.key === '@') {
        e.preventDefault();
        const el = ref.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          setSlotPickerAnchor({ top: rect.bottom + 4, left: rect.left });
        }
        return;
      }
    },
    []
  );

  const handleCompositionStart = () => { isComposing.current = true; };
  const handleCompositionEnd = () => { isComposing.current = false; };

  // Initial sync and when content changes from parent (e.g. slash insert)
  useEffect(() => {
    syncDomFromContent();
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    if (ref.current && (ref.current !== document.activeElement || Date.now() - lastInputTime.current > 100)) {
      syncDomFromContent();
    }
  }, [content, syncDomFromContent]);

  return (
    <div className={styles.wrapper}>
      <div
        ref={ref}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        aria-label="Free text editor"
      />
      {slashAnchor && (
        <SlashCommandMenu
          slotNames={slotNames}
          anchorRect={slashAnchor}
          onSelect={(cmd) => {
            setSlashAnchor(null);
            if (cmd.kind === 'insert_slot_ref' && cmd.slotName) {
              onChange(content + `@${cmd.slotName} `);
            } else if (cmd.kind === 'define_slot') {
              onChange(content + (content ? ' ' : '') + 'slot ');
            } else if (cmd.kind === 'add_validation') {
              onChange(content + (content ? ' ' : '') + 'validate ');
            } else if (cmd.kind === 'add_condition') {
              onChange(content + (content ? ' ' : '') + 'if  then ');
            }
          }}
          onClose={() => setSlashAnchor(null)}
        />
      )}
      {slotPickerAnchor && (
        <SlotPicker
          slotNames={slotNames}
          anchorRect={slotPickerAnchor}
          filter=""
          onSelect={(name) => {
            setSlotPickerAnchor(null);
            onChange(content + `@${name} `);
          }}
          onClose={() => setSlotPickerAnchor(null)}
        />
      )}
    </div>
  );
}
