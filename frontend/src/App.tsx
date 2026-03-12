import { useState, useCallback, Component, type ReactNode } from 'react';
import type { Document, Block, SlotDefinitionBlock, PendingAssistantDiff, AssistantStatus } from './types';
import { StarterScreen, type StarterFormData } from './components/StarterScreen';
import { TopHeader } from './components/TopHeader';
import { FreeTextCanvas } from './components/editor/FreeTextCanvas';
import { ReviewBar } from './components/ReviewBar';
import styles from './App.module.css';

class DebugErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_error: Error, _info: { componentStack: string }) {}
  render() {
    if (this.state.hasError) return <div style={{ padding: 16, color: '#c00' }}>Something went wrong.</div>;
    return this.props.children;
  }
}

function genBlockId(): string {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialDocument: Document = {
  id: 'doc-1',
  title: 'Slot Filling Config',
  description: 'Define slots, validations, and conditions for your Omni Tool.',
  blocks: [],
  freeTextContent: '',
  slotCards: [{ id: 'slot-1', content: '' }],
};

export default function App() {
  const [screen, setScreen] = useState<'starter' | 'editor'>('starter');
  const [_starterData, setStarterData] = useState<StarterFormData | null>(null);

  const [document, setDocument] = useState<Document>(initialDocument);
  const [agentTitle, setAgentTitle] = useState('Omnitools Slot Filling Demo');
  const [toolName, setToolName] = useState('nrg_new_service');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<PendingAssistantDiff | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>('idle');
  const [userPrompt, setUserPrompt] = useState<string | null>(null);
  const [thoughtDuration, setThoughtDuration] = useState<number | null>(null);
  const [createdSlotNames, setCreatedSlotNames] = useState<string[]>([]);
  const onDocumentChange = useCallback((doc: Document) => {
    setDocument(doc);
    setDraftDirty(true);
  }, []);

  const onAcceptChanges = useCallback(() => {
    if (!pendingDiff) return;
    if (pendingDiff.blocksToAdd && pendingDiff.blocksToAdd.length > 0) {
      const newSlots = pendingDiff.blocksToAdd
        .filter((b): b is SlotDefinitionBlock => b.type === 'slot_definition')
        .map((b) => `slot ${b.slotName}`)
        .join('\n');
      setDocument((prev) => ({
        ...prev,
        freeTextContent: (prev.freeTextContent ?? '') + (prev.freeTextContent ? '\n\n' : '') + newSlots,
        slotCards:
          prev.slotCards && prev.slotCards.length > 0
            ? prev.slotCards.map((card, idx) =>
                idx === 0
                  ? {
                      ...card,
                      content: (card.content ?? '') + (card.content ? '\n\n' : '') + newSlots,
                    }
                  : card
              )
            : [{ id: 'slot-1', content: newSlots }],
      }));
    } else if (pendingDiff.suggestedSlots?.length) {
      const newSlots = pendingDiff.suggestedSlots.map((s) => `slot ${s.name}`).join('\n');
      setDocument((prev) => ({
        ...prev,
        freeTextContent: (prev.freeTextContent ?? '') + (prev.freeTextContent ? '\n\n' : '') + newSlots,
        slotCards:
          prev.slotCards && prev.slotCards.length > 0
            ? prev.slotCards.map((card, idx) =>
                idx === 0
                  ? {
                      ...card,
                      content: (card.content ?? '') + (card.content ? '\n\n' : '') + newSlots,
                    }
                  : card
              )
            : [{ id: 'slot-1', content: newSlots }],
      }));
    }
    setPendingDiff(null);
    setCreatedSlotNames([]);
    setDraftDirty(true);
  }, [pendingDiff]);

  const onDeclineChanges = useCallback(() => {
    setPendingDiff(null);
    setCreatedSlotNames([]);
  }, []);

  const onSendAssistantPrompt = useCallback((prompt: string) => {
    setUserPrompt(prompt);
    setAssistantStatus('thinking');
    setThoughtDuration(null);
    setTimeout(() => {
      setThoughtDuration(2);
      setAssistantStatus('result');
      setCreatedSlotNames(['age', 'is_account_holder']);
      const newBlocks: Block[] = [
        {
          id: genBlockId(),
          type: 'slot_definition',
          slotName: 'age',
          slotType: 'int',
        },
        {
          id: genBlockId(),
          type: 'slot_definition',
          slotName: 'is_account_holder',
          slotType: 'string',
        },
      ] as SlotDefinitionBlock[];
      setPendingDiff({
        kind: 'slots_created',
        suggestedSlots: [
          { id: '1', name: 'age', type: 'int', order: 1, validations: [], status: 'default', expanded: true },
          { id: '2', name: 'is_account_holder', type: 'string', order: 2, validations: [], status: 'default', expanded: false },
        ],
        blocksToAdd: newBlocks,
        insertionPoint: { afterBlockId: document.blocks[document.blocks.length - 1]?.id ?? '' },
        message: "Slots created. Here's what is added.",
      });
    }, 1500);
  }, [document.blocks]);

  const onSave = useCallback(() => {
    setLastSavedAt(new Date());
    setDraftDirty(false);
  }, []);

  const onSlotPillClick = useCallback((_name: string) => {}, []);

  const handleStarterSubmit = useCallback((data: StarterFormData) => {
    setStarterData(data);
    setToolName(data.toolName);
    setDocument((prev) => ({ ...prev, description: data.description || prev.description }));
    setScreen('editor');
  }, []);

  if (screen === 'starter') {
    return <StarterScreen onSubmit={handleStarterSubmit} />;
  }

  return (
    <>
      <nav className={styles.sidebar} role="navigation" aria-label="Global navigation">
        <div className={styles.navIcon} aria-label="Flows" title="Flows" />
        <div className={`${styles.navIcon} ${styles.navIconActive}`} aria-label="Slot authoring" title="Slot authoring" />
        <div className={styles.navIcon} aria-label="Settings" title="Settings" />
      </nav>

      <div className={styles.mainWrap}>
        <TopHeader
          agentTitle={agentTitle}
          toolName={toolName}
          lastSavedAt={lastSavedAt}
          draftDirty={draftDirty}
          onAgentTitleChange={setAgentTitle}
          onToolNameChange={setToolName}
          onSave={onSave}
        />

        <div className={styles.editorArea}>
          <DebugErrorBoundary>
          <FreeTextCanvas
            document={document}
            onDocumentChange={onDocumentChange}
            toolName={toolName}
            userPrompt={userPrompt}
            thoughtDuration={thoughtDuration}
            assistantStatus={assistantStatus}
            createdSlotNames={createdSlotNames}
            onSendAssistantPrompt={onSendAssistantPrompt}
            onSlotPillClick={onSlotPillClick}
          />
          </DebugErrorBoundary>
        </div>

        {pendingDiff && (
          <ReviewBar
            onAccept={onAcceptChanges}
            onDecline={onDeclineChanges}
          />
        )}
      </div>
    </>
  );
}
