import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  createEncounterPhaseAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';

import { createArcanaFearState } from '../../../../../src/simulation/arcana-fear';
import { createKeepsakeState } from '../../../../../src/simulation/keepsakes/state';
import { applyEchoKeepsakeReplayTransition } from '../../../../../src/simulation/rewards/biome/lifecycle-transitions/echo-keepsake-replay';
import type { RewardBranchState } from '../../../../../src/simulation/rewards/branch-primitives';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../../../../src/simulation/traits';
import { resolveRoutePosition } from '../../../../../src/authored-project/route-context';
import { initializeTestRewardBranches } from '../../../../support/arcana-fear';

const replayOwner = createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'G'));
const hammerResult = createKeepsakeEquipResultAddress(replayOwner, 'experimentalHammer');

function routeG() {
  const project = createGoldenFGHProject();
  const route = project.route!;
  const biome = simulateProject(catalog, project).route?.biomes.find(
    (candidate) => candidate.biomeKey === 'G',
  );
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error('expected valid G fixture');
  return { route, snapshot: biome.snapshot, position: resolveRoutePosition(catalog, route, 'G') };
}

/** One branch holding an Echo gift that captured Experimental Hammer, now unequipped. */
function hammerGiftBranch(route: ReturnType<typeof routeG>['route']): RewardBranchState {
  const base = initializeTestRewardBranches()[0]!;
  const traitHistory = foldTraitHistoryEvents(catalog, [
    Object.freeze({
      kind: 'traitOffer' as const,
      owner: createEncounterPhaseAddress(
        createBiomeAddress('Underworld', 'F'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('echo-replay-test') },
        'Encounter',
      ),
      acquisitionRole: 'selection',
      sequence: -1,
      giverKey: 'Echo',
      options: Object.freeze([{ traitKey: 'EchoRepeatKeepsakeBoon' }] as const),
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'encounterCompleted',
      acquisitionIdentity: 'echo-gift',
      echoRepeatedKeepsakeKey: 'TempHammerKeepsake',
    }),
  ]);
  const captured = createKeepsakeState(
    catalog,
    'TempHammerKeepsake',
    createArcanaFearState(catalog, route.loadout),
  );
  return Object.freeze({
    ...base,
    state: Object.freeze({
      ...base.state,
      rewardHistory: attachTraitHistory(base.state.rewardHistory, traitHistory),
      traitHistory,
      keepsakes: Object.freeze({ ...captured, currentKey: 'ManaOverTimeRefundKeepsake' }),
    }),
  });
}

describe('Echo keepsake replay biome-start transition', () => {
  it('leaves branches untouched and emits nothing without a captured gift', () => {
    const { route, snapshot, position } = routeG();
    const branches = initializeTestRewardBranches();
    const transition = applyEchoKeepsakeReplayTransition(
      catalog,
      snapshot,
      position,
      route.loadout,
      branches,
      0,
    );
    expect(transition.branches).toBe(branches);
    expect(transition.findings).toEqual([]);
    expect(transition.keepsakeEquipResultCandidates).toEqual([]);
    expect(transition.timelineFacts.nodes).toEqual([]);
    expect(transition.outcome).toBeUndefined();
  });

  it('publishes the equip-result candidate and a biome-start missing finding', () => {
    const { route, snapshot, position } = routeG();
    expect(snapshot.echoKeepsakeReplayResults).toBeUndefined();
    const branches = [hammerGiftBranch(route)];
    const transition = applyEchoKeepsakeReplayTransition(
      catalog,
      snapshot,
      position,
      route.loadout,
      branches,
      7,
    );
    expect(transition.branches).toBe(branches);
    expect(transition.keepsakeEquipResultCandidates.map((entry) => entry.key)).toEqual([
      semanticAddressKey(hammerResult),
    ]);
    expect(transition.findings).toEqual([
      expect.objectContaining({
        finding: expect.objectContaining({ code: 'keepsakeEquipResultMissing' }),
        chronology: { kind: 'history', sequence: 7, boundary: 'at' },
      }),
    ]);
    expect(transition.timelineFacts.nodes).toEqual([]);
    expect(transition.outcome).toBeUndefined();
  });

  it('replays an authored result and includes the replay Room Action', () => {
    const { route, snapshot, position } = routeG();
    const transition = applyEchoKeepsakeReplayTransition(
      catalog,
      {
        ...snapshot,
        echoKeepsakeReplayResults: {
          experimentalHammer: { kind: 'selected', traitKey: 'StaffLongAttackTrait' },
        },
      },
      position,
      route.loadout,
      [hammerGiftBranch(route)],
      0,
    );
    expect(transition.findings).toEqual([]);
    expect(transition.outcome).toEqual({
      capturedKeepsakeKey: 'TempHammerKeepsake',
      result: {
        kind: 'experimentalHammer',
        value: { kind: 'selected', traitKey: 'StaffLongAttackTrait' },
      },
    });
    expect(transition.timelineFacts.nodes).toEqual([{ owner: replayOwner, included: true }]);
    expect(
      transition.branches[0]?.state.traitHistory.equippedTraits.EchoRepeatKeepsakeBoon
        ?.echoKeepsakeReplayCount,
    ).toBe(1);
  });
});
