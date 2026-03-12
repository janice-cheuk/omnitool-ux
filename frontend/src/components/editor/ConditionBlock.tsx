import type { ConditionBlock as ConditionBlockType, ConditionAction } from '../../types';
import { CONDITION_ACTION_LABELS } from '../../lib/slotAuthoring';
import styles from './ConditionBlock.module.css';

const ACTION_LABELS: Record<ConditionAction['kind'], string> = {
  respond: CONDITION_ACTION_LABELS.respond,
  invoke_tool: CONDITION_ACTION_LABELS.invoke_tool,
  update_slot: CONDITION_ACTION_LABELS.update_slot,
  transfer: CONDITION_ACTION_LABELS.transfer,
  end_conversation: CONDITION_ACTION_LABELS.end_conversation,
};

interface ConditionBlockProps {
  block: ConditionBlockType;
  onUpdate: (updates: Partial<ConditionBlockType>) => void;
}

export function ConditionBlock({ block, onUpdate }: ConditionBlockProps) {
  const action = block.action;

  return (
    <div className={styles.block}>
      <span className={styles.if}>IF</span>
      <span className={styles.chip}>@{block.slotRef}</span>
      <select
        className={styles.opSelect}
        value={block.operator}
        onChange={(e) => onUpdate({ operator: e.target.value })}
      >
        {['==', '!=', '>=', '<=', '>', '<', 'in', 'contains'].map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
      <input
        type="text"
        className={styles.valueInput}
        value={String(block.value)}
        onChange={(e) => {
          const v = e.target.value;
          const num = Number(v);
          onUpdate({
            value: v === 'true' ? true : v === 'false' ? false : !Number.isNaN(num) ? num : v,
          });
        }}
        placeholder="value"
      />
      <span className={styles.then}>THEN</span>
      <select
        className={styles.actionSelect}
        value={action.kind}
        onChange={(e) => {
          const k = e.target.value as ConditionAction['kind'];
          if (k === 'respond') onUpdate({ action: { kind: 'respond', message: '' } });
          else if (k === 'invoke_tool') onUpdate({ action: { kind: 'invoke_tool', toolName: '' } });
          else if (k === 'update_slot') onUpdate({ action: { kind: 'update_slot', slotName: '', value: '' } });
          else if (k === 'transfer') onUpdate({ action: { kind: 'transfer', target: '' } });
          else onUpdate({ action: { kind: 'end_conversation' } });
        }}
      >
        {(Object.keys(ACTION_LABELS) as ConditionAction['kind'][]).map((k) => (
          <option key={k} value={k}>{ACTION_LABELS[k]}</option>
        ))}
      </select>
      {action.kind === 'respond' && (
        <input
          type="text"
          className={styles.actionInput}
          value={action.message}
          onChange={(e) => onUpdate({ action: { ...action, message: e.target.value } })}
          placeholder="Message..."
        />
      )}
      {action.kind === 'invoke_tool' && (
        <input
          type="text"
          className={styles.actionInput}
          value={action.toolName}
          onChange={(e) => onUpdate({ action: { ...action, toolName: e.target.value } })}
          placeholder="Tool name"
        />
      )}
      {action.kind === 'transfer' && (
        <input
          type="text"
          className={styles.actionInput}
          value={action.target}
          onChange={(e) => onUpdate({ action: { ...action, target: e.target.value } })}
          placeholder="Target"
        />
      )}
    </div>
  );
}
