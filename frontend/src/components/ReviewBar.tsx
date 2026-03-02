import styles from './ReviewBar.module.css';

interface ReviewBarProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function ReviewBar({ onAccept, onDecline }: ReviewBarProps) {
  return (
    <div className={styles.bar} role="region" aria-label="Review assistant changes">
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.accept}
          onClick={onAccept}
          aria-label="Accept changes (⌘↵)"
        >
          Accept <span className={styles.shortcut}>(⌘↵)</span>
        </button>
        <button
          type="button"
          className={styles.decline}
          onClick={onDecline}
          aria-label="Decline changes (Esc)"
        >
          Decline <span className={styles.shortcut}>(Esc)</span>
        </button>
      </div>
    </div>
  );
}
