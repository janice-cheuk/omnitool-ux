import { useState, useCallback } from 'react';
import type { AssistantStatus } from '../types';
import styles from './AssistantPanel.module.css';

const STARTER_OPTIONS = [
  { id: 'address', label: 'Address collection flow', icon: '📇' },
  { id: 'payment', label: 'Payment collection flow', icon: '💵' },
  { id: 'custom', label: 'Build with custom instructions', icon: '🔧' },
] as const;

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

  const handleStarterClick = useCallback(
    (label: string) => {
      onSendPrompt(label);
    },
    [onSendPrompt]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showEmptyState = !userPrompt && assistantStatus !== 'result';

  return (
    <div className={styles.panel}>
      <div className={styles.content}>
        {showEmptyState && (
          <div className={styles.welcomeState}>
            <p className={styles.welcomeTitle}>
              Welcome, I&apos;m your omni tool building assistant.
            </p>
            <p className={styles.welcomeDesc}>
              Describe the information you need to collect and what should happen when it&apos;s captured.
              I&apos;ll help you design the slots, validation rules, conditions, and tool triggers.
            </p>
            <p className={styles.welcomeQuestion}>What are you building today?</p>
            <div className={styles.starterCards}>
              {STARTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={styles.starterCard}
                  onClick={() => handleStarterClick(opt.label)}
                  disabled={assistantStatus === 'thinking'}
                >
                  <span className={styles.starterIcon}>{opt.icon}</span>
                  <span className={styles.starterLabel}>{opt.label}</span>
                  <span className={styles.starterChevron} aria-hidden>›</span>
                </button>
              ))}
            </div>
          </div>
        )}

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

        {assistantStatus === 'result' && createdSlotNames.length > 0 && (
          <p className={styles.reviewText}>
            Review the suggested slots below and accept to add them to your flow.
          </p>
        )}
      </div>

      <div className={styles.composer}>
        <div className={styles.composerBar}>
          <input
            type="text"
            className={styles.composerInput}
            placeholder="Start building omni tool with custom instructions"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
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
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
