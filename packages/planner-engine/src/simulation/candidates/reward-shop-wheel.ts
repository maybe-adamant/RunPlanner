import { semanticAddressKey } from '../../authored-project/addresses';
import { type ProjectCommand } from '../../authored-project/commands/dispatch';
import type { ProjectDocument, RewardWheelState } from '../../authored-project/model';
import type { Catalog, RewardWheelOfferPoint } from '../../catalog-schema';
import type { CompleteHubProjectEvaluation, CompleteLinearProjectEvaluation } from '../project';
import type {
  BatchRewardStoreCandidateQuery,
  CandidateContextUnavailableReason,
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
} from './model';

import {
  applyCandidateCommand,
  evaluateCandidateBiome,
  failCandidate,
  immutableQuery,
  locateBiomePlan,
  locateCandidateBiome,
  locateCandidateLinear,
  locateLinearBiomePlan,
  type PreparedCandidateContext,
} from './context';

export function evaluateBatchRewardStoreCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: BatchRewardStoreCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as BatchRewardStoreCandidateQuery;
  const plan = locateLinearBiomePlan(project, stableQuery);
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
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  const selected = biome.rewards.storeSupport.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(stableQuery.rewardStore),
  );
  if (selected === undefined) {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: 'upstreamInvalid' });
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
    }),
  });
}

function rewardCommand(
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
): ProjectCommand {
  switch (query.kind) {
    case 'incomingReward':
      return { kind: 'ReplaceIncomingReward', reward: query.reward, value: query.value };
    case 'localReward':
      return { kind: 'ReplaceLocalReward', reward: query.reward, value: query.value };
    case 'shopOffer':
      return { kind: 'ReplaceShopOffer', offer: query.offer, value: query.value };
  }
}

function rewardFindings(
  evaluation: CompleteHubProjectEvaluation | CompleteLinearProjectEvaluation,
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
) {
  const address = query.kind === 'shopOffer' ? query.offer : query.reward;
  const exactKey = semanticAddressKey(address);
  return Object.freeze(
    evaluation.rewards.findings.filter((finding) => {
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

export function evaluateRewardCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as
    IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery;
  locateBiomePlan(project, stableQuery);
  const baseline = locateCandidateBiome(project, context, stableQuery);
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const proposal = applyCandidateCommand(catalog, project, stableQuery, rewardCommand(stableQuery));
  const biome = evaluateCandidateBiome(catalog, project, proposal, context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  if (biome.authoring === 'incomplete') {
    failCandidate(stableQuery, 'reward proposal made a complete biome incomplete');
  }
  const findings = rewardFindings(biome, stableQuery);
  const evidence = Object.freeze({
    candidate: stableQuery.value,
    relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
  });
  const support = findings.length === 0 ? ('possible' as const) : ('impossible' as const);
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
  project: ProjectDocument,
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
  const plan = locateLinearBiomePlan(project, query);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceAddress.occurrenceId,
  );
  if (occurrence?.state.kind !== 'shipCombat') {
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
  project: ProjectDocument,
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
  const ship = requireShipOccurrence(catalog, project, query);
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

function evaluateLinearMutation(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query:
    | RewardWheelOfferCandidateQuery
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelPickedCandidateQuery
    | RewardWheelStoreCandidateQuery
    | ShipEncounterCountCandidateQuery,
  command: ProjectCommand,
): CompleteLinearProjectEvaluation | CandidateContextUnavailableReason {
  const baseline = locateCandidateLinear(context, query);
  if (typeof baseline === 'string') {
    return baseline;
  }
  const proposal = applyCandidateCommand(catalog, project, query, command);
  const evaluation = evaluateCandidateBiome(catalog, project, proposal, context, query);
  if (typeof evaluation === 'string') {
    return evaluation;
  }
  if (evaluation.authoring === 'incomplete' || evaluation.kind !== 'LinearBiome') {
    failCandidate(query, 'ship proposal did not produce a complete linear biome');
  }
  return evaluation;
}

export function evaluateShipEncounterCountCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: ShipEncounterCountCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as ShipEncounterCountCandidateQuery;
  requireShipOccurrence(catalog, project, stableQuery);
  const evaluation = evaluateLinearMutation(catalog, project, context, stableQuery, {
    kind: 'ReplaceShipEncounterCount',
    occurrence: stableQuery.occurrence,
    encounterCount: stableQuery.encounterCount,
  });
  if (typeof evaluation === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: evaluation });
  }
  const selected = evaluation.roomGeneration.encounterCounts.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(stableQuery.occurrence),
  );
  if (selected === undefined) {
    failCandidate(stableQuery, 'ShipCombat occurrence has no encounter-count support');
  }
  const findings = Object.freeze(
    evaluation.findings.filter(
      (finding) =>
        finding.code !== 'encounterCountUnavailable' ||
        semanticAddressKey(finding.origin) === semanticAddressKey(stableQuery.occurrence),
    ),
  );
  const possible = selected.selectedPossible && findings.length === 0;
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
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: RewardWheelOfferCountCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelOfferCountCandidateQuery;
  const { descriptor } = requireRewardWheel(catalog, project, stableQuery);
  const evaluation = evaluateLinearMutation(catalog, project, context, stableQuery, {
    kind: 'ReplaceRewardWheelOfferCount',
    wheel: stableQuery.wheel,
    offerCount: stableQuery.offerCount,
  });
  if (typeof evaluation === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: evaluation });
  }
  const findings = evaluation.findings;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support:
      findings.length === 0
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
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: RewardWheelStoreCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelStoreCandidateQuery;
  const { descriptor } = requireRewardWheel(catalog, project, stableQuery);
  const evaluation = evaluateLinearMutation(catalog, project, context, stableQuery, {
    kind: 'ReplaceRewardWheelStore',
    wheel: stableQuery.wheel,
    storeKey: stableQuery.storeKey,
  });
  if (typeof evaluation === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: evaluation });
  }
  const findings = evaluation.findings;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support:
      findings.length === 0
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
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: RewardWheelOfferCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelOfferCandidateQuery;
  requireRewardWheel(catalog, project, stableQuery);
  const evaluation = evaluateLinearMutation(catalog, project, context, stableQuery, {
    kind: 'ReplaceRewardWheelOffer',
    offer: stableQuery.offer,
    value: stableQuery.value,
  });
  if (typeof evaluation === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: evaluation });
  }
  const exactKey = semanticAddressKey(stableQuery.offer);
  const findings = Object.freeze(
    evaluation.findings.filter((finding) => semanticAddressKey(finding.origin) === exactKey),
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      candidate: stableQuery.value,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

export function evaluateRewardWheelPickedCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: RewardWheelPickedCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RewardWheelPickedCandidateQuery;
  const { wheel } = requireRewardWheel(catalog, project, stableQuery);
  const evaluation = evaluateLinearMutation(catalog, project, context, stableQuery, {
    kind: 'ReplaceRewardWheelPicked',
    wheel: stableQuery.wheel,
    pickedOfferIndex: stableQuery.pickedOfferIndex,
  });
  if (typeof evaluation === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: evaluation });
  }
  const findings = evaluation.findings;
  const activeOfferIndexes = Object.freeze(
    Array.from({ length: wheel.offerCount }, (_, index) => index + 1),
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support:
      findings.length === 0
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
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: ShopPurchaseCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as ShopPurchaseCandidateQuery;
  locateBiomePlan(project, stableQuery);
  const baseline = locateCandidateBiome(project, context, stableQuery);
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const proposal = applyCandidateCommand(catalog, project, stableQuery, {
    kind: 'SetShopPurchase',
    purchase: stableQuery.purchase,
    purchased: stableQuery.purchased,
  });
  const biome = evaluateCandidateBiome(catalog, project, proposal, context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  if (biome.authoring === 'incomplete') {
    failCandidate(stableQuery, 'purchase proposal made a complete biome incomplete');
  }
  const exactKey = semanticAddressKey(stableQuery.purchase);
  const findings = Object.freeze(
    biome.rewards.findings.filter(
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
    support: findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      purchased: stableQuery.purchased,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}
