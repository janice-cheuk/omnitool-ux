# Frontend Design Spec: Slot Authoring Page (Omni Tool)

Spec for the slot authoring / slot-filling engine config UI for an Omni Tool. Layout and components align with the design (Figma: Omni-Tool, node 1070-7104); details below are from the written layout summary. Assumes **React + TypeScript**. Aligned with deterministic slot-based authoring and “one action per turn” guardrails. No UI implementation in this repo until explicitly requested.

---

## 1. Page purpose + users

### What this page is for

- **Slot authoring** and **slot-filling engine configuration** for an Omni Tool.
- Users define slots, validations, and conditional logic in a single place; the editor output drives the backend slot-filling engine (e.g. `omnitools.slot_filling_engine`).

### Primary user personas

| Persona | Role |
|--------|------|
| **Conversation Designer** | Defines slots, validations, and conditions; uses AI-assisted suggestions to speed up authoring. |
| **FDE (Frontend / flow developer)** | Configures tool names, advanced mode, and integration with routing/VA. |
| **QA** | Reviews flows, validates deterministic behavior, tests edge cases. |

### Job to be done

- **Define slots and validations deterministically** (Define → Validate → Condition lifecycle).
- **Review AI-assisted suggestions** in the right panel and accept or decline changes.
- **Accept/decline changes** via a sticky review bar when the assistant proposes slot/validation edits.

---

## 2. Layout + information architecture

### Three-column layout

| Column | Role | Behavior |
|--------|------|----------|
| **Left sidebar** | Global nav | Icon-only nav rail; active section highlighted; keyboard-accessible. |
| **Main content** | Editor | Header, tool context, primary actions, Slots panel + slot cards. |
| **Right panel** | Assistant / activity log | User prompt, “Thought for Xs”, result state, review copy, composer. |

### Left sidebar (global nav)

- **Icon-only nav rail** (no labels by default; tooltips on hover).
- **Active section** has a clear highlight (e.g. background or left border).
- **Keyboard**: Tab through icons; Enter/Space activates; arrow keys move focus between icons. Landmark role `navigation`, `aria-label` per section.

### Main content column (editor)

- **Header**
  - “AI agent title” + **editable name** (pencil icon to edit).
  - Top controls: **“Global”**, **“subAgents”** (tabs or pills).
- **Tool context**
  - Label: “Omni Tool” + **editable tool name** (e.g. `record_information`).
- **Primary actions row** (buttons)
  - “Omni Tool Assistant”
  - “Advanced mode”
  - “Slot Filling Engine”
- **Slots section**
  - **Left**: “Slots” panel — list of slots with **order numbers** and **status dot** per slot.
  - **Main**: Slot cards — **Slot 1**, **Slot 2**, etc., each a **collapsible card**.

### Right panel (assistant / activity log)

- **Top**: User’s prompt/request in a **gray bubble**.
- **“Thought for Xs”** — timing line (system status).
- **Result state**: Success check + “Slots created. Here’s what is added” with created slot names.
- **Review instruction** paragraph (e.g. “Review the suggested slots below…”).
- **Bottom**: **Input composer** — “Start building omni tool with custom instructions” placeholder + **Send** button.

---

## 3. Slot list component (left panel)

### Anatomy (per slot list item)

- **Index badge** — numeric order (1, 2, 3…).
- **Slot name** — snake_case, matches slot card title.
- **Status indicator** — **green dot** when configured/valid; other states per §4 (error = red, loading = spinner, etc.).
- **Hover**: Distinct hover state (e.g. background, cursor pointer).

### Interaction

- **Selecting a slot** scrolls and/or focuses the **corresponding slot card** in the main editor (scroll-into-view + focus management).
- **Reordering**: Not supported in MVP; list order is read-only from slot definition order. State explicitly in UI (e.g. “Order is defined by slot sequence” in empty state or help).
- **Empty state**: When no slots exist, show message (e.g. “No slots yet. Add a slot or ask the assistant to create slots.”) and primary CTA (e.g. “Add slot” or “Ask assistant”).

---

## 4. Slot card component (main editor)

Each slot is one **collapsible card**. One card = one slot in the Define → Validate → Condition model.

### Card header

- **“Slot {n}” pill** (e.g. “Slot 1”) + **slot name** (e.g. `user_intent`).
- **Edit icon** next to name: **rename inline** (click name or icon to edit in place; no modal). On blur or Enter, commit; Escape cancels.
- **Collapse/expand caret** for non-active slot; active slot can default to expanded.

### Card body

- **Define row**
  - “Define” **chip** (label).
  - **Dropdown/pill** with slot name and **type selector** (e.g. string, int, float, enum, boolean). Selecting type may show schema options (e.g. enum values).
- **Validation row**
  - “Validation” **chip**.
  - **Rule UI** — two display modes:
    1. **“is from a defined list”** — bullet list of allowed values (editable; add/remove items).
    2. **Numeric constraint** — inline (e.g. “>= 0”); operator + value.
- **Editor affordance**
  - Line of text: “Start typing or insert using /”.
- **Slash menu**
  - **Trigger**: Typing `/` opens menu.
  - **Contents**: Add condition, add validation, insert slot reference (@slot_name), and other lifecycle actions. Selection inserts at cursor or creates block.

### Per-slot states

| State | When | Visual / behavior |
|-------|------|-------------------|
| **Default** | Slot configured, no error | Normal card; green status in list. |
| **Editing** | User is inline-editing name or validation | Focus ring; unsaved indicator if needed. |
| **Error** | Invalid validation, duplicate slot name, or other rule error | **Red border** on card; inline error text; status dot red in list. |
| **Loading** | Assistant is generating/changing this slot | Spinner or skeleton in card; status dot loading in list. |
| **Read-only** | User lacks permission | Disabled controls; no edit icon; aria-disabled. |

---

## 5. AI-assisted changes + review workflow

### Review bar (bottom of main content)

- **Sticky action bar** when there are **pending assistant-proposed diffs**.
- **Primary**: **“Accept”** button.
- **Secondary**: **“Decline”** button.
- **Keyboard shortcuts** shown next to buttons (e.g. “Accept (⌘↵)”, “Decline (Esc)”).

### Accept

- **Commits** assistant-proposed slot/validation changes to the **saved draft**.
- Pending diff is cleared; UI updates to show new slot list and cards; right panel can show a brief “Changes applied” confirmation.

### Decline

- **Reverts** proposed changes; restores **user’s previous state** (before the assistant suggestion).
- If declining would lose **manual edits** made after the suggestion, show a **confirmation** (e.g. “Decline will discard the assistant’s suggestion. Your recent edits will be kept.” or “Discard suggestion and your edits?” depending on product rule).

### When the bar appears

- **Only when there are pending assistant-suggested diffs** (e.g. “Slots created” or “Slots updated” with uncommitted changes). No bar when there are no pending diffs.

---

## 6. Right panel assistant behavior

### Message types

- **User prompt bubble** — gray; user’s request at top.
- **System “thought” line** — e.g. “Thought for 3s” (timing).
- **Success summary card** — “Slots created. Here’s what is added” with success check icon.
- **Instruction text** — review instruction paragraph (e.g. “Review the suggested slots below and accept to add them to your flow.”).

### “Slots created” summary

- Lists **created slot names as pills** (e.g. `user_intent`, `is_residential_service`).
- **Clicking a pill** **navigates to that slot card** in the main editor (scroll + focus).

### Composer

- **Multiline** input; Enter adds new line (do not send).
- **Send**: Dedicated Send button (or e.g. Cmd+Enter to send).
- **Placeholder**: “Start building omni tool with custom instructions”.
- **Disabled state**: When request is in flight or when panel is read-only; show loading or disabled Send.

---

## 7. Validation interaction rules (MVP)

### Defined list validation

- **Add/remove values**: Add button adds new list item; each item has remove control.
- **Input format**: Trimmed; no empty duplicates.
- **De-dupe**: On blur or submit, remove duplicates; optional inline hint “Duplicate removed”.
- **Ordering**: List order is significant if runtime uses order; allow reorder (e.g. drag-handle) or state “order not used in MVP”.

### Numeric validation

- **Operator dropdown**: `>=`, `>`, `<=`, `<`, `==`, `!=`.
- **Numeric input**: Single numeric field; **prevent non-numeric** (block or strip non-digits and one optional decimal/minus).
- **Errors**: Invalid number or empty when required → inline error + red border.

### Validation errors (global)

- **Inline error text** under the invalid field + **red border** on the slot card.
- **Do not block typing**; user can correct without dismissing.
- **Block Save/Accept** when any validation is invalid (Save disabled; Accept disabled while invalid).

---

## 8. Save + draft behavior

### Top right (from spec)

- **“Last saved: …”** — timestamp of last successful save.
- **“Save”** button with **dropdown caret** (e.g. “Save” vs “Save and publish” or “Save draft”).

### Save behavior

- **Recommendation**: **Autosave** for draft (debounced, e.g. on blur or after idle) **plus** explicit **“Save”** for user-confirmed persist. If product chooses manual-only, state “Manual save only; no autosave.”
- **Save disabled** when: no changes since last save; or **invalid state** (validation errors, duplicate slot name, etc.).
- **Versioning**: **Draft** = working copy; **Published** = last published version (if applicable). “Save” writes draft; optional “Publish” or “Save and publish” from dropdown.

---

## 9. Accessibility + responsiveness

### Focus order

- **Across columns**: Left nav → Main (header → tool context → actions → slot list → slot cards) → Right panel (prompt → summary → composer). Tab order follows visual order; no focus traps.

### ARIA

- **Icon buttons**: `aria-label` (e.g. “Edit slot name”, “Collapse slot”, “Add validation”).
- **Slot list**: `role="list"`; each item `role="listitem"`; selected slot `aria-current="true"` or equivalent.
- **Slot cards**: `aria-expanded` on collapsible; `aria-describedby` for error text when present.

### Responsiveness

- **Minimum viewport**: Below breakpoint **X** (e.g. 1024px), **right panel collapses** into a **drawer** (e.g. bottom sheet or slide-over). Main content and slot list remain usable; assistant available via “Open assistant” or drawer toggle.

### Empty / loading

- **Empty slot list**: Skeleton or empty state with CTA (§3).
- **Loading**: Slot cards or list items show **skeleton** when loading slot config; assistant panel shows “Thinking…” or spinner during “Thought for Xs”.

---

## 10. Deliverables summary

### Component list (React)

| Component | Responsibility |
|-----------|----------------|
| **TopHeader** | AI agent title (editable name), Global/subAgents, Save + Last saved, tool context (Omni Tool + name). |
| **SlotList** | Left panel: list of slots with index badge, name, status dot; selection scrolls/focuses slot card. |
| **SlotCard** | Single slot: header (Slot n, name, edit, collapse), Define row, Validation row, slash hint. |
| **ValidationRow** | Validation chip + rule UI (defined list or numeric); error state. |
| **AssistantPanel** | Right: user bubble, thought line, success card, slot pills, review text, composer + Send. |
| **ReviewBar** | Sticky Accept/Decline bar when pending assistant diff; shortcuts. |

### State model (TypeScript-oriented)

```ts
// Core state
interface SlotAuthoringState {
  slots: Slot[];                    // ordered list of slots
  selectedSlotId: string | null;     // id of slot selected in list / focused card
  validationErrors: Record<string, ValidationError[]>;  // slotId -> errors
  assistantStatus: 'idle' | 'thinking' | 'result' | 'error';
  pendingDiff: PendingAssistantDiff | null;  // uncommitted assistant suggestion
  lastSavedAt: Date | null;
  draftDirty: boolean;
}

interface Slot {
  id: string;
  name: string;          // snake_case
  type: SlotType;       // string | int | float | enum | boolean
  order: number;
  validations: ValidationRule[];
  // ... conditions when in scope
}

interface PendingAssistantDiff {
  kind: 'slots_created' | 'slots_updated' | 'validations_updated';
  payload: unknown;    // e.g. new slots, patch
}
```

### Event list

| Event | When | Handler / effect |
|-------|------|-------------------|
| **onSelectSlot** | User selects slot in SlotList | Set `selectedSlotId`; scroll + focus SlotCard. |
| **onRenameSlot** | User commits slot name edit | Update slot name; validate uniqueness; set draftDirty. |
| **onAddValidation** | User adds validation (chip or / menu) | Append to slot.validations; set draftDirty. |
| **onRemoveValidation** | User removes a validation | Remove from slot.validations; clear relevant validationErrors. |
| **onAcceptChanges** | User clicks Accept in ReviewBar | Apply pendingDiff to draft; clear pendingDiff; set draftDirty. |
| **onDeclineChanges** | User clicks Decline | Clear pendingDiff; optionally confirm if manual edits exist. |
| **onSendAssistantPrompt** | User sends from composer | POST assistant; set assistantStatus 'thinking'; on result set pendingDiff and 'result'. |
| **onSave** | User clicks Save | PATCH draft; clear draftDirty; update lastSavedAt. |

### API contracts

| Method | Endpoint / usage | Purpose |
|--------|-------------------|--------|
| **GET** | `GET /api/tools/:toolId/config` or equivalent | Load tool config (slots, validations, conditions) for the Omni Tool. Returns draft or published per query. |
| **PATCH** | `PATCH /api/tools/:toolId/config` | Update **draft** config (slots, validations). Body: partial config; validate server-side. |
| **POST** | `POST /api/tools/:toolId/assistant/generate` or `/assistant/generate-slots` | Send user prompt; backend (or AI) returns suggested slots/validations. Response includes `suggestedSlots` (or diff) for ReviewBar. |

Response shapes (illustrative):

```ts
// GET config
interface ToolConfigResponse {
  displayName: string;
  toolName: string;
  slots: Slot[];
  // ... fixedArgs / actions_by_name shape for engine
}

// POST assistant generate
interface AssistantGenerateResponse {
  thoughtDurationMs?: number;
  suggestedSlots?: Slot[];
  message?: string;  // e.g. "Slots created. Here's what is added."
}
```

---

This spec stays aligned with the **Define → Validate → Condition** lifecycle and **one action per turn** deterministic guardrails. Implement when ready; no UI code in repo until requested.
