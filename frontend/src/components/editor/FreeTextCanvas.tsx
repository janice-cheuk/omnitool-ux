import { useState, useCallback, useRef } from 'react';
import type { Document } from '../../types';
import { parseTextToSegments } from '../../lib/parseInline';
import { FreeTextEditor } from './FreeTextEditor';
import { SlotsTOCFromSegments } from './SlotsTOCFromSegments';
import styles from './BlockEditor.module.css';

interface FreeTextCanvasProps {
  document: Document;
  onDocumentChange: (doc: Document) => void;
}

export function FreeTextCanvas({ document, onDocumentChange }: FreeTextCanvasProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const content = document.freeTextContent ?? '';
  const segments = parseTextToSegments(content);

  const handleContentChange = useCallback(
    (newContent: string) => {
      onDocumentChange({
        ...document,
        freeTextContent: newContent,
      });
    },
    [document, onDocumentChange]
  );

  const handleSelectSlot = useCallback((segmentId: string) => {
    setSelectedSegmentId(segmentId);
    const el = editorRef.current?.querySelector(`[data-segment-id="${segmentId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <div className={styles.editor}>
      <div className={styles.docArea}>
        <aside className={styles.toc}>
          <h2 className={styles.tocTitle}>Slots</h2>
          <SlotsTOCFromSegments
            segments={segments}
            selectedSegmentId={selectedSegmentId}
            onSelectSlot={handleSelectSlot}
          />
        </aside>

        <div className={styles.blocks} ref={editorRef}>
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
          <div className={styles.freeTextArea}>
            <FreeTextEditor
              content={content}
              onChange={handleContentChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
