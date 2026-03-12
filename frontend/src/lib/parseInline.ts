import type { SlotType } from '../types';

export type ValidationType =
  | 'contains'
  | 'does_not_contain'
  | 'is_from_defined_list'
  | 'satisfies_numeric_condition'
  | 'satisfies_date_condition'
  | 'satisfies_boolean_condition'
  | 'is_not_empty';

/** Serialized length of a segment (for caret-offset / segment-boundary math). */
const VALIDATION_PHRASE: Record<ValidationType, string> = {
  contains: 'contains',
  does_not_contain: 'does not contain',
  is_from_defined_list: 'is from a defined list',
  satisfies_numeric_condition: 'satisfies a numeric condition',
  satisfies_date_condition: 'satisfies a date condition',
  satisfies_boolean_condition: '== true',
  is_not_empty: 'is not empty',
};

export function getSegmentSerializedLength(seg: InlineSegment): number {
  if (seg.type === 'text') return seg.value.length;
  if (seg.type === 'slot_ref') return 1 + seg.slotName.length;
  if (seg.type === 'value_ref') return 1 + seg.valueName.length;
  if (seg.type === 'validation') {
    if (seg.validationType === 'satisfies_boolean_condition') {
      const val = seg.value === true || seg.value === 'true' ? 'true' : 'false';
      return 3 + val.length; // "== " + val
    }
    return 1 + (VALIDATION_PHRASE[seg.validationType]?.length ?? 0);
  }
  return 0;
}

/** Start offset of each segment in serialized content order. */
export function getSegmentStarts(segments: InlineSegment[]): number[] {
  const starts: number[] = [];
  let pos = 0;
  for (const seg of segments) {
    starts.push(pos);
    pos += getSegmentSerializedLength(seg);
  }
  return starts;
}

/** Validation types after which @name defines a value (white chip), not a slot (green chip). */
export const VALUE_CONTEXT_VALIDATION_TYPES: ValidationType[] = [
  'contains',
  'does_not_contain',
  'is_from_defined_list',
];

export type InlineSegment =
  | { type: 'text'; id: string; value: string }
  | { type: 'slot_def'; id: string; slotName: string; slotType: SlotType }
  | { type: 'slot_ref'; id: string; slotName: string }
  | { type: 'value_ref'; id: string; valueName: string }
  | {
      type: 'validation';
      id: string;
      slotRef: string;
      validationType: ValidationType;
      operator?: string;
      value?: string[] | number | string | boolean;
    }
  | { type: 'condition'; id: string; slotRef: string; operator: string; value: string | number | boolean; action: string };

function genId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const SLOT_RE = /\b(slot|create\s+slot|define\s+slot|collect)\s+([a-z][a-z0-9_]*)\b/gi;
const AT_REF_RE = /@([a-z][a-z0-9_]*)(?=\s|,|\)|\])/g;
// Capturing middle so we can emit slot_ref + validation (keyword-only span) and preserve text between @slot and keyword
const MIDDLE_CAPTURE_SOURCE = '((?:(?!@[a-z])[\\s\\S])*?)';
const VALIDATION_LIST_RE = new RegExp(`\\b(?:validate\\s+)?@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}((?:is\\s+one\\s+of|in)\\s+\\[([^\\]]*)\\])`, 'gi');
const VALIDATION_NUM_RE = new RegExp(`\\b@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}(>=|<=|>|<|==|!=)\\s+(-?\\d+(?:\\.\\d+)?)\\b`, 'g');
const VALIDATION_REQUIRED_RE = new RegExp(`\\b@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}(is\\s+not\\s+empty)\\b`, 'gi');
const CONDITION_RE = /\bif\s+@?([a-z][a-z0-9_]*)\s+(=|==|!=|>=|<=|>|<|in|contains)\s+(.+?)\s+then\s+(respond|invoke_tool|update_slot|transfer|end)\s*(.*?)(?=\s|$|if\b)/gi;

// Five validation types (natural language); require explicit @ somewhere before keyword (not necessarily adjacent). Capture middle + keyword so we preserve text between @slot and keyword.
const VALIDATION_CONTAINS_RE = new RegExp(`(?:validate\\s+)?@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}(contains)\\b`, 'gi');
const VALIDATION_DOES_NOT_CONTAIN_RE = new RegExp(`(?:validate\\s+)?@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}(does(?:n't)?\\s+not\\s+contain)\\b`, 'gi');
const VALIDATION_DEFINED_LIST_RE = new RegExp(`(?:validate\\s+)?@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}((?:is\\s+from\\s+a\\s+defined\\s+list|from\\s+defined\\s+list|in\\s+list))\\b`, 'gi');
const VALIDATION_NUMERIC_COND_RE = new RegExp(`(?:validate\\s+)?@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}(satisfies\\s+a\\s+numeric\\s+condition)\\b`, 'gi');
const VALIDATION_DATE_COND_RE = new RegExp(`(?:validate\\s+)?@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}(satisfies\\s+a\\s+date\\s+condition)\\b`, 'gi');
const VALIDATION_BOOLEAN_RE = new RegExp(`\\b@([a-z][a-z0-9_]*)${MIDDLE_CAPTURE_SOURCE}(==)\\s+(true|false)\\b`, 'gi');

interface Match {
  start: number;
  end: number;
  segment: InlineSegment;
}

function parseList(str: string): string[] {
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function findAtRefs(text: string): Match[] {
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AT_REF_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'slot_ref',
        id: genId(),
        slotName: m[1].toLowerCase().replace(/\s+/g, '_'),
      },
    });
  }
  return matches;
}

function findSlots(text: string): Match[] {
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SLOT_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    if (text.slice(m.index + m[0].length, m.index + m[0].length + 10).match(/^\s*:/)) continue;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'slot_def',
        id: genId(),
        slotName: m[2].toLowerCase().replace(/\s+/g, '_'),
        slotType: 'string',
      },
    });
  }
  return matches;
}

function normSlot(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_');
}

function findValidations(text: string): Match[] {
  const matches: Match[] = [];
  let m: RegExpExecArray | null;

  const listRe = new RegExp(VALIDATION_LIST_RE.source, 'gi');
  while ((m = listRe.exec(text)) !== null) {
    const listStr = m[4] || ''; // group 1=slot, 2=middle, 3=keyword phrase, 4=list content
    const list = parseList(listStr);
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'is_from_defined_list',
        value: list,
      },
    });
  }
  const numRe = new RegExp(VALIDATION_NUM_RE.source, 'g');
  while ((m = numRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'satisfies_numeric_condition',
        operator: m[3], // group 2=middle, 3=op, 4=num
        value: Number(m[4]),
      },
    });
  }
  const reqRe = new RegExp(VALIDATION_REQUIRED_RE.source, 'gi');
  while ((m = reqRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'contains',
      },
    });
  }
  const containsRe = new RegExp(VALIDATION_CONTAINS_RE.source, 'gi');
  while ((m = containsRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'contains',
      },
    });
  }
  const doesNotRe = new RegExp(VALIDATION_DOES_NOT_CONTAIN_RE.source, 'gi');
  while ((m = doesNotRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'does_not_contain',
      },
    });
  }
  const definedListRe = new RegExp(VALIDATION_DEFINED_LIST_RE.source, 'gi');
  while ((m = definedListRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'is_from_defined_list',
      },
    });
  }
  const numericCondRe = new RegExp(VALIDATION_NUMERIC_COND_RE.source, 'gi');
  while ((m = numericCondRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'satisfies_numeric_condition',
      },
    });
  }
  const dateCondRe = new RegExp(VALIDATION_DATE_COND_RE.source, 'gi');
  while ((m = dateCondRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: normSlot(m[1]),
        validationType: 'satisfies_date_condition',
      },
    });
  }
  return matches;
}

function findConditions(text: string): Match[] {
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CONDITION_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    let value: string | number | boolean = m[3].trim();
    const num = Number(value);
    if (!Number.isNaN(num)) value = num;
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'condition',
        id: genId(),
        slotRef: m[1].toLowerCase().replace(/\s+/g, '_'),
        operator: m[2] === '=' ? '==' : m[2],
        value,
        action: `${m[4]} ${(m[5] || '').trim()}`.trim(),
      },
    });
  }
  return matches;
}

function mergeMatches(matches: Match[]): Match[] {
  return matches.sort((a, b) => a.start - b.start).filter((m, i, arr) => {
    for (let j = 0; j < i; j++) {
      const other = arr[j];
      if (m.start < other.end && m.end > other.start) return false;
    }
    return true;
  });
}

export function parseTextToSegments(text: string): InlineSegment[] {
  const allMatches: Match[] = [
    ...findValidations(text),
    ...findConditions(text),
    ...findSlots(text),
    ...findAtRefs(text),
  ];
  const merged = mergeMatches(allMatches);

  if (merged.length === 0) {
    return text ? [{ type: 'text', id: genId(), value: text }] : [];
  }

  const segments: InlineSegment[] = [];
  let lastEnd = 0;

  for (const match of merged) {
    if (match.start > lastEnd) {
      const textVal = text.slice(lastEnd, match.start);
      if (textVal) segments.push({ type: 'text', id: genId(), value: textVal });
    }
    segments.push(match.segment);
    lastEnd = match.end;
  }
  if (lastEnd < text.length) {
    const textVal = text.slice(lastEnd);
    if (textVal) segments.push({ type: 'text', id: genId(), value: textVal });
  }

  return segments;
}

/** Returns validation matches with stable ids for the editor. Emits slot_ref (span of @slotname) + validation (keyword-only span) so middle text is preserved. */
function findValidationMatchesForEditor(text: string): Match[] {
  const out: Match[] = [];
  const slotNameLen = (m: RegExpExecArray) => 1 + (m[1]?.length ?? 0);
  const middleLen = (m: RegExpExecArray) => (m[2]?.length ?? 0);
  const run = (re: RegExp, validationType: ValidationType) => {
    const r = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const slotEnd = m.index + slotNameLen(m);
      const keywordStart = slotEnd + middleLen(m);
      const slotName = normSlot(m[1]);
      out.push({
        start: m.index,
        end: slotEnd,
        segment: { type: 'slot_ref', id: `ref_${slotName}_${m.index}`, slotName },
      });
      out.push({
        start: keywordStart,
        end: m.index + m[0].length,
        segment: {
          type: 'validation',
          id: `val_${validationType}_${keywordStart}`,
          slotRef: slotName,
          validationType,
        },
      });
    }
  };
  let m: RegExpExecArray | null;
  const listRe = new RegExp(VALIDATION_LIST_RE.source, 'gi');
  while ((m = listRe.exec(text)) !== null) {
    const slotEnd = m.index + slotNameLen(m);
    const keywordStart = slotEnd + middleLen(m);
    const slotName = normSlot(m[1]);
    out.push({
      start: m.index,
      end: slotEnd,
      segment: { type: 'slot_ref', id: `ref_${slotName}_${m.index}`, slotName },
    });
    out.push({
      start: keywordStart,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: `val_is_from_defined_list_${keywordStart}`,
        slotRef: slotName,
        validationType: 'is_from_defined_list',
        value: parseList(m[4] || ''),
      },
    });
  }
  const numRe = new RegExp(VALIDATION_NUM_RE.source, 'g');
  while ((m = numRe.exec(text)) !== null) {
    const slotEnd = m.index + slotNameLen(m);
    const keywordStart = slotEnd + middleLen(m);
    const slotName = normSlot(m[1]);
    out.push({
      start: m.index,
      end: slotEnd,
      segment: { type: 'slot_ref', id: `ref_${slotName}_${m.index}`, slotName },
    });
    out.push({
      start: keywordStart,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: `val_satisfies_numeric_condition_${keywordStart}`,
        slotRef: slotName,
        validationType: 'satisfies_numeric_condition',
        operator: m[3],
        value: Number(m[4]),
      },
    });
  }
  const boolRe = new RegExp(VALIDATION_BOOLEAN_RE.source, 'gi');
  while ((m = boolRe.exec(text)) !== null) {
    const slotEnd = m.index + slotNameLen(m);
    const keywordStart = slotEnd + middleLen(m);
    const slotName = normSlot(m[1]);
    const boolVal = (m[4] ?? 'true').toLowerCase() === 'true';
    out.push({
      start: m.index,
      end: slotEnd,
      segment: { type: 'slot_ref', id: `ref_${slotName}_${m.index}`, slotName },
    });
    out.push({
      start: keywordStart,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: `val_satisfies_boolean_condition_${keywordStart}`,
        slotRef: slotName,
        validationType: 'satisfies_boolean_condition',
        operator: '==',
        value: boolVal,
      },
    });
  }
  run(VALIDATION_CONTAINS_RE, 'contains');
  run(VALIDATION_DOES_NOT_CONTAIN_RE, 'does_not_contain');
  run(VALIDATION_DEFINED_LIST_RE, 'is_from_defined_list');
  run(VALIDATION_NUMERIC_COND_RE, 'satisfies_numeric_condition');
  run(VALIDATION_DATE_COND_RE, 'satisfies_date_condition');
  run(VALIDATION_REQUIRED_RE, 'is_not_empty');
  return out;
}

/** Value regions: ranges after contains/does_not_contain/is_from_defined_list where @name = value ref (white chip). */
function getValueContextRanges(text: string, valMatches: Match[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (let i = 0; i < valMatches.length; i++) {
    const seg = valMatches[i].segment;
    if (seg.type !== 'validation' || !VALUE_CONTEXT_VALIDATION_TYPES.includes(seg.validationType))
      continue;
    const start = valMatches[i].end;
    const end = i + 1 < valMatches.length ? valMatches[i + 1].start : text.length;
    if (start < end) ranges.push([start, end]);
  }
  return ranges;
}

function isInValueContext(offset: number, ranges: [number, number][]): boolean {
  return ranges.some(([s, e]) => offset >= s && offset < e);
}

/** Find @word; in value context → value_ref, else → slot_ref. */
function findAtRefsWithValueContext(text: string, valueRanges: [number, number][]): Match[] {
  const matches: Match[] = [];
  const re = new RegExp(AT_REF_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = normSlot(m[1]!);
    const inValue = isInValueContext(m.index, valueRanges);
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: inValue
        ? { type: 'value_ref', id: `valref_${name}_${m.index}`, valueName: name }
        : { type: 'slot_ref', id: `ref_${name}_${m.index}`, slotName: name },
    });
  }
  return matches;
}

/** Only text + slot_ref + value_ref + validation segments. Value context: after contains/does_not_contain/is_from_defined_list, @name → value_ref (white chip). */
export function parseTextToSegmentsForEditor(text: string): InlineSegment[] {
  const valMatches = findValidationMatchesForEditor(text);
  const valueRanges = getValueContextRanges(text, valMatches);
  const atRefMatches = findAtRefsWithValueContext(text, valueRanges);
  const combined = [...valMatches, ...atRefMatches].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start)
  );
  const sorted = combined.filter((m, i, arr) => {
    for (let j = 0; j < i; j++) if (m.start < arr[j].end && m.end > arr[j].start) return false;
    return true;
  });
  if (sorted.length === 0) {
    return text ? [{ type: 'text', id: 'text_0', value: text }] : [];
  }
  const segments: InlineSegment[] = [];
  let lastEnd = 0;
  for (const match of sorted) {
    if (match.start > lastEnd) {
      const textVal = text.slice(lastEnd, match.start);
      if (textVal) segments.push({ type: 'text', id: `text_${lastEnd}`, value: textVal });
    }
    segments.push(match.segment);
    lastEnd = match.end;
  }
  if (lastEnd < text.length) {
    const textVal = text.slice(lastEnd);
    if (textVal) segments.push({ type: 'text', id: `text_${lastEnd}`, value: textVal });
  }
  return segments;
}

/** Slot names for sidebar/TOC; only slot_def and slot_ref. value_ref (values after contains etc.) must not appear. */
export function getSlotNamesFromSegments(segments: InlineSegment[]): string[] {
  const names = new Set<string>();
  for (const s of segments) {
    if (s.type === 'value_ref') continue;
    if (s.type === 'slot_def') names.add(s.slotName);
    if (s.type === 'slot_ref') names.add(s.slotName);
  }
  return [...names];
}

/** If content has a validation pattern but no newline before the validation keyword, return the index before which to insert \n so validation moves to the next line. */
export function getInsertNewlineBeforeValidationIndex(text: string): number | null {
  const slotNameLen = (m: RegExpExecArray) => 1 + (m[1]?.length ?? 0);
  const middleLen = (m: RegExpExecArray) => (m[2]?.length ?? 0);
  const slotStart = (m: RegExpExecArray) => m.index + slotNameLen(m);
  const keywordStart = (m: RegExpExecArray) => m.index + slotNameLen(m) + middleLen(m);
  const hasLineBreakBetweenSlotAndKeyword = (m: RegExpExecArray, start: number) =>
    text.slice(slotStart(m), start).includes('\n');
  const reList = [
    VALIDATION_CONTAINS_RE,
    VALIDATION_DOES_NOT_CONTAIN_RE,
    VALIDATION_DEFINED_LIST_RE,
    VALIDATION_NUMERIC_COND_RE,
    VALIDATION_DATE_COND_RE,
    VALIDATION_BOOLEAN_RE,
    VALIDATION_REQUIRED_RE,
  ];
  let earliest: number | null = null;
  for (const re of reList) {
    const r = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const start = keywordStart(m);
      if (hasLineBreakBetweenSlotAndKeyword(m, start)) continue;
      if (start > 0 && text[start - 1] !== '\n') {
        if (earliest == null || start < earliest) earliest = start;
      }
    }
  }
  // Also check LIST and NUM which have different group layout
  const listRe = new RegExp(VALIDATION_LIST_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = listRe.exec(text)) !== null) {
    const start = m.index + slotNameLen(m) + middleLen(m);
    if (hasLineBreakBetweenSlotAndKeyword(m, start)) continue;
    if (start > 0 && text[start - 1] !== '\n') {
      if (earliest == null || start < earliest) earliest = start;
    }
  }
  const numRe = new RegExp(VALIDATION_NUM_RE.source, 'g');
  while ((m = numRe.exec(text)) !== null) {
    const start = m.index + slotNameLen(m) + middleLen(m);
    if (hasLineBreakBetweenSlotAndKeyword(m, start)) continue;
    if (start > 0 && text[start - 1] !== '\n') {
      if (earliest == null || start < earliest) earliest = start;
    }
  }
  return earliest;
}
