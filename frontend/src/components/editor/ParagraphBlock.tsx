import { useRef, useCallback, useEffect } from 'react';
import type { ParagraphBlock as ParagraphBlockType } from '../../types';
import styles from './ParagraphBlock.module.css';

interface ParagraphBlockProps {
  block: ParagraphBlockType;
  placeholder?: string;
  onContentChange: (content: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSlash?: () => void;
  onAt?: () => void;
  isSelected?: boolean;
}

export function ParagraphBlock({
  block,
  placeholder = "Type '/' for commands, '@' for slot references",
  onContentChange,
  onKeyDown,
  onSlash,
  onAt,
}: ParagraphBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleInput = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onContentChange(el.innerText);
  }, [onContentChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault();
        onSlash?.();
        return;
      }
      if (e.key === '@') {
        e.preventDefault();
        onAt?.();
        return;
      }
      onKeyDown(e);
    },
    [onSlash, onAt, onKeyDown]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerText !== block.content) {
      el.innerText = block.content;
    }
  }, [block.id, block.content]);

  return (
    <div
      ref={ref}
      className={styles.editor}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      aria-label="Paragraph"
    />
  );
}
