import { useState, useCallback } from 'react';
import type { AssistantStatus } from '../types';
import styles from './AssistantPanel.module.css';

interface AssistantPanelProps {
  userPrompt: string | null;
  thoughtDuration: number | null;
  assistantStatus: AssistantStatus;
  createdSlotNames: string[];
  onSendPrompt: (prompt: string) => void;
  onSlotPillClick: (name: string) => void;
}

export function AssistantPanel({
  userPrompt,
  thoughtDuration,
  assistantStatus,
  createdSlotNames,
  onSendPrompt,
  onSlotPillClick,
}: AssistantPanelProps) {
  const [input, setInput] = useState('');

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || assistantStatus === 'thinking') return;
    onSendPrompt(text);
    setInput('');
  }, [input, assistantStatus, onSendPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.content}>
        {userPrompt && (
          <div className={styles.userBubble} role="log">
            {userPrompt}
          </div>
        )}

        {assistantStatus === 'thinking' && (
          <div className={styles.thoughtLine}>
            Thinking…
          </div>
        )}

        {thoughtDuration != null && (
          <div className={styles.thoughtLine}>
            Thought for {thoughtDuration}s
          </div>
        )}

        {assistantStatus === 'result' && createdSlotNames.length > 0 && (
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.successIcon} aria-hidden>✓</span>
              <span>Slots created. Here&apos;s what is added.</span>
            </div>
            <div className={styles.pills}>
              {createdSlotNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={styles.pill}
                  onClick={() => onSlotPillClick(name)}
                  aria-label={`Go to slot ${name}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={styles.reviewText}>
          Review the suggested slots below and accept to add them to your flow.
        </p>
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.composerInput}
          placeholder="Start building omni tool with custom instructions"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={assistantStatus === 'thinking'}
          aria-label="Assistant prompt"
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || assistantStatus === 'thinking'}
          aria-label="Send"
        >
          {assistantStatus === 'thinking' ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
