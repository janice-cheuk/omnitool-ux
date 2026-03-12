# Interaction Design: Free-Text Slot Editor (Omni Tool)

Interaction design for the slot definition area and free-text editor. Documents the current implemented behavior: typing, @-mentions, slash menu, insert plus button, and chip configuration.

---

## 1. Slot definition area

### Starting state

- **Slot block** is always visible (no “Add a slot” empty state).
- **Header**: “Slot 1” title + “Define” tag.
- **Editor**: Single free-text contenteditable with placeholder:
  - *“Start typing using @ to define a slot name. Make sure it is: in snake_case, a unique name”*

### Layout

- **Left**: Insert plus button (see §4), outside the slot block container, on the same row.
- **Right**: Slot block (card with header + free-text area).
- **Slots panel** (sidebar): Live table of contents from defined and referenced slots (`slot_def` and `slot_ref` segments).

---

## 2. Typing and cursor

### Normal typing

- User types in the contenteditable; text appears in normal order.
- **@** is not intercepted: the browser inserts it natively so the cursor stays **after** the `@` (user can type `@slotname`).
- All other printable keys, Backspace, Delete, paste, and line breaks are handled via keydown/beforeinput with `preventDefault` and a single programmatic update to avoid duplication and keep a single source of truth.

### Cursor and selection

- Caret position is restored after React re-renders (e.g. after chip conversion) via a stored offset and `setCaretAtOffset` in a layout effect.
- No special handling that moves the cursor in front of `@` or causes “typing in multiple places.”

---

## 3. Slot references and chips

### Defining a slot with @

1. User types `@` (cursor remains after it).
2. User types the slot name in **snake_case** (e.g. `user_intent`).
3. User presses **Space**.
4. The system treats the span as a completed reference: `@user_intent` is replaced by a **green inline chip** showing the slot name (no `@` in the chip label).
5. The slot appears in the **Slots** sidebar (from `slot_ref` / `slot_def` segments).

### Chip behavior

- **First-time definition**: When a slot name has no saved config, the chip’s **dropdown opens by default** (Slot Type, Dependencies, Default values).
- **Reuse**: Once the user has applied config for that slot name, it is stored in **document.slotConfigs**. Reopening that chip’s dropdown shows the saved config; dropdown is not auto-opened again.
- **Config is global**: Slot Type, Dependencies, and Default values are saved per slot name and reused wherever that slot is referenced.

### Chip display

- Chip shows only the slot name (e.g. `user_intent`), not `@user_intent`.
- Chip is a tappable control; clicking opens the configuration dropdown.

---

## 4. Insert plus button

### Placement

- **Outside** the slot block container, to the **left** of the slot block, on the same horizontal row.
- **Vertical alignment**: The plus button **follows the caret’s line** (same “latitude” as the current typing line):
  - A `selectionchange` listener (and focus) reports the caret’s `getBoundingClientRect()` to the canvas.
  - The canvas converts that to a `top` offset relative to the slot row and sets the plus button’s `top` (position: absolute within the row).
  - So when the user is on line 1, the plus aligns to line 1; on line 2, it aligns to line 2.

### Appearance

- **Button**: Light blue background (`#b3d9ff`), dark blue “+” icon (`#2563eb`), 24×24px, rounded.
- **Tooltip** (on hover): Dark gray/black box, white text **“Insert /”**, with a small left-pointing caret. Shown on hover/focus.

### Interaction

- **Click**: Opens the **slash command menu** (same as typing `/`), with insert at **end of content** (or a defined insert point).
- The plus does not receive focus in a way that steals it from the text area; it only opens the menu.

---

## 5. Slash command menu (“/”)

### Opening the menu

- **Typing `/`** in the editor: `preventDefault` on `/`, then open the menu **at the caret**; chosen command is inserted at the **current caret offset**.
- **Clicking the insert plus** (see §4): Open the same menu with insert at **end of content** (or plus-defined offset).

### Menu contents (examples)

- **Validate** (add validation)
- **Conditions** (add condition: “if … then …”)
- **Define slot**
- **Insert slot reference** (list of defined/referenced slot names, e.g. `@slotname`)
- Other block/command options as in the SlashCommandMenu component.

### After selection

- The chosen template (e.g. `validate `, `if  then `, `@slotname `) is inserted at the stored `insertOffset`.
- A leading space is added when the character before the insert offset is not already a newline (so words don’t run together).
- Menu closes after selection.

---

## 6. Parsing and segments

### Segment types (for sidebar and chips)

- **text**: Plain text (including incomplete `@…` before space).
- **slot_def**: Detected slot definition (e.g. “slot x”, “define slot x”).
- **slot_ref**: `@name` after space (snake_case); rendered as green chip in editor.
- **validation**, **condition**: For structure and sidebar; editor may show as plain text or dedicated UI as needed.

### Editor view

- The free-text editor parses content into segments and renders **text** and **slot_ref** inline; **slot_ref** is rendered as the green chip. Other types can be shown as plain text in the same flow.

---

## 7. Accessibility and robustness

- **contentEditable**: Single contenteditable root; chips are non-editable spans inside it.
- **Composition**: IME (e.g. CJK) is respected via `compositionstart` / `compositionend`; no interception during composition.
- **Paste**: Handled with `preventDefault`; text is inserted at caret and caret offset is updated.
- **Slash menu**: Escape closes the menu; focus returns to the editor as appropriate.
- **Plus button**: `aria-label` and `title` “Insert /” for screen readers and tooltips.

---

## 8. References

- **Figma**: Omni-Tool design (e.g. empty state 842-6526, chip/dropdown 842-6525, insert/plus and slash menu 387-9156).
- **Specs**: `NOTION_STYLE_EDITOR_SPEC.md`, `FRONTEND_DESIGN_SPEC.md` for layout and block model.
- **Implementation**: `FreeTextCanvas`, `FreeTextEditor`, `InlineSegmentEditor`, `SlotChip`, `SlashCommandMenu` in `frontend/src/components/editor/`.
