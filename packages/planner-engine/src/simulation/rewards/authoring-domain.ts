import {
  createBiomeAddress,
  semanticAddressKey,
  type IncomingRewardAddress,
  type LocalRewardAddress,
  type RewardWheelOfferAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredBiomePlan,
  ExitDecision,
  ProjectDocument,
  RoomOccurrence,
  RouteLoadout,
} from '../../authored-project/model';
import { legalTopologyOccurrenceRoom } from '../../authored-project/topology/room-ownership';
import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel';
import { finalSharedBatchStoreKey, orderedTargets } from '../materialization/batch';
import { materializeShipCombatState } from '../materialization/rooms';
import type { RewardProducerCandidateCapability } from './producer-frontiers';

export type CountedRewardOwnerAddress =
  IncomingRewardAddress | LocalRewardAddress | RewardWheelOfferAddress;

export class RewardAuthoringDomainContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'RewardAuthoringDomainContractError';
  }
}

function fail(detail: string): never {
  throw new RewardAuthoringDomainContractError(detail);
}

function planFor(project: ProjectDocument, owner: CountedRewardOwnerAddress): AuthoredBiomePlan {
  const plan =
    project.route.routeKey === owner.routeKey
      ? project.route.biomes.find((biome) => biome.biomeKey === owner.biomeKey)
      : undefined;
  if (plan === undefined) {
    fail(`reward producer ${semanticAddressKey(owner)} has no authored biome`);
  }
  return plan;
}

function occurrenceFor(plan: AuthoredBiomePlan, owner: CountedRewardOwnerAddress): RoomOccurrence {
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === owner.occurrenceId,
  );
  if (occurrence === undefined) {
    fail(`reward producer ${semanticAddressKey(owner)} has no authored occurrence`);
  }
  return occurrence;
}

function declarationFor(
  catalog: Catalog,
  plan: AuthoredBiomePlan,
  occurrence: RoomOccurrence,
  owner: CountedRewardOwnerAddress,
): RoomDeclaration {
  const layout = catalog.biomeLayouts.byKey[owner.biomeKey];
  const topology = plan.topology;
  const declaration =
    layout === undefined || topology === null
      ? undefined
      : legalTopologyOccurrenceRoom(catalog, layout, topology, occurrence.occurrenceId);
  if (declaration === undefined) {
    fail(`reward producer ${semanticAddressKey(owner)} has no room declaration`);
  }
  return declaration;
}

function sourceOfferPointStoreKey(
  catalog: Catalog,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
  owner: IncomingRewardAddress,
  loadout: RouteLoadout,
): string | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  switch (decision.normal.rewardStore.kind) {
    case 'authoredBaseStore':
      return decision.normal.rewardStore.baseRewardStoreKey ?? undefined;
    case 'none':
      return undefined;
    case 'sourceOfferPoint': {
      if (decision.source.kind !== 'occurrence') {
        fail(`reward producer ${semanticAddressKey(owner)} has no authored offer-point source`);
      }
      const sourceOccurrenceId = decision.source.occurrenceId;
      const source = plan.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === sourceOccurrenceId,
      );
      if (source === undefined) {
        fail(`reward producer ${semanticAddressKey(owner)} lost its offer-point source`);
      }
      const declaration = declarationFor(catalog, plan, source, owner);
      const wheel = materializeShipCombatState(
        catalog,
        createBiomeAddress(owner.routeKey, owner.biomeKey),
        declaration,
        source,
        loadout,
      ).rewardWheels.at(-1);
      if (wheel === undefined) {
        fail(`reward producer ${semanticAddressKey(owner)} has no active source offer point`);
      }
      return wheel.storeKey;
    }
  }
}

function incomingStoreKey(
  catalog: Catalog,
  plan: AuthoredBiomePlan,
  occurrence: RoomOccurrence,
  declaration: RoomDeclaration,
  owner: IncomingRewardAddress,
  loadout: RouteLoadout,
): string | undefined {
  const topology = plan.topology;
  const creatingDecision = topology?.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      decision.normal.targets.some((target) => target.occurrenceId === occurrence.occurrenceId),
  );
  if (creatingDecision?.normal.kind !== 'batch' || topology === null) {
    return declaration.forcedRewardStoreKey ?? declaration.individualRewardStoreKey;
  }
  const occurrences = new Map(
    topology.occurrences.map((candidate) => [candidate.occurrenceId, candidate] as const),
  );
  const sharedStore = finalSharedBatchStoreKey(
    catalog,
    occurrences,
    orderedTargets(creatingDecision.normal.targets),
    sourceOfferPointStoreKey(catalog, plan, creatingDecision, owner, loadout),
  );
  return declaration.forcedRewardStoreKey ?? declaration.individualRewardStoreKey ?? sharedStore;
}

function localStoreKey(
  declaration: RoomDeclaration,
  owner: LocalRewardAddress,
): string | undefined {
  if (owner.groupKey === declaration.fieldsOptionalRewards?.key) {
    if (!declaration.fieldsOptionalRewards.slotKeys.includes(owner.slotKey)) {
      fail(`reward producer ${semanticAddressKey(owner)} has no optional reward slot`);
    }
    return 'FieldsOptionalRewards';
  }
  const descriptor = declaration.localChildren.find((child) => child.key === owner.groupKey);
  if (descriptor?.kind === 'boundedRewardSlots') {
    if (!descriptor.slotKeys.includes(owner.slotKey)) {
      fail(`reward producer ${semanticAddressKey(owner)} has no bounded reward slot`);
    }
    return declaration.individualRewardStoreKey;
  }
  fail(`reward producer ${semanticAddressKey(owner)} has no local reward declaration`);
}

function authoredStoreKey(
  catalog: Catalog,
  project: ProjectDocument,
  owner: CountedRewardOwnerAddress,
): string | undefined {
  const plan = planFor(project, owner);
  const route = project.route.routeKey === owner.routeKey ? project.route : undefined;
  if (route === undefined)
    fail(`reward producer ${semanticAddressKey(owner)} has no authored route`);
  const occurrence = occurrenceFor(plan, owner);
  const declaration = declarationFor(catalog, plan, occurrence, owner);
  switch (owner.kind) {
    case 'incomingReward':
      return incomingStoreKey(catalog, plan, occurrence, declaration, owner, route.loadout);
    case 'localReward':
      return localStoreKey(declaration, owner);
    case 'rewardWheelOffer': {
      if (occurrence.state.kind !== 'shipCombat') {
        fail(`reward producer ${semanticAddressKey(owner)} has no authored reward wheel`);
      }
      const wheel = occurrence.state.wheels[owner.wheelKey];
      if (wheel === undefined || wheel.offers[owner.offerKey] === undefined) {
        fail(`reward producer ${semanticAddressKey(owner)} has no authored wheel offer`);
      }
      return wheel.storeKey;
    }
  }
}

/**
 * Returns the declaration-ordered reward-type domain for one exact counted
 * producer. This is a synchronous authoring fact and never evaluates reward
 * candidates.
 */
export function resolveCountedRewardTypeDomain(
  catalog: Catalog,
  project: ProjectDocument,
  owner: CountedRewardOwnerAddress,
  binding: CountedRewardBinding,
  evaluatedProducer: RewardProducerCandidateCapability | undefined,
): readonly string[] {
  const storeKey =
    evaluatedProducer === undefined
      ? authoredStoreKey(catalog, project, owner)
      : (evaluatedProducer.resolvedStoreKey ??
        fail(`evaluated reward producer ${semanticAddressKey(owner)} has no resolved store`));
  if (storeKey === undefined || !binding.storeKeys.includes(storeKey)) {
    fail(`reward producer ${semanticAddressKey(owner)} has no resolved declaration-owned store`);
  }
  const store = catalog.rewards.stores.byKey[storeKey];
  if (store === undefined) {
    fail(`reward producer ${semanticAddressKey(owner)} resolved unknown store ${storeKey}`);
  }
  const seen = new Set<string>();
  const rewardTypes = store.entries.flatMap((entry) => {
    if (!binding.allowedRewardTypes.includes(entry.rewardType) || seen.has(entry.rewardType)) {
      return [];
    }
    seen.add(entry.rewardType);
    return [entry.rewardType];
  });
  if (rewardTypes.length === 0) {
    fail(`reward producer store ${storeKey} has no selectable reward types`);
  }
  return Object.freeze(rewardTypes);
}
