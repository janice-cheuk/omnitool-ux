/**
 * Single source of truth for the slot authoring framework (Define → Validate → Condition).
 * Aligns menu, placeholders, and block labels with the Interaction Design.
 */

export const CONTROL_LABEL_DEFINE = 'Define';
export const CONTROL_LABEL_VALIDATE = 'Validate';
export const CONTROL_LABEL_CONDITION = 'Condition';

/** Control order for menu and autocomplete. */
export const CONTROL_ORDER = ['define', 'validate', 'condition'] as const;
export type ControlId = (typeof CONTROL_ORDER)[number];

export const CONTROL_LABELS: Record<ControlId, string> = {
  define: CONTROL_LABEL_DEFINE,
  validate: CONTROL_LABEL_VALIDATE,
  condition: CONTROL_LABEL_CONDITION,
};

export const SECTION_LABEL_CONTROLS = 'Controls';
export const SECTION_LABEL_SLOTS = 'Slots';

/** Line/block label for the validation line in the editor (noun form). */
export const VALIDATION_LINE_LABEL = 'Validation';

/** Condition action labels (after "then") for autocomplete. */
export const CONDITION_ACTION_LABELS: Record<string, string> = {
  respond: 'Respond to user',
  invoke_tool: 'Invoke tool',
  update_slot: 'Update slot',
  transfer: 'Transfer',
  end_conversation: 'End conversation',
};
