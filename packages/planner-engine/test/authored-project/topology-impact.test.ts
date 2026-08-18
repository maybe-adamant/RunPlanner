import {
  applyTopologyRemovalImpact,
  createOccurrenceId,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeHubDecisionRemovalImpact,
  describeHubSlotClosureImpact,
  describeTopologyRemovalImpact,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

const root = createOccurrenceId('impact-root');
const retained = createOccurrenceId('impact-retained');
const child = createOccurrenceId('impact-child');
const grandchild = createOccurrenceId('impact-grandchild');

function normalBatch(
  targets: readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[],
) {
  return {
    kind: 'batch' as const,
    rewardStore: { kind: 'none' as const },
    batchState: null,
    targets,
  };
}

describe('topology removal impact', () => {
  it('owns the complete removed occurrence subtree and its exit-decision sources', () => {
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, retained, child, grandchild].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: normalBatch([
            { exitKey: 'exit1', occurrenceId: retained },
            { exitKey: 'exit2', occurrenceId: child },
          ]),
          selection: { kind: 'normal' as const, exitKey: 'exit1' },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: child },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: grandchild }]),
          selection: { kind: 'derived' as const },
        },
      ],
    };

    expect(describeTopologyRemovalImpact(topology, new Set([child]))).toEqual({
      removedExitDecisionSources: [{ kind: 'occurrence', occurrenceId: child }],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [child, grandchild],
    });
  });

  it('uses one command-owned impact for an exit, its targets, and their descendants', () => {
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, retained, child, grandchild].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: normalBatch([
            { exitKey: 'exit1', occurrenceId: retained },
            { exitKey: 'exit2', occurrenceId: child },
          ]),
          selection: { kind: 'normal' as const, exitKey: 'exit1' },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: child },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: grandchild }]),
          selection: { kind: 'derived' as const },
        },
      ],
    };

    const impact = describeExitDecisionRemovalImpact(topology, {
      kind: 'occurrence',
      occurrenceId: root,
    });

    expect(impact).toEqual({
      removedExitDecisionSources: [
        { kind: 'occurrence', occurrenceId: root },
        { kind: 'occurrence', occurrenceId: child },
      ],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [retained, child, grandchild],
    });
    if (impact === undefined) throw new Error('root exit is required');
    expect(applyTopologyRemovalImpact(topology, impact)).toEqual({
      startOccurrenceId: root,
      occurrences: [
        {
          occurrenceId: root,
          gameName: 'TestRoom',
          state: { kind: 'none' },
          encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
          roomActions: { order: [] },
          additionalExits: [],
        },
      ],
      decisions: [],
    });
  });

  it('owns additional-route targets and their automatic host-return subtree', () => {
    const contract = createOccurrenceId('impact-contract');
    const hostReturn = createOccurrenceId('impact-host-return');
    const returnChild = createOccurrenceId('impact-return-child');
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, retained, contract, hostReturn, returnChild].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits:
          occurrenceId === root
            ? [
                {
                  kind: 'zagreusContract' as const,
                  key: 'zagreusContract' as const,
                  occurrenceId: contract,
                },
              ]
            : [],
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: retained }]),
          selection: { kind: 'additional' as const, additionalExitKey: 'zagreusContract' },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: contract },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: hostReturn }]),
          selection: { kind: 'derived' as const },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: hostReturn },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: returnChild }]),
          selection: { kind: 'derived' as const },
        },
      ],
    };

    const impact = describeExitDecisionRemovalImpact(topology, {
      kind: 'occurrence',
      occurrenceId: root,
    });
    expect(impact).toEqual({
      removedExitDecisionSources: [
        { kind: 'occurrence', occurrenceId: root },
        { kind: 'occurrence', occurrenceId: contract },
        { kind: 'occurrence', occurrenceId: hostReturn },
      ],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [retained, contract, hostReturn, returnChild],
    });
    if (impact === undefined) throw new Error('root exit is required');
    expect(
      applyTopologyRemovalImpact(topology, impact).occurrences.map(
        (occurrence) => occurrence.occurrenceId,
      ),
    ).toEqual([root]);
  });

  it('removes a Hub through its persisted PreHub source, not a linked-entry special case', () => {
    const opening = createOccurrenceId('n-opening');
    const preHub = createOccurrenceId('n-prehub');
    const hubSlot = createOccurrenceId('n-combat01');
    const preboss = createOccurrenceId('n-preboss');
    const postPreboss = createOccurrenceId('n-after-preboss');
    const topology = {
      startOccurrenceId: opening,
      occurrences: [opening, preHub, hubSlot, preboss, postPreboss].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: opening },
          normal: normalBatch([{ exitKey: 'prehub', occurrenceId: preHub }]),
          selection: { kind: 'normal' as const, exitKey: 'prehub' },
        },
        {
          kind: 'hub' as const,
          hubKey: 'hub',
          source: { kind: 'occurrence' as const, occurrenceId: preHub },
          openTargets: [{ hubSlotKey: 'combat01', occurrenceId: hubSlot }],
          visitOrder: [],
        },
        {
          kind: 'exit' as const,
          source: { kind: 'hubDecision' as const, decisionKey: 'hub' },
          normal: normalBatch([{ exitKey: 'preboss', occurrenceId: preboss }]),
          selection: { kind: 'derived' as const },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: preboss },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: postPreboss }]),
          selection: { kind: 'derived' as const },
        },
      ],
    };

    expect(describeTopologyRemovalImpact(topology, new Set([preHub]))).toEqual({
      removedExitDecisionSources: [
        { kind: 'hubDecision', decisionKey: 'hub' },
        { kind: 'occurrence', occurrenceId: preboss },
      ],
      removedHubDecisionKeys: ['hub'],
      removedOccurrenceIds: [preHub, hubSlot, preboss, postPreboss],
    });

    const impact = describeExitDecisionRemovalImpact(topology, {
      kind: 'occurrence',
      occurrenceId: opening,
    });
    expect(impact).toEqual({
      removedExitDecisionSources: [
        { kind: 'occurrence', occurrenceId: opening },
        { kind: 'hubDecision', decisionKey: 'hub' },
        { kind: 'occurrence', occurrenceId: preboss },
      ],
      removedHubDecisionKeys: ['hub'],
      removedOccurrenceIds: [preHub, hubSlot, preboss, postPreboss],
    });
    if (impact === undefined) throw new Error('opening exit is required');
    expect(applyTopologyRemovalImpact(topology, impact)).toEqual({
      startOccurrenceId: opening,
      occurrences: [
        {
          occurrenceId: opening,
          gameName: 'TestRoom',
          state: { kind: 'none' },
          encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
          roomActions: { order: [] },
          additionalExits: [],
        },
      ],
      decisions: [],
    });

    const handoffImpact = describeExitDecisionRemovalImpact(topology, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    expect(handoffImpact).toEqual({
      removedExitDecisionSources: [
        { kind: 'hubDecision', decisionKey: 'hub' },
        { kind: 'occurrence', occurrenceId: preboss },
      ],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [preboss, postPreboss],
    });
    if (handoffImpact === undefined) throw new Error('completed-Hub handoff is required');
    expect(
      applyTopologyRemovalImpact(topology, handoffImpact).occurrences.map(
        (occurrence) => occurrence.occurrenceId,
      ),
    ).toEqual([opening, preHub, hubSlot]);

    const hubImpact = describeHubDecisionRemovalImpact(topology, 'hub');
    expect(hubImpact).toEqual({
      removedExitDecisionSources: [
        { kind: 'hubDecision', decisionKey: 'hub' },
        { kind: 'occurrence', occurrenceId: preboss },
      ],
      removedHubDecisionKeys: ['hub'],
      removedOccurrenceIds: [hubSlot, preboss, postPreboss],
    });
    if (hubImpact === undefined) throw new Error('Hub decision is required');
    expect(applyTopologyRemovalImpact(topology, hubImpact)).toEqual({
      startOccurrenceId: opening,
      occurrences: [opening, preHub].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [topology.decisions[0]],
    });
  });

  it('owns the detached physical subtree when closing an unvisited Hub slot', () => {
    const hubSlot = createOccurrenceId('hub-slot-combat01');
    const hubChild = createOccurrenceId('hub-slot-child');
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, hubSlot, hubChild].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [
        {
          kind: 'hub' as const,
          hubKey: 'hub',
          source: { kind: 'occurrence' as const, occurrenceId: root },
          openTargets: [{ hubSlotKey: 'combat01', occurrenceId: hubSlot }],
          visitOrder: [],
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: hubSlot },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: hubChild }]),
          selection: { kind: 'derived' as const },
        },
      ],
    };

    expect(describeHubSlotClosureImpact(topology, 'hub', 'combat01', 1)).toEqual({
      removedExitDecisionSources: [{ kind: 'occurrence', occurrenceId: hubSlot }],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [hubSlot, hubChild],
    });
    expect(describeHubSlotClosureImpact(topology, 'hub', 'combat02', 1)).toBeUndefined();
  });

  it('removes the completed-Hub handoff subtree when closing falls below its open-slot minimum', () => {
    const hubSlot = createOccurrenceId('hub-slot-combat01');
    const retainedSlot = createOccurrenceId('hub-slot-combat02');
    const preboss = createOccurrenceId('hub-preboss');
    const completionChild = createOccurrenceId('hub-completion-child');
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, hubSlot, retainedSlot, preboss, completionChild].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [
        {
          kind: 'hub' as const,
          hubKey: 'hub',
          source: { kind: 'occurrence' as const, occurrenceId: root },
          openTargets: [
            { hubSlotKey: 'combat01', occurrenceId: hubSlot },
            { hubSlotKey: 'combat02', occurrenceId: retainedSlot },
          ],
          visitOrder: ['combat01'],
        },
        {
          kind: 'exit' as const,
          source: { kind: 'hubDecision' as const, decisionKey: 'hub' },
          normal: normalBatch([{ exitKey: 'preboss', occurrenceId: preboss }]),
          selection: { kind: 'derived' as const },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: preboss },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: completionChild }]),
          selection: { kind: 'derived' as const },
        },
      ],
    };

    const impact = describeHubSlotClosureImpact(topology, 'hub', 'combat01', 2);
    expect(impact).toEqual({
      removedExitDecisionSources: [
        { kind: 'hubDecision', decisionKey: 'hub' },
        { kind: 'occurrence', occurrenceId: preboss },
      ],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [hubSlot, preboss, completionChild],
    });
    if (impact === undefined) throw new Error('Hub slot closure impact is missing');
    expect(applyTopologyRemovalImpact(topology, impact)).toEqual({
      startOccurrenceId: root,
      occurrences: [root, retainedSlot].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [topology.decisions[0]],
    });
    expect(describeHubSlotClosureImpact(topology, 'hub', 'combat01', 1)).toEqual({
      removedExitDecisionSources: [],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [hubSlot],
    });
  });

  it('describes ClearTopology as every persisted occurrence and decision owner', () => {
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, child].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
        encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {} },
        roomActions: { order: [] },
        additionalExits: [],
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: normalBatch([{ exitKey: 'exit1', occurrenceId: child }]),
          selection: { kind: 'derived' as const },
        },
        {
          kind: 'hub' as const,
          hubKey: 'hub',
          source: { kind: 'occurrence' as const, occurrenceId: child },
          openTargets: [],
          visitOrder: [],
        },
        {
          kind: 'exit' as const,
          source: { kind: 'hubDecision' as const, decisionKey: 'hub' },
          normal: normalBatch([]),
          selection: { kind: 'unresolved' as const },
        },
      ],
    };

    expect(describeClearTopologyImpact(topology)).toEqual({
      removedExitDecisionSources: [
        { kind: 'occurrence', occurrenceId: root },
        { kind: 'hubDecision', decisionKey: 'hub' },
      ],
      removedHubDecisionKeys: ['hub'],
      removedOccurrenceIds: [root, child],
    });
  });
});
