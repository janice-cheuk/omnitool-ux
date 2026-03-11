import { useState } from 'react';
import styles from './StarterScreen.module.css';

/** Payload captured from the starter form for the next screen. */
export interface StarterFormData {
  toolName: string;
  description: string;
}

interface StarterScreenProps {
  onSubmit: (data: StarterFormData) => void;
  onCancel?: () => void;
}

/** First screen: Build an Omni Tool — tool name and description (Figma 1086-37285). */
export function StarterScreen({ onSubmit, onCancel }: StarterScreenProps) {
  const [toolName, setToolName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    onSubmit({
      toolName: toolName.trim() || 'Omni Tool',
      description: description.trim(),
    });
  };

  return (
    <div className={styles.root} data-node-id="1086:37285">
      <aside className={styles.navFold} aria-label="Navigation">
        <div className={styles.logo}>
          <div className={styles.logoIcon} aria-hidden="true">C</div>
        </div>
      </aside>
      <div className={styles.contentArea}>
        <div className={styles.scrim} aria-hidden="true" />
        <div className={styles.modal} role="dialog" aria-labelledby="starter-title" aria-modal="true">
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 id="starter-title" className={styles.title}>
                Build an Omni Tool
              </h1>
              <span className={styles.infoIcon} title="Omni tools interpret user requests and decide the next best action." aria-label="Info">
                ℹ
              </span>
            </div>
            {onCancel && (
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onCancel}
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </header>

          <div className={styles.body}>
            <p className={styles.intro}>
              Omni tools can be used to interpret a user's request and deterministically decide the next best action.
            </p>

            <div className={styles.fieldGroup}>
              <label htmlFor="starter-tool-name">
                <span className={styles.fieldLabel}>Tool name</span>
              </label>
              <p className={styles.fieldHint}>
                Omni tools require a unique name and should be triggered in the main prompt
              </p>
              <input
                id="starter-tool-name"
                type="text"
                className={styles.input}
                placeholder="Enter tool name"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                aria-describedby="starter-tool-name-hint"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="starter-description">
                <span className={styles.fieldLabel}>Description</span>
              </label>
              <textarea
                id="starter-description"
                className={styles.textarea}
                placeholder="Enter description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="Description"
              />
            </div>

            <div className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.nextBtn}
                onClick={handleSubmit}
              >
                Next: Orchestrate Omni Tool
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
