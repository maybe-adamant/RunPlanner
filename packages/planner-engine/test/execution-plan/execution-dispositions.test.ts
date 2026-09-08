import { describe, expect, it } from 'vitest';

import type { RoomActionReference } from '../../src/authored-project/model';
import type {
  ExecutionAcquisitionDisposition,
  ExecutionDoors,
  ExecutionOverview,
  ExecutionResourcePolicy,
  ExecutionRoomExitConformanceFactKind,
  ExecutionTimelineTransaction,
} from '../../src/execution-plan/model';

type ExecutionDisposition =
  'covered' | 'native-authoritative' | 'intentionally-omitted' | 'deferred-route';
type RoomActionKind = RoomActionReference['kind'];
type TimelineTransactionKind = ExecutionTimelineTransaction['kind'];
type AutomaticEffect = Extract<ExecutionTimelineTransaction, { kind: 'automatic' }>['effect'];
type OverviewField = keyof ExecutionOverview;
type ResourcePolicyField = Exclude<
  keyof ExecutionResourcePolicy['occurrences'][number],
  'occurrenceId'
>;
type DoorsKind = ExecutionDoors['kind'];

/**
 * Test-owned census of the planner semantics that can reach execution.  These
 * maps prove exhaustive ownership without becoming a runtime registry or
 * duplicating native callback names from the executor.
 */
const executionDispositions = {
  roomActions: {
    collectRequiredReward: 'native-authoritative',
    completeFieldsCage: 'deferred-route',
    interactIncomingReward: 'covered',
    interactLocalReward: 'deferred-route',
    chooseRewardWheel: 'deferred-route',
    interactWheelReward: 'deferred-route',
    interactShopOffer: 'covered',
    purchaseStygianWellOffer: 'covered',
    sellPurgingPoolTrait: 'intentionally-omitted',
    interactEncounter: 'covered',
    interactGorgon: 'covered',
    interactAcquisitionEntry: 'covered',
    useFountain: 'covered',
    interactKeepsakeRack: 'covered',
  } satisfies Record<RoomActionKind, ExecutionDisposition>,
  timelineTransactions: {
    acquisition: 'covered',
    encounterInteraction: 'covered',
    automatic: 'covered',
    shopPurchase: 'covered',
    wellPurchase: 'covered',
    wellRefill: 'covered',
    keepsakeChange: 'covered',
    keepsakeReplay: 'covered',
    fountainUse: 'covered',
  } satisfies Record<TimelineTransactionKind, ExecutionDisposition>,
  automaticEffects: {
    steadyGrowth: 'covered',
    transcendentEmbryo: 'covered',
    judgment: 'covered',
    crystalFigurine: 'covered',
  } satisfies Record<AutomaticEffect, ExecutionDisposition>,
  acquisitionDispositions: {
    normal: 'covered',
    artificer: 'covered',
  } satisfies Record<ExecutionAcquisitionDisposition, ExecutionDisposition>,
  overviewFields: {
    incomingReward: 'covered',
    effectNeutralRequiredReward: 'native-authoritative',
    unmodeledEncounterKeys: 'covered',
    encounterPhases: 'covered',
    requiredObjects: 'covered',
    shop: 'covered',
    hermesShrine: 'deferred-route',
    stygianWell: 'covered',
    purgingPool: 'covered',
    keepsakeRack: 'covered',
    fountain: 'covered',
    fields: 'covered',
    additional: 'covered',
    hub: 'covered',
    localSlots: 'covered',
  } satisfies Record<OverviewField, ExecutionDisposition>,
  resourcePolicy: {
    pointDispositions: 'covered',
  } satisfies Record<ResourcePolicyField, ExecutionDisposition>,
  doors: {
    batch: 'covered',
    fixed: 'covered',
    terminal: 'covered',
  } satisfies Record<DoorsKind, ExecutionDisposition>,
  roomExitConformance: {
    traitInventory: 'covered',
    elementCounts: 'covered',
    echoShopDuplicate: 'deferred-route',
    steadyGrowth: 'covered',
    chaos: 'covered',
    keepsakeEffects: 'covered',
    rewardPriorities: 'covered',
    pathOfStars: 'covered',
    forfeit: 'covered',
    hermesShrineDeliveries: 'deferred-route',
    stygianWell: 'covered',
  } satisfies Record<ExecutionRoomExitConformanceFactKind, ExecutionDisposition>,
} as const;

describe('execution semantic dispositions', () => {
  it('keeps every classified family explicit and test-owned', () => {
    expect(executionDispositions.roomActions.completeFieldsCage).toBe('deferred-route');
    expect(executionDispositions.overviewFields.effectNeutralRequiredReward).toBe(
      'native-authoritative',
    );
    expect(executionDispositions.roomExitConformance.hermesShrineDeliveries).toBe('deferred-route');
  });
});
