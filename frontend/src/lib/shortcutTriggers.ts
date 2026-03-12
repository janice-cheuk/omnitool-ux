export type ShortcutTrigger = '/';

export interface ShortcutContext {
  slotId: string;
  editorId: string;
}

/**
 * Resolve the next shortcut trigger available for the current context.
 * Kept centralized so Insert click and keyboard share the same trigger source.
 */
export function getNextShortcutTrigger(_context: ShortcutContext): ShortcutTrigger {
  return '/';
}
