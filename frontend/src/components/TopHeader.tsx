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
  toolName,
  lastSavedAt,
  draftDirty,
  onAgentTitleChange,
  onToolNameChange,
  onSave,
}: TopHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTool, setEditingTool] = useState(false);
  const [titleValue, setTitleValue] = useState(agentTitle);
  const [toolValue, setToolValue] = useState(toolName);

  const commitTitle = () => {
    setEditingTitle(false);
    const v = titleValue.trim() || agentTitle;
    setTitleValue(v);
    onAgentTitleChange(v);
  };

  const commitTool = () => {
    setEditingTool(false);
    const v = toolValue.trim() || toolName;
    setToolValue(v);
    onToolNameChange(v);
  };

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <div className={styles.agentTitleRow}>
          <span className={styles.agentLabel}>AI agent title</span>
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
        <div className={styles.tabs}>
          <button type="button" className={styles.tab}>Global</button>
          <button type="button" className={styles.tab}>subAgents</button>
        </div>
      </div>

      <div className={styles.toolRow}>
        <span className={styles.toolLabel}>Omni Tool</span>
        {editingTool ? (
          <input
            className={styles.inlineInput}
            value={toolValue}
            onChange={(e) => setToolValue(e.target.value)}
            onBlur={commitTool}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTool();
              if (e.key === 'Escape') {
                setToolValue(toolName);
                setEditingTool(false);
              }
            }}
            autoFocus
            aria-label="Edit tool name"
          />
        ) : (
          <>
            <span className={styles.toolName}>{toolName}</span>
            <button
              type="button"
              className={styles.pencilBtn}
              onClick={() => setEditingTool(true)}
              aria-label="Edit tool name"
            >
              ✎
            </button>
          </>
        )}
      </div>

      <div className={styles.saveRow}>
        {lastSavedAt && (
          <span className={styles.lastSaved}>
            Last saved: {lastSavedAt.toLocaleTimeString()}
          </span>
        )}
        <div className={styles.saveDropdown}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={onSave}
            disabled={!draftDirty}
            aria-label="Save draft"
          >
            Save
          </button>
          <button type="button" className={styles.saveCaret} aria-hidden>▾</button>
        </div>
      </div>
    </header>
  );
}
