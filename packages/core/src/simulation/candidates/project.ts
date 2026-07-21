import type { Catalog } from '../../catalog';
import { semanticAddressKey, type SemanticAddress } from '../../project/addresses';
import { applyProjectCommand, type ProjectCommand } from '../../project/commands';
import type { LinearBiomePlan, ProjectDocument } from '../../project/model';
import type { ResolvedRewardOffer } from '../../rewardKernel/model';
import {
  evaluateLinearRoomTargetCandidate,
  type LinearForcePressureLedgerEntry,
} from '../generation';
import type {
  BiomeProjectEvaluation,
  CompleteLinearProjectEvaluation,
  ProjectEvaluation,
  ProjectRouteEvaluation,
  ProjectSimulationScope,
} from '../project';
import { assertProjectEvaluationSource, evaluateLinearBiome, simulateProject } from '../project';
import type {
  CandidateContextUnavailableReason,
  CandidateSupport,
  BatchRewardStoreCandidateQuery,
  BiomeFieldCandidateQuery,
  FieldsCageOutcomeCandidateQuery,
  IncomingRewardCandidateQuery,
  LocalRewardCandidateQuery,
  ProjectCandidateEvaluation,
  ProjectCandidateEvaluator,
  ProjectCandidateQuery,
  RoomTargetCandidateEvidence,
  RoomTargetCandidateQuery,
  ShopOfferCandidateQuery,
  ShopPurchaseCandidateQuery,
  StartRoomCandidateQuery,
} from './model';

type CandidateAddress = Exclude<SemanticAddress, { readonly kind: 'project' | 'route' }>;

function queryAddress(query: ProjectCandidateQuery): CandidateAddress {
  switch (query.kind) {
    case 'biomeField':
      return query.field;
    case 'startRoom':
      return query.owner;
    case 'roomTarget':
      return query.target;
    case 'batchRewardStore':
      return query.rewardStore;
    case 'incomingReward':
      return query.reward;
    case 'localReward':
      return query.reward;
    case 'fieldsCageOutcome':
      return query.continuation;
    case 'shopOffer':
      return query.offer;
    case 'shopPurchase':
      return query.purchase;
  }
}

export class CandidateEvaluationContractError extends Error {
  readonly queryKind: ProjectCandidateQuery['kind'];
  readonly targetKey: string;
  readonly detail: string;

  constructor(query: ProjectCandidateQuery, detail: string) {
    const targetKey = semanticAddressKey(queryAddress(query));
    super(`${query.kind} at ${targetKey}: ${detail}`);
    this.name = 'CandidateEvaluationContractError';
    this.queryKind = query.kind;
    this.targetKey = targetKey;
    this.detail = detail;
  }
}

function failCandidate(query: ProjectCandidateQuery, detail: string): never {
  throw new CandidateEvaluationContractError(query, detail);
}

function immutableOffer(value: ResolvedRewardOffer): ResolvedRewardOffer {
  return Object.freeze({
    rewardType: value.rewardType,
    ...(value.payload === undefined ? {} : { payload: Object.freeze({ ...value.payload }) }),
  });
}

function immutableQuery(query: ProjectCandidateQuery): ProjectCandidateQuery {
  switch (query.kind) {
    case 'biomeField':
      return Object.freeze({ ...query, field: Object.freeze({ ...query.field }) });
    case 'startRoom':
      return Object.freeze({ ...query, owner: Object.freeze({ ...query.owner }) });
    case 'roomTarget':
      return Object.freeze({ ...query, target: Object.freeze({ ...query.target }) });
    case 'batchRewardStore':
      return Object.freeze({ ...query, rewardStore: Object.freeze({ ...query.rewardStore }) });
    case 'incomingReward':
      return Object.freeze({
        ...query,
        reward: Object.freeze({ ...query.reward }),
        value: immutableOffer(query.value),
      });
    case 'localReward':
      return Object.freeze({
        ...query,
        reward: Object.freeze({ ...query.reward }),
        value: immutableOffer(query.value),
      });
    case 'fieldsCageOutcome':
      return Object.freeze({
        ...query,
        continuation: Object.freeze({ ...query.continuation }),
      });
    case 'shopOffer':
      return Object.freeze({
        ...query,
        offer: Object.freeze({ ...query.offer }),
        value: immutableOffer(query.value),
      });
    case 'shopPurchase':
      return Object.freeze({ ...query, purchase: Object.freeze({ ...query.purchase }) });
  }
}

function locateBiomePlan(project: ProjectDocument, query: ProjectCandidateQuery): LinearBiomePlan {
  const address = queryAddress(query);
  const route = project.routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (route === undefined) {
    failCandidate(query, `project has no route ${address.routeKey}`);
  }
  const biome = route.biomes.find((candidate) => candidate.biomeKey === address.biomeKey);
  if (biome === undefined) {
    failCandidate(query, `project has no configured biome ${address.biomeKey}`);
  }
  if (biome.kind !== 'LinearBiome') {
    failCandidate(query, `${address.biomeKey} does not use linear candidate evaluation`);
  }
  return biome;
}

function targetExists(project: ProjectDocument, query: RoomTargetCandidateQuery): boolean {
  const topology = locateBiomePlan(project, query).topology;
  if (topology === null) {
    failCandidate(query, 'biome topology has not been started');
  }
  const continuation = topology.continuations.find(
    (candidate) => candidate.parentOccurrenceId === query.target.parentOccurrenceId,
  );
  if (continuation?.kind !== 'batch') {
    failCandidate(query, 'target parent does not own an ordinary generated batch');
  }
  return continuation.targets.some((candidate) => candidate.exitIndex === query.target.exitIndex);
}

function assertCandidateExists(catalog: Catalog, query: RoomTargetCandidateQuery): void {
  const room = catalog.rooms.byKey[query.gameName];
  if (room === undefined) {
    failCandidate(query, `catalog has no room ${query.gameName}`);
  }
  if (room.biomeKey !== query.target.biomeKey) {
    failCandidate(query, `${query.gameName} belongs to biome ${room.biomeKey}`);
  }
}

function requireRoute(
  routes: readonly ProjectRouteEvaluation[],
  query: ProjectCandidateQuery,
): ProjectRouteEvaluation {
  const address = queryAddress(query);
  const route = routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (route === undefined) {
    failCandidate(query, `simulation has no route ${address.routeKey}`);
  }
  return route;
}

function unavailableReason(
  route: ProjectRouteEvaluation,
  query: ProjectCandidateQuery,
): CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const { horizon } = route;
  if (horizon.kind === 'incomplete') {
    return horizon.biomeKey === address.biomeKey ? 'biomeIncomplete' : 'upstreamIncomplete';
  }
  if (horizon.kind === 'invalid') {
    return 'upstreamInvalid';
  }
  if (horizon.kind === 'simulatorBoundary') {
    return 'simulatorUnavailable';
  }
  failCandidate(query, 'simulation omitted the candidate biome without a processing horizon');
}

function locateCompleteLinear(
  route: ProjectRouteEvaluation,
  query: ProjectCandidateQuery,
): CompleteLinearProjectEvaluation | CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const evaluation = route.biomes.find((candidate) => candidate.biomeKey === address.biomeKey);
  if (evaluation === undefined) {
    return unavailableReason(route, query);
  }
  if (evaluation.completion === 'incomplete') {
    return 'biomeIncomplete';
  }
  return evaluation;
}

interface PreparedCandidateContext {
  readonly projectEvaluation: ProjectEvaluation;
}

function locateCandidateLinear(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CompleteLinearProjectEvaluation | CandidateContextUnavailableReason {
  const route = requireRoute(context.projectEvaluation.routes, query);
  return locateCompleteLinear(route, query);
}

function support(pressure: LinearForcePressureLedgerEntry): CandidateSupport {
  if (!pressure.selectedPossible) {
    return 'impossible';
  }
  return pressure.requiredForcedRoomGameNames.length > 0 ? 'forced' : 'possible';
}

function evidence(pressure: LinearForcePressureLedgerEntry): RoomTargetCandidateEvidence {
  return Object.freeze({
    beforeSequence: pressure.beforeSequence,
    sourceGameName: pressure.sourceGameName,
    candidateGameName: pressure.selectedGameName,
    exitIndex: pressure.exitIndex,
    biomeDepthCache: pressure.biomeDepthCache,
    biomeEncounterDepth: pressure.biomeEncounterDepth,
    candidateCreationCount: pressure.selectedCreationCount,
    candidateAppearanceCount: pressure.selectedAppearanceCount,
    candidateParentCreationCount: pressure.selectedParentCreationCount,
    eligibleRoomGameNames: pressure.eligibleRoomGameNames,
    optionalForcedRoomGameNames: pressure.optionalForcedRoomGameNames,
    requiredForcedRoomGameNames: pressure.requiredForcedRoomGameNames,
    supportRoomGameNames: pressure.supportRoomGameNames,
    exclusionReasons: pressure.selectedExclusionReasons,
  });
}

function evaluateRoomTargetCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: RoomTargetCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RoomTargetCandidateQuery;
  const authoredTargetExists = targetExists(project, stableQuery);
  assertCandidateExists(catalog, stableQuery);
  const route = requireRoute(context.projectEvaluation.routes, stableQuery);
  const biome = locateCandidateLinear(context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  if (!authoredTargetExists) {
    failCandidate(stableQuery, `exit ${stableQuery.target.exitIndex} has no authored target`);
  }

  const enteredBiomeCount = route.configuredBiomeKeys.indexOf(stableQuery.target.biomeKey) + 1;
  if (enteredBiomeCount <= 0) {
    failCandidate(stableQuery, `${stableQuery.target.biomeKey} is not configured on the route`);
  }
  const candidate = evaluateLinearRoomTargetCandidate(
    catalog,
    biome.snapshot,
    biome.history,
    stableQuery.target,
    stableQuery.gameName,
    enteredBiomeCount,
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: support(candidate.pressure),
    findings: candidate.findings,
    evidence: evidence(candidate.pressure),
  });
}

function evaluateStartRoomCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  query: StartRoomCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as StartRoomCandidateQuery;
  const plan = locateBiomePlan(project, stableQuery);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
    failCandidate(stableQuery, `${plan.biomeKey} has no authored start candidate domain`);
  }
  const room = catalog.rooms.byKey[stableQuery.gameName];
  if (room === undefined || room.biomeKey !== plan.biomeKey) {
    failCandidate(stableQuery, `catalog has no ${plan.biomeKey} room ${stableQuery.gameName}`);
  }
  if (stableQuery.owner.kind === 'occurrence') {
    if (
      plan.topology === null ||
      plan.topology.startOccurrenceId !== stableQuery.owner.occurrenceId
    ) {
      failCandidate(stableQuery, 'occurrence owner is not the authored biome start');
    }
  }
  const supported = layout.start.roomGameNames;
  const possible = supported.includes(stableQuery.gameName);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: possible ? (supported.length === 1 ? 'forced' : 'possible') : 'impossible',
    findings: Object.freeze([]),
    evidence: Object.freeze({
      candidateGameName: stableQuery.gameName,
      supportedGameNames: supported,
    }),
  });
}

function evaluateBatchRewardStoreCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: BatchRewardStoreCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as BatchRewardStoreCandidateQuery;
  const plan = locateBiomePlan(project, stableQuery);
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
    failCandidate(stableQuery, 'reward store has no simulation support entry');
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

function applyCandidateCommand(
  catalog: Catalog,
  project: ProjectDocument,
  query: ProjectCandidateQuery,
  command: ProjectCommand,
): ProjectDocument {
  try {
    return applyProjectCommand(project, catalog, command);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    failCandidate(query, `candidate proposal is malformed: ${detail}`);
  }
}

function rewardFindings(
  evaluation: CompleteLinearProjectEvaluation,
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

function evaluateCandidateBiome(
  catalog: Catalog,
  project: ProjectDocument,
  proposal: ProjectDocument,
  context: PreparedCandidateContext,
  query:
    | BiomeFieldCandidateQuery
    | FieldsCageOutcomeCandidateQuery
    | IncomingRewardCandidateQuery
    | LocalRewardCandidateQuery
    | ShopOfferCandidateQuery
    | ShopPurchaseCandidateQuery,
): BiomeProjectEvaluation | CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const baselineRoute = requireRoute(context.projectEvaluation.routes, query);
  const baselineBiome = locateCandidateLinear(context, query);
  if (typeof baselineBiome === 'string') {
    return baselineBiome;
  }

  const route = proposal.routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (route === undefined) {
    failCandidate(query, `candidate proposal has no route ${address.routeKey}`);
  }
  const biomeIndex = route.biomes.findIndex((candidate) => candidate.biomeKey === address.biomeKey);
  const plan = route.biomes[biomeIndex];
  if (biomeIndex < 0 || plan === undefined) {
    failCandidate(query, `candidate proposal has no configured biome ${address.biomeKey}`);
  }
  if (plan.kind !== 'LinearBiome') {
    failCandidate(query, `${address.biomeKey} does not use linear candidate evaluation`);
  }

  const previous = biomeIndex === 0 ? undefined : baselineRoute.biomes[biomeIndex - 1];
  if (previous?.completion === 'incomplete') {
    failCandidate(query, 'candidate biome has an incomplete upstream evaluation');
  }
  return evaluateLinearBiome(catalog, route.routeKey, plan, biomeIndex + 1, previous);
}

function evaluateBiomeFieldCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: BiomeFieldCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as BiomeFieldCandidateQuery;
  locateBiomePlan(project, stableQuery);
  const proposal = applyCandidateCommand(catalog, project, stableQuery, {
    kind: 'ReplaceBiomeField',
    field: stableQuery.field,
    value: stableQuery.value,
  });
  const biome = evaluateCandidateBiome(catalog, project, proposal, context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  if (biome.completion === 'incomplete') {
    failCandidate(stableQuery, 'biome-field proposal made a complete biome incomplete');
  }
  const findings = biome.findings;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateValue: stableQuery.value,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

function evaluateRewardCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as
    IncomingRewardCandidateQuery | LocalRewardCandidateQuery | ShopOfferCandidateQuery;
  locateBiomePlan(project, stableQuery);
  const proposal = applyCandidateCommand(catalog, project, stableQuery, rewardCommand(stableQuery));
  const biome = evaluateCandidateBiome(catalog, project, proposal, context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  if (biome.completion === 'incomplete') {
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

function evaluateFieldsCageOutcomeCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: FieldsCageOutcomeCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as FieldsCageOutcomeCandidateQuery;
  if (stableQuery.cageOutcome !== 'min' && stableQuery.cageOutcome !== 'max') {
    failCandidate(stableQuery, `unknown Fields cage outcome ${String(stableQuery.cageOutcome)}`);
  }
  const plan = locateBiomePlan(project, stableQuery);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  const continuation = plan.topology?.continuations.find(
    (candidate) =>
      candidate.kind === 'batch' &&
      candidate.parentOccurrenceId === stableQuery.continuation.parentOccurrenceId,
  );
  if (
    layout?.kind !== 'LinearBiome' ||
    layout.continuation.batchPolicy.kind !== 'fields' ||
    continuation?.kind !== 'batch'
  ) {
    failCandidate(stableQuery, 'semantic owner has no Fields cage outcome');
  }
  const biome = locateCandidateLinear(context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  const exactKey = semanticAddressKey(stableQuery.continuation);
  const selected = biome.roomGeneration.fieldsCageOutcomes.find(
    (entry) => semanticAddressKey(entry.origin) === exactKey,
  );
  if (selected === undefined) {
    failCandidate(stableQuery, 'Fields outcome has no simulation support entry');
  }
  const selectedPossible = selected.supportOutcomes.includes(stableQuery.cageOutcome);
  const findings = selectedPossible
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({
          code: 'fieldsCageOutcomeUnavailable' as const,
          severity: 'error' as const,
          phase: 'roomGeneration' as const,
          origin: stableQuery.continuation,
          evidence: Object.freeze({
            beforeSequence: selected.beforeSequence,
            biomeDepthCache: selected.biomeDepthCache,
            fieldsMaxDoorsRolled: selected.fieldsMaxDoorsRolled,
            maxDoorCageCeiling: selected.maxDoorCageCeiling,
            selectedOutcome: stableQuery.cageOutcome,
            supportOutcomes: selected.supportOutcomes,
          }),
        }),
      ]);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible
      ? selected.supportOutcomes.length === 1
        ? 'forced'
        : 'possible'
      : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateOutcome: stableQuery.cageOutcome,
      beforeSequence: selected.beforeSequence,
      biomeDepthCache: selected.biomeDepthCache,
      fieldsMaxDoorsRolled: selected.fieldsMaxDoorsRolled,
      maxDoorCageCeiling: selected.maxDoorCageCeiling,
      supportOutcomes: selected.supportOutcomes,
    }),
  });
}

function evaluateShopPurchaseCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: ShopPurchaseCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as ShopPurchaseCandidateQuery;
  locateBiomePlan(project, stableQuery);
  const proposal = applyCandidateCommand(catalog, project, stableQuery, {
    kind: 'SetShopPurchase',
    purchase: stableQuery.purchase,
    purchased: stableQuery.purchased,
  });
  const biome = evaluateCandidateBiome(catalog, project, proposal, context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  if (biome.completion === 'incomplete') {
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

export function evaluateProjectCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  query: ProjectCandidateQuery,
  scope?: ProjectSimulationScope,
): ProjectCandidateEvaluation {
  const evaluation = evaluateProjectCandidates(catalog, project, Object.freeze([query]), scope)[0];
  if (evaluation === undefined) {
    throw new Error('single candidate evaluation returned no result');
  }
  return evaluation;
}

export function evaluateProjectCandidates(
  catalog: Catalog,
  project: ProjectDocument,
  queries: readonly ProjectCandidateQuery[],
  scope?: ProjectSimulationScope,
): readonly ProjectCandidateEvaluation[] {
  if (queries.length === 0) {
    return Object.freeze([]);
  }
  return createProjectCandidateEvaluator(catalog, project, scope).evaluate(queries);
}

export function createProjectCandidateEvaluator(
  catalog: Catalog,
  project: ProjectDocument,
  scope?: ProjectSimulationScope,
): ProjectCandidateEvaluator {
  return createPreparedProjectCandidateEvaluator(
    catalog,
    project,
    simulateProject(catalog, project, scope),
  );
}

export function createPreparedProjectCandidateEvaluator(
  catalog: Catalog,
  project: ProjectDocument,
  projectEvaluation: ProjectEvaluation,
): ProjectCandidateEvaluator {
  assertProjectEvaluationSource(project, projectEvaluation);
  const context: PreparedCandidateContext = {
    projectEvaluation,
  };
  return Object.freeze({
    evaluate: (queries: readonly ProjectCandidateQuery[]) =>
      evaluatePreparedProjectCandidates(catalog, project, context, queries),
  });
}

function evaluatePreparedProjectCandidates(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  queries: readonly ProjectCandidateQuery[],
): readonly ProjectCandidateEvaluation[] {
  if (queries.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze(
    queries.map((query): ProjectCandidateEvaluation => {
      switch (query.kind) {
        case 'biomeField':
          return evaluateBiomeFieldCandidate(catalog, project, context, query);
        case 'startRoom':
          return evaluateStartRoomCandidate(catalog, project, query);
        case 'roomTarget':
          return evaluateRoomTargetCandidate(catalog, project, context, query);
        case 'batchRewardStore':
          return evaluateBatchRewardStoreCandidate(catalog, project, context, query);
        case 'fieldsCageOutcome':
          return evaluateFieldsCageOutcomeCandidate(catalog, project, context, query);
        case 'incomingReward':
        case 'localReward':
        case 'shopOffer':
          return evaluateRewardCandidate(catalog, project, context, query);
        case 'shopPurchase':
          return evaluateShopPurchaseCandidate(catalog, project, context, query);
      }
    }),
  );
}
