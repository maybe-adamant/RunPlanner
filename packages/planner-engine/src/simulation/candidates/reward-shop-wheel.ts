import { semanticAddressKey } from '../../authored-project/addresses';
import type { SemanticAddress } from '../../authored-project/addresses';
import type {
  OccurrenceId,
  RewardWheelState,
  ShipCombatState,
  ShopState,
} from '../../authored-project/model';
import type { Catalog, RewardWheelOfferPoint } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { SemanticFinding } from '../model';
import { rewardProducerFrontier } from '../rewards';
import type {
  BatchRewardStoreCandidateQuery,
  IncomingRewardCandidateQuery,
  LocalRewardCandidateQuery,
  ProjectCandidateEvaluation,
  RewardWheelOfferCandidateQuery,
  RewardWheelOfferCountCandidateQuery,
  RewardWheelPickedCandidateQuery,
  RewardWheelStoreCandidateQuery,
  ShipEncounterCountCandidateQuery,
  ShopOfferCandidateQuery,
  ShopPurchaseCandidateQuery,
  RewardCandidateExclusionEvidence,
} from './model';

import {
  coverageNotReached,
  failCandidate,
  immutableQuery,
  isCandidateContextUnavailable,
  locateCandidateBiome,
  locateCandidateLinear,
  locateIndexedOccurrence,
  locateIndexedLinearPlan,
  producerFrontierUnavailable,
  unavailableCandidate,
  type CandidateContextUnavailable,
  type CandidateHubBiomeEvaluation,
  type CandidateLinearBiomeEvaluation,
  type PreparedCandidateContext,
} from './context';

function evidenceString(finding: SemanticFinding, key: string): string | undefined {
  const value = finding.evidence[key];
  return typeof value === 'string' ? value : undefined;
}

function evidencePriorOffers(
  finding: SemanticFinding,
): readonly { readonly origin: SemanticAddress; readonly offer: ResolvedRewardOffer }[] {
  const value = finding.evidence.priorOffers;
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    value.flatMap((entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'origin' in entry &&
      typeof entry.origin === 'object' &&
      entry.origin !== null &&
      'kind' in entry.origin &&
      typeof entry.origin.kind === 'string' &&
      'offer' in entry &&
      typeof entry.offer === 'object' &&
      entry.offer !== null &&
      'rewardType' in entry.offer &&
      typeof entry.offer.rewardType === 'string'
        ? [
            Object.freeze({
              origin: entry.origin as SemanticAddress,
              offer: entry.offer as ResolvedRewardOffer,
            }),
          ]
        : [],
    ),
  );
}

function rewardExclusions(
  findings: readonly SemanticFinding[],
): readonly RewardCandidateExclusionEvidence[] {
  return Object.freeze(
    findings.flatMap((finding): readonly RewardCandidateExclusionEvidence[] => {
      const priorOffers = evidencePriorOffers(finding);
      const peerExclusions: readonly RewardCandidateExclusionEvidence[] =
        priorOffers.length === 0 ? [] : [Object.freeze({ kind: 'sibling', priorOffers })];
      switch (finding.code) {
        case 'baseRewardStoreUnavailable': {
          const storeKey =
            evidenceString(finding, 'storeKey') ?? evidenceString(finding, 'authoredStoreKey');
          return [
            ...peerExclusions,
            Object.freeze(storeKey === undefined ? { kind: 'store' } : { kind: 'store', storeKey }),
          ];
        }
        case 'rewardBagEntryUnavailable':
        case 'rewardBagSupportEmpty': {
          const storeKey = evidenceString(finding, 'storeKey');
          return [
            ...peerExclusions,
            Object.freeze(storeKey === undefined ? { kind: 'bag' } : { kind: 'bag', storeKey }),
          ];
        }
        case 'rewardSourceUnavailable': {
          const chosenSource = evidenceString(finding, 'chosenSource');
          const spurnedSource = evidenceString(finding, 'spurnedSource');
          if (chosenSource !== undefined || spurnedSource !== undefined) {
            return [
              ...peerExclusions,
              Object.freeze({
                kind: 'devotionPair',
                ...(chosenSource === undefined ? {} : { chosenSource }),
                ...(spurnedSource === undefined ? {} : { spurnedSource }),
              }),
            ];
          }
          const source = evidenceString(finding, 'source');
          return [
            ...peerExclusions,
            Object.freeze({
              kind: 'boonSource',
              ...(source === undefined ? {} : { source }),
            }),
          ];
        }
        case 'rewardPayloadInvalid':
          return [...peerExclusions, Object.freeze({ kind: 'payload' })];
        case 'shopOfferUnavailable':
        case 'shopPurchaseUnavailable':
          return [...peerExclusions, Object.freeze({ kind: 'shop' })];
        case 'rewardAcquisitionUnavailable':
          return [...peerExclusions, Object.freeze({ kind: 'acquisition' })];
        default:
          return peerExclusions;
      }
    }),
  );
}

export function evaluateBatchRewardStoreCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: BatchRewardStoreCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as BatchRewardStoreCandidateQuery;
  const plan = locateIndexedLinearPlan(context, stableQuery);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (
    layout?.kind !== 'LinearBiome' ||
    layout.continuation.rewardStorePolicy.kind !== 'authoredBaseStore' ||
    !layout.continuation.rewardStorePolicy.storeKeys.includes(stableQuery.storeKey)
  ) {
    failCandidate(stableQuery, `${stableQuery.storeKey} is outside the authored store domain`);
  }
  const continuation = plan.topology?.continuations.find(
    (candidate) =>
      candidate.kind === 'batch' &&
      candidate.parentOccurrenceId === stableQuery.rewardStore.parentOccurrenceId,
  );
  if (continuation?.kind !== 'batch' || continuation.rewardStore.kind !== 'authoredBaseStore') {
    failCandidate(stableQuery, 'semantic owner has no authored batch reward store');
  }
  const biome = locateCandidateLinear(context, stableQuery);
  if (isCandidateContextUnavailable(biome)) {
    return unavailableCandidate(stableQuery, biome);
  }
  const selected = context.index.batchRewardStoresByOwner.get(
    semanticAddressKey(stableQuery.rewardStore),
  );
  if (selected === undefined) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, biome));
  }
  const possible = selected.supportStoreKeys.includes(stableQuery.storeKey);
  const findings = possible
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({
          code: 'baseRewardStoreUnavailable' as const,
          severity: 'error' as const,
          phase: 'rewardGeneration' as const,
          origin: stableQuery.rewardStore,
          evidence: Object.freeze({
            authoredStoreKey: stableQuery.storeKey,
            enteredStoreCount: selected.enteredStoreCount,
            enteredMetaStoreCount: selected.enteredMetaStoreCount,
            currentMetaRatio: selected.currentMetaRatio,
            metaSelectionValue: selected.metaSelectionValue,
            supportStoreKeys: selected.supportStoreKeys,
          }),
        }),
      ]);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: possible
      ? selected.supportStoreKeys.length === 1
        ? 'forced'
        : 'possible'
      : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateStoreKey: stableQuery.storeKey,
      enteredStoreCount: selected.enteredStoreCount,
      enteredMetaStoreCount: selected.enteredMetaStoreCount,
      currentMetaRatio: selected.currentMetaRatio,
      metaSelectionValue: selected.metaSelectionValue,
      supportStoreKeys: selected.supportStoreKeys,
      exclusions: possible
        ? Object.freeze([])
        : Object.freeze([{ kind: 'store' as const, storeKey: stableQuery.storeKey }]),
    }),
  });
}

function rewardFindings(
  findings: readonly SemanticFinding[],
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
) {
  const address = query.kind === 'shopOffer' ? query.offer : query.reward;
  const exactKey = semanticAddressKey(address);
  return Object.freeze(
    findings.filter((finding) => {
      if (semanticAddressKey(finding.origin) === exactKey) {
        return true;
      }
      return (
        query.kind === 'shopOffer' &&
        finding.code === 'shopOfferUnavailable' &&
        finding.origin.kind === 'occurrence' &&
        finding.origin.routeKey === address.routeKey &&
        finding.origin.biomeKey === address.biomeKey &&
        finding.origin.occurrenceId === address.occurrenceId
      );
    }),
  );
}

function rewardOwnerCovered(
  evaluation: CandidateHubBiomeEvaluation | CandidateLinearBiomeEvaluation,
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
): boolean {
  const address = query.kind === 'shopOffer' ? query.offer : query.reward;
  const exactKey = semanticAddressKey(address);
  const exactRewardWitness =
    evaluation.rewards.findings.some(
      (finding) => semanticAddressKey(finding.origin) === exactKey,
    ) ||
    evaluation.rewards.branches.some((branch) =>
      branch.events.some((event) => semanticAddressKey(event.origin) === exactKey),
    );
  if (exactRewardWitness) {
    return true;
  }
  if (query.kind === 'shopOffer') {
    return evaluation.history.rooms.some(
      (room) =>
        room.origin.kind === 'occurrence' &&
        room.origin.occurrenceId === address.occurrenceId &&
        room.postCommit !== undefined,
    );
  }
  if (query.kind === 'localReward') {
    const localAddress = query.reward;
    return evaluation.history.events.some(
      (event) =>
        event.origin.kind === 'localChild' &&
        event.origin.routeKey === localAddress.routeKey &&
        event.origin.biomeKey === localAddress.biomeKey &&
        event.origin.occurrenceId === localAddress.occurrenceId &&
        event.origin.groupKey === localAddress.groupKey &&
        event.origin.slotKey === localAddress.slotKey,
    );
  }
  return evaluation.history.events.some(
    (event) =>
      event.origin.kind === 'occurrence' &&
      event.origin.routeKey === address.routeKey &&
      event.origin.biomeKey === address.biomeKey &&
      event.origin.occurrenceId === address.occurrenceId,
  );
}

function requireRewardCandidateOwner(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
): void {
  const address = query.kind === 'shopOffer' ? query.offer : query.reward;
  const { occurrence } = locateIndexedOccurrence(context, query, address.occurrenceId);
  switch (query.kind) {
    case 'incomingReward': {
      if (occurrence.state.kind === 'fixed') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        if (
          room?.incomingReward.kind !== 'fixed' ||
          query.value.rewardType !== room.incomingReward.offer.rewardType
        ) {
          failCandidate(query, `${occurrence.gameName} has a fixed reward type`);
        }
        return;
      }
      if (
        occurrence.state.kind !== 'counted' &&
        occurrence.state.kind !== 'freeReward' &&
        occurrence.state.kind !== 'ephyraCombat'
      ) {
        failCandidate(query, `${occurrence.gameName} has no replaceable counted reward`);
      }
      return;
    }
    case 'localReward': {
      if (occurrence.state.kind === 'fieldsCombat') {
        if (
          query.reward.groupKey !== 'cages' ||
          occurrence.state.cages[query.reward.slotKey] === undefined
        ) {
          failCandidate(
            query,
            `unknown local reward ${query.reward.groupKey}.${query.reward.slotKey}`,
          );
        }
        return;
      }
      if (occurrence.state.kind === 'ephyraCombat') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        const group = room?.localChildren.find(
          (child) => child.kind === 'fixedRoomSlots' && child.key === query.reward.groupKey,
        );
        if (
          group?.kind !== 'fixedRoomSlots' ||
          !group.slots.some((slot) => slot.slotKey === query.reward.slotKey) ||
          occurrence.state.sideRooms[query.reward.slotKey] === undefined
        ) {
          failCandidate(
            query,
            `unknown local reward ${query.reward.groupKey}.${query.reward.slotKey}`,
          );
        }
        return;
      }
      return failCandidate(query, `${occurrence.gameName} has no replaceable local reward group`);
    }
    case 'shopOffer':
      if (
        occurrence.state.kind !== 'shop' ||
        occurrence.state.shop?.offers[query.offer.offerKey] === undefined
      ) {
        failCandidate(query, `${occurrence.gameName} has no shop offer ${query.offer.offerKey}`);
      }
      return;
  }
}

export function evaluateRewardCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as
    IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery;
  requireRewardCandidateOwner(catalog, context, stableQuery);
  const baseline = locateCandidateBiome(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const address = stableQuery.kind === 'shopOffer' ? stableQuery.offer : stableQuery.reward;
  const frontier = rewardProducerFrontier(baseline.rewards, address);
  if (frontier === undefined) {
    if (!rewardOwnerCovered(baseline, stableQuery)) {
      return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
    }
    return unavailableCandidate(stableQuery, producerFrontierUnavailable(stableQuery));
  }
  const result = frontier.evaluateOffer(address, stableQuery.value);
  const ownerFindings = rewardFindings(result.findings, stableQuery);
  const findings =
    !result.supported && ownerFindings.length === 0 && frontier.generationPolicy !== 'sequential'
      ? result.findings
      : ownerFindings;
  const evidence = Object.freeze({
    candidate: stableQuery.value,
    relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    exclusions: rewardExclusions(findings),
  });
  const support =
    result.supported && findings.length === 0 ? ('possible' as const) : ('impossible' as const);
  switch (stableQuery.kind) {
    case 'incomingReward':
      return Object.freeze({
        context: 'evaluated',
        query: stableQuery,
        support,
        findings,
        evidence,
      });
    case 'localReward':
      return Object.freeze({
        context: 'evaluated',
        query: stableQuery,
        support,
        findings,
        evidence,
      });
    case 'shopOffer':
      return Object.freeze({
        context: 'evaluated',
        query: stableQuery,
        support,
        findings,
        evidence,
      });
  }
}

function requireShipOccurrence(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query:
    | RewardWheelOfferCandidateQuery
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelPickedCandidateQuery
    | RewardWheelStoreCandidateQuery
    | ShipEncounterCountCandidateQuery,
  occurrenceAddress = query.kind === 'shipEncounterCount'
    ? query.occurrence
    : {
        kind: 'occurrence' as const,
        routeKey: (query.kind === 'rewardWheelOffer' ? query.offer : query.wheel).routeKey,
        biomeKey: (query.kind === 'rewardWheelOffer' ? query.offer : query.wheel).biomeKey,
        occurrenceId: (query.kind === 'rewardWheelOffer' ? query.offer : query.wheel).occurrenceId,
      },
) {
  const occurrence = locateIndexedOccurrence(
    context,
    query,
    occurrenceAddress.occurrenceId,
  ).occurrence;
  if (occurrence.state.kind !== 'shipCombat') {
    failCandidate(query, 'semantic owner is not a ShipCombat room');
  }
  const room = catalog.rooms.byKey[occurrence.gameName];
  const profile = room && catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (room === undefined || profile?.key !== 'ShipCombat') {
    failCandidate(query, `${occurrence.gameName} has no ShipCombat encounter profile`);
  }
  return { occurrence, state: occurrence.state, profile };
}

function requireRewardWheel(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query:
    | RewardWheelOfferCandidateQuery
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelPickedCandidateQuery
    | RewardWheelStoreCandidateQuery,
): {
  readonly descriptor: RewardWheelOfferPoint;
  readonly wheel: RewardWheelState;
} {
  const address = query.kind === 'rewardWheelOffer' ? query.offer : query.wheel;
  const ship = requireShipOccurrence(catalog, context, query);
  const descriptor = ship.profile.phases.find(
    (phase) => phase.offerPoint?.key === address.wheelKey,
  )?.offerPoint;
  const wheel = ship.state.wheels[address.wheelKey];
  if (descriptor === undefined || wheel === undefined) {
    failCandidate(query, `${ship.occurrence.gameName} has no wheel ${address.wheelKey}`);
  }
  if (query.kind === 'rewardWheelOffer' && !descriptor.offerKeys.includes(query.offer.offerKey)) {
    failCandidate(query, `${address.wheelKey} has no offer ${query.offer.offerKey}`);
  }
  return { descriptor, wheel };
}

function requireShipLifecycleContext(
  context: PreparedCandidateContext,
  query:
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelPickedCandidateQuery
    | RewardWheelStoreCandidateQuery
    | ShipEncounterCountCandidateQuery,
  occurrenceId: OccurrenceId,
) {
  const baseline = locateCandidateLinear(context, query);
  if (isCandidateContextUnavailable(baseline)) {
    return baseline;
  }
  const occurrence = locateIndexedOccurrence(context, query, occurrenceId).occurrence;
  const candidateContext = context.index.shipLifecycleContextsByOwner.get(
    semanticAddressKey({
      kind: 'occurrence',
      routeKey:
        query.kind === 'shipEncounterCount' ? query.occurrence.routeKey : query.wheel.routeKey,
      biomeKey:
        query.kind === 'shipEncounterCount' ? query.occurrence.biomeKey : query.wheel.biomeKey,
      occurrenceId: occurrence.occurrenceId,
    }),
  );
  if (candidateContext === undefined) {
    return coverageNotReached(query, baseline);
  }
  return { baseline, candidateContext, occurrence };
}

function replaceWheel(
  state: ShipCombatState,
  wheelKey: string,
  wheel: RewardWheelState,
): ShipCombatState {
  return Object.freeze({
    ...state,
    wheels: Object.freeze({ ...state.wheels, [wheelKey]: Object.freeze(wheel) }),
  });
}

function lifecycleFindings(
  findings: readonly SemanticFinding[],
  owner:
    | RewardWheelOfferCountCandidateQuery['wheel']
    | RewardWheelPickedCandidateQuery['wheel']
    | RewardWheelStoreCandidateQuery['wheel'],
): readonly SemanticFinding[] {
  const roomKey = semanticAddressKey({
    kind: 'occurrence',
    routeKey: owner.routeKey,
    biomeKey: owner.biomeKey,
    occurrenceId: owner.occurrenceId,
  });
  return Object.freeze(
    findings.filter(
      (finding) =>
        semanticAddressKey(finding.origin) === semanticAddressKey(owner) ||
        ('occurrenceId' in finding.origin &&
          semanticAddressKey({
            kind: 'occurrence',
            routeKey: finding.origin.routeKey,
            biomeKey: finding.origin.biomeKey,
            occurrenceId: finding.origin.occurrenceId,
          }) === roomKey),
    ),
  );
}

function encounterCountFinding(
  query: ShipEncounterCountCandidateQuery,
  beforeSequence: number,
  supportEncounterCounts: readonly number[],
): SemanticFinding {
  return Object.freeze({
    code: 'encounterCountUnavailable',
    severity: 'error',
    phase: 'roomGeneration',
    origin: query.occurrence,
    evidence: Object.freeze({
      beforeSequence,
      selectedEncounterCount: query.encounterCount,
      supportEncounterCounts,
    }),
  });
}

function requireActiveWheel(
  query:
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelPickedCandidateQuery
    | RewardWheelStoreCandidateQuery,
  activeWheelKeys: readonly string[],
  baseline: CandidateLinearBiomeEvaluation,
): CandidateContextUnavailable | undefined {
  if (!activeWheelKeys.includes(query.wheel.wheelKey)) {
    return coverageNotReached(query, baseline);
  }
  return undefined;
}

export function evaluateShipEncounterCountCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: ShipEncounterCountCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as ShipEncounterCountCandidateQuery;
  if (stableQuery.encounterCount !== 2 && stableQuery.encounterCount !== 3) {
    failCandidate(stableQuery, 'encounterCount must be 2 or 3');
  }
  const ship = requireShipOccurrence(catalog, context, stableQuery);
  const prepared = requireShipLifecycleContext(
    context,
    stableQuery,
    stableQuery.occurrence.occurrenceId,
  );
  if (isCandidateContextUnavailable(prepared)) {
    return unavailableCandidate(stableQuery, prepared);
  }
  const selected = context.index.encounterCountsByOwner.get(
    semanticAddressKey(stableQuery.occurrence),
  );
  if (selected === undefined) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, prepared.baseline));
  }
  const structurallyPossible = selected.supportEncounterCounts.includes(stableQuery.encounterCount);
  const rewardResult = structurallyPossible
    ? prepared.candidateContext.evaluateState(
        Object.freeze({ ...ship.state, encounterCount: stableQuery.encounterCount }),
      )
    : undefined;
  const findings = Object.freeze([
    ...(structurallyPossible
      ? []
      : [
          encounterCountFinding(
            stableQuery,
            selected.beforeSequence,
            selected.supportEncounterCounts,
          ),
        ]),
    ...(rewardResult?.findings ?? []),
  ]);
  const possible =
    structurallyPossible && rewardResult?.supported === true && findings.length === 0;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: possible
      ? selected.supportEncounterCounts.length === 1
        ? 'forced'
        : 'possible'
      : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateEncounterCount: stableQuery.encounterCount,
      beforeSequence: selected.beforeSequence,
      supportEncounterCounts: selected.supportEncounterCounts,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

export function evaluateRewardWheelOfferCountCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: RewardWheelOfferCountCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelOfferCountCandidateQuery;
  const { descriptor, wheel } = requireRewardWheel(catalog, context, stableQuery);
  if (
    !Number.isInteger(stableQuery.offerCount) ||
    stableQuery.offerCount < descriptor.offerCount.min ||
    stableQuery.offerCount > descriptor.offerCount.max
  ) {
    failCandidate(
      stableQuery,
      `offerCount must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
    );
  }
  const ship = requireShipOccurrence(catalog, context, stableQuery);
  const prepared = requireShipLifecycleContext(
    context,
    stableQuery,
    stableQuery.wheel.occurrenceId,
  );
  if (isCandidateContextUnavailable(prepared)) {
    return unavailableCandidate(stableQuery, prepared);
  }
  const inactive = requireActiveWheel(
    stableQuery,
    prepared.candidateContext.activeWheelKeys,
    prepared.baseline,
  );
  if (inactive !== undefined) {
    return unavailableCandidate(stableQuery, inactive);
  }
  const result = prepared.candidateContext.evaluateState(
    replaceWheel(ship.state, stableQuery.wheel.wheelKey, {
      ...wheel,
      offerCount: stableQuery.offerCount,
      pickedOfferIndex: Math.min(wheel.pickedOfferIndex, stableQuery.offerCount),
    }),
  );
  const findings = lifecycleFindings(result.findings, stableQuery.wheel);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support:
      result.supported && findings.length === 0
        ? descriptor.offerCount.min === descriptor.offerCount.max
          ? 'forced'
          : 'possible'
        : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateOfferCount: stableQuery.offerCount,
      minimumOfferCount: descriptor.offerCount.min,
      maximumOfferCount: descriptor.offerCount.max,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

export function evaluateRewardWheelStoreCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: RewardWheelStoreCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelStoreCandidateQuery;
  const { descriptor, wheel } = requireRewardWheel(catalog, context, stableQuery);
  if (!descriptor.reward.storeKeys.includes(stableQuery.storeKey)) {
    failCandidate(
      stableQuery,
      `${stableQuery.storeKey} is not available from ${stableQuery.wheel.wheelKey}`,
    );
  }
  const ship = requireShipOccurrence(catalog, context, stableQuery);
  const prepared = requireShipLifecycleContext(
    context,
    stableQuery,
    stableQuery.wheel.occurrenceId,
  );
  if (isCandidateContextUnavailable(prepared)) {
    return unavailableCandidate(stableQuery, prepared);
  }
  const inactive = requireActiveWheel(
    stableQuery,
    prepared.candidateContext.activeWheelKeys,
    prepared.baseline,
  );
  if (inactive !== undefined) {
    return unavailableCandidate(stableQuery, inactive);
  }
  const result = prepared.candidateContext.evaluateState(
    replaceWheel(ship.state, stableQuery.wheel.wheelKey, {
      ...wheel,
      storeKey: stableQuery.storeKey,
    }),
  );
  const findings = lifecycleFindings(result.findings, stableQuery.wheel);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support:
      result.supported && findings.length === 0
        ? descriptor.reward.storeKeys.length === 1
          ? 'forced'
          : 'possible'
        : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateStoreKey: stableQuery.storeKey,
      supportedStoreKeys: descriptor.reward.storeKeys,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

export function evaluateRewardWheelOfferCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: RewardWheelOfferCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelOfferCandidateQuery;
  requireRewardWheel(catalog, context, stableQuery);
  const baseline = locateCandidateLinear(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const frontier = rewardProducerFrontier(baseline.rewards, stableQuery.offer);
  if (frontier === undefined) {
    const ownerCovered = baseline.history.rooms.some(
      (room) =>
        room.origin.kind === 'occurrence' &&
        room.origin.occurrenceId === stableQuery.offer.occurrenceId &&
        room.offerPoints?.some(
          (offerPoint) => offerPoint.offerPoint === stableQuery.offer.wheelKey,
        ) === true,
    );
    if (!ownerCovered) {
      return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
    }
    return unavailableCandidate(stableQuery, producerFrontierUnavailable(stableQuery));
  }
  const exactKey = semanticAddressKey(stableQuery.offer);
  const result = frontier.evaluateOffer(stableQuery.offer, stableQuery.value);
  const ownerFindings = Object.freeze(
    result.findings.filter((finding) => semanticAddressKey(finding.origin) === exactKey),
  );
  const findings =
    !result.supported && ownerFindings.length === 0 ? result.findings : ownerFindings;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: result.supported && findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      candidate: stableQuery.value,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
      exclusions: rewardExclusions(findings),
    }),
  });
}

export function evaluateRewardWheelPickedCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: RewardWheelPickedCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelPickedCandidateQuery;
  const { wheel } = requireRewardWheel(catalog, context, stableQuery);
  if (
    !Number.isInteger(stableQuery.pickedOfferIndex) ||
    stableQuery.pickedOfferIndex < 1 ||
    stableQuery.pickedOfferIndex > wheel.offerCount
  ) {
    failCandidate(stableQuery, 'pickedOfferIndex must address an active offer');
  }
  const ship = requireShipOccurrence(catalog, context, stableQuery);
  const prepared = requireShipLifecycleContext(
    context,
    stableQuery,
    stableQuery.wheel.occurrenceId,
  );
  if (isCandidateContextUnavailable(prepared)) {
    return unavailableCandidate(stableQuery, prepared);
  }
  const inactive = requireActiveWheel(
    stableQuery,
    prepared.candidateContext.activeWheelKeys,
    prepared.baseline,
  );
  if (inactive !== undefined) {
    return unavailableCandidate(stableQuery, inactive);
  }
  const result = prepared.candidateContext.evaluateState(
    replaceWheel(ship.state, stableQuery.wheel.wheelKey, {
      ...wheel,
      pickedOfferIndex: stableQuery.pickedOfferIndex,
    }),
  );
  const findings = lifecycleFindings(result.findings, stableQuery.wheel);
  const activeOfferIndexes = Object.freeze(
    Array.from({ length: wheel.offerCount }, (_, index) => index + 1),
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support:
      result.supported && findings.length === 0
        ? activeOfferIndexes.length === 1
          ? 'forced'
          : 'possible'
        : 'impossible',
    findings,
    evidence: Object.freeze({
      candidatePickedOfferIndex: stableQuery.pickedOfferIndex,
      activeOfferIndexes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

export function evaluateShopPurchaseCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: ShopPurchaseCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as ShopPurchaseCandidateQuery;
  if (typeof stableQuery.purchased !== 'boolean') {
    failCandidate(stableQuery, 'purchased must be a boolean');
  }
  const { occurrence } = locateIndexedOccurrence(
    context,
    stableQuery,
    stableQuery.purchase.occurrenceId,
  );
  if (
    occurrence.state.kind !== 'shop' ||
    occurrence.state.shop?.offers[stableQuery.purchase.offerKey] === undefined
  ) {
    failCandidate(
      stableQuery,
      `${occurrence.gameName} has no shop purchase ${stableQuery.purchase.offerKey}`,
    );
  }
  const baseline = locateCandidateBiome(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const purchaseRoomCovered = baseline.history.rooms.some(
    (room) =>
      room.origin.kind === 'occurrence' &&
      room.origin.occurrenceId === stableQuery.purchase.occurrenceId &&
      room.postCommit !== undefined,
  );
  if (!purchaseRoomCovered) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
  }
  const candidateContext = context.index.shopPurchaseContextsByOwner.get(
    semanticAddressKey(stableQuery.purchase),
  );
  if (candidateContext === undefined) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
  }
  const shop = occurrence.state.shop;
  const selectedOffer = shop.offers[stableQuery.purchase.offerKey]!;
  const candidateState: ShopState = Object.freeze({
    ...shop,
    offers: Object.freeze({
      ...shop.offers,
      [stableQuery.purchase.offerKey]: Object.freeze({
        ...selectedOffer,
        purchased: stableQuery.purchased,
      }),
    }),
  });
  const result = candidateContext.evaluateState(candidateState);
  const exactKey = semanticAddressKey(stableQuery.purchase);
  const findings = Object.freeze(
    result.findings.filter(
      (finding) =>
        semanticAddressKey(finding.origin) === exactKey ||
        (finding.code === 'shopPurchaseUnavailable' &&
          finding.origin.kind === 'occurrence' &&
          finding.origin.routeKey === stableQuery.purchase.routeKey &&
          finding.origin.biomeKey === stableQuery.purchase.biomeKey &&
          finding.origin.occurrenceId === stableQuery.purchase.occurrenceId),
    ),
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: result.supported && findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      purchased: stableQuery.purchased,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}
