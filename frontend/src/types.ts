export type SlotType = 'string' | 'int' | 'float' | 'enum' | 'boolean';

export type SlotStatus = 'default' | 'editing' | 'error' | 'loading' | 'readonly';

export type ValidationKind = 'defined_list' | 'numeric';

export interface ValidationRule {
  id: string;
  kind: ValidationKind;
  definedList?: string[];
  numericOp?: '>=' | '>' | '<=' | '<' | '==' | '!=';
  numericValue?: number;
}

export interface Slot {
  id: string;
  name: string;
  type: SlotType;
  order: number;
  validations: ValidationRule[];
  status: SlotStatus;
  expanded: boolean;
}

export type AssistantStatus = 'idle' | 'thinking' | 'result' | 'error';

export interface PendingAssistantDiff {
  kind: 'slots_created' | 'slots_updated' | 'validations_updated';
  suggestedSlots: Slot[];
  message?: string;
}
