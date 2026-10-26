import { catalog } from '@run-planner/hades2-catalog';
import {
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  type AuthoredTraitOffer,
} from '@run-planner/engine/authored-project';
import { foldTraitHistoryEvents } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { goldenFBiome, goldenFStartId } from '@run-planner/test-fixtures/underworld';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { withTestEncounterRecord } from '../support/simulation-state';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { applyEncounterEndEffectsTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import { replaceSimulationTraitHistory } from '../../src/simulation/state/transitions';
import { createKeepsakeState } from '../../src/simulation/keepsakes/state';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';

const landing = createOccurrenceAddress(goldenFBiome, goldenFStartId);
const room = {
  kind: 'authored',
  origin: landing,
  occurrenceId: landing.occurrenceId,
  gameName: 'F_Opening01',
  encounters: {},
  encounterPhases: [
    {
      slotKey: 'Encounter',
      envelopeKey: 'SingleEncounter',
      authoredChoiceKey: 'OpeningGeneratedF',
      figLeafSkip: false,
    },
  ],
} as unknown as CanonicalAuthoredRoom;

function sourcePhase(id: string) {
  return createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId(id) },
    'Encounter',
  );
}

function offer(
  giverKey: string,
  traitKeys: readonly [string, string, string],
  steadyGrowthTargets?: Readonly<Record<string, string>>,
): AuthoredTraitOffer {
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(traitKeys.map((traitKey) => ({ traitKey, rarity: 'Common' }))),
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
    ...(steadyGrowthTargets === undefined ? {} : { steadyGrowthTargets }),
  }) as unknown as AuthoredTraitOffer;
}

function acquire(
  branch: RewardBranchState,
  id: string,
  value: AuthoredTraitOffer,
  sequence: number,
): RewardBranchState {
  return settleEncounterTraitOffer(
    catalog,
    branch,
    sourcePhase(id),
    value,
    sequence,
    'encounterCompleted',
    undefined,
    'selection',
    undefined,
    {},
  ).branch;
}

/** Runs encounter ends at the landing room until one reaches an interval. */
function untilInterval(branch: RewardBranchState, firstSequence: number) {
  let branches: readonly RewardBranchState[] = [branch];
  for (let sequence = firstSequence; sequence < firstSequence + 12; sequence += 1) {
    const transition = applyEncounterEndEffectsTransition(
      catalog,
      Object.freeze({
        kind: 'encounterEndEffectsApplied' as const,
        origin: landing,
        phaseKey: 'Encounter',
        execution: 'normal' as const,
        figLeafSkipOwner: false,
        operationIndex: 1,
        sequence,
      }),
      room,
      branches.map((candidate) =>
        withTestEncounterRecord(candidate, room, 'Encounter', 'OpeningGeneratedF'),
      ),
    );
    if (transition.steadyGrowthThresholds.length > 0)
      return Object.freeze({ transition, sequence });
    branches = transition.branches;
  }
  throw new Error('Steady Growth never reached its interval');
}

describe('Steady Growth outcomes by source and cycle', () => {
  it('reads each instance’s targets from the offer that gave it, counting cycles per source', () => {
    let branch = initializeTestRewardBranches()[0]!;
    branch = acquire(
      branch,
      'apollo',
      offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']),
      1,
    );
    branch = acquire(
      branch,
      'first-source',
      offer('Demeter', ['BoonGrowthBoon', 'DemeterCastBoon', 'DemeterSprintBoon'], {
        '1': 'ApolloWeaponBoon',
        '2': 'ApolloWeaponBoon',
      }),
      3,
    );
    const first = untilInterval(branch, 10);
    const firstSource = createTraitOfferAddress(sourcePhase('first-source'), 'selection');
    expect(first.transition.steadyGrowthThresholds.map(({ address }) => address)).toEqual([
      createSteadyGrowthOutcomeAddress(firstSource, 1),
    ]);
    expect(first.transition.steadyGrowthThresholds[0]?.landing).toEqual({
      owner: landing,
      phaseKey: 'Encounter',
    });
    expect(first.transition.findings).toEqual([]);
    const promoted = first.transition.branches[0]!;
    expect(promoted.state.traitHistory.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Rare');

    // The same Steady Growth's second interval reads its second cycle.
    const second = untilInterval(promoted, first.sequence + 1);
    expect(second.transition.steadyGrowthThresholds.map(({ address }) => address)).toEqual([
      createSteadyGrowthOutcomeAddress(firstSource, 2),
    ]);
    expect(
      second.transition.branches[0]!.state.traitHistory.equippedTraits.ApolloWeaponBoon?.rarity,
    ).toBe('Epic');

    // A later Steady Growth from another offer starts its own cycles with its own targets.
    const sold = second.transition.branches[0]!;
    const removed = Object.freeze({
      ...sold,
      state: replaceSimulationTraitHistory(
        sold.state,
        foldTraitHistoryEvents(catalog, [
          ...sold.state.traitHistory.events,
          Object.freeze({
            kind: 'traitRemoval' as const,
            owner: landing,
            acquisitionRole: 'purgingPoolSale',
            sequence: second.sequence,
            acquisitionPoint: 'test',
            traitKey: 'BoonGrowthBoon',
            match: 'currentTraitKey' as const,
          }),
        ]),
      ),
    });
    const reacquired = acquire(
      removed,
      'second-source',
      offer('Demeter', ['BoonGrowthBoon', 'DemeterCastBoon', 'DemeterSprintBoon'], {
        '1': 'ApolloWeaponBoon',
      }),
      second.sequence + 1,
    );
    const third = untilInterval(reacquired, second.sequence + 2);
    expect(third.transition.steadyGrowthThresholds.map(({ address }) => address)).toEqual([
      createSteadyGrowthOutcomeAddress(
        createTraitOfferAddress(sourcePhase('second-source'), 'selection'),
        1,
      ),
    ]);
    expect(
      third.transition.branches[0]!.state.traitHistory.equippedTraits.ApolloWeaponBoon?.rarity,
    ).toBe('Heroic');
  });

  it('reports a reached cycle its source does not author as missing at that address', () => {
    let branch = initializeTestRewardBranches()[0]!;
    branch = acquire(
      branch,
      'apollo',
      offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']),
      1,
    );
    branch = acquire(
      branch,
      'source',
      offer('Demeter', ['BoonGrowthBoon', 'DemeterCastBoon', 'DemeterSprintBoon'], {
        '2': 'ApolloWeaponBoon',
      }),
      2,
    );
    const reached = untilInterval(branch, 10);
    expect(reached.transition.branches).toEqual([]);
    expect(reached.transition.findings).toMatchObject([
      {
        finding: {
          code: 'steadyGrowthOutcomeMissing',
          origin: createSteadyGrowthOutcomeAddress(
            createTraitOfferAddress(sourcePhase('source'), 'selection'),
            1,
          ),
        },
        chronology: { kind: 'history', occurrence: landing },
      },
    ]);
  });

  it('grows a Steady Growth gained as the Concave Stone residual from its source offer', () => {
    const initial = initializeTestRewardBranches()[0]!;
    const withStone = Object.freeze({
      ...initial,
      state: Object.freeze({
        ...initial.state,
        keepsakes: createKeepsakeState(catalog, 'UnpickedBoonKeepsake'),
      }),
    });
    const apollo = acquire(
      withStone,
      'apollo',
      offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']),
      1,
    );
    const residualOffer = (targets: Readonly<Record<string, string>>) =>
      Object.freeze({
        ...offer('Demeter', ['DemeterCastBoon', 'DemeterSprintBoon', 'BoonGrowthBoon'], targets),
        concaveStoneResult: Object.freeze({ kind: 'proc', optionKey: 'option3' }),
      }) as unknown as AuthoredTraitOffer;
    const source = createTraitOfferAddress(sourcePhase('stone-source'), 'selection');

    const branch = acquire(apollo, 'stone-source', residualOffer({ '1': 'ApolloWeaponBoon' }), 3);
    expect(branch.state.traitHistory.equippedTraits.BoonGrowthBoon).toBeDefined();
    const reached = untilInterval(branch, 10);
    expect(reached.transition.steadyGrowthThresholds.map(({ address }) => address)).toEqual([
      createSteadyGrowthOutcomeAddress(source, 1),
    ]);
    expect(reached.transition.findings).toEqual([]);
    expect(
      reached.transition.branches[0]!.state.traitHistory.equippedTraits.ApolloWeaponBoon?.rarity,
    ).toBe('Rare');

    const unauthored = untilInterval(acquire(apollo, 'stone-source', residualOffer({}), 3), 10);
    expect(unauthored.transition.findings).toMatchObject([
      {
        finding: {
          code: 'steadyGrowthOutcomeMissing',
          origin: createSteadyGrowthOutcomeAddress(source, 1),
        },
        chronology: { kind: 'history', occurrence: landing },
      },
    ]);
  });
});
