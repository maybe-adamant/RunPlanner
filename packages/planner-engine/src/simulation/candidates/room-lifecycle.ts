import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  semanticAddressKey,
  type AcquisitionSiteAddress,
  type OccurrenceAddress,
  type RewardWheelAddress,
} from '../../authored-project/addresses';
import type {
  ProjectDocument,
  RewardWheelState,
  ShipCombatState,
} from '../../authored-project/model';
import type { SemanticFinding } from '../model';
import { materializeShipCombatState } from '../materialization';
import type { EncounterCandidateArtifacts } from '../encounters';
import type { ProjectEvaluation } from '../project';
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
import { candidateBiome, planFor, type CandidateBiomeEvaluation } from './evaluated-biome';
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

export interface AcquisitionOrderCandidateQuery {
  readonly kind: 'acquisitionOrder';
  readonly site: AcquisitionSiteAddress;
  readonly entryKeys: readonly string[];
}

export type RoomLifecycleCandidateQuery =
  | ShipEncounterCountCandidateQuery
  | RewardWheelOfferCountCandidateQuery
  | RewardWheelStoreCandidateQuery
  | RewardWheelPickedCandidateQuery
  | AcquisitionOrderCandidateQuery;

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

export interface EvaluatedAcquisitionOrderCandidate {
  readonly kind: 'acquisitionOrder';
  readonly result: RoomLifecycleCandidateResult;
}

export type RoomLifecycleCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedShipEncounterCountCandidate
  | EvaluatedRewardWheelOfferCountCandidate
  | EvaluatedRewardWheelStoreCandidate
  | EvaluatedRewardWheelPickedCandidate
  | EvaluatedAcquisitionOrderCandidate;

type LifecycleRepairOwner = OccurrenceAddress | RewardWheelAddress;

interface LifecycleCandidateSource {
  readonly evaluation: CandidateBiomeEvaluation;
  readonly artifacts: RoomLifecycleCandidateArtifacts | undefined;
  readonly encounters: EncounterCandidateArtifacts | undefined;
}

function selectedLifecycleSource(
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  selectedEncounterArtifacts: EncounterCandidateArtifacts | undefined,
  owner: LifecycleRepairOwner,
): LifecycleCandidateSource | undefined {
  const biome = candidateBiome(evaluation, owner.routeKey, owner.biomeKey);
  return biome === undefined
    ? undefined
    : Object.freeze({
        evaluation: biome,
        artifacts: selectedArtifacts,
        encounters: selectedEncounterArtifacts,
      });
}

function lifecycleSourceForOwner(
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  owner: LifecycleRepairOwner,
  selectedEncounterArtifacts?: EncounterCandidateArtifacts,
): LifecycleCandidateSource | undefined {
  return selectedLifecycleSource(evaluation, selectedArtifacts, selectedEncounterArtifacts, owner);
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
        (owner.kind === 'occurrence' &&
          finding.origin.kind === 'encounterPhase' &&
          finding.origin.owner.kind === 'occurrence' &&
          finding.origin.routeKey === owner.routeKey &&
          finding.origin.biomeKey === owner.biomeKey &&
          finding.origin.owner.occurrenceId === owner.occurrenceId) ||
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
  selectedEncounterArtifacts: EncounterCandidateArtifacts | undefined,
  query: ShipEncounterCountCandidateQuery,
): RoomLifecycleCandidateEvaluation {
  const source = lifecycleSourceForOwner(
    evaluation,
    selectedArtifacts,
    query.occurrence,
    selectedEncounterArtifacts,
  );
  const context = source?.artifacts?.shipAt(query.occurrence);
  const preparation = source?.encounters?.roomAt(query.occurrence);
  if (source === undefined || preparation === undefined) {
    return unavailableForBiome(
      evaluation,
      query.occurrence.routeKey,
      query.occurrence.biomeKey,
      query.occurrence,
      'afterRoomLifecycle',
    );
  }
  const ship = shipState(catalog, project, query.occurrence);
  const route = project.routes.find(
    (candidate) => candidate.routeKey === query.occurrence.routeKey,
  );
  if (route === undefined) {
    throw new CandidateEvaluationContractError(
      `candidate owner has no ${query.occurrence.routeKey} route`,
    );
  }
  const loadout = route.loadout;
  const stateForCount = (encounterCount: 2 | 3): ShipCombatState =>
    Object.freeze({ ...ship.state, encounterCount });
  const encounterForCount = (encounterCount: 2 | 3) => {
    const materialized = materializeShipCombatState(
      catalog,
      createBiomeAddress(query.occurrence.routeKey, query.occurrence.biomeKey),
      ship.room,
      Object.freeze({ ...ship.authored, state: stateForCount(encounterCount) }),
      loadout,
    );
    return Object.freeze({
      finalPhaseKey: materialized.encounterPhases.at(-1)?.slotKey,
      prepared: preparation.prepare(materialized.encounterPhases),
    });
  };
  const encounter = encounterForCount(query.encounterCount);
  const supportEncounterCounts = Object.freeze(
    ([2, 3] as const).filter((encounterCount) => {
      if (encounterCount === 2) return true;
      const candidate = encounterForCount(encounterCount);
      return candidate.prepared.candidates.some(
        (phase) => phase.origin.phaseKey === candidate.finalPhaseKey && phase.activationSatisfied,
      );
    }),
  );
  const lifecycle = context?.evaluateState(stateForCount(query.encounterCount));
  const findings = Object.freeze([
    ...lifecycleFindings(encounter.prepared.findings, query.occurrence),
    ...(lifecycle === undefined ? [] : lifecycleFindings(lifecycle.findings, query.occurrence)),
  ]);
  return Object.freeze({
    kind: 'shipEncounterCount',
    result: Object.freeze({
      encounterCount: query.encounterCount,
      supportEncounterCounts,
      // The count owns Ship phase topology. Activating a retained encounter or
      // reward leaf may expose findings, but those leaves must remain reachable
      // for repair rather than making their owning topology value unauthorable.
      selectedPossible: supportEncounterCounts.includes(query.encounterCount),
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
  const source = lifecycleSourceForOwner(evaluation, selectedArtifacts, query.wheel);
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

export function evaluateAcquisitionOrderCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RoomLifecycleCandidateArtifacts | undefined,
  query: AcquisitionOrderCandidateQuery,
): RoomLifecycleCandidateEvaluation {
  if (query.site.owner.kind !== 'occurrence' || query.site.pointKey !== 'roomExit') {
    throw new CandidateEvaluationContractError('unsupported acquisition site');
  }
  const shop = query.site.owner;
  const source = lifecycleSourceForOwner(evaluation, selectedArtifacts, shop);
  if (source === undefined) {
    return unavailableForBiome(
      evaluation,
      shop.routeKey,
      shop.biomeKey,
      shop,
      'afterRoomLifecycle',
    );
  }
  const plan = planFor(project, shop.routeKey, shop.biomeKey);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === shop.occurrenceId,
  );
  if (occurrence?.state.kind !== 'shop' || occurrence.state.shop === undefined) {
    throw new CandidateEvaluationContractError(
      'Shop acquisition-site owner has no materialized Shop state',
    );
  }
  if (!Array.isArray(query.entryKeys) || !query.entryKeys.every((key) => typeof key === 'string')) {
    throw new CandidateEvaluationContractError('acquisition order must contain entry keys');
  }
  const seen = new Set<string>();
  for (const offerKey of query.entryKeys) {
    if (occurrence.state.shop.offers[offerKey] === undefined) {
      throw new CandidateEvaluationContractError(
        `acquisition order has no declared entry ${offerKey}`,
      );
    }
    if (seen.has(offerKey)) {
      throw new CandidateEvaluationContractError(`acquisition order duplicates ${offerKey}`);
    }
    seen.add(offerKey);
  }
  const context = source.artifacts?.acquisitionOrderAt(shop);
  if (context === undefined) {
    return source.evaluation.coverage.kind === 'prefix'
      ? coverageUnavailable(evaluation, shop, 'afterRoomLifecycle')
      : producerUnavailable(shop);
  }
  return Object.freeze({
    kind: 'acquisitionOrder',
    result: context.evaluateOrder(Object.freeze([...query.entryKeys])),
  });
}
