# Implementation-Ready Frontend Spec: Notion/Coda-Style Slot Editor

A block-based document editor for slot authoring. The primary surface is free-text; the system auto-detects structure (slots, validations, conditions) from what the user types and transforms text into structured blocks in-place. Reads like a Notion/Coda editor spec—document-first, not form-first.

---

## 1. Core Interaction Model (Notion/Coda-Like)

### Authoring Mechanics

- **Main canvas**: A free-text editor where the user types natural language. No forms or modals for basic authoring.
- **Auto-detection**: As the user types, the system detects intents (Define Slot, Add Validation, Add Condition) and transforms the text into structured chips/blocks in-place.
- **Non-blocking**: The user can always continue typing; transforms are non-blocking and reversible.
- **Suggestive, not destructive**: At medium confidence, show a subtle pill suggestion (e.g. "Convert to Slot"); auto-convert only at high confidence or when user confirms via Tab/Enter.

### Notion-Style Patterns

| Pattern | Behavior |
|---------|----------|
| **`/`** | Opens command menu (block types, insert slot ref, add validation, add condition). |
| **`@`** | Opens slot picker; inserts inline slot reference chip. |
| **Inline chips** | Structured objects (slot refs, operators, values) render as tappable chips within blocks. |
| **Blocks** | Each block is selectable, draggable, deletable, and convertible between types. |
| **Hover handles** | `⋮⋮` (six-dot handle) appears on left of block on hover; enables drag, delete, convert. |

### Deterministic Guarantees

- **One action per turn**: Conditions evaluate slots and result in exactly one action per turn.
- **Conflict detection**: The system warns on ambiguous or conflicting rules (e.g. overlapping conditions, no default) rather than silently accepting them.
- **Validation before run**: Invalid blocks show inline warnings; Save/Accept blocked only when critical (duplicate slot, missing config for referenced slot).

---

## 2. Layout + Panels

### Three-Column Layout (Editor-First)

```
┌─────────┬──────────────────────────────────────────────────┬────────────────┐
│  Left   │              Main Canvas                         │  Right Panel  │
│  Nav    │  Header + Tool Context                           │  Assistant    │
│  Rail   │  ─────────────────────────────────────────────  │  ────────────  │
│         │  ┌──────────┬────────────────────────────────┐  │  User prompt  │
│  [icon] │  │  Slots   │  Notion-like doc                │  │  Thought Xs   │
│  [icon] │  │  (TOC)   │  Title / description            │  │  Proposed diff│
│  [icon] │  │          │  ⋮⋮ Block 1 (paragraph)        │  │  [Accept]     │
│         │  │  • slot1 │  ⋮⋮ Block 2 (slot)              │  │  [Decline]    │
│         │  │  • slot2 │  ⋮⋮ Block 3 (validation)        │  │  Composer     │
│         │  │          │  ...                            │  │  [Send]       │
│         │  └──────────┴────────────────────────────────┘  │  ────────────  │
└─────────┴──────────────────────────────────────────────────┴────────────────┘
```

### Left Nav Rail (Icon-Only)

- Icon-only nav rail; tooltips on hover.
- Active section: background or left border highlight.
- Keyboard: Tab through icons; Enter/Space activates; arrow keys move focus. `role="navigation"`, `aria-label` per section.

### Main Canvas

| Area | Purpose |
|------|---------|
| **Header** | AI agent title (editable), Global/subAgents tabs, Save + Last saved. |
| **Tool context** | "Omni Tool" + editable tool name (e.g. `record_information`). |
| **Primary actions** | "Omni Tool Assistant", "Advanced mode", "Slot Filling Engine" buttons. |
| **Slots panel** | Live index derived from Slot Definition blocks (see §7). |
| **Main doc area** | Title/description at top; below, a sequence of blocks (paragraph, slot, validation, condition). |

### Right Assistant Panel

- **User prompt bubble** — gray; user's request at top.
- **"Thought for Xs"** — timing line (system status).
- **Proposed diff** — Assistant outputs suggested blocks; UI shows "Slots created…" summary pills and "Review changes" state.
- **Accept/Decline** — Accept applies blocks at insertion point; Decline discards. Optional: "Apply one" per suggested slot.
- **Composer** — Multiline input; "Start building omni tool with custom instructions" placeholder; Send; Cmd+Enter to send.

---

## 3. Block System: Types + Rendering

### A) Free Text Paragraph Block

- **Default block** on Enter.
- Supports inline `@slot_name` mentions (render as chips).
- Typing `/` opens command menu; selection inserts block template at cursor.
- **Rendering**: Plain text; inline chips for slot refs.

### B) Slot Definition Block

**Auto-created when user types patterns like:**

- `slot user_intent`
- `create slot age`
- `define slot is_residential_service`
- `collect user_intent`

**Patterns:**

```ts
const SLOT_PATTERNS = [
  /^\s*(?:slot|create\s+slot|define\s+slot|collect)\s+([a-z][a-z0-9_]*)\s*$/i,
  /^\s*slot\s+([a-z][a-z0-9_]*)\s*:\s*(string|int|float|enum|boolean)\s*$/i,
];
```

**Rendering:**

- **Slot pill** (label) + **slot name chip** (editable) + optional **type chip** (e.g. `string`, `int`).
- Inline edit on slot name; rename updates all references across the document.
- Click type chip to change type (string, int, float, enum, boolean).

**Block structure:**

```ts
interface SlotDefinitionBlock {
  id: string;
  type: 'slot_definition';
  slotName: string;
  slotType: 'string' | 'int' | 'float' | 'enum' | 'boolean';
  enumValues?: string[];
  missingSlotConfig?: { toolMessage: string; configured: boolean };
}
```

### C) Validation Block

**Auto-created when user types:**

- `validate user_intent is one of [new_service, transfer, stop]`
- `age must be >= 0`
- `user_intent in [a,b,c]`
- `user_intent is not empty`

**Patterns:**

```ts
const VALIDATION_PATTERNS = [
  /^\s*validate\s+@?([a-z][a-z0-9_]*)\s+is\s+one\s+of\s+\[([^\]]+)\]\s*$/i,
  /^\s*@?([a-z][a-z0-9_]*)\s+must\s+be\s+(>=|<=|>|<|==|!=)\s+(\d+(?:\.\d+)?)\s*$/i,
  /^\s*@?([a-z][a-z0-9_]*)\s+in\s+\[([^\]]+)\]\s*$/i,
  /^\s*@?([a-z][a-z0-9_]*)\s+is\s+not\s+empty\s*$/i,
  /^\s*@?([a-z][a-z0-9_]*)\s+(>=|<=|>|<|==|!=)\s+(\d+(?:\.\d+)?)\s*$/,
];
```

**Rendering:**

- **Validation pill** (label) + **target slot chip** + **operator chip** + **value UI**:
  - **Lists**: Inline list tokens `[a, b, c]` (editable; add/remove items inline).
  - **Numeric**: Inline numeric token (e.g. `0`, `18`).

**Block structure:**

```ts
interface ValidationBlock {
  id: string;
  type: 'validation';
  slotRef: string;
  intent: 'in_list' | 'numeric' | 'required' | 'match' | 'contains';
  operator?: string;
  value?: string | number | string[];
}
```

### D) Condition Block

**Auto-created when user types:**

- `if user_intent = new_service then respond "Hello"`
- `if @age >= 18 then invoke_tool verify_age`

**Patterns:**

```ts
const CONDITION_PATTERNS = [
  /^\s*if\s+@?([a-z][a-z0-9_]*)\s+(=|==|!=|>=|<=|>|<|in|contains)\s+(.+?)\s+then\s+(respond|invoke_tool|update_slot|transfer|end)\s*(.*)$/i,
];
```

**Rendering:**

- **IF chip** + **expression chips** (slot ref, operator, value) + **THEN** + **action chip** (respond, invoke_tool, etc.).
- Click any chip to edit inline.

**Actions (one per condition):**

- `respond "message"`
- `invoke_tool tool_name`
- `update_slot slot_name value`
- `transfer target_flow`
- `end`

---

## 4. Auto-Detect + Transform Rules (Key Notion Mechanic)

### When Auto-Detect Runs

- **Triggers**: On space, comma, Enter, and short debounce (300–500ms after last keystroke).
- **Scope**: Current block text only.

### Confidence-Based Behavior

| Confidence | Behavior |
|------------|----------|
| **High** | Auto-convert to structured block immediately. Creates undo step. |
| **Medium** | Show subtle **pill suggestion** (e.g. "Convert to Slot" or "Convert to Validation") inline. User confirms via **Tab** or **Enter** to apply. |
| **Low** | No suggestion; leave as text. |

### Validation on Transform

- **If transform fails validation** (e.g. invalid operator, empty list): Keep as text; show **soft warning suggestion** inline (e.g. "List cannot be empty"). Do not block typing.
- **Undo**: Every transform creates an undo step; Cmd+Z reverts to raw text.

### Parsing Pipeline

```ts
interface ParseResult {
  confidence: 'high' | 'medium' | 'low';
  block?: Block;
  suggestion?: string;  // e.g. "Convert to Slot"
  warning?: string;    // e.g. "List cannot be empty"
}

function parseBlockText(text: string, existingSlots: string[]): ParseResult | null;
```

1. Run pattern matchers in order (slot → validation → condition).
2. If match: validate extracted data (slot exists for validation/condition, operator valid, etc.).
3. Return `{ confidence, block }` or `{ confidence, suggestion }` or `{ warning }`.

---

## 5. Slash Command Menu (Notion-Style)

### Top-Level Items

| Item | Action |
|------|--------|
| **Define slot** | Inserts Slot Definition block template: `slot ` (cursor after space). |
| **Add validation** | Inserts Validation block template: `validate ` (cursor after space). |
| **Add condition** | Inserts Condition block template: `if  then ` (cursor in slot position). |
| **Insert slot reference** | Opens slot picker; inserts `@slot_name` at cursor. |
| **Insert example JSON** | Inserts a paragraph block with example JSON structure (if relevant). |
| **---** | Divider |
| **Advanced mode** | Toggle; shows/hides advanced block options. |
| **Slot filling engine settings** | Opens drawer with engine config. |

### Context-Aware Ordering

- **If cursor is inside a Slot Definition block**: Show slot-relevant commands first (Add validation for @slot_name, Add condition for @slot_name).
- **If cursor is in paragraph**: Show Define slot, Add validation, Add condition first.

### Behavior

- **Selecting an item**: Inserts a block template at cursor (or converts current block if empty).
- **Keyboard**: Arrow keys navigate; Enter selects; Escape closes.

---

## 6. Slot References (@) and Inline Chips

### @ Mention System

- **Trigger**: Typing `@` anywhere in text.
- **Behavior**: Opens search list of existing slots (from Slot Definition blocks).
- **Filter**: User can type to filter (e.g. `@user` → matches `user_intent`).
- **Selection**: Inserts inline slot chip `@slot_name`.

### Chip Hover (Slot Reference)

On hover, chip shows tooltip:

- **Slot type** (string, int, etc.)
- **Validations summary** (e.g. "in [new, transfer]")
- **Where used** (list of block IDs or "Used in 3 places")

### Rename Propagation

- Renaming a slot (in Slot Definition block) updates:
  - All `@slot_name` chips in the document
  - Slot list (TOC) entry
  - Validation and Condition blocks that reference the slot

---

## 7. Left "Slots" Panel as Live Index

### Source

- **Derived from document blocks**: Automatically lists slots in order of **first appearance** in the document.
- Not a separate data model—computed from Slot Definition blocks.

### Status Dot Meanings

| Dot | Meaning |
|-----|---------|
| **Green** | Valid + referenced (used in at least one validation or condition). |
| **Yellow** | Missing validation, or unused (defined but not referenced). |
| **Red** | Invalid / duplicate / conflict (e.g. duplicate slot name, validation error). |

### Interaction

- **Clicking** a slot: Scrolls the canvas to that Slot Definition block and focuses it.
- **Empty state**: "No slots yet. Type 'slot name' or use / to add." + CTA to focus doc.

---

## 8. Assistant Suggestions as Diffs (Notion AI-Like)

### Right Panel Behavior

- Assistant generates a set of **proposed blocks** (Slot + Validation).
- **UI shows**:
  - "Slots created…" summary pills (slot names)
  - "Review changes" state
  - Optional: checkboxes per suggested block for selective apply

### Accept

- **Applies** the blocks into the canvas at a defined insertion point:
  - **Default**: After description block (or after first paragraph).
  - **Alternative**: At cursor position if cursor is in doc.
- **Clears** pending diff.

### Decline

- **Discards** proposals; restores prior document state.

### Advanced: Apply One

- If feasible: Allow "Apply one" per suggested slot—user can selectively accept individual blocks from the diff.

---

## 9. Bottom Review Bar (Accept / Decline)

### When It Appears

- **Only when there's a pending AI diff.** No bar when no pending diff.

### Actions

| Action | Effect |
|--------|--------|
| **Accept** | Commits the diff into the document; clears pending state. |
| **Decline** | Removes pending diff; restores prior document. |

### Merge Strategy (User Edits While Diff Pending)

- **Simple**: Apply diff at cursor (or at default insertion point). If user has edited the doc since the diff was generated:
  - **No conflict**: Insert blocks at insertion point.
  - **Conflict** (e.g. user deleted a block the diff modifies): Show **warning** ("Document changed. Accept may overwrite recent edits."); user can still Accept or Decline.
- **Conflicts produce warnings**; do not silently overwrite without user awareness.

---

## 10. States, Errors, and Soft Warnings (Coda-Like)

### Lightweight, Non-Blocking Validation UX

- **Errors do not stop typing.** User can always continue editing.
- **Save/Accept blocked** only when critical (duplicate slot, missing config for referenced slot).

### Inline Warnings (Small Yellow Callouts)

| Warning | When |
|---------|------|
| **Duplicate slot name** | Two Slot Definition blocks share the same name. |
| **Two rules matching same request** | Overlapping conditions (e.g. both could match). |
| **Validation impossible** | List empty, invalid operator for type, etc. |
| **Unused slot** | Slot defined but not referenced. |
| **Missing slot config** | Slot referenced in condition but missing-slot tool message not configured. |

### Presentation

- **Small yellow callout** near the affected block (or chip).
- **Icon**: Warning icon (e.g. ⚠) + short message.
- **Click**: Optional—expand to show details or link to fix.

---

## 11. Component + State Architecture (React + TS)

### Block Renderer Architecture

```ts
// Block registry: type → renderer
const BLOCK_RENDERERS: Record<Block['type'], React.ComponentType<BlockProps>> = {
  paragraph: ParagraphBlockRenderer,
  slot_definition: SlotDefinitionBlockRenderer,
  validation: ValidationBlockRenderer,
  condition: ConditionBlockRenderer,
};

// Block component resolves renderer by type
function Block({ block, ...props }: BlockProps) {
  const Renderer = BLOCK_RENDERERS[block.type];
  return <Renderer block={block} {...props} />;
}
```

### Document Model

```ts
interface Document {
  id: string;
  title: string;
  description: string;
  blocks: Block[];
}

type Block =
  | ParagraphBlock
  | SlotDefinitionBlock
  | ValidationBlock
  | ConditionBlock;

interface BaseBlock {
  id: string;
  type: string;
}

interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: string;  // rich text or plain; may contain inline mentions
}

interface SlotDefinitionBlock extends BaseBlock {
  type: 'slot_definition';
  slotName: string;
  slotType: SlotType;
  enumValues?: string[];
  missingSlotConfig?: { toolMessage: string; configured: boolean };
}

interface ValidationBlock extends BaseBlock {
  type: 'validation';
  slotRef: string;
  intent: ValidationIntent;
  operator?: string;
  value?: string | number | string[];
}

interface ConditionBlock extends BaseBlock {
  type: 'condition';
  slotRef: string;
  operator: string;
  value: string | number | boolean;
  action: ConditionAction;
}
```

### Parsing Layer (Auto-Detect Plugin Pipeline)

```ts
interface ParsePlugin {
  name: string;
  match(text: string, context: ParseContext): ParseResult | null;
}

const parsePipeline: ParsePlugin[] = [
  slotDefinitionPlugin,
  validationPlugin,
  conditionPlugin,
];

function runParsePipeline(text: string, context: ParseContext): ParseResult | null {
  for (const plugin of parsePipeline) {
    const result = plugin.match(text, context);
    if (result) return result;
  }
  return null;
}
```

### Diff Layer (Assistant Proposals)

```ts
interface PendingDiff {
  id: string;
  blocksToAdd: Block[];
  blocksToModify?: { blockId: string; patch: Partial<Block> }[];
  blocksToRemove?: string[];
  insertionPoint: { afterBlockId: string } | { atCursor: true };
}

function applyDiff(document: Document, diff: PendingDiff): Document;
function mergeDiffWithEdits(document: Document, diff: PendingDiff): { document: Document; conflicts: string[] };
```

### Events

| Event | When | Payload |
|-------|------|---------|
| **onTextChange** | User types in paragraph block | `{ blockId, text }` |
| **onBlockTransform** | Text converted to structured block | `{ blockId, from: 'paragraph', to: Block }` |
| **onSlashCommand** | User selects from `/` menu | `{ command, blockId, cursorPosition }` |
| **onMentionInsert** | User selects slot from `@` picker | `{ slotName, blockId, position }` |
| **onAcceptDiff** | User clicks Accept on review bar | `{ diffId }` |
| **onDeclineDiff** | User clicks Decline | `{ diffId }` |
| **onBlockReorder** | User drags block | `{ blockId, fromIndex, toIndex }` |
| **onBlockConvert** | User converts block via handle | `{ blockId, fromType, toType }` |

### API Contracts

| Method | Purpose |
|--------|---------|
| **GET /api/tools/:toolId/draft** | Load draft document. Returns `{ document: Document }`. |
| **PATCH /api/tools/:toolId/draft** | Save document. Body: `{ document: Document }`. |
| **POST /api/tools/:toolId/assistant/suggest** | Request assistant suggestions. Body: `{ prompt: string, document: Document }`. Returns `{ suggestedDiff: PendingDiff, thoughtDurationMs?: number }`. |

### Response Shape (Assistant Suggest)

```ts
interface AssistantSuggestResponse {
  suggestedDiff: {
    blocksToAdd: Block[];
    insertionPoint: { afterBlockId: string } | { atCursor: true };
  };
  thoughtDurationMs?: number;
  message?: string;  // e.g. "Slots created. Here's what is added."
}
```

---

## Implementation Checklist

- [ ] Block editor (Slate, Lexical, or contenteditable with block model)
- [ ] Block registry + renderers for paragraph, slot, validation, condition
- [ ] Parse plugin pipeline (slot, validation, condition patterns)
- [ ] Confidence-based transform (high = auto, medium = pill suggestion, Tab/Enter to confirm)
- [ ] Undo stack (transform = one undo step)
- [ ] Block handle (⋮⋮) with drag, delete, convert
- [ ] Slash command menu (`/`) with context-aware ordering
- [ ] Slot picker (`@`) with search/filter
- [ ] Inline chip rendering; hover tooltip for slot refs
- [ ] Slots TOC derived from blocks; status dots (green/yellow/red)
- [ ] Rename propagation (slot name → all refs)
- [ ] Diff layer for assistant; apply at insertion point
- [ ] Bottom review bar; merge strategy when user edits during pending diff
- [ ] Inline soft warnings (yellow callouts); non-blocking
- [ ] API: load draft, save draft, assistant suggest
