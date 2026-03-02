# Slot Authoring UI (Omni Tool)

React + TypeScript frontend for the slot authoring page. Implements the layout and components from [../docs/FRONTEND_DESIGN_SPEC.md](../docs/FRONTEND_DESIGN_SPEC.md).

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
npm run preview   # preview production build
```

## Structure

- **Left column**: Icon nav (Flows, Slot authoring, Settings).
- **Main column**: Header (AI agent title, Omni Tool name, Save), action buttons (Omni Tool Assistant, Advanced mode, Slot Filling Engine), Slots list + slot cards (Define, Validation, “Start typing or insert using /”).
- **Right column**: Assistant panel — user prompt bubble, “Thought for Xs”, “Slots created” result with pills (click to go to slot), composer + Send.

The assistant is simulated: sending a prompt shows “Thinking…” then a fake “Slots created” result with Accept/Decline bar. Real API integration can be wired to `onSendAssistantPrompt` and the PATCH/GET endpoints in the design spec.
