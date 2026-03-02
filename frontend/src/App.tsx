import { useState, useCallback } from 'react';
import type { Document, Block, SlotDefinitionBlock, PendingAssistantDiff, AssistantStatus } from './types';
import { TopHeader } from './components/TopHeader';
import { BlockEditor } from './components/editor/BlockEditor';
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
  blocks: [
    {
      id: genBlockId(),
      type: 'slot_definition',
      slotName: 'user_intent',
      slotType: 'string',
    },
    {
      id: genBlockId(),
      type: 'slot_definition',
      slotName: 'is_residential_service',
      slotType: 'string',
    },
    {
      id: genBlockId(),
      type: 'validation',
      slotRef: 'user_intent',
      intent: 'in_list',
      value: ['new_service', 'transfer_service', 'stop_service', 'pending'],
    },
    {
      id: genBlockId(),
      type: 'validation',
      slotRef: 'is_residential_service',
      intent: 'in_list',
      value: ['yes', 'no'],
    },
    { id: genBlockId(), type: 'paragraph', content: "Type 'slot name' or '/' for commands" },
  ],
};

export default function App() {
  const [document, setDocument] = useState<Document>(initialDocument);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
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
      const insertionPoint = pendingDiff.insertionPoint;
      let afterBlockId: string | undefined;
      if (insertionPoint && 'afterBlockId' in insertionPoint && insertionPoint.afterBlockId) {
        afterBlockId = insertionPoint.afterBlockId;
      }
      setDocument((prev) => {
        const idx =
          afterBlockId != null
            ? prev.blocks.findIndex((b) => b.id === afterBlockId) + 1 || prev.blocks.length
            : prev.blocks.length;
        const next = [...prev.blocks];
        next.splice(idx, 0, ...pendingDiff.blocksToAdd!);
        return { ...prev, blocks: next };
      });
    } else if (pendingDiff.suggestedSlots?.length) {
      const newBlocks: Block[] = pendingDiff.suggestedSlots.map((s) => ({
        id: genBlockId(),
        type: 'slot_definition',
        slotName: s.name,
        slotType: s.type,
      })) as SlotDefinitionBlock[];
      setDocument((prev) => ({
        ...prev,
        blocks: [...prev.blocks, ...newBlocks],
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

  const slotBlocks = document.blocks.filter((b) => b.type === 'slot_definition');
  const onSlotPillClick = useCallback(
    (name: string) => {
      const block = slotBlocks.find((b) => b.type === 'slot_definition' && b.slotName === name);
      if (block) setSelectedBlockId(block.id);
    },
    [slotBlocks]
  );

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
          <BlockEditor
            document={document}
            onDocumentChange={onDocumentChange}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
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
