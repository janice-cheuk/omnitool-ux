import type { SlotType } from '../types';

export type InlineSegment =
  | { type: 'text'; id: string; value: string }
  | { type: 'slot_def'; id: string; slotName: string; slotType: SlotType }
  | { type: 'validation'; id: string; slotRef: string; intent: 'in_list' | 'numeric' | 'required'; value?: string[] | number; operator?: string }
  | { type: 'condition'; id: string; slotRef: string; operator: string; value: string | number | boolean; action: string };

function genId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Patterns that match within text (with word boundaries)
const SLOT_RE = /\b(slot|create\s+slot|define\s+slot|collect)\s+([a-z][a-z0-9_]*)\b/gi;
const VALIDATION_LIST_RE = /\b(validate\s+)?@?([a-z][a-z0-9_]*)\s+(?:is\s+one\s+of|in)\s+\[([^\]]*)\]/gi;
const VALIDATION_NUM_RE = /\b@?([a-z][a-z0-9_]*)\s+(>=|<=|>|<|==|!=)\s+(-?\d+(?:\.\d+)?)\b/g;
const VALIDATION_REQUIRED_RE = /\b@?([a-z][a-z0-9_]*)\s+is\s+not\s+empty\b/gi;
const CONDITION_RE = /\bif\s+@?([a-z][a-z0-9_]*)\s+(=|==|!=|>=|<=|>|<|in|contains)\s+(.+?)\s+then\s+(respond|invoke_tool|update_slot|transfer|end)\s*(.*?)(?=\s|$|if\b)/gi;

function parseList(str: string): string[] {
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

interface Match {
  start: number;
  end: number;
  segment: InlineSegment;
}

function findSlots(text: string): Match[] {
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SLOT_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    // Skip if it's part of slot name: type (e.g. "slot x : string")
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

function findValidations(text: string): Match[] {
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VALIDATION_LIST_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    const listStr = m[3] || '';
    const list = parseList(listStr);
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: {
        type: 'validation',
        id: genId(),
        slotRef: m[2].toLowerCase().replace(/\s+/g, '_'),
        intent: 'in_list',
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
        slotRef: m[1].toLowerCase().replace(/\s+/g, '_'),
        intent: 'numeric',
        operator: m[2],
        value: Number(m[3]),
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
        slotRef: m[1].toLowerCase().replace(/\s+/g, '_'),
        intent: 'required',
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

export function getSlotNamesFromSegments(segments: InlineSegment[]): string[] {
  const names = new Set<string>();
  for (const s of segments) {
    if (s.type === 'slot_def') names.add(s.slotName);
  }
  return [...names];
}
