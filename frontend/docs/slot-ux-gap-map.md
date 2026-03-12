# Slot UX Gap Map

This map links Figma contracts to current implementation surfaces.

## Current Implementation Surfaces

- `frontend/src/components/editor/FreeTextCanvas.tsx`
- `frontend/src/components/editor/InlineSegmentEditor.tsx`
- `frontend/src/components/editor/FreeTextEditor.tsx`
- `frontend/src/components/editor/SlashCommandMenu.tsx`
- `frontend/src/components/editor/ValidationChip.tsx`
- `frontend/src/lib/parseInline.ts`
- `frontend/src/lib/slotAuthoring.ts`

## Mapped Gaps

### Structure
- Needed: multi-slot card orchestration toward `1070:7948`.
- Current change: slot cards are now explicit document state (`Document.slotCards`) and rendered as multiple slot blocks.

### Interaction
- Needed: active-slot scoped insertion and menu anchoring.
- Current change: slash/insert actions are tied to active slot context.

### Semantics
- Needed: strict update-only validation type selection and stable row semantics.
- In progress: instrumentation remains for ghost-line/caret verification.

### Visual
- Needed: spacing and branch polish to match nested `IF/ELIF/ELSE -> THEN` layouts from advanced states.
- Planned: iterative CSS pass after interaction stability.

### Testing
- Needed: regression tests for multi-slot isolation and validation/caret flows.
- Planned: extend existing placeholder/focus tests with slot-card scoped scenarios.
