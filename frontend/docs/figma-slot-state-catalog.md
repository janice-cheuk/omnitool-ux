# Slot Authoring Figma State Catalog

This catalog captures the source-of-truth state nodes used for implementation and regression checks.

## Macro Screen States

- `1070:7948` - Full editor screen with **two completed slots**, slots panel, assistant panel, and header controls.

## Slot Journey States

- `842:6525` - Slot animations frame (state collection root).
- `842:6526` - Default empty slot state.
- `842:6673` - Slot defined state (green define chip + configured slot ref).
- `842:6690` - Post-define typing/insert state.
- `842:6757` - Slash controls menu overlay state.
- `842:6822` - Validation flow introduced.
- `842:7857` - Validation + condition flow expanded with nested THEN/actions.

## Interaction Surfaces to Validate Against

- Slot header identity: `Slot n` tag + editable slot name label.
- Define row chip + slot object chip conversion.
- Validation row semantics and list formatting.
- Condition branching: `IF/ELIF/ELSE` and nested `THEN`.
- Slash/insert action menu positioning and option set.

## Intended Usage

Use this file during implementation reviews to confirm each staged UI behavior corresponds to a known Figma state node and to prevent behavior drift between single-slot and multi-slot scenarios.
