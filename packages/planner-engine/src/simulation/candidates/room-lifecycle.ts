import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type RewardWheelAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type {
  ProjectDocument,
  RewardWheelState,
  ShipCombatState,
} from '../../authored-project/model';
import type { SemanticFinding } from '../model';
import type { CompleteBiomeProjectEvaluation, ProjectEvaluation } from '../project';
import {
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
} from '../progressive/biome';
import type {
  RoomLifecycleCandidateArtifacts,
  RoomLifecycleCandidateResult,
} from '../rewards/lifecycle-artifacts';
import {
  coverageUnavailable,
  producerUnavailable,
  unavailableForBiome,
  type CandidateContextUnavailable,
} from './availability';
import { CandidateEvaluationContractError } from './contract';
import {
  candidateBlockedAt,
  completeBiome,
  completeBiomeCount,
  planFor,
  prefixBiome,
  progressiveSeed,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';
import { shipState, wheelState } from './ship-owner';

export interface ShipEncounterCountCandidateQuery {
  readonly kind: 'shipEncounterCount';
  readonly occurrence: OccurrenceAddress;
  readonly encounterCount: 2 | 3;
}

export interface RewardWheelOfferCountCandidateQuery {
  readonly kind: 'rewardWheelOfferCount';
  readonly wheel: RewardWheelAddress;
  readonly offerCount: number;
}

export interface RewardWheelStoreCandidateQuery {
  readonly kind: 'rewardWheelStore';
  readonly wheel: RewardWheelAddress;
  readonly storeKey: string;
}

export interface RewardWheelPickedCandidateQuery {
  readonly kind: 'rewardWheelPicked';
  readonly wheel: RewardWheelAddress;
  readonly pickedOfferIndex: number;
}

export interface ShopPurchaseOrderCandidateQuery {
  readonly kind: 'shopPurchaseOrder';
  readonly shop: OccurrenceAddress;
  readonly offerKeys: readonly string[];
}

export type RoomLifecycleCandidateQuery =
  | ShipEncounterCountCandidateQuery
  | RewardWheelOfferCountCandidateQuery
  | RewardWheelStoreCandidateQuery
  | RewardWheelPickedCandidateQuery
  | ShopPurchaseOrderCandidateQuery;

export interface ShipEncounterCountCandidateSupport {
  readonly encounterCount: 2 | 3;
  readonly supportEncounterCounts: readonly number[];
  readonly selectedPossible: boolean;
  readonly findings: readonly SemanticFinding[];
}

export interface EvaluatedShipEncounterCountCandidate {
  readonly kind: 'shipEncounterCount';
  readonly result: ShipEncounterCountCandidateSupport;
}

export interface RewardWheelLifecycleCandidateSupport {
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedRewardWheelOfferCountCandidate {
  readonly kind: 'rewardWheelOfferCount';
  readonly result: RewardWheelLifecycleCandidateSupport & {
    readonly offerCount: number;
    readonly minimumOfferCount: number;
    readonly maximumOfferCount: number;
  };
}

export interface EvaluatedRewardWheelStoreCandidate {
  readonly kind: 'rewardWheelStore';
  readonly result: RewardWheelLifecycleCandidateSupport & {
    readonly storeKey: string;
    readonly supportedStoreKeys: readonly string[];
  };
}

export interface EvaluatedRewardWheelPickedCandidate {
  readonly kind: 'rewardWheelPicked';
  readonly result: RewardWheelLifecycleCandidateSupport & { readonly pickedOfferIndex: number };
}

export interface EvaluatedShopPurchaseOrderCandidate {
  readonly kind: 'shopPurchaseOrder';
  readonly result: RoomLifecycleCandidateResult;
}

export type RoomLifecycleCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedShipEncounterCountCandidate
  | EvaluatedRewardWheelOfferCountCandidate
  | EvaluatedRewardWheelStoreCandidate
  | EvaluatedRewardWheelPickedCandidate
  | EvaluatedShopPurchaseOrderCandidate;

type LifecycleRepairOwner = OccurrenceAddress | RewardWheelAddress;
type LifecycleRepairScope = 'exact' | 'shopPurchaseOrder';

interface LifecycleCandidateSource {
  readonly evaluation: CandidateBiomeEvaluation;
  readonly artifacts: RoomLifecycleCandidateArtifacts | undefined;
}

function lifecycleRepairOwnerMatches(
  owner: LifecycleRepairOwner,
  blockedOwner: SemanticAddress,
  scope: LifecycleRepairScope = 'exact',
): boolean {
  if (semanticAddressKey(owner) === semanticAddressKey(blockedOwner)) return true;
  if (
    scope === 'shopPurchaseOrder' &&
    owner.kind === 'occurrence' &&
    blockedOwner.kind === 'shopPurchase' &&
    blockedOwner.routeKey === owner.routeKey &&
    blockedOwner.biomeKey === owner.biomeKey &&
    blockedOwner.occurrenceId === owner.occurrenceId
  ) {
    return true;
  }
  return (
    owner.kind === 'rewardWheel' &&
    blockedOwner.kind === 'rewardWheelOffer' &&
    blockedOwner.routeKey === owner.routeKey &&
    blockedOwner.biomeKey === owner.biomeKey &&
    blockedOwner.occurrenceId === owner.occurrenceId &&
    blockedOwner.wheelKey === owner.wheelKey
  );
}

function selectedLifecycleSource(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  owner: LifecycleRepairOwner,
): LifecycleCandidateSource | undefined {
  const complete = completeBiome(evaluation, owner.routeKey, owner.biomeKey);
  if (complete?.validity === 'invalid') {
    const progressive = evaluateProgressiveBiomeAssembly(
      catalog,
      createBiomeAddress(owner.routeKey, owner.biomeKey),
      planFor(project, owner.routeKey, owner.biomeKey),
      completeBiomeCount(evaluation, owner.routeKey, owner.biomeKey),
      progressiveSeed(evaluation, owner.routeKey, owner.biomeKey),
    );
    return progressive === null
      ? undefined
      : Object.freeze({
          evaluation: progressive.evaluation,
          artifacts: progressive.candidateArtifacts.roomLifecycles,
        });
  }
  const biome = complete ?? prefixBiome(evaluation, owner.routeKey, owner.biomeKey);
  return biome === undefined
    ? undefined
    : Object.freeze({ evaluation: biome, artifacts: selectedArtifacts });
}

function preClampLifecycleRepairSource(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selected: LifecycleCandidateSource | undefined,
  owner: LifecycleRepairOwner,
  scope: LifecycleRepairScope,
): LifecycleCandidateSource | undefined {
  const blockedAt = candidateBlockedAt(selected?.evaluation);
  if (blockedAt === undefined || !lifecycleRepairOwnerMatches(owner, blockedAt, scope)) {
    return undefined;
  }
  const raw = evaluateProgressiveBiomeAssemblyBeforeClamp(
    catalog,
    createBiomeAddress(owner.routeKey, owner.biomeKey),
    planFor(project, owner.routeKey, owner.biomeKey),
    completeBiomeCount(evaluation, owner.routeKey, owner.biomeKey),
    progressiveSeed(evaluation, owner.routeKey, owner.biomeKey),
  );
  return raw !== null &&
    raw.evaluation.blockedAt !== undefined &&
    lifecycleRepairOwnerMatches(owner, raw.evaluation.blockedAt, scope)
    ? Object.freeze({
        evaluation: raw.evaluation,
        artifacts: raw.candidateArtifacts.roomLifecycles,
      })
    : undefined;
}

/**
 * A complete biome can lack a materializable progressive form. Its complete
 * lifecycle capability is safe only when the queried owner owns every finding.
 */
function completeInvalidSoleOwnerSource(
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  owner: LifecycleRepairOwner,
  scope: LifecycleRepairScope,
): LifecycleCandidateSource | undefined {
  const complete: CompleteBiomeProjectEvaluation | undefined = completeBiome(
    evaluation,
    owner.routeKey,
    owner.biomeKey,
  );
  if (complete?.validity !== 'invalid' || complete.findings.length === 0) return undefined;
  return complete.findings.every((finding) =>
    lifecycleRepairOwnerMatches(owner, finding.origin, scope),
  )
    ? Object.freeze({ evaluation: complete, artifacts: selectedArtifacts })
    : undefined;
}

function lifecycleSourceForOwner(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  owner: LifecycleRepairOwner,
  scope: LifecycleRepairScope = 'exact',
): LifecycleCandidateSource | undefined {
  const selected = selectedLifecycleSource(catalog, project, evaluation, selectedArtifacts, owner);
  return (
    preClampLifecycleRepairSource(catalog, project, evaluation, selected, owner, scope) ??
    completeInvalidSoleOwnerSource(evaluation, selectedArtifacts, owner, scope) ??
    selected
  );
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
  owner: OccurrenceAddress | RewardWheelAddress,
): readonly SemanticFinding[] {
  return Object.freeze(
    findings.filter(
      (finding) =>
        semanticAddressKey(finding.origin) === semanticAddressKey(owner) ||
        ('occurrenceId' in finding.origin &&
          finding.origin.occurrenceId === owner.occurrenceId &&
          finding.origin.routeKey === owner.routeKey &&
          finding.origin.biomeKey === owner.biomeKey),
    ),
  );
}

export function evaluateShipEncounterCountCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  query: ShipEncounterCountCandidateQuery,
): RoomLifecycleCandidateEvaluation {
  const source = lifecycleSourceForOwner(
    catalog,
    project,
    evaluation,
    selectedArtifacts,
    query.occurrence,
  );
  const context = source?.artifacts?.shipAt(query.occurrence);
  if (source === undefined || context === undefined) {
    return unavailableForBiome(
      evaluation,
      query.occurrence.routeKey,
      query.occurrence.biomeKey,
      query.occurrence,
      'afterRoomLifecycle',
    );
  }
  const ship = shipState(catalog, project, query.occurrence);
  const support = source.evaluation.roomGeneration.ordinary.encounterCounts.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(query.occurrence),
  );
  if (support === undefined) {
    return coverageUnavailable(evaluation, query.occurrence, 'afterTargetGeneration');
  }
  const structurallyPossible = support.supportEncounterCounts.includes(query.encounterCount);
  const lifecycle = structurallyPossible
    ? context.evaluateState(Object.freeze({ ...ship.state, encounterCount: query.encounterCount }))
    : undefined;
  const findings = Object.freeze([
    ...(structurallyPossible
      ? []
      : [
          Object.freeze({
            code: 'encounterCountUnavailable' as const,
            severity: 'error' as const,
            phase: 'roomGeneration' as const,
            origin: query.occurrence,
            evidence: Object.freeze({
              beforeSequence: support.beforeSequence,
              selectedEncounterCount: query.encounterCount,
              supportEncounterCounts: support.supportEncounterCounts,
            }),
          }),
        ]),
    ...(lifecycle === undefined ? [] : lifecycleFindings(lifecycle.findings, query.occurrence)),
  ]);
  return Object.freeze({
    kind: 'shipEncounterCount',
    result: Object.freeze({
      encounterCount: query.encounterCount,
      supportEncounterCounts: support.supportEncounterCounts,
      selectedPossible:
        structurallyPossible && lifecycle?.supported === true && findings.length === 0,
      findings,
    }),
  });
}

export function evaluateRewardWheelLifecycleCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  query:
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelStoreCandidateQuery
    | RewardWheelPickedCandidateQuery,
): RoomLifecycleCandidateEvaluation {
  const { owner, ship, descriptor, wheel } = wheelState(catalog, project, query.wheel);
  const source = lifecycleSourceForOwner(
    catalog,
    project,
    evaluation,
    selectedArtifacts,
    query.wheel,
  );
  const context = source?.artifacts?.shipAt(owner);
  if (source === undefined || context === undefined) {
    return unavailableForBiome(
      evaluation,
      query.wheel.routeKey,
      query.wheel.biomeKey,
      query.wheel,
      'afterRoomLifecycle',
    );
  }
  if (!context.activeWheelKeys.includes(query.wheel.wheelKey)) {
    return coverageUnavailable(evaluation, query.wheel, 'afterRoomLifecycle');
  }
  if (
    query.kind === 'rewardWheelOfferCount' &&
    (!Number.isInteger(query.offerCount) ||
      query.offerCount < descriptor.offerCount.min ||
      query.offerCount > descriptor.offerCount.max)
  ) {
    throw new CandidateEvaluationContractError(
      `offerCount must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
    );
  }
  if (query.kind === 'rewardWheelStore' && !descriptor.reward.storeKeys.includes(query.storeKey)) {
    throw new CandidateEvaluationContractError(
      `${query.storeKey} is not available from ${query.wheel.wheelKey}`,
    );
  }
  if (
    query.kind === 'rewardWheelPicked' &&
    (!Number.isInteger(query.pickedOfferIndex) ||
      query.pickedOfferIndex < 1 ||
      query.pickedOfferIndex > wheel.offerCount)
  ) {
    throw new CandidateEvaluationContractError('pickedOfferIndex must address an active offer');
  }
  const replacement =
    query.kind === 'rewardWheelOfferCount'
      ? Object.freeze({
          ...wheel,
          offerCount: query.offerCount,
          pickedOfferIndex: Math.min(wheel.pickedOfferIndex, query.offerCount),
        })
      : query.kind === 'rewardWheelStore'
        ? Object.freeze({ ...wheel, storeKey: query.storeKey })
        : Object.freeze({ ...wheel, pickedOfferIndex: query.pickedOfferIndex });
  const result = context.evaluateState(replaceWheel(ship.state, query.wheel.wheelKey, replacement));
  const findings = lifecycleFindings(result.findings, query.wheel);
  const selectedPossible = result.supported && findings.length === 0;
  switch (query.kind) {
    case 'rewardWheelOfferCount':
      return Object.freeze({
        kind: 'rewardWheelOfferCount',
        result: Object.freeze({
          offerCount: query.offerCount,
          minimumOfferCount: descriptor.offerCount.min,
          maximumOfferCount: descriptor.offerCount.max,
          selectedPossible,
          findings,
        }),
      });
    case 'rewardWheelStore':
      return Object.freeze({
        kind: 'rewardWheelStore',
        result: Object.freeze({
          storeKey: query.storeKey,
          supportedStoreKeys: descriptor.reward.storeKeys,
          selectedPossible,
          findings,
        }),
      });
    case 'rewardWheelPicked':
      return Object.freeze({
        kind: 'rewardWheelPicked',
        result: Object.freeze({
          pickedOfferIndex: query.pickedOfferIndex,
          selectedPossible,
          findings,
        }),
      });
  }
}

export function evaluateShopPurchaseOrderCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  query: ShopPurchaseOrderCandidateQuery,
): RoomLifecycleCandidateEvaluation {
  const source = lifecycleSourceForOwner(
    catalog,
    project,
    evaluation,
    selectedArtifacts,
    query.shop,
    'shopPurchaseOrder',
  );
  if (source === undefined) {
    return unavailableForBiome(
      evaluation,
      query.shop.routeKey,
      query.shop.biomeKey,
      query.shop,
      'afterRoomLifecycle',
    );
  }
  const plan = planFor(project, query.shop.routeKey, query.shop.biomeKey);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === query.shop.occurrenceId,
  );
  if (occurrence?.state.kind !== 'shop' || occurrence.state.shop === undefined) {
    throw new CandidateEvaluationContractError(
      'shop purchase-order owner has no materialized shop state',
    );
  }
  if (!Array.isArray(query.offerKeys) || !query.offerKeys.every((key) => typeof key === 'string')) {
    throw new CandidateEvaluationContractError('shop purchase order must contain offer keys');
  }
  const seen = new Set<string>();
  for (const offerKey of query.offerKeys) {
    if (occurrence.state.shop.offers[offerKey] === undefined) {
      throw new CandidateEvaluationContractError(
        `shop purchase order has no declared offer ${offerKey}`,
      );
    }
    if (seen.has(offerKey)) {
      throw new CandidateEvaluationContractError(`shop purchase order duplicates ${offerKey}`);
    }
    seen.add(offerKey);
  }
  const context = source.artifacts?.shopAt(query.shop);
  if (context === undefined) return producerUnavailable(query.shop);
  return Object.freeze({
    kind: 'shopPurchaseOrder',
    result: context.evaluateState(
      Object.freeze({
        ...occurrence.state.shop,
        purchaseOrder: Object.freeze([...query.offerKeys]),
      }),
    ),
  });
}
