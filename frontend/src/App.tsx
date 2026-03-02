import { useState, useCallback } from 'react';
import type { Document, Block, SlotDefinitionBlock, PendingAssistantDiff, AssistantStatus } from './types';
import { TopHeader } from './components/TopHeader';
import { FreeTextCanvas } from './components/editor/FreeTextCanvas';
import { AssistantPanel } from './components/AssistantPanel';
import { ReviewBar } from './components/ReviewBar';
import styles from './App.module.css';

function genBlockId(): string {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialDocument: Document = {
  id: 'doc-1',
  title: 'Slot Filling Config',
  description: 'Define slots, validations, and conditions for your Omni Tool.',
  blocks: [],
  freeTextContent:
    'slot user_intent\nslot is_residential_service\n\nuser_intent in [new_service, transfer_service, stop_service, pending]\nis_residential_service in [yes, no]\n\nType freely — say "slot age", "validate X in [a,b,c]", "if X == Y then respond" — objects auto-detect as chips. Use / for commands, @ for slot refs.',
};

export default function App() {
  const [document, setDocument] = useState<Document>(initialDocument);
  const [agentTitle, setAgentTitle] = useState('Omnitools Slot Filling Demo');
  const [toolName, setToolName] = useState('record_information');
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
      }));
    } else if (pendingDiff.suggestedSlots?.length) {
      const newSlots = pendingDiff.suggestedSlots.map((s) => `slot ${s.name}`).join('\n');
      setDocument((prev) => ({
        ...prev,
        freeTextContent: (prev.freeTextContent ?? '') + (prev.freeTextContent ? '\n\n' : '') + newSlots,
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

        <div className={styles.actionsRow}>
          <button type="button" className={styles.actionBtn}>Omni Tool Assistant</button>
          <button type="button" className={styles.actionBtn}>Advanced mode</button>
          <button type="button" className={styles.actionBtn}>Slot Filling Engine</button>
        </div>

        <div className={styles.editorArea}>
          <FreeTextCanvas
            document={document}
            onDocumentChange={onDocumentChange}
          />
        </div>

        {pendingDiff && (
          <ReviewBar
            onAccept={onAcceptChanges}
            onDecline={onDeclineChanges}
          />
        )}
      </div>

      <aside className={styles.rightPanel} role="complementary" aria-label="Assistant">
        <AssistantPanel
          userPrompt={userPrompt}
          thoughtDuration={thoughtDuration}
          assistantStatus={assistantStatus}
          createdSlotNames={createdSlotNames}
          onSendPrompt={onSendAssistantPrompt}
          onSlotPillClick={onSlotPillClick}
        />
      </aside>
    </>
  );
}
