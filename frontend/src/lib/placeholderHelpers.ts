/**
 * Shared placeholder helpers for slot builder editors.
 * Ensures placeholders render in the correct input only (no dropdown leakage).
 */

/**
 * Treats contentEditable as empty when it has:
 * - no child nodes, or
 * - only whitespace/br/ZWSP, or
 * - only chip nodes (data-slot-ref, data-validation-type) and no visible text
 */
export function isContentEditableEmpty(el: HTMLElement | null): boolean {
  if (!el) return true;
  const text = getTextExcludingPlaceholdersAndChips(el);
  return !text || /^[\s\u200b]*$/.test(text);
}

/**
 * Returns raw text from element, excluding placeholder inline spans and chip content
 * (so we can treat "only chips" as empty-of-text for placeholder B).
 */
function getTextExcludingPlaceholdersAndChips(el: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent || '';
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const e = node as HTMLElement;
      if (e.getAttribute('data-placeholder-inline')) return;
      if (e.getAttribute('data-slot-ref') || e.getAttribute('data-validation-type')) return;
    }
    node.childNodes.forEach(walk);
  };
  walk(el);
  return out;
}

/**
 * True if the editor contains at least one chip (slot ref or validation).
 */
export function hasChips(el: HTMLElement | null): boolean {
  if (!el) return false;
  return (
    el.querySelector('[data-slot-ref]') != null ||
    el.querySelector('[data-validation-type]') != null
  );
}

export const PLACEHOLDER_A =
  'Start typing using @ to define a slot name. Make sure it is:\n• in snake_case\n• a unique name';
/** After user defines a slot; placeholder when editor is empty (Figma 842-6690). */
export const PLACEHOLDER_B = 'Start typing or insert using /';
/** After a contains/does_not_contain validation chip; value is entered in the editor (Figma 891-7288). */
export const PLACEHOLDER_AFTER_CONTAINS = 'start typing @ to define a value name';

/**
 * Compute which placeholder to show in the slot definition editor.
 * - No chips and empty => Placeholder A (initial).
 * - Has chips and empty-of-text => Placeholder B (next step).
 * - Otherwise => null (no placeholder).
 */
export function computePlaceholderForSlotEditor(
  segments: { type: string; value?: unknown }[],
  hasSlotsFromConfig: boolean
): string {
  const noSegments = segments.length === 0;
  const onlyChipsOrWhitespace =
    segments.length > 0 &&
    segments.every(
      (s) =>
        s.type === 'slot_ref' ||
        s.type === 'value_ref' ||
        s.type === 'validation' ||
        (s.type === 'text' && (!s.value || !String(s.value).trim()))
    );
  if (noSegments) return hasSlotsFromConfig ? PLACEHOLDER_B : PLACEHOLDER_A;
  if (onlyChipsOrWhitespace) return PLACEHOLDER_B;
  return PLACEHOLDER_A; // not shown when there's real text; caller hides placeholder
}

/**
 * Should the slot editor show the inline placeholder?
 * Show when: empty, or only chips/validations/whitespace.
 */
export function shouldShowSlotEditorPlaceholder(
  segments: { type: string; value?: unknown }[],
  _content: string
): boolean {
  if (segments.length === 0) return true;
  return segments.every(
    (s) =>
      s.type === 'slot_ref' ||
      s.type === 'value_ref' ||
      s.type === 'validation' ||
      (s.type === 'text' && (!s.value || !String(s.value).trim()))
  );
}

/** Placeholder when last segment is contains / does not contain / is from a defined list (value entered in editor). */
export function getPlaceholderAfterSegment(
  segments: { type: string; validationType?: string; value?: unknown }[]
): string | null {
  if (segments.length === 0) return null;
  let lastMeaningful: { type: string; validationType?: string; value?: unknown } | null = null;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg.type === 'text') {
      const text = String(seg.value ?? '');
      if (!text.trim()) continue;
    }
    lastMeaningful = seg;
    break;
  }
  if (!lastMeaningful) return null;
  if (
    lastMeaningful.type === 'validation' &&
    (lastMeaningful.validationType === 'contains' ||
      lastMeaningful.validationType === 'does_not_contain' ||
      lastMeaningful.validationType === 'is_from_defined_list')
  )
    return PLACEHOLDER_AFTER_CONTAINS;
  return null;
}
