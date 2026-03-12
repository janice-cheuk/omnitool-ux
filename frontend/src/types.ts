export type SlotType = 'string' | 'int' | 'float' | 'enum' | 'boolean';

export type AssistantStatus = 'idle' | 'thinking' | 'result' | 'error';

// --- Block-based document model (Notion/Coda-style) ---

export type Block =
  | ParagraphBlock
  | SlotDefinitionBlock
  | ValidationBlock
  | ConditionBlock;

export interface BaseBlock {
  id: string;
  type: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: string;
}

export interface SlotDefinitionBlock extends BaseBlock {
  type: 'slot_definition';
  slotName: string;
  slotType: SlotType;
  enumValues?: string[];
  missingSlotConfig?: { toolMessage: string; configured: boolean };
}

export interface ValidationBlock extends BaseBlock {
  type: 'validation';
  slotRef: string;
  intent: 'in_list' | 'numeric' | 'required' | 'match' | 'contains';
  operator?: string;
  value?: string | number | string[];
}

export type ConditionAction =
  | { kind: 'respond'; message: string }
  | { kind: 'invoke_tool'; toolName: string }
  | { kind: 'update_slot'; slotName: string; value: string }
  | { kind: 'transfer'; target: string }
  | { kind: 'end_conversation' };

export interface ConditionBlock extends BaseBlock {
  type: 'condition';
  slotRef: string;
  operator: string;
  value: string | number | boolean;
  action: ConditionAction;
}

/** Saved config for a slot (from the green chip dropdown); shared across all uses of that slot. */
export interface SlotConfig {
  slotType: SlotType;
  dependencies: string[];
  defaultValues: string;
}

export interface SlotCardDraft {
  id: string;
  content: string;
}

export interface Document {
  id: string;
  title: string;
  description: string;
  blocks: Block[];
  freeTextContent?: string;
  slotCards?: SlotCardDraft[];
  /** Config per slot name (from chip dropdown); used whenever that slot's chip is opened. */
  slotConfigs?: Record<string, SlotConfig>;
}

export interface ValidationRule {
  id: string;
  kind: 'defined_list' | 'numeric';
  definedList?: string[];
  numericOp?: '>=' | '>' | '<=' | '<' | '==' | '!=';
  numericValue?: number;
}

export interface DocumentWarning {
  blockId: string;
  code: 'duplicate_slot' | 'missing_config' | 'overlapping_condition' | 'unused_slot' | 'empty_list';
  message: string;
}

export interface PendingDiff {
  id: string;
  blocksToAdd: Block[];
  insertionPoint: { afterBlockId: string } | { atCursor: true };
  message?: string;
}

// Legacy slot type for assistant compatibility
export interface Slot {
  id: string;
  name: string;
  type: SlotType;
  order: number;
  validations: { id: string; kind: string; definedList?: string[] }[];
  status: string;
  expanded: boolean;
}

export interface PendingAssistantDiff {
  kind: 'slots_created' | 'slots_updated' | 'validations_updated';
  suggestedSlots: Slot[];
  blocksToAdd?: Block[];
  insertionPoint?: { afterBlockId: string };
  message?: string;
}
