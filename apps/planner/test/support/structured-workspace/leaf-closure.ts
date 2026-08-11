import {
  createLocalChildGroupAddress,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';

import {
  assertExactObservedDestination,
  observedInteractionOwnerKey,
  type ObservedOwnedInteraction,
} from './closure-primitives';
import type {
  ExpectedWorkspaceLeafInteractionKind,
  ExpectedWorkspaceLeafRequirement,
} from './expected-leaves';
import type { ObservedWorkspaceProducts } from './observed-workspace';
import { workspaceTestOwnerKey } from './test-keys';

function leafInteraction(
  observed: ObservedWorkspaceProducts,
  kind: ExpectedWorkspaceLeafInteractionKind,
  key: string,
): ObservedOwnedInteraction | undefined {
  switch (kind) {
    case 'encounterPhase':
      return observed.interactions.encounterPhases.get(key);
    case 'reward':
      return observed.interactions.rewards.get(key);
    case 'rewardWheelOfferCount':
      return observed.interactions.rewardWheelOfferCounts.get(key);
    case 'rewardWheelPick':
      return observed.interactions.rewardWheelPicks.get(key);
    case 'rewardWheelStore':
      return observed.interactions.rewardWheelStores.get(key);
    case 'shipCombatPhaseCount':
      return observed.interactions.shipCombatPhaseCounts.get(key);
    case 'acquisitionOrder':
      return observed.interactions.acquisitionOrders.get(key);
    case 'sideRoomEntryOrder':
      return observed.interactions.sideRoomEntryOrders.get(key);
    case 'sideRoomGeneration':
      return observed.interactions.sideRoomGenerations.get(key);
    case 'levelResolution':
      return observed.interactions.levelResolutions.get(key);
    case 'traitOffer':
      return observed.interactions.traitOffers.get(key);
  }
}

function leafInteractionLabel(kind: ExpectedWorkspaceLeafInteractionKind): string {
  switch (kind) {
    case 'encounterPhase':
      return 'encounter phase';
    case 'acquisitionOrder':
      return 'acquisition order';
    case 'shipCombatPhaseCount':
      return 'Ship combat-phase count';
    case 'traitOffer':
      return 'trait offer';
    case 'levelResolution':
      return 'level resolution';
    default:
      return kind;
  }
}

function leafInteractionOwner(
  kind: ExpectedWorkspaceLeafInteractionKind,
  address: SemanticAddress,
): SemanticAddress {
  if (kind === 'sideRoomEntryOrder' && address.kind === 'localChild') {
    return createLocalChildGroupAddress(
      { biomeKey: address.biomeKey, kind: 'biome', routeKey: address.routeKey },
      address.occurrenceId,
      address.groupKey,
    );
  }
  return address;
}

/** Close independent editable-leaf identities over typed public products. */
export function assertExpectedWorkspaceLeafClosure(input: {
  readonly expected: readonly ExpectedWorkspaceLeafRequirement[];
  readonly observed: ObservedWorkspaceProducts;
}): void {
  for (const requirement of input.expected) {
    const key = workspaceTestOwnerKey(requirement.address);
    const marker = input.observed.markersByOwner.get(key);
    if (marker === undefined) {
      throw new Error(`${key} required authored leaf has no workspace marker`);
    }
    if (workspaceTestOwnerKey(marker.address) !== key) {
      throw new Error(`${key} required authored leaf resolves to a conflicting workspace marker`);
    }
    assertExactObservedDestination(
      requirement.address,
      input.observed,
      'required authored leaf',
      true,
    );
    for (const expectedInteraction of requirement.interactions) {
      const interaction = leafInteraction(
        input.observed,
        expectedInteraction.kind,
        expectedInteraction.key,
      );
      if (interaction === undefined) {
        throw new Error(
          `authored ${leafInteractionLabel(expectedInteraction.kind)} leaf ${key} has no exact workspace interaction`,
        );
      }
      if (
        interaction.key !== expectedInteraction.key ||
        observedInteractionOwnerKey(interaction) !==
          workspaceTestOwnerKey(leafInteractionOwner(expectedInteraction.kind, requirement.address))
      ) {
        throw new Error(
          `authored ${leafInteractionLabel(expectedInteraction.kind)} leaf ${key} has a conflicting workspace interaction`,
        );
      }
    }
  }
}
