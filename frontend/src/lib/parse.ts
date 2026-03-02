import type { Block, SlotDefinitionBlock, ValidationBlock, ConditionBlock } from '../types';

export type ParseConfidence = 'high' | 'medium' | 'low';

export interface ParseResult {
  confidence: ParseConfidence;
  block?: Block;
  suggestion?: string;
  warning?: string;
}

const SLOT_PATTERNS = [
  { re: /^\s*(?:slot|create\s+slot|define\s+slot|collect)\s+([a-z][a-z0-9_]*)\s*$/i, confidence: 'high' as const },
  { re: /^\s*(?:slot|create\s+slot|define\s+slot|collect)\s+([a-z][a-z0-9_]*)\s*$/i, confidence: 'medium' as const },
];
const SLOT_WITH_TYPE = /^\s*slot\s+([a-z][a-z0-9_]*)\s*:\s*(string|int|float|enum|boolean)\s*$/i;

const VALIDATION_PATTERNS = [
  { re: /^\s*validate\s+@?([a-z][a-z0-9_]*)\s+is\s+one\s+of\s+\[([^\]]*)\]\s*$/i, intent: 'in_list' as const },
  { re: /^\s*@?([a-z][a-z0-9_]*)\s+in\s+\[([^\]]*)\]\s*$/i, intent: 'in_list' as const },
  { re: /^\s*@?([a-z][a-z0-9_]*)\s+must\s+be\s+(>=|<=|>|<|==|!=)\s+(-?\d+(?:\.\d+)?)\s*$/i, intent: 'numeric' as const },
  { re: /^\s*@?([a-z][a-z0-9_]*)\s+(>=|<=|>|<|==|!=)\s+(-?\d+(?:\.\d+)?)\s*$/i, intent: 'numeric' as const },
  { re: /^\s*@?([a-z][a-z0-9_]*)\s+is\s+not\s+empty\s*$/i, intent: 'required' as const },
];

const CONDITION_PATTERN = /^\s*if\s+@?([a-z][a-z0-9_]*)\s+(=|==|!=|>=|<=|>|<|in|contains)\s+(.+?)\s+then\s+(respond|invoke_tool|update_slot|transfer|end)\s*(.*)$/i;

function genId(): string {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseList(str: string): string[] {
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

export function parseBlockText(
  text: string,
  _existingSlotNames: string[]
): ParseResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Slot definition
  const slotWithType = SLOT_WITH_TYPE.exec(trimmed);
  if (slotWithType) {
    const slotName = slotWithType[1].toLowerCase().replace(/\s+/g, '_');
    return {
      confidence: 'high',
      block: {
        id: genId(),
        type: 'slot_definition',
        slotName,
        slotType: slotWithType[2] as SlotDefinitionBlock['slotType'],
      } as SlotDefinitionBlock,
    };
  }

  for (const { re, confidence } of SLOT_PATTERNS) {
    const m = re.exec(trimmed);
    if (m) {
      const slotName = m[1].toLowerCase().replace(/\s+/g, '_');
      return {
        confidence,
        block: {
          id: genId(),
          type: 'slot_definition',
          slotName,
          slotType: 'string',
        } as SlotDefinitionBlock,
      };
    }
  }

  // Validation
  for (const { re, intent } of VALIDATION_PATTERNS) {
    const m = re.exec(trimmed);
    if (m) {
      const slotRef = m[1].toLowerCase().replace(/\s+/g, '_');
      if (intent === 'in_list') {
        const listStr = m[2] || '';
        const list = parseList(listStr);
        if (list.length === 0 && listStr.length > 0) {
          return { confidence: 'low', warning: 'List cannot be empty' };
        }
        return {
          confidence: list.length > 0 ? 'high' : 'medium',
          block: {
            id: genId(),
            type: 'validation',
            slotRef,
            intent: 'in_list',
            value: list,
          } as ValidationBlock,
        };
      }
      if (intent === 'numeric') {
        const op = m[2];
        const val = Number(m[3]);
        return {
          confidence: 'high',
          block: {
            id: genId(),
            type: 'validation',
            slotRef,
            intent: 'numeric',
            operator: op,
            value: val,
          } as ValidationBlock,
        };
      }
      if (intent === 'required') {
        return {
          confidence: 'high',
          block: {
            id: genId(),
            type: 'validation',
            slotRef,
            intent: 'required',
          } as ValidationBlock,
        };
      }
    }
  }

  // Condition
  const condM = CONDITION_PATTERN.exec(trimmed);
  if (condM) {
    const slotRef = condM[1].toLowerCase().replace(/\s+/g, '_');
    const op = condM[2] === '=' ? '==' : condM[2];
    let value: string | number | boolean = condM[3].trim();
    const num = Number(value);
    if (!Number.isNaN(num)) value = num;
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    const actionKind = condM[4].toLowerCase();
    const actionArg = (condM[5] || '').trim().replace(/^["']|["']$/g, '');

    let action: ConditionBlock['action'];
    if (actionKind === 'respond') action = { kind: 'respond', message: actionArg };
    else if (actionKind === 'invoke_tool') action = { kind: 'invoke_tool', toolName: actionArg };
    else if (actionKind === 'update_slot') {
      const [slotName, val] = actionArg.split(/\s+/);
      action = { kind: 'update_slot', slotName: slotName || '', value: val || '' };
    } else if (actionKind === 'transfer') action = { kind: 'transfer', target: actionArg };
    else action = { kind: 'end_conversation' };

    return {
      confidence: 'high',
      block: {
        id: genId(),
        type: 'condition',
        slotRef,
        operator: op,
        value,
        action,
      } as ConditionBlock,
    };
  }

  return null;
}

export function getSlotNamesFromBlocks(blocks: Block[]): string[] {
  return blocks
    .filter((b): b is SlotDefinitionBlock => b.type === 'slot_definition')
    .map((b) => b.slotName);
}
