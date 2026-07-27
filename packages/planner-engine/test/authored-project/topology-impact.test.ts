import {
  applyTopologyRemovalImpact,
  createOccurrenceId,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeTopologyRemovalImpact,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

const root = createOccurrenceId('impact-root');
const retained = createOccurrenceId('impact-retained');
const child = createOccurrenceId('impact-child');
const grandchild = createOccurrenceId('impact-grandchild');

describe('topology removal impact', () => {
  it('owns the complete removed occurrence subtree and its exit-decision sources', () => {
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, retained, child, grandchild].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: {
            kind: 'batch' as const,
            rewardStore: { kind: 'none' as const },
            batchState: null,
            targets: [
              { exitKey: 'exit1', occurrenceId: retained },
              { exitKey: 'exit2', occurrenceId: child },
            ],
          },
          selection: { kind: 'normal' as const, exitKey: 'exit1' },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: child },
          normal: {
            kind: 'linked' as const,
            exitKey: 'exit1',
            occurrenceId: grandchild,
          },
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
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: {
            kind: 'batch' as const,
            rewardStore: { kind: 'none' as const },
            batchState: null,
            targets: [
              { exitKey: 'exit1', occurrenceId: retained },
              { exitKey: 'exit2', occurrenceId: child },
            ],
          },
          selection: { kind: 'normal' as const, exitKey: 'exit1' },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: child },
          normal: {
            kind: 'linked' as const,
            exitKey: 'exit1',
            occurrenceId: grandchild,
          },
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
      occurrences: [{ occurrenceId: root, gameName: 'TestRoom', state: { kind: 'none' } }],
      decisions: [],
    });
  });

  it('removes N linked-PreHub topology with its Hub board and completed handoff', () => {
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
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: opening },
          normal: {
            kind: 'linked' as const,
            exitKey: 'exit1',
            occurrenceId: preHub,
          },
          selection: { kind: 'derived' as const },
        },
        {
          kind: 'hub' as const,
          hubKey: 'hub',
          openTargets: [{ hubSlotKey: 'combat01', occurrenceId: hubSlot }],
          visitOrder: ['combat01'],
        },
        {
          kind: 'exit' as const,
          source: { kind: 'hubDecision' as const, decisionKey: 'hub' },
          normal: {
            kind: 'batch' as const,
            rewardStore: { kind: 'none' as const },
            batchState: null,
            targets: [{ exitKey: 'preboss', occurrenceId: preboss }],
          },
          selection: { kind: 'derived' as const },
        },
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: preboss },
          normal: {
            kind: 'linked' as const,
            exitKey: 'exit1',
            occurrenceId: postPreboss,
          },
          selection: { kind: 'derived' as const },
        },
      ],
    };

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
    if (impact === undefined) throw new Error('linked PreHub exit is required');
    expect(applyTopologyRemovalImpact(topology, impact)).toEqual({
      startOccurrenceId: opening,
      occurrences: [{ occurrenceId: opening, gameName: 'TestRoom', state: { kind: 'none' } }],
      decisions: [],
    });

    const handoffImpact = describeExitDecisionRemovalImpact(topology, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    expect(handoffImpact).toMatchObject({
      removedExitDecisionSources: [
        { kind: 'hubDecision', decisionKey: 'hub' },
        { kind: 'occurrence', occurrenceId: preboss },
      ],
      removedHubDecisionKeys: [],
      removedOccurrenceIds: [preboss, postPreboss],
    });
    if (handoffImpact === undefined) throw new Error('completed-Hub handoff is required');
    const withoutHandoff = applyTopologyRemovalImpact(topology, handoffImpact);
    expect(withoutHandoff.occurrences.map((occurrence) => occurrence.occurrenceId)).toEqual([
      opening,
      preHub,
      hubSlot,
    ]);
    expect(withoutHandoff.decisions).toEqual([topology.decisions[0], topology.decisions[1]]);
  });

  it('describes ClearTopology as every persisted occurrence and decision owner', () => {
    const topology = {
      startOccurrenceId: root,
      occurrences: [root, child].map((occurrenceId) => ({
        occurrenceId,
        gameName: 'TestRoom',
        state: { kind: 'none' as const },
      })),
      decisions: [
        {
          kind: 'exit' as const,
          source: { kind: 'occurrence' as const, occurrenceId: root },
          normal: {
            kind: 'linked' as const,
            exitKey: 'exit1',
            occurrenceId: child,
          },
          selection: { kind: 'derived' as const },
        },
        {
          kind: 'hub' as const,
          hubKey: 'hub',
          openTargets: [],
          visitOrder: [],
        },
        {
          kind: 'exit' as const,
          source: { kind: 'hubDecision' as const, decisionKey: 'hub' },
          normal: {
            kind: 'batch' as const,
            rewardStore: { kind: 'none' as const },
            batchState: null,
            targets: [],
          },
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
