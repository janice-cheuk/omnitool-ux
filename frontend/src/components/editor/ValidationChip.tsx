import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ValidationType } from '../../lib/parseInline';
import styles from './ValidationChip.module.css';

const LABELS: Record<ValidationType, string> = {
  contains: 'contains',
  does_not_contain: 'does not contain',
  is_from_defined_list: 'is from a defined list',
  satisfies_numeric_condition: 'satisfies a numeric condition',
  satisfies_date_condition: 'satisfies a date condition',
  satisfies_boolean_condition: '== true',
  is_not_empty: 'is not empty',
};

function getValidationChipLabel(validationType: ValidationType, value?: unknown): string {
  if (validationType === 'satisfies_boolean_condition') {
    return value === true || value === 'true' ? '== true' : '== false';
  }
  return LABELS[validationType];
}

const PLACEHOLDER_CONTAINS = 'start typing @ to define a value name';
const PLACEHOLDER_NUMERIC =
  'start typing or insert using / to search for available operators or type =, !=, <, >, =>, <=';
const PLACEHOLDER_NUMERIC_VALUE = 'Enter a number e.g., 10';
const PLACEHOLDER_TOOL_MESSAGE = 'Enter tool message';
const PLACEHOLDER_MAX_ATTEMPTS = 'Enter the number of maximum attempts';
const PLACEHOLDER_DATE = 'MM/DD/YYYY';

const VALUE_REF_RE = /@([a-z][a-z0-9_]*)(?=\s|$)/g;

type ValueSegment = { type: 'text'; value: string } | { type: 'ref'; name: string };

function parseValueSegments(str: string): ValueSegment[] {
  if (!str.trim()) return [];
  const segments: ValueSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  VALUE_REF_RE.lastIndex = 0;
  while ((m = VALUE_REF_RE.exec(str)) !== null) {
    if (m.index > lastIndex) segments.push({ type: 'text', value: str.slice(lastIndex, m.index) });
    segments.push({ type: 'ref', name: m[1]! });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < str.length) segments.push({ type: 'text', value: str.slice(lastIndex) });
  return segments;
}

function serializeValueDom(container: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const ref = el.getAttribute('data-value-ref');
      if (ref) {
        out += '@' + ref;
        return;
      }
      if (el.getAttribute('data-value-placeholder-inline')) return;
    }
    node.childNodes.forEach(walk);
  };
  walk(container);
  return out;
}

interface ValueNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function ValueNameField({ value, onChange, placeholder }: ValueNameFieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  const segments = parseValueSegments(value);
  const isEmpty = !value.trim();

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const raw = serializeValueDom(el);
    if (raw !== value) onChange(raw);
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={styles.valueField}
      data-empty={isEmpty ? 'true' : 'false'}
      data-placeholder={placeholder}
      onInput={handleInput}
      role="textbox"
      aria-label="Value to match"
    >
      {segments.length === 0 ? <br /> : segments.map((seg, i) =>
        seg.type === 'text' ? (
          <span key={`t-${i}`}>{seg.value}</span>
        ) : (
          <span key={`r-${i}`} className={styles.valueChip} data-value-ref={seg.name} contentEditable={false}>
            {seg.name}
          </span>
        )
      )}
    </div>
  );
}

interface ValidationChipProps {
  slotRef: string;
  validationType: ValidationType;
  operator?: string;
  value?: string[] | number | string | boolean;
  dataSegmentId?: string;
  onChange?: (data: { operator?: string; value?: string[] | number | string | boolean }) => void;
}

export function ValidationChip({
  slotRef,
  validationType,
  operator,
  value,
  dataSegmentId,
  onChange,
}: ValidationChipProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);

  const [localValue, setLocalValue] = useState<string>(() =>
    Array.isArray(value) ? value.join(', ') : String(value ?? '')
  );
  const [compareExact, setCompareExact] = useState(true);
  const [compareCaseInsensitive, setCompareCaseInsensitive] = useState(false);
  const [compareNormalized, setCompareNormalized] = useState(false);
  const [toolMessage, setToolMessage] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [dateValue, setDateValue] = useState<string>(() => (typeof value === 'string' ? value : ''));
  const [localOperator, setLocalOperator] = useState<string>(() => operator ?? '');

  useEffect(() => {
    if (open) {
      setLocalValue(Array.isArray(value) ? value.join(', ') : String(value ?? ''));
      setDateValue(typeof value === 'string' ? value : '');
      setLocalOperator(operator ?? '');
    }
  }, [open, value, operator]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom + 4, left: rect.left });
    } else {
      setDropdownRect(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && buttonRef.current && !buttonRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const [booleanValue, setBooleanValue] = useState<boolean>(() => value === true || value === 'true');

  useEffect(() => {
    if (open) setBooleanValue(value === true || value === 'true');
  }, [open, value]);

  const handleApply = () => {
    if (validationType === 'is_from_defined_list') {
      onChange?.({ value: localValue ? localValue.split(',').map((s) => s.trim()).filter(Boolean) : undefined });
    } else if (validationType === 'satisfies_numeric_condition') {
      const num = Number(localValue);
      onChange?.({ operator: localOperator || '==', value: Number.isNaN(num) ? undefined : num });
    } else if (validationType === 'satisfies_date_condition') {
      onChange?.({ value: dateValue || undefined });
    } else if (validationType === 'satisfies_boolean_condition') {
      onChange?.({ value: booleanValue });
    } else {
      onChange?.({ value: localValue || undefined });
    }
    setOpen(false);
  };

  const label = getValidationChipLabel(validationType, value);

  const dropdownContent = open && dropdownRect && (
    <div
      ref={panelRef}
      className={styles.dropdown}
      style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, zIndex: 1000 }}
    >
          {validationType === 'is_not_empty' ? (
            <p className={styles.sectionTitle} style={{ fontWeight: 400, margin: 0 }}>
              Value must be present. No additional configuration.
            </p>
          ) : null}

          {validationType === 'contains' || validationType === 'does_not_contain' ? (
            <p className={styles.sectionTitle} style={{ fontWeight: 400, margin: 0 }}>
              Value is entered in the editor after this chip.
            </p>
          ) : null}

          {validationType === 'is_from_defined_list' ? (
            <>
              <div>
                <p className={styles.sectionTitle}>List values</p>
                <ValueNameField
                  value={localValue}
                  onChange={setLocalValue}
                  placeholder={PLACEHOLDER_CONTAINS}
                />
              </div>
              <div>
                <p className={styles.sectionTitle}>How should values be compared?</p>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={compareExact}
                    onChange={(e) => setCompareExact(e.target.checked)}
                  />
                  Exact match
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={compareCaseInsensitive}
                    onChange={(e) => setCompareCaseInsensitive(e.target.checked)}
                  />
                  Case-insensitive match
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={compareNormalized}
                    onChange={(e) => setCompareNormalized(e.target.checked)}
                  />
                  Normalized (trim, lowercase, etc.)
                </label>
              </div>
              <div>
                <p className={styles.sectionTitle}>Failure Behavior</p>
                <p className={styles.sectionTitle} style={{ fontWeight: 400, marginTop: 4 }}>If the value is invalid:</p>
                <p className={styles.sectionTitle} style={{ fontWeight: 400, fontSize: 11 }}>Trigger validation failure tool message</p>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={PLACEHOLDER_TOOL_MESSAGE}
                  value={toolMessage}
                  onChange={(e) => setToolMessage(e.target.value)}
                  aria-label="Tool message"
                />
              </div>
              <div>
                <p className={styles.sectionTitle}>Max attempts</p>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={PLACEHOLDER_MAX_ATTEMPTS}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  aria-label="Max attempts"
                />
              </div>
              <button type="button" className={styles.applyBtn} onClick={handleApply}>
                Apply
              </button>
            </>
          ) : null}

          {validationType === 'satisfies_numeric_condition' ? (
            <>
              <div>
                <p className={styles.sectionTitle}>Operator</p>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={PLACEHOLDER_NUMERIC}
                  value={localOperator}
                  onChange={(e) => setLocalOperator(e.target.value)}
                  aria-label="Operator"
                />
              </div>
              <div>
                <p className={styles.sectionTitle}>Value</p>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={PLACEHOLDER_NUMERIC_VALUE}
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  aria-label="Numeric value"
                />
              </div>
              <button type="button" className={styles.applyBtn} onClick={handleApply}>
                Apply
              </button>
            </>
          ) : null}

          {validationType === 'satisfies_date_condition' ? (
            <>
              <div>
                <p className={styles.sectionTitle}>Date</p>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  placeholder={PLACEHOLDER_DATE}
                  aria-label="Date value"
                />
              </div>
              <button type="button" className={styles.applyBtn} onClick={handleApply}>
                Apply
              </button>
            </>
          ) : null}

          {validationType === 'satisfies_boolean_condition' ? (
            <>
              <div>
                <p className={styles.sectionTitle}>Value must be</p>
                <select
                  className={styles.input}
                  value={booleanValue ? 'true' : 'false'}
                  onChange={(e) => setBooleanValue(e.target.value === 'true')}
                  aria-label="True or false"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
              <button type="button" className={styles.applyBtn} onClick={handleApply}>
                Apply
              </button>
            </>
          ) : null}
    </div>
  );

  return (
    <span className={styles.chipWrapper} data-segment-id={dataSegmentId}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.chip}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`@${slotRef} ${label}`}
      >
        <span className={styles.chipLabel}>{label}</span>
        <span className={styles.chipChevron} aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </span>
  );
}
