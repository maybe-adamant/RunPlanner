import {
  countedRewardTypeDomain,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  type ProjectCandidateQuery,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type EncounterPhaseAddress,
  type ExitDecisionAddress,
  type HubDecisionAddress,
  type HubSlotAddress,
  type LocalVisitOrderAddress,
  type LocalVisitSlotAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type RewardWheelAddress,
  type SideRoomGeneration,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import type {
  CandidateOptionProjection,
  CandidateProjectionSession,
  EncounterCandidateProjectionEvaluation,
  RewardCandidateOwner,
  CountedRewardCandidateOwner,
} from './candidateProjection';
import { domainKey, offerKey, type CandidateProjectionCore } from './candidateProjectionSession';
import {
  prepareRewardDomain,
  projectRewardDomain,
  rewardDomainOffers,
  type PreparedRewardDomain,
  type ProjectedRewardDomain,
} from './rewardDomainProjection';
export interface RewardDomainCache {
  readonly rewardTypeDomainCache: WeakMap<
    ProjectEvaluationAssembly,
    Map<string, readonly string[]>
  >;
  readonly preparedRewardDomainCache: Map<string, PreparedRewardDomain>;
  readonly pendingRewardDomains: WeakMap<
    ProjectEvaluationAssembly,
    Map<string, Promise<ProjectedRewardDomain>>
  >;
}

function rewardQueries(
  owner: RewardCandidateOwner,
  offers: readonly ResolvedRewardOffer[],
): readonly ProjectCandidateQuery[] {
  switch (owner.kind) {
    case 'incomingReward':
      return offers.map((value) => ({ kind: 'incomingReward', reward: owner.address, value }));
    case 'localReward':
      return offers.map((value) => ({ kind: 'localReward', reward: owner.address, value }));
    case 'rewardWheelOffer':
      return offers.map((value) => ({ kind: 'rewardWheelOffer', offer: owner.address, value }));
    case 'shopOffer':
      return offers.map((value) => ({ kind: 'shopOffer', offer: owner.address, value }));
    case 'acquisitionEntry':
      return offers.map((value) => ({
        kind: 'acquisitionEntryOffer',
        entry: owner.address,
        value,
      }));
  }
}

function prepareCachedRewardDomain(
  core: CandidateProjectionCore,
  cache: RewardDomainCache,
  rewardTypes: readonly string[],
  selected?: ResolvedRewardOffer,
): PreparedRewardDomain {
  const key = domainKey([
    ...rewardTypes,
    selected === undefined ? '__unresolved__' : offerKey(selected),
  ]);
  const existing = cache.preparedRewardDomainCache.get(key);
  if (existing !== undefined) return existing;
  const prepared = prepareRewardDomain(core.catalog, rewardTypes, selected);
  cache.preparedRewardDomainCache.set(key, prepared);
  return prepared;
}

function countedRewardTypesFor(
  core: CandidateProjectionCore,
  cache: RewardDomainCache,
  owner: CountedRewardCandidateOwner,
  binding: CountedRewardBinding,
  selectedRewardType?: string,
): readonly string[] {
  let projectCache = cache.rewardTypeDomainCache.get(core.assembly);
  if (projectCache === undefined) {
    projectCache = new Map();
    cache.rewardTypeDomainCache.set(core.assembly, projectCache);
  }
  const selectable = countedRewardTypeDomain(core.catalog, core.assembly, owner.address, binding);
  const key = `reward-types:${semanticAddressKey(owner.address)}:${domainKey(selectable)}:${selectedRewardType ?? '__unresolved__'}`;
  const existing = projectCache.get(key);
  if (existing !== undefined) return existing;
  const domain =
    selectedRewardType === undefined || selectable.includes(selectedRewardType)
      ? selectable
      : Object.freeze([...selectable, selectedRewardType]);
  projectCache.set(key, domain);
  return domain;
}

function rewardDomainFor(
  core: CandidateProjectionCore,
  cache: RewardDomainCache,
  owner: RewardCandidateOwner,
  rewardTypes: readonly string[],
  selected?: ResolvedRewardOffer,
): Promise<ProjectedRewardDomain> {
  const prepared = prepareCachedRewardDomain(core, cache, rewardTypes, selected);
  const offers = rewardDomainOffers(prepared);
  const candidateKey = `reward-domain:${semanticAddressKey(owner.address)}:${domainKey(offers.map(offerKey))}`;
  const pendingKey = `${candidateKey}:selected:${selected === undefined ? '__unresolved__' : offerKey(selected)}`;
  let projectPending = cache.pendingRewardDomains.get(core.assembly);
  if (projectPending === undefined) {
    projectPending = new Map();
    cache.pendingRewardDomains.set(core.assembly, projectPending);
  }
  const existing = projectPending.get(pendingKey);
  if (existing !== undefined) return existing;
  const pending = core
    .projectOptionsCooperatively(candidateKey, offers, rewardQueries(owner, offers))
    .then((candidates) => projectRewardDomain(prepared, candidates))
    .finally(() => {
      projectPending?.delete(pendingKey);
    });
  projectPending.set(pendingKey, pending);
  return pending;
}

function startRoomsFor(
  core: CandidateProjectionCore,
  owner: BiomeAddress | OccurrenceAddress,
  rooms: readonly RoomDeclaration[],
) {
  return core.projectOptions(
    `start:${semanticAddressKey(owner)}:${domainKey(rooms.map((room) => room.gameName))}`,
    rooms,
    rooms.map((room) => ({ kind: 'startRoom', owner, gameName: room.gameName })),
  );
}

function roomTargetsFor(
  core: CandidateProjectionCore,
  target: TargetAddress,
  rooms: readonly RoomDeclaration[],
) {
  return core.projectOptions(
    `target:${semanticAddressKey(target)}:${domainKey(rooms.map((room) => room.gameName))}`,
    rooms,
    rooms.map((room) => ({ kind: 'roomTarget', target, gameName: room.gameName })),
  );
}

function encounterPhasesFor(
  core: CandidateProjectionCore,
  phase: EncounterPhaseAddress,
  encounterKeys: readonly string[],
): readonly CandidateOptionProjection<string, EncounterCandidateProjectionEvaluation>[] {
  const key = `encounter:${semanticAddressKey(phase)}:${domainKey(encounterKeys)}`;
  return core.memoizeOptions(key, () => {
    const support = encounterPhaseCandidateSupportForProjectEvaluationAssembly(
      core.assembly,
      phase,
    );
    const candidateKeys = support?.candidateEncounterKeys ?? [];
    const projected = Object.freeze(
      encounterKeys.map((encounterKey) => {
        const result =
          support === undefined
            ? Object.freeze({
                evidence: Object.freeze({ kind: 'coverageUnavailable' as const }),
                support: 'unavailable' as const,
              })
            : !support.activationSatisfied
              ? Object.freeze({
                  evidence: Object.freeze({ kind: 'inactiveSlot' as const }),
                  support: 'impossible' as const,
                })
              : candidateKeys.includes(encounterKey)
                ? Object.freeze({
                    evidence: Object.freeze({ kind: 'supported' as const }),
                    support: (candidateKeys.length === 1 ? 'forced' : 'possible') as
                      'forced' | 'possible',
                  })
                : Object.freeze({
                    evidence: Object.freeze({ kind: 'requirementsExcluded' as const }),
                    support: 'impossible' as const,
                  });
        return Object.freeze({
          value: encounterKey,
          evaluation: Object.freeze({
            kind: 'encounter' as const,
            result,
          }),
        });
      }),
    );
    return projected;
  });
}

export type RewardRoomCandidateAdapters = Pick<
  CandidateProjectionSession,
  | 'prepareRewardDomain'
  | 'countedRewardTypes'
  | 'rewardDomain'
  | 'startRooms'
  | 'roomTargets'
  | 'encounterPhases'
  | 'batchRewardStores'
  | 'fieldsCageOutcomes'
  | 'takeoverPrebossBatches'
  | 'hubTerminalTakeover'
  | 'shipCombatPhaseCounts'
  | 'rewardWheelOfferCounts'
  | 'rewardWheelStores'
  | 'rewardWheelPicks'
  | 'hubSlots'
  | 'hubVisitOrders'
  | 'localVisitGenerations'
  | 'localVisitOrders'
>;

export function createRewardRoomCandidateAdapters(
  core: CandidateProjectionCore,
  cache: RewardDomainCache,
): RewardRoomCandidateAdapters {
  return {
    prepareRewardDomain: (rewardTypes, selected) =>
      prepareCachedRewardDomain(core, cache, rewardTypes, selected),
    countedRewardTypes: (owner, binding, selectedRewardType) =>
      countedRewardTypesFor(core, cache, owner, binding, selectedRewardType),
    rewardDomain: (owner, rewardTypes, selected) =>
      rewardDomainFor(core, cache, owner, rewardTypes, selected),
    startRooms: (owner, rooms) => startRoomsFor(core, owner, rooms),
    roomTargets: (target, rooms) => roomTargetsFor(core, target, rooms),
    encounterPhases: (phase, encounterKeys) => encounterPhasesFor(core, phase, encounterKeys),
    batchRewardStores: (rewardStore, storeKeys) =>
      core.projectOptions(
        `store:${semanticAddressKey(rewardStore)}:${domainKey(storeKeys)}`,
        storeKeys,
        storeKeys.map((storeKey) => ({ kind: 'batchRewardStore', rewardStore, storeKey })),
      ),
    fieldsCageOutcomes: (decision, outcomes) =>
      core.projectOptions(
        `fields:${semanticAddressKey(decision)}:${domainKey(outcomes)}`,
        outcomes,
        outcomes.map((cageOutcome) => ({ kind: 'fieldsCageOutcome', decision, cageOutcome })),
      ),
    shipCombatPhaseCounts: (occurrence, values) =>
      core.projectOptions(
        `ship-encounters:${semanticAddressKey(occurrence)}:${domainKey(values.map(String))}`,
        values,
        values.map((encounterCount) => ({
          kind: 'shipEncounterCount',
          occurrence,
          encounterCount,
        })),
      ),
    rewardWheelOfferCounts: (wheel, values) =>
      core.projectOptions(
        `wheel-count:${semanticAddressKey(wheel)}:${domainKey(values.map(String))}`,
        values,
        values.map((offerCount) => ({ kind: 'rewardWheelOfferCount', wheel, offerCount })),
      ),
    rewardWheelStores: (wheel, storeKeys) =>
      core.projectOptions(
        `wheel-store:${semanticAddressKey(wheel)}:${domainKey(storeKeys)}`,
        storeKeys,
        storeKeys.map((storeKey) => ({ kind: 'rewardWheelStore', wheel, storeKey })),
      ),
    rewardWheelPicks: (wheel, values) =>
      core.projectOptions(
        `wheel-pick:${semanticAddressKey(wheel)}:${domainKey(values.map(String))}`,
        values,
        values.map((pickedOfferIndex) => ({ kind: 'rewardWheelPicked', wheel, pickedOfferIndex })),
      ),
    hubSlots: (slot, occurrenceId, localOccurrenceIdsBySlot, values) =>
      core.projectOptions(
        `hub-slot:${semanticAddressKey(slot)}:${occurrenceId}:${domainKey(
          Object.entries(localOccurrenceIdsBySlot)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([slotKey, localOccurrenceId]) => `${slotKey}:${localOccurrenceId}`),
        )}:${domainKey(values.map(String))}`,
        values,
        values.map((open) => ({
          kind: 'hubSlot',
          slot,
          open,
          occurrenceId,
          localOccurrenceIdsBySlot,
        })),
      ),
    hubVisitOrders: (hub, values) =>
      core.projectOptions(
        `hub-visit-order:${semanticAddressKey(hub)}:${domainKey(
          values.map((value) => JSON.stringify(value)),
        )}`,
        values,
        values.map((hubSlotKeys) => ({ kind: 'hubVisitOrder', hub, hubSlotKeys })),
      ),
    localVisitGenerations: (sideRoom, values) =>
      core.projectOptions(
        `side-generation:${semanticAddressKey(sideRoom)}:${domainKey(values)}`,
        values,
        values.map((generation) => ({ kind: 'sideRoomGeneration', sideRoom, generation })),
      ),
    localVisitOrders: (group, values) =>
      core.projectOptions(
        `side-entry-order:${semanticAddressKey(group)}:${domainKey(
          values.map((value) => JSON.stringify(value)),
        )}`,
        values,
        values.map((occurrenceIds) => ({ kind: 'sideRoomEntryOrder', group, occurrenceIds })),
      ),
    takeoverPrebossBatches: (source, gameNames) =>
      core.projectOptions(
        `takeover:${semanticAddressKey(source)}:${domainKey(gameNames)}`,
        gameNames,
        gameNames.map((gameName) => ({ kind: 'takeoverPrebossBatch', source, gameName })),
      ),
    hubTerminalTakeover: (source) => {
      const [candidate] = core.projectOptions(
        `hub-takeover:${semanticAddressKey(source)}`,
        Object.freeze([source]),
        Object.freeze([{ kind: 'hubTerminalTakeover' as const, source }]),
      );
      if (candidate === undefined) {
        throw new Error(`Hub terminal candidate ${semanticAddressKey(source)} is missing`);
      }
      return candidate;
    },
  };
}
