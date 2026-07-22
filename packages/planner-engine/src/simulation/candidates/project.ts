import type { Catalog, HubBiomeLayout, RewardWheelOfferPoint } from '../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
import { applyProjectCommand, type ProjectCommand } from '../../authored-project/commands/dispatch';
import type {
  AuthoredBiomePlan,
  HubBiomePlan,
  LinearBiomePlan,
  ProjectDocument,
  RewardWheelState,
} from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import {
  evaluateLinearRoomTargetCandidate,
  type LinearForcePressureLedgerEntry,
} from '../generation';
import type {
  CompleteHubProjectEvaluation,
  CompleteLinearProjectEvaluation,
  HubBiomeProjectEvaluation,
  ProjectEvaluation,
  ProjectBiomeEvaluation,
  ProjectRouteEvaluation,
  ProjectSimulationScope,
} from '../project';
import {
  assertProjectEvaluationSource,
  evaluateLinearBiome,
  evaluateNBiome,
  simulateProject,
} from '../project';
import type {
  CandidateContextUnavailableReason,
  CandidateSupport,
  BatchRewardStoreCandidateQuery,
  BiomeFieldCandidateQuery,
  FieldsCageOutcomeCandidateQuery,
  HubSlotCandidateQuery,
  HubVisitCandidateQuery,
  IncomingRewardCandidateQuery,
  LocalRewardCandidateQuery,
  ProjectCandidateEvaluation,
  ProjectCandidateEvaluator,
  ProjectCandidateQuery,
  RoomTargetCandidateEvidence,
  RoomTargetCandidateQuery,
  RewardWheelOfferCandidateQuery,
  RewardWheelOfferCountCandidateQuery,
  RewardWheelPickedCandidateQuery,
  RewardWheelStoreCandidateQuery,
  ShipEncounterCountCandidateQuery,
  ShopOfferCandidateQuery,
  ShopPurchaseCandidateQuery,
  SideRoomEntryOrderCandidateQuery,
  SideRoomGenerationCandidateQuery,
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
    case 'shipEncounterCount':
      return query.occurrence;
    case 'rewardWheelOfferCount':
    case 'rewardWheelStore':
    case 'rewardWheelPicked':
      return query.wheel;
    case 'rewardWheelOffer':
      return query.offer;
    case 'hubSlot':
      return query.slot;
    case 'hubVisit':
      return query.visit;
    case 'shopOffer':
      return query.offer;
    case 'shopPurchase':
      return query.purchase;
    case 'sideRoomEntryOrder':
      return query.group;
    case 'sideRoomGeneration':
      return query.sideRoom;
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
    case 'shipEncounterCount':
      return Object.freeze({ ...query, occurrence: Object.freeze({ ...query.occurrence }) });
    case 'rewardWheelOfferCount':
    case 'rewardWheelStore':
    case 'rewardWheelPicked':
      return Object.freeze({ ...query, wheel: Object.freeze({ ...query.wheel }) });
    case 'rewardWheelOffer':
      return Object.freeze({
        ...query,
        offer: Object.freeze({ ...query.offer }),
        value: immutableOffer(query.value),
      });
    case 'hubSlot':
      return Object.freeze({ ...query, slot: Object.freeze({ ...query.slot }) });
    case 'hubVisit':
      return Object.freeze({ ...query, visit: Object.freeze({ ...query.visit }) });
    case 'shopOffer':
      return Object.freeze({
        ...query,
        offer: Object.freeze({ ...query.offer }),
        value: immutableOffer(query.value),
      });
    case 'shopPurchase':
      return Object.freeze({ ...query, purchase: Object.freeze({ ...query.purchase }) });
    case 'sideRoomEntryOrder':
      return Object.freeze({
        ...query,
        group: Object.freeze({ ...query.group }),
        enteredSlotKeys: Object.freeze([...query.enteredSlotKeys]),
      });
    case 'sideRoomGeneration':
      return Object.freeze({ ...query, sideRoom: Object.freeze({ ...query.sideRoom }) });
  }
}

function locateBiomePlan(
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): AuthoredBiomePlan {
  const address = queryAddress(query);
  const route = project.routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (route === undefined) {
    failCandidate(query, `project has no route ${address.routeKey}`);
  }
  const biome = route.biomes.find((candidate) => candidate.biomeKey === address.biomeKey);
  if (biome === undefined) {
    failCandidate(query, `project has no configured biome ${address.biomeKey}`);
  }
  return biome;
}

function locateLinearBiomePlan(
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): LinearBiomePlan {
  const biome = locateBiomePlan(project, query);
  if (biome.kind !== 'LinearBiome') {
    failCandidate(
      query,
      `${queryAddress(query).biomeKey} does not use linear candidate evaluation`,
    );
  }
  return biome;
}

function locateHubBiomePlan(project: ProjectDocument, query: ProjectCandidateQuery): HubBiomePlan {
  const biome = locateBiomePlan(project, query);
  if (biome.kind !== 'HubBiome') {
    failCandidate(query, `${queryAddress(query).biomeKey} does not use Hub candidate evaluation`);
  }
  return biome;
}

function targetExists(project: ProjectDocument, query: RoomTargetCandidateQuery): boolean {
  const topology = locateLinearBiomePlan(project, query).topology;
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
  if (evaluation.kind !== 'LinearBiome') {
    failCandidate(query, `${address.biomeKey} does not have a linear evaluation`);
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

function locateCandidateHub(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): CompleteHubProjectEvaluation | CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const route = requireRoute(context.projectEvaluation.routes, query);
  const activeEvaluation = route.biomes.find(
    (candidate) => candidate.biomeKey === address.biomeKey,
  );
  if (activeEvaluation !== undefined) {
    if (activeEvaluation.completion === 'incomplete') {
      return 'biomeIncomplete';
    }
    if (activeEvaluation.kind !== 'HubBiome') {
      failCandidate(query, `${address.biomeKey} does not have a Hub evaluation`);
    }
    return activeEvaluation;
  }
  return unavailableReason(route, query);
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
    biome.rewards.targetHistory,
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
  const plan = locateLinearBiomePlan(project, stableQuery);
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

function requireHubCandidateLayout(
  catalog: Catalog,
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): { readonly layout: HubBiomeLayout; readonly plan: HubBiomePlan } {
  const plan = locateHubBiomePlan(project, query);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.kind !== 'HubBiome' || plan.biomeKey !== 'N') {
    failCandidate(query, `${plan.biomeKey} has no supported Hub candidate domain`);
  }
  if (plan.topology === null) {
    failCandidate(query, 'Hub topology has not been started');
  }
  return { layout, plan };
}

function hubSlotProposal(
  catalog: Catalog,
  project: ProjectDocument,
  query: HubSlotCandidateQuery,
  plan: HubBiomePlan,
  layout: HubBiomeLayout,
  baseline: CompleteHubProjectEvaluation,
  open: boolean,
): HubBiomeProjectEvaluation | undefined {
  const topology = plan.topology!;
  const currentlyOpen = topology.openTargets.some(
    (target) => target.hubSlotKey === query.slot.hubSlotKey,
  );
  if (open === currentlyOpen) {
    return baseline;
  }
  if (
    (open && topology.openTargets.length >= layout.hub.openCount.max) ||
    (!open && topology.visitOrder.includes(query.slot.hubSlotKey))
  ) {
    return undefined;
  }
  const proposal = applyCandidateCommand(
    catalog,
    project,
    query,
    open
      ? { kind: 'OpenHubSlot', slot: query.slot, occurrenceId: query.occurrenceId }
      : { kind: 'CloseHubSlot', slot: query.slot },
  );
  return evaluateNBiome(catalog, query.slot.routeKey, locateHubBiomePlan(proposal, query));
}

function hubSlotFindings(
  query: HubSlotCandidateQuery,
  evaluation: HubBiomeProjectEvaluation | undefined,
) {
  if (evaluation === undefined) {
    return Object.freeze([]);
  }
  return Object.freeze(
    evaluation.completion === 'incomplete'
      ? evaluation.findings.filter((finding) => finding.code === 'hubOpenSetIncomplete')
      : evaluation.roomGeneration.findings.filter(
          (finding) =>
            finding.code === 'hubOpenSlotUnavailable' &&
            semanticAddressKey(finding.origin) === semanticAddressKey(query.slot),
        ),
  );
}

function evaluateHubSlotCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: HubSlotCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as HubSlotCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { layout, plan } = requireHubCandidateLayout(catalog, project, stableQuery);
  const slot = layout.hub.slots.find(
    (candidate) => candidate.slotKey === stableQuery.slot.hubSlotKey,
  );
  if (slot === undefined) {
    failCandidate(stableQuery, `unknown Hub slot ${stableQuery.slot.hubSlotKey}`);
  }
  const topology = plan.topology!;
  const current = topology.openTargets.find(
    (target) => target.hubSlotKey === stableQuery.slot.hubSlotKey,
  );
  const currentlyOpen = current !== undefined;
  const referencedVisitIndexes = Object.freeze(
    topology.visitOrder.flatMap((hubSlotKey, index) =>
      hubSlotKey === stableQuery.slot.hubSlotKey ? [index + 1] : [],
    ),
  );
  const selectedEvaluation = hubSlotProposal(
    catalog,
    project,
    stableQuery,
    plan,
    layout,
    baseline,
    stableQuery.open,
  );
  const findings = hubSlotFindings(stableQuery, selectedEvaluation);
  const selectedPossible = selectedEvaluation !== undefined && findings.length === 0;
  const oppositeEvaluation = hubSlotProposal(
    catalog,
    project,
    stableQuery,
    plan,
    layout,
    baseline,
    !stableQuery.open,
  );
  const oppositePossible =
    oppositeEvaluation !== undefined &&
    hubSlotFindings(stableQuery, oppositeEvaluation).length === 0;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible ? (oppositePossible ? 'possible' : 'forced') : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateOpen: stableQuery.open,
      currentlyOpen,
      openSlotKeys: Object.freeze(topology.openTargets.map((target) => target.hubSlotKey)),
      minimumOpenCount: layout.hub.openCount.min,
      maximumOpenCount: layout.hub.openCount.max,
      referencedVisitIndexes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

function evaluateHubVisitCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: HubVisitCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as HubVisitCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { layout, plan } = requireHubCandidateLayout(catalog, project, stableQuery);
  if (!layout.hub.slots.some((slot) => slot.slotKey === stableQuery.hubSlotKey)) {
    failCandidate(stableQuery, `unknown Hub slot ${stableQuery.hubSlotKey}`);
  }
  const topology = plan.topology!;
  const visitIndex = stableQuery.visit.visitIndex - 1;
  const current = topology.visitOrder[visitIndex];
  if (current === undefined) {
    failCandidate(stableQuery, `unknown Hub visit ${stableQuery.visit.visitIndex}`);
  }
  const openHubSlotKeys = Object.freeze(topology.openTargets.map((target) => target.hubSlotKey));
  const occupiedVisitIndexes = Object.freeze(
    topology.visitOrder.flatMap((hubSlotKey, index) =>
      hubSlotKey === stableQuery.hubSlotKey ? [index + 1] : [],
    ),
  );
  const structurallyPossible =
    openHubSlotKeys.includes(stableQuery.hubSlotKey) &&
    occupiedVisitIndexes.every((index) => index === stableQuery.visit.visitIndex);
  let findings = Object.freeze([]) as CompleteHubProjectEvaluation['findings'];
  if (structurallyPossible) {
    const proposal =
      current === stableQuery.hubSlotKey
        ? project
        : applyCandidateCommand(catalog, project, stableQuery, {
            kind: 'ReplaceHubVisit',
            visit: stableQuery.visit,
            hubSlotKey: stableQuery.hubSlotKey,
          });
    const evaluation = evaluateNBiome(
      catalog,
      stableQuery.visit.routeKey,
      locateHubBiomePlan(proposal, stableQuery),
    );
    if (evaluation.completion === 'incomplete') {
      failCandidate(stableQuery, 'Hub visit proposal made a complete biome incomplete');
    }
    findings = Object.freeze(
      evaluation.findings.filter((finding) => finding.code !== 'hubOpenSlotUnavailable'),
    );
  }
  const possibleChoices = openHubSlotKeys.filter(
    (hubSlotKey) =>
      hubSlotKey === current || !topology.visitOrder.some((visited) => visited === hubSlotKey),
  );
  const selectedPossible = structurallyPossible && findings.length === 0;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible
      ? possibleChoices.length === 1
        ? 'forced'
        : 'possible'
      : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateHubSlotKey: stableQuery.hubSlotKey,
      openHubSlotKeys,
      occupiedVisitIndexes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

function requireSideRoomState(
  catalog: Catalog,
  project: ProjectDocument,
  query: SideRoomEntryOrderCandidateQuery | SideRoomGenerationCandidateQuery,
) {
  const { layout, plan } = requireHubCandidateLayout(catalog, project, query);
  const address = query.kind === 'sideRoomEntryOrder' ? query.group : query.sideRoom;
  const occurrence = plan.topology!.occurrences.find(
    (candidate) => candidate.occurrenceId === address.occurrenceId,
  );
  if (occurrence?.state.kind !== 'ephyraCombat') {
    failCandidate(query, 'semantic owner is not an Ephyra combat room');
  }
  const room = catalog.rooms.byKey[occurrence.gameName];
  const group = room?.localChildren.find((candidate) => candidate.key === address.groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    failCandidate(query, `unknown local child group ${address.groupKey}`);
  }
  return { layout, plan, occurrence, state: occurrence.state, group };
}

function evaluateSideRoomGenerationCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: SideRoomGenerationCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as SideRoomGenerationCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { state, group } = requireSideRoomState(catalog, project, stableQuery);
  if (!group.slots.some((slot) => slot.slotKey === stableQuery.sideRoom.slotKey)) {
    failCandidate(stableQuery, `unknown side-room slot ${stableQuery.sideRoom.slotKey}`);
  }
  const sideRoom = state.sideRooms[stableQuery.sideRoom.slotKey];
  if (sideRoom === undefined) {
    failCandidate(stableQuery, `missing side-room state ${stableQuery.sideRoom.slotKey}`);
  }
  const baselineEntry = baseline.roomGeneration.sideRoomGenerations.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(stableQuery.sideRoom),
  );
  if (baselineEntry === undefined) {
    failCandidate(stableQuery, 'side room has no selected generation support entry');
  }
  const structurallyPossible =
    stableQuery.generation === 'generated' || sideRoom.enteredOrdinal === null;
  let selected = baselineEntry;
  let findings = Object.freeze([]) as CompleteHubProjectEvaluation['findings'];
  if (structurallyPossible) {
    const proposal =
      sideRoom.generation === stableQuery.generation
        ? project
        : applyCandidateCommand(catalog, project, stableQuery, {
            kind: 'ReplaceSideRoomGeneration',
            sideRoom: stableQuery.sideRoom,
            generation: stableQuery.generation,
          });
    const evaluation = evaluateNBiome(
      catalog,
      stableQuery.sideRoom.routeKey,
      locateHubBiomePlan(proposal, stableQuery),
    );
    if (evaluation.completion === 'incomplete') {
      failCandidate(stableQuery, 'side-generation proposal made a complete biome incomplete');
    }
    selected =
      evaluation.roomGeneration.sideRoomGenerations.find(
        (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(stableQuery.sideRoom),
      ) ?? failCandidate(stableQuery, 'side room proposal lost its generation support entry');
    findings = Object.freeze(
      evaluation.roomGeneration.findings.filter(
        (finding) => finding.code === 'sideRoomGenerationUnavailable',
      ),
    );
  }
  const selectedPossible = structurallyPossible && findings.length === 0;
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
      candidateGeneration: stableQuery.generation,
      enteredOrdinal: sideRoom.enteredOrdinal,
      generatedBefore: selected.generatedBefore,
      requiredGeneratedCount: selected.requiredGeneratedCount,
      supportOutcomes: selected.supportOutcomes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

function evaluateSideRoomEntryOrderCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: SideRoomEntryOrderCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as SideRoomEntryOrderCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { state, group } = requireSideRoomState(catalog, project, stableQuery);
  const generatedSlotKeys = Object.freeze(
    group.slots.flatMap((slot) =>
      state.sideRooms[slot.slotKey]?.generation === 'generated' ? [slot.slotKey] : [],
    ),
  );
  const proposal = applyCandidateCommand(catalog, project, stableQuery, {
    kind: 'ReplaceSideRoomEntryOrder',
    group: stableQuery.group,
    enteredSlotKeys: stableQuery.enteredSlotKeys,
  });
  const evaluation = evaluateNBiome(
    catalog,
    stableQuery.group.routeKey,
    locateHubBiomePlan(proposal, stableQuery),
  );
  if (evaluation.completion === 'incomplete') {
    failCandidate(stableQuery, 'side-entry proposal made a complete biome incomplete');
  }
  const findings = Object.freeze(
    evaluation.findings.filter(
      (finding) =>
        finding.code !== 'hubOpenSlotUnavailable' &&
        finding.code !== 'sideRoomGenerationUnavailable',
    ),
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateEnteredSlotKeys: stableQuery.enteredSlotKeys,
      generatedSlotKeys,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
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

type CandidateBiomeEvaluation = ProjectBiomeEvaluation;

function locateCandidateBiome(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
) {
  const sourcePlan = locateBiomePlan(project, query);
  return sourcePlan.kind === 'LinearBiome'
    ? locateCandidateLinear(context, query)
    : locateCandidateHub(context, query);
}

function evaluateCandidateBiome(
  catalog: Catalog,
  project: ProjectDocument,
  proposal: ProjectDocument,
  context: PreparedCandidateContext,
  query:
    | BiomeFieldCandidateQuery
    | FieldsCageOutcomeCandidateQuery
    | HubSlotCandidateQuery
    | HubVisitCandidateQuery
    | IncomingRewardCandidateQuery
    | LocalRewardCandidateQuery
    | RewardWheelOfferCandidateQuery
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelPickedCandidateQuery
    | RewardWheelStoreCandidateQuery
    | ShipEncounterCountCandidateQuery
    | ShopOfferCandidateQuery
    | ShopPurchaseCandidateQuery
    | SideRoomEntryOrderCandidateQuery
    | SideRoomGenerationCandidateQuery,
): CandidateBiomeEvaluation | CandidateContextUnavailableReason {
  const address = queryAddress(query);
  const baselineRoute = requireRoute(context.projectEvaluation.routes, query);
  const sourcePlan = locateBiomePlan(project, query);
  const baselineBiome = locateCandidateBiome(catalog, project, context, query);
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
  if (plan.kind !== sourcePlan.kind) {
    failCandidate(query, 'candidate proposal changed biome layout kind');
  }
  if (plan.kind === 'HubBiome') {
    return evaluateNBiome(catalog, route.routeKey, plan);
  }

  const previous = biomeIndex === 0 ? undefined : baselineRoute.biomes[biomeIndex - 1];
  if (previous?.completion === 'incomplete') {
    failCandidate(query, 'candidate biome has an incomplete upstream evaluation');
  }
  const previousComplete = previous?.completion === 'complete' ? previous : undefined;
  return evaluateLinearBiome(catalog, route.routeKey, plan, biomeIndex + 1, previousComplete);
}

function evaluateBiomeFieldCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: BiomeFieldCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as BiomeFieldCandidateQuery;
  locateLinearBiomePlan(project, stableQuery);
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
  const baseline = locateCandidateBiome(catalog, project, context, stableQuery);
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
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
  const plan = locateLinearBiomePlan(project, stableQuery);
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
  if (evaluation.completion === 'incomplete' || evaluation.kind !== 'LinearBiome') {
    failCandidate(query, 'ship proposal did not produce a complete linear biome');
  }
  return evaluation;
}

function evaluateShipEncounterCountCandidate(
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

function evaluateRewardWheelOfferCountCandidate(
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

function evaluateRewardWheelStoreCandidate(
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

function evaluateRewardWheelOfferCandidate(
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

function evaluateRewardWheelPickedCandidate(
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

function evaluateShopPurchaseCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: ShopPurchaseCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as ShopPurchaseCandidateQuery;
  locateBiomePlan(project, stableQuery);
  const baseline = locateCandidateBiome(catalog, project, context, stableQuery);
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
        case 'shipEncounterCount':
          return evaluateShipEncounterCountCandidate(catalog, project, context, query);
        case 'rewardWheelOfferCount':
          return evaluateRewardWheelOfferCountCandidate(catalog, project, context, query);
        case 'rewardWheelStore':
          return evaluateRewardWheelStoreCandidate(catalog, project, context, query);
        case 'rewardWheelOffer':
          return evaluateRewardWheelOfferCandidate(catalog, project, context, query);
        case 'rewardWheelPicked':
          return evaluateRewardWheelPickedCandidate(catalog, project, context, query);
        case 'hubSlot':
          return evaluateHubSlotCandidate(catalog, project, context, query);
        case 'hubVisit':
          return evaluateHubVisitCandidate(catalog, project, context, query);
        case 'incomingReward':
        case 'localReward':
        case 'shopOffer':
          return evaluateRewardCandidate(catalog, project, context, query);
        case 'shopPurchase':
          return evaluateShopPurchaseCandidate(catalog, project, context, query);
        case 'sideRoomEntryOrder':
          return evaluateSideRoomEntryOrderCandidate(catalog, project, context, query);
        case 'sideRoomGeneration':
          return evaluateSideRoomGenerationCandidate(catalog, project, context, query);
      }
    }),
  );
}
