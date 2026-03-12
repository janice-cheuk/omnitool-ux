import { useState } from 'react';
import styles from './TopHeader.module.css';

interface TopHeaderProps {
  agentTitle: string;
  toolName: string;
  lastSavedAt: Date | null;
  draftDirty: boolean;
  onAgentTitleChange: (v: string) => void;
  onToolNameChange: (v: string) => void;
  onSave: () => void;
}

export function TopHeader({
  agentTitle,
  lastSavedAt,
  draftDirty,
  onAgentTitleChange,
  onSave,
}: TopHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(agentTitle);

  const commitTitle = () => {
    setEditingTitle(false);
    const v = titleValue.trim() || agentTitle;
    setTitleValue(v);
    onAgentTitleChange(v);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.agentBlock}>
          {editingTitle ? (
            <input
              className={styles.inlineInput}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') {
                  setTitleValue(agentTitle);
                  setEditingTitle(false);
                }
              }}
              autoFocus
              aria-label="Edit AI agent title"
            />
          ) : (
            <>
              <span className={styles.agentTitle}>{agentTitle}</span>
              <button
                type="button"
                className={styles.pencilBtn}
                onClick={() => setEditingTitle(true)}
                aria-label="Edit AI agent title"
              >
                ✎
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.tabs}>
          <button type="button" className={styles.tabActive}>Global</button>
          <button type="button" className={styles.tab}>subAgents</button>
        </div>
      </div>

      <div className={styles.right}>
        {lastSavedAt && (
          <span className={styles.lastSaved}>
            Last saved: {lastSavedAt.toLocaleDateString()}, {lastSavedAt.toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          className={styles.saveBtn}
          onClick={onSave}
          disabled={!draftDirty}
          aria-label="Save draft"
        >
          Save ▾
        </button>
      </div>
    </header>
  );
}
