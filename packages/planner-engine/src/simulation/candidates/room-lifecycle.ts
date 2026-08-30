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
import { materializeShipCombatState } from '../materialization';
import type { EncounterCandidateArtifacts } from '../encounters';
import type { ProjectEvaluation } from '../evaluation-products';
import type { RoomLifecycleCandidateArtifacts } from '../rewards/lifecycle-artifacts';
import {
  coverageUnavailable,
  unavailableForBiome,
  type CandidateContextUnavailable,
} from './availability';
import { CandidateEvaluationContractError } from './contract';
import { candidateBiome, type CandidateBiomeEvaluation } from './evaluated-biome';
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

export type RoomLifecycleCandidateQuery =
  | ShipEncounterCountCandidateQuery
  | RewardWheelOfferCountCandidateQuery
  | RewardWheelStoreCandidateQuery
  | RewardWheelPickedCandidateQuery;

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

export type RoomLifecycleCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedShipEncounterCountCandidate
  | EvaluatedRewardWheelOfferCountCandidate
  | EvaluatedRewardWheelStoreCandidate
  | EvaluatedRewardWheelPickedCandidate;

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

interface RewardWheelIdentity {
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly occurrenceId: string;
  readonly wheelKey: string;
}

function rewardWheelIdentityForAddress(address: SemanticAddress): RewardWheelIdentity | undefined {
  switch (address.kind) {
    case 'rewardWheel':
    case 'rewardWheelOffer':
      return {
        routeKey: address.routeKey,
        biomeKey: address.biomeKey,
        occurrenceId: address.occurrenceId,
        wheelKey: address.wheelKey,
      };
    case 'acquisitionSite':
      return rewardWheelIdentityForAddress(address.owner);
    case 'acquisitionEntry':
      return rewardWheelIdentityForAddress(address.site.owner);
    case 'traitOffer':
    case 'acquisitionRole':
    case 'levelResolution':
      return rewardWheelIdentityForAddress(address.owner);
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'naturalSelectionResult':
    case 'echoLastRunBoon':
    case 'echoLastReward':
    case 'allTogetherSet':
      return rewardWheelIdentityForAddress(address.trait);
    default:
      return undefined;
  }
}

function belongsToRewardWheel(origin: SemanticAddress, owner: RewardWheelAddress): boolean {
  const identity = rewardWheelIdentityForAddress(origin);
  return (
    identity?.routeKey === owner.routeKey &&
    identity.biomeKey === owner.biomeKey &&
    identity.occurrenceId === owner.occurrenceId &&
    identity.wheelKey === owner.wheelKey
  );
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
        (owner.kind === 'occurrence' &&
          'occurrenceId' in finding.origin &&
          finding.origin.occurrenceId === owner.occurrenceId &&
          finding.origin.routeKey === owner.routeKey &&
          finding.origin.biomeKey === owner.biomeKey) ||
        (owner.kind === 'rewardWheel' && belongsToRewardWheel(finding.origin, owner)),
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
  const route = project.route.routeKey === query.occurrence.routeKey ? project.route : undefined;
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
  const replacementState = replaceWheel(ship.state, query.wheel.wheelKey, replacement);
  const result =
    query.kind === 'rewardWheelPicked'
      ? context.evaluateStateThroughWheelPick(replacementState, query.wheel.wheelKey)
      : context.evaluateState(replacementState);
  const findings = lifecycleFindings(result.findings, query.wheel);
  const selectedPossible =
    query.kind === 'rewardWheelOfferCount'
      ? true
      : query.kind === 'rewardWheelStore'
        ? context.supportedStoreKeysAtGeneration(query.wheel.wheelKey).includes(query.storeKey)
        : result.supported && findings.length === 0;
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
          supportedStoreKeys: context.supportedStoreKeysAtGeneration(query.wheel.wheelKey),
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
