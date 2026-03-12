# Slot UX Contracts

These contracts define behavior that should remain stable as implementation evolves.

## Row Composition Contract

- Each slot card composes rows in this order: `Define` -> `Validation` -> `Condition`.
- Row semantics are tag-led (colored chip first, structured text/chips to the right).
- Validation type selection updates the existing validation row in place.

## Chip Semantics Contract

- `@slot_name` + space defines a slot and renders as a green slot chip.
- Validation types render as neutral/semantic chips (not free text).
- Value references (in validation contexts) render as subtle value chips and do not register as slots.

## Menu Contract

- `/` key and insert button are equivalent entry points into the same command pipeline.
- Menus anchor near current caret context and do not steal persistent focus.
- Validation and condition menus are context-scoped to active slot and active row.

## Focus and Caret Contract

- Last meaningful insertion wins.
- Focus never resolves to ghost/empty non-interactive rows.
- After validation type selection, focus stays in validation flow (operator/value or next meaningful input).

## Multi-Slot Contract

- Slot cards are independently editable, while slot definitions remain globally discoverable.
- Active slot context determines insertion/focus operations.
- Slots panel aggregates all defined slots across slot cards.
