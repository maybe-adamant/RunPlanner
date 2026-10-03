import { expect, it } from 'vitest';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  hermesShrineDeliveryEntryKey,
  clockedTraitGeneratedPickupEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
} from '../../../../src/authored-project';
import {
  assessReachedHermesDeliveryPlacement,
  assessReachedClockedPickupPlacement,
} from '../../../../src/simulation/rewards/acquisition/generated-pickup-placement';
import { initializeTestRewardBranches } from '../../../support/arcana-fear';
import type { RewardBranchState } from '../../../../src/simulation/rewards/branch-primitives';
import type { DerivedAcquisitionEntryFrontier } from '../../../../src/simulation/rewards/acquisition/contracts';

const biome = createBiomeAddress('Surface', 'O');
const host = createOccurrenceAddress(biome, createOccurrenceId('host'));
const source = createOccurrenceAddress(biome, createOccurrenceId('source'));
const reference = {
  kind: 'interactAcquisitionEntry' as const,
  siteKey: 'hermesShrineDelivery',
  entryKey: hermesShrineDeliveryEntryKey(source, 'initial:first'),
  encounterPhaseKey: 'combat1',
};
const seed = initializeTestRewardBranches()[0]!;
function delivery(
  dueAt = host,
  dueEncounterPhaseKey: string | null = 'combat1',
): RewardBranchState {
  return {
    ...seed,
    state: {
      ...seed.state,
      pendingHermesShrineDeliveries: {
        [reference.entryKey]: {
          sourceKey: reference.entryKey,
          sourceOrigin: source,
          generationKey: 'initial:first',
          rewardType: 'HealBigDrop',
          remainingUses: 0,
          dueAt,
          ...(dueEncounterPhaseKey === null ? {} : { dueEncounterPhaseKey }),
        },
      },
    },
  };
}
it('requires universal reached rejection and distinguishes exact Hermes host and phase from payload', () => {
  const assess = (branches: readonly RewardBranchState[]) =>
    assessReachedHermesDeliveryPlacement(host, reference, branches, 9).assessment.kind;
  expect(assess([])).toBe('unassessed');
  expect(assess([delivery()])).toBe('valid');
  expect(assess([delivery(source)])).toBe('invalid');
  expect(assess([delivery(host, 'combat2')])).toBe('invalid');
  expect(assess([delivery(), delivery(source)])).toBe('unassessed');
  expect(assess([seed])).toBe('invalid');
  expect(
    assessReachedHermesDeliveryPlacement(
      host,
      { kind: reference.kind, siteKey: reference.siteKey, entryKey: reference.entryKey },
      [delivery(host, null)],
      9,
    ).assessment.kind,
  ).toBe('valid');
});
it('matches clocked evidence to each branch maturity instead of temporally accumulated cohort sizes', () => {
  const clocked = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: 'roomExit',
    entryKey: clockedTraitGeneratedPickupEntryKey('sourceIdentity', 'pomSlice1'),
    encounterPhaseKey: 'combat1',
  };
  const event = {
    kind: 'pickupProducerProgress' as const,
    owner: host,
    acquisitionRole: 'pickupProducer' as const,
    sequence: 7,
    acquisitionPoint: 'encounterEndEffectsApplied' as const,
    traitKey: 'TestTrait',
    acquisitionIdentity: 'sourceIdentity',
    oldProgress: 1,
    newProgress: 0,
    requiredInterval: 2,
    matured: true,
  };
  const branch = {
    ...seed,
    state: {
      ...seed.state,
      traitHistory: {
        ...seed.state.traitHistory,
        events: [...seed.state.traitHistory.events, event],
      },
    },
  };
  const frontier: DerivedAcquisitionEntryFrontier = {
    address: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'roomExit'),
      clocked.entryKey,
    ),
    kind: 'clockedTraitPickup',
    historySequence: 7,
    branchCohortSize: 2,
    rewardTypes: ['StackUpgrade'],
    encounterPhaseKey: 'combat1',
    branchesBeforeEntry: [branch],
  };
  const assess = (
    branches: readonly RewardBranchState[],
    frontiers: readonly DerivedAcquisitionEntryFrontier[],
  ) => assessReachedClockedPickupPlacement(host, clocked, branches, frontiers, 9).assessment.kind;
  expect(assess([], [])).toBe('unassessed');
  expect(assess([branch], [])).toBe('unassessed');
  expect(assess([branch], [frontier])).toBe('valid');
  expect(assess([branch], [{ ...frontier, encounterPhaseKey: 'combat2' }])).toBe('invalid');
  expect(assess([branch], [{ ...frontier, historySequence: 6 }])).toBe('unassessed');
  expect(assess([branch, seed], [frontier])).toBe('unassessed');
  expect(assess([seed], [frontier])).toBe('invalid');
});
