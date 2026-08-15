import {
  countedRewardTypeDomain,
  createPreparedProjectCandidateSession,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  type CandidateEvaluationEvent,
  type EvaluatedTraitAcquisitionTargetCandidate,
  type EvaluatedTraitOfferFocusedOptionCandidate,
  type EvaluatedKeepsakeEquipResultCandidate,
  type EvaluatedAcquisitionConversionCandidate,
  type CirceResolutionDomainEvaluation,
  type EchoPomTargetDomainEvaluation,
  type EchoLastRunBoonDomainEvaluation,
  type EchoLastRewardDomainEvaluation,
  type ProjectCandidateEvaluation,
  type ProjectCandidateQuery,
  type ProjectCandidateSession,
  type ProjectCandidateSessionEvaluation,
  type ProjectCandidateSessionQuery,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
  levelResolutionCandidateForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import {
  semanticAddressKey,
  type AcquisitionSiteAddress,
  type AcquisitionEntryAddress,
  type AuthoredTraitOption,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type BossCompletionArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type AcquisitionRoleAddress,
  type ExitDecisionAddress,
  type EncounterPhaseAddress,
  type HubDecisionAddress,
  type HubSlotAddress,
  type IncomingRewardAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type LocalRewardAddress,
  type OccurrenceId,
  type OccurrenceAddress,
  type ProjectDocument,
  type RewardWheelAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
  type SideRoomGeneration,
  type TraitOfferAddress,
  type LevelResolutionAddress,
  type TraitOptionKey,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { type Catalog, type RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import {
  prepareRewardDomain,
  projectRewardDomain,
  rewardDomainOffers,
  type PreparedRewardDomain,
  type ProjectedRewardDomain,
} from './rewardDomainProjection';

export type RewardCandidateOwner =
  | { readonly kind: 'incomingReward'; readonly address: IncomingRewardAddress }
  | { readonly kind: 'localReward'; readonly address: LocalRewardAddress }
  | { readonly kind: 'rewardWheelOffer'; readonly address: RewardWheelOfferAddress }
  | { readonly kind: 'shopOffer'; readonly address: ShopOfferAddress }
  | { readonly kind: 'acquisitionEntry'; readonly address: AcquisitionEntryAddress };

export type CountedRewardCandidateOwner = Exclude<
  RewardCandidateOwner,
  { readonly kind: 'shopOffer' | 'acquisitionEntry' }
>;

/**
 * Application adaptation of the engine's exact encounter-phase artifact.
 * It intentionally carries only the already-evaluated support state for one
 * displayed definition; no encounter membership or requirement policy is
 * recreated here.
 */
export interface EncounterCandidateProjectionEvaluation {
  readonly kind: 'encounter';
  readonly result: {
    /**
     * Presentation can distinguish missing assessment from a reached phase
     * that is inactive or absent from the engine support set. The latter is a
     * generic support-set exclusion, not application evidence of one exact
     * requirement. React never reevaluates an encounter requirement.
     */
    readonly evidence:
      | { readonly kind: 'coverageUnavailable' }
      | { readonly kind: 'inactiveSlot' }
      | { readonly kind: 'requirementsExcluded' }
      | { readonly kind: 'supported' };
    readonly support: CandidateSupport;
  };
}

export type CandidateProjectionEvaluation =
  | ProjectCandidateEvaluation
  | EvaluatedTraitOfferFocusedOptionCandidate
  | EvaluatedTraitAcquisitionTargetCandidate
  | EncounterCandidateProjectionEvaluation
  | EvaluatedKeepsakeEquipResultCandidate
  | EvaluatedAcquisitionConversionCandidate;

export interface CandidateOptionProjection<
  T,
  Evaluation extends CandidateProjectionEvaluation = ProjectCandidateEvaluation,
> {
  readonly value: T;
  readonly evaluation: Evaluation;
}

export interface CandidateProjectionSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  readonly prepareRewardDomain: (
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ) => PreparedRewardDomain;
  readonly countedRewardTypes: (
    owner: CountedRewardCandidateOwner,
    binding: CountedRewardBinding,
    selectedRewardType: string,
  ) => readonly string[];
  readonly rewardDomain: (
    owner: RewardCandidateOwner,
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ) => Promise<ProjectedRewardDomain>;
  readonly startRooms: (
    owner: BiomeAddress | OccurrenceAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly roomTargets: (
    target: TargetAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly encounterPhases: (
    phase: EncounterPhaseAddress,
    encounterKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string, EncounterCandidateProjectionEvaluation>[];
  readonly batchRewardStores: (
    rewardStore: BatchRewardStoreAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly fieldsCageOutcomes: (
    decision: ExitDecisionAddress,
    outcomes: readonly ('min' | 'max')[],
  ) => readonly CandidateOptionProjection<'min' | 'max'>[];
  readonly takeoverPrebossBatches: (
    source: ExitDecisionAddress,
    gameNames: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  /** One declaration-owned terminal Hub result for an exact authored envelope. */
  readonly hubTerminalTakeover: (
    source: ExitDecisionAddress,
  ) => CandidateOptionProjection<ExitDecisionAddress>;
  readonly shipCombatPhaseCounts: (
    occurrence: OccurrenceAddress,
    values: readonly (2 | 3)[],
  ) => readonly CandidateOptionProjection<2 | 3>[];
  readonly rewardWheelOfferCounts: (
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly rewardWheelStores: (
    wheel: RewardWheelAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly rewardWheelPicks: (
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly hubSlots: (
    slot: HubSlotAddress,
    occurrenceId: OccurrenceId,
    values: readonly boolean[],
  ) => readonly CandidateOptionProjection<boolean>[];
  readonly hubVisitOrders: (
    hub: HubDecisionAddress,
    values: readonly (readonly string[])[],
  ) => readonly CandidateOptionProjection<readonly string[]>[];
  readonly sideRoomGenerations: (
    sideRoom: LocalChildAddress,
    values: readonly SideRoomGeneration[],
  ) => readonly CandidateOptionProjection<SideRoomGeneration>[];
  readonly sideRoomEntryOrders: (
    group: LocalChildGroupAddress,
    values: readonly (readonly string[])[],
  ) => readonly CandidateOptionProjection<readonly string[]>[];
  readonly acquisitionOrders: (
    site: AcquisitionSiteAddress,
    values: readonly (readonly string[])[],
  ) => readonly CandidateOptionProjection<readonly string[]>[];
  readonly traitOffer: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
  ) => readonly CandidateOptionProjection<AuthoredTraitOffer>[];
  readonly traitOfferStartingDraft: (
    owner: TraitOfferAddress,
    giverKey: string,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly nextTraitOfferDraft: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  /**
   * Evaluates one declaration-compatible concrete domain at one focused offer
   * position. Every query still carries the complete draft into engine offer
   * assessment.
   */
  readonly traitOfferFocusedOptions: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    variants: readonly AuthoredTraitOption[],
  ) => readonly CandidateOptionProjection<AuthoredTraitOption, CandidateProjectionEvaluation>[];
  readonly traitAcquisitionTargets: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    retainedTargetTraitKey?: string,
  ) => readonly CandidateOptionProjection<string, CandidateProjectionEvaluation>[];
  /** Typed exact Circe frontier from the prepared engine candidate session. */
  readonly circeResolution: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => CirceResolutionDomainEvaluation;
  readonly echoPomTarget: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => EchoPomTargetDomainEvaluation;
  readonly echoLastRunBoon: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => EchoLastRunBoonDomainEvaluation;
  readonly echoLastReward: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => EchoLastRewardDomainEvaluation;
  /**
   * Exact declaration-owned Pom capability. The engine retains the correlated
   * branch histories; application presentation only adapts its returned data.
   */
  readonly levelResolution: (
    owner: LevelResolutionAddress,
    value: AuthoredLevelResolution,
  ) => LevelResolutionCandidateProjection | undefined;
  /** One atomic exact Judgment selection, assessed against its pre-effect domain. */
  readonly bossCompletionArcana: (
    owner: BossCompletionArcanaAddress,
    arcanaKeys: readonly string[],
  ) => CandidateProjectionEvaluation;
  /** Exact engine-captured keepsake frontier, projected one option at a time for controls. */
  readonly keepsakeSelections: (
    owner: KeepsakeSelectionAddress,
  ) => readonly CandidateOptionProjection<string>[];
  readonly keepsakeEquipResult: (
    owner: KeepsakeEquipResultAddress,
    value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults[keyof import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults],
  ) => readonly CandidateOptionProjection<string>[];
  readonly acquisitionConversion: (owner: AcquisitionRoleAddress) => CandidateProjectionEvaluation;
}

export interface LevelResolutionCandidateProjection {
  readonly groups: readonly LevelResolutionCandidateGroup[];
}

export interface LevelResolutionCandidateSurface {
  readonly effectKind: 'choice' | 'random';
  readonly emptyTargetAllowed?: boolean;
  readonly levelCount: number;
  readonly requiredOfferCount?: number;
  readonly eligibleTargetTraitKeys: readonly string[];
}

export interface LevelResolutionCandidateGroup {
  readonly key: string;
  readonly branchIndices: readonly number[];
  readonly surface: LevelResolutionCandidateSurface;
  readonly evaluations: readonly {
    readonly branchIndex: number;
    readonly supported: boolean;
    readonly findings: readonly string[];
  }[];
}

export interface CandidateSessionFactory {
  readonly bind: (assembly: ProjectEvaluationAssembly) => CandidateProjectionSession;
}

export interface CandidateSessionFactoryOptions {
  readonly observeCandidateEvaluation?: (event: CandidateEvaluationEvent) => void;
  readonly yieldToHost?: () => Promise<void>;
}

function offerKey(value: ResolvedRewardOffer): string {
  return JSON.stringify(value);
}

function domainKey(values: readonly string[]): string {
  return JSON.stringify(values);
}

function traitOptionKey(option: AuthoredTraitOption): string {
  return `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}`;
}

function offerWithFocusedOption(
  value: AuthoredTraitOffer,
  optionKey: TraitOptionKey,
  option: AuthoredTraitOption,
): AuthoredTraitOffer {
  if (value.kind === 'fallbackGold') return value;
  const index = optionKey === 'option1' ? 0 : optionKey === 'option2' ? 1 : 2;
  const options = [...value.options] as AuthoredTraitOption[];
  options[index] = Object.freeze({ ...option });
  return Object.freeze({
    ...value,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}

function candidateOptionEvaluation(
  evaluation: ProjectCandidateSessionEvaluation,
): CandidateProjectionEvaluation {
  if (
    evaluation.kind === 'traitAcquisitionTargetDomain' ||
    evaluation.kind === 'circeResolutionDomain' ||
    evaluation.kind === 'echoPomTargetDomain' ||
    evaluation.kind === 'echoLastRunBoonDomain' ||
    evaluation.kind === 'echoLastRewardDomain'
  ) {
    throw new Error('a target-domain aggregate cannot be projected as one candidate option');
  }
  return evaluation;
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

function requireProjectCache(
  cache: WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>,
  assembly: ProjectEvaluationAssembly,
  catalog: Catalog,
  options: CandidateSessionFactoryOptions,
): ProjectCandidateProjectionCache {
  let projectCache = cache.get(assembly);
  if (projectCache === undefined) {
    projectCache = {
      evaluator: createPreparedProjectCandidateSession(
        catalog,
        assembly,
        options.observeCandidateEvaluation === undefined
          ? {}
          : { observe: options.observeCandidateEvaluation },
      ),
      options: new Map(),
    };
    cache.set(assembly, projectCache);
  }
  return projectCache;
}

function projectOptions<T>(
  cache: WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>,
  assembly: ProjectEvaluationAssembly,
  key: string,
  values: readonly T[],
  queries: readonly ProjectCandidateSessionQuery[],
  catalog: Catalog,
  options: CandidateSessionFactoryOptions,
): readonly CandidateOptionProjection<T>[] {
  const projectCache = requireProjectCache(cache, assembly, catalog, options);
  const existing = projectCache.options.get(key);
  if (existing !== undefined) {
    return existing as readonly CandidateOptionProjection<T>[];
  }
  const evaluations = projectCache.evaluator.evaluate(queries);
  const projected = Object.freeze(
    values.map((value, index) => {
      const evaluation = evaluations[index];
      if (evaluation === undefined) {
        throw new Error(`candidate projection ${key} omitted value ${index}`);
      }
      return Object.freeze({ value, evaluation: candidateOptionEvaluation(evaluation) });
    }),
  ) as readonly CandidateOptionProjection<T>[];
  projectCache.options.set(key, projected);
  return projected;
}

interface ProjectCandidateProjectionCache {
  readonly evaluator: ProjectCandidateSession;
  readonly options: Map<
    string,
    readonly CandidateOptionProjection<unknown, CandidateProjectionEvaluation>[]
  >;
}

async function projectOptionsCooperatively<T>(
  cache: WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>,
  assembly: ProjectEvaluationAssembly,
  key: string,
  values: readonly T[],
  queries: readonly ProjectCandidateSessionQuery[],
  catalog: Catalog,
  options: CandidateSessionFactoryOptions,
  yieldToHost: () => Promise<void>,
): Promise<readonly CandidateOptionProjection<T>[]> {
  const cached = cache.get(assembly)?.options.get(key);
  if (cached !== undefined) {
    return cached as readonly CandidateOptionProjection<T>[];
  }
  await yieldToHost();
  const projectCache = requireProjectCache(cache, assembly, catalog, options);
  const existing = projectCache.options.get(key);
  if (existing !== undefined) {
    return existing as readonly CandidateOptionProjection<T>[];
  }
  const projected: CandidateOptionProjection<T, CandidateProjectionEvaluation>[] = [];
  for (const [index, query] of queries.entries()) {
    const evaluation = projectCache.evaluator.evaluate([query])[0];
    if (evaluation === undefined) {
      throw new Error(`candidate projection ${key} omitted value ${index}`);
    }
    projected.push(
      Object.freeze({
        value: values[index]!,
        evaluation: candidateOptionEvaluation(evaluation),
      }),
    );
    if (index + 1 < queries.length) {
      await yieldToHost();
    }
  }
  const result = Object.freeze(projected) as readonly CandidateOptionProjection<T>[];
  projectCache.options.set(key, result);
  return result;
}

export function createCandidateSessionFactory(
  catalog: Catalog,
  options: CandidateSessionFactoryOptions = {},
): CandidateSessionFactory {
  const yieldToHost =
    options.yieldToHost ??
    (() =>
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }));
  const cache = new WeakMap<ProjectEvaluationAssembly, ProjectCandidateProjectionCache>();
  const rewardTypeDomainCache = new WeakMap<
    ProjectEvaluationAssembly,
    Map<string, readonly string[]>
  >();
  const preparedRewardDomainCache = new Map<string, PreparedRewardDomain>();
  const pendingRewardDomains = new WeakMap<
    ProjectEvaluationAssembly,
    Map<string, Promise<ProjectedRewardDomain>>
  >();
  const boundSessionCache = new WeakMap<ProjectEvaluationAssembly, CandidateProjectionSession>();
  const prepareCachedRewardDomain = (
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ): PreparedRewardDomain => {
    const key = domainKey([...rewardTypes, offerKey(selected)]);
    const existing = preparedRewardDomainCache.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const prepared = prepareRewardDomain(catalog, rewardTypes, selected);
    preparedRewardDomainCache.set(key, prepared);
    return prepared;
  };
  const countedRewardTypesFor = (
    assembly: ProjectEvaluationAssembly,
    owner: CountedRewardCandidateOwner,
    binding: CountedRewardBinding,
    selectedRewardType: string,
  ): readonly string[] => {
    let projectCache = rewardTypeDomainCache.get(assembly);
    if (projectCache === undefined) {
      projectCache = new Map();
      rewardTypeDomainCache.set(assembly, projectCache);
    }
    const selectable = countedRewardTypeDomain(catalog, assembly, owner.address, binding);
    const key = `reward-types:${semanticAddressKey(owner.address)}:${domainKey(selectable)}:${selectedRewardType}`;
    const existing = projectCache.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const domain = selectable.includes(selectedRewardType)
      ? selectable
      : Object.freeze([...selectable, selectedRewardType]);
    projectCache.set(key, domain);
    return domain;
  };
  const rewardDomainFor = (
    assembly: ProjectEvaluationAssembly,
    owner: RewardCandidateOwner,
    rewardTypes: readonly string[],
    selected: ResolvedRewardOffer,
  ): Promise<ProjectedRewardDomain> => {
    const prepared = prepareCachedRewardDomain(rewardTypes, selected);
    const offers = rewardDomainOffers(prepared);
    const candidateKey = `reward-domain:${semanticAddressKey(owner.address)}:${domainKey(offers.map(offerKey))}`;
    const pendingKey = `${candidateKey}:selected:${offerKey(selected)}`;
    let projectPending = pendingRewardDomains.get(assembly);
    if (projectPending === undefined) {
      projectPending = new Map();
      pendingRewardDomains.set(assembly, projectPending);
    }
    const existing = projectPending.get(pendingKey);
    if (existing !== undefined) {
      return existing;
    }
    const pending = projectOptionsCooperatively(
      cache,
      assembly,
      candidateKey,
      offers,
      rewardQueries(owner, offers),
      catalog,
      options,
      yieldToHost,
    )
      .then((candidates) => projectRewardDomain(prepared, candidates))
      .finally(() => {
        projectPending?.delete(pendingKey);
      });
    projectPending.set(pendingKey, pending);
    return pending;
  };
  const startRoomsFor = (
    assembly: ProjectEvaluationAssembly,
    owner: BiomeAddress | OccurrenceAddress,
    rooms: readonly RoomDeclaration[],
  ) =>
    projectOptions(
      cache,
      assembly,
      `start:${semanticAddressKey(owner)}:${domainKey(rooms.map((room) => room.gameName))}`,
      rooms,
      rooms.map((room) => ({ kind: 'startRoom', owner, gameName: room.gameName })),
      catalog,
      options,
    );
  const roomTargetsFor = (
    assembly: ProjectEvaluationAssembly,
    target: TargetAddress,
    rooms: readonly RoomDeclaration[],
  ) =>
    projectOptions(
      cache,
      assembly,
      `target:${semanticAddressKey(target)}:${domainKey(rooms.map((room) => room.gameName))}`,
      rooms,
      rooms.map((room) => ({ kind: 'roomTarget', target, gameName: room.gameName })),
      catalog,
      options,
    );
  const encounterPhasesFor = (
    assembly: ProjectEvaluationAssembly,
    phase: EncounterPhaseAddress,
    encounterKeys: readonly string[],
  ): readonly CandidateOptionProjection<string, EncounterCandidateProjectionEvaluation>[] => {
    const key = `encounter:${semanticAddressKey(phase)}:${domainKey(encounterKeys)}`;
    const projectCache = requireProjectCache(cache, assembly, catalog, options);
    const existing = projectCache.options.get(key);
    if (existing !== undefined) {
      return existing as readonly CandidateOptionProjection<
        string,
        EncounterCandidateProjectionEvaluation
      >[];
    }
    const support = encounterPhaseCandidateSupportForProjectEvaluationAssembly(assembly, phase);
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
                    support: (candidateKeys.length === 1
                      ? 'forced'
                      : 'possible') as CandidateSupport,
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
    projectCache.options.set(key, projected);
    return projected;
  };
  const bind = (assembly: ProjectEvaluationAssembly): CandidateProjectionSession => {
    const existing = boundSessionCache.get(assembly);
    if (existing !== undefined) {
      return existing;
    }
    requireProjectCache(cache, assembly, catalog, options);
    const { evaluation, project } = assembly;
    const session = Object.freeze({
      project,
      evaluation,
      prepareRewardDomain: prepareCachedRewardDomain,
      countedRewardTypes: (
        owner: CountedRewardCandidateOwner,
        binding: CountedRewardBinding,
        selectedRewardType: string,
      ) => countedRewardTypesFor(assembly, owner, binding, selectedRewardType),
      rewardDomain: (
        owner: RewardCandidateOwner,
        rewardTypes: readonly string[],
        selected: ResolvedRewardOffer,
      ) => rewardDomainFor(assembly, owner, rewardTypes, selected),
      startRooms: (owner: BiomeAddress | OccurrenceAddress, rooms: readonly RoomDeclaration[]) =>
        startRoomsFor(assembly, owner, rooms),
      roomTargets: (target: TargetAddress, rooms: readonly RoomDeclaration[]) =>
        roomTargetsFor(assembly, target, rooms),
      encounterPhases: (phase: EncounterPhaseAddress, encounterKeys: readonly string[]) =>
        encounterPhasesFor(assembly, phase, encounterKeys),
      batchRewardStores: (rewardStore: BatchRewardStoreAddress, storeKeys: readonly string[]) =>
        projectOptions(
          cache,
          assembly,
          `store:${semanticAddressKey(rewardStore)}:${domainKey(storeKeys)}`,
          storeKeys,
          storeKeys.map((storeKey) => ({ kind: 'batchRewardStore', rewardStore, storeKey })),
          catalog,
          options,
        ),
      fieldsCageOutcomes: (decision: ExitDecisionAddress, outcomes: readonly ('min' | 'max')[]) =>
        projectOptions(
          cache,
          assembly,
          `fields:${semanticAddressKey(decision)}:${domainKey(outcomes)}`,
          outcomes,
          outcomes.map((cageOutcome) => ({
            kind: 'fieldsCageOutcome',
            decision,
            cageOutcome,
          })),
          catalog,
          options,
        ),
      shipCombatPhaseCounts: (occurrence: OccurrenceAddress, values: readonly (2 | 3)[]) =>
        projectOptions(
          cache,
          assembly,
          `ship-encounters:${semanticAddressKey(occurrence)}:${domainKey(values.map(String))}`,
          values,
          values.map((encounterCount) => ({
            kind: 'shipEncounterCount',
            occurrence,
            encounterCount,
          })),
          catalog,
          options,
        ),
      rewardWheelOfferCounts: (wheel: RewardWheelAddress, values: readonly number[]) =>
        projectOptions(
          cache,
          assembly,
          `wheel-count:${semanticAddressKey(wheel)}:${domainKey(values.map(String))}`,
          values,
          values.map((offerCount) => ({ kind: 'rewardWheelOfferCount', wheel, offerCount })),
          catalog,
          options,
        ),
      rewardWheelStores: (wheel: RewardWheelAddress, storeKeys: readonly string[]) =>
        projectOptions(
          cache,
          assembly,
          `wheel-store:${semanticAddressKey(wheel)}:${domainKey(storeKeys)}`,
          storeKeys,
          storeKeys.map((storeKey) => ({ kind: 'rewardWheelStore', wheel, storeKey })),
          catalog,
          options,
        ),
      rewardWheelPicks: (wheel: RewardWheelAddress, values: readonly number[]) =>
        projectOptions(
          cache,
          assembly,
          `wheel-pick:${semanticAddressKey(wheel)}:${domainKey(values.map(String))}`,
          values,
          values.map((pickedOfferIndex) => ({
            kind: 'rewardWheelPicked',
            wheel,
            pickedOfferIndex,
          })),
          catalog,
          options,
        ),
      hubSlots: (slot: HubSlotAddress, occurrenceId: OccurrenceId, values: readonly boolean[]) =>
        projectOptions(
          cache,
          assembly,
          `hub-slot:${semanticAddressKey(slot)}:${occurrenceId}:${domainKey(values.map(String))}`,
          values,
          values.map((open) => ({ kind: 'hubSlot', slot, open, occurrenceId })),
          catalog,
          options,
        ),
      hubVisitOrders: (hub: HubDecisionAddress, values: readonly (readonly string[])[]) =>
        projectOptions(
          cache,
          assembly,
          `hub-visit-order:${semanticAddressKey(hub)}:${domainKey(
            values.map((value) => JSON.stringify(value)),
          )}`,
          values,
          values.map((hubSlotKeys) => ({ kind: 'hubVisitOrder', hub, hubSlotKeys })),
          catalog,
          options,
        ),
      sideRoomGenerations: (sideRoom: LocalChildAddress, values: readonly SideRoomGeneration[]) =>
        projectOptions(
          cache,
          assembly,
          `side-generation:${semanticAddressKey(sideRoom)}:${domainKey(values)}`,
          values,
          values.map((generation) => ({ kind: 'sideRoomGeneration', sideRoom, generation })),
          catalog,
          options,
        ),
      sideRoomEntryOrders: (
        group: LocalChildGroupAddress,
        values: readonly (readonly string[])[],
      ) =>
        projectOptions(
          cache,
          assembly,
          `side-entry-order:${semanticAddressKey(group)}:${domainKey(values.map((value) => JSON.stringify(value)))}`,
          values,
          values.map((enteredSlotKeys) => ({
            kind: 'sideRoomEntryOrder',
            group,
            enteredSlotKeys,
          })),
          catalog,
          options,
        ),
      acquisitionOrders: (site: AcquisitionSiteAddress, values: readonly (readonly string[])[]) =>
        projectOptions(
          cache,
          assembly,
          `acquisition-order:${semanticAddressKey(site)}:${domainKey(
            values.map((value) => JSON.stringify(value)),
          )}`,
          values,
          values.map((entryKeys) => ({
            kind: 'acquisitionOrder',
            site,
            entryKeys,
          })),
          catalog,
          options,
        ),
      traitOffer: (owner: TraitOfferAddress, value: AuthoredTraitOffer) =>
        projectOptions(
          cache,
          assembly,
          `trait-offer:${semanticAddressKey(owner)}:${JSON.stringify(value)}`,
          [value],
          [{ kind: 'traitOffer', trait: owner, value }],
          catalog,
          options,
        ),
      traitOfferStartingDraft: (owner: TraitOfferAddress, giverKey: string) => {
        const draft = requireProjectCache(
          cache,
          assembly,
          catalog,
          options,
        ).evaluator.traitOfferStartingDraft(owner, giverKey);
        return draft?.kind === 'traits' ? draft : undefined;
      },
      nextTraitOfferDraft: (owner: TraitOfferAddress, value: AuthoredTraitOfferTraits) => {
        const draft = requireProjectCache(
          cache,
          assembly,
          catalog,
          options,
        ).evaluator.nextTraitOfferDraft(owner, value);
        return draft?.kind === 'traits' ? draft : undefined;
      },
      traitOfferFocusedOptions: (
        owner: TraitOfferAddress,
        value: AuthoredTraitOffer,
        optionKey: TraitOptionKey,
        variants: readonly AuthoredTraitOption[],
      ) =>
        projectOptions(
          cache,
          assembly,
          `trait-offer-focused:${semanticAddressKey(owner)}:${JSON.stringify(value)}:${optionKey}:${domainKey(
            variants.map(traitOptionKey),
          )}`,
          variants,
          variants.map((option) => ({
            kind: 'traitOfferFocusedOption' as const,
            optionKey,
            trait: owner,
            value: offerWithFocusedOption(value, optionKey, option),
          })),
          catalog,
          options,
        ),
      traitAcquisitionTargets: (
        owner: TraitOfferAddress,
        value: AuthoredTraitOffer,
        optionKey: TraitOptionKey,
        retainedTargetTraitKey?: string,
      ) => {
        const key = `trait-acquisition-targets:${semanticAddressKey(owner)}:${JSON.stringify(value)}:${optionKey}:${retainedTargetTraitKey ?? ''}`;
        const projectCache = requireProjectCache(cache, assembly, catalog, options);
        const existing = projectCache.options.get(key);
        if (existing !== undefined) {
          return existing as readonly CandidateOptionProjection<
            string,
            CandidateProjectionEvaluation
          >[];
        }
        const evaluation = projectCache.evaluator.evaluate({
          kind: 'traitAcquisitionTargetDomain',
          trait: owner,
          value,
          optionKey,
          ...(retainedTargetTraitKey === undefined ? {} : { retainedTargetTraitKey }),
        });
        const projected = Object.freeze(
          evaluation.kind === 'unavailable'
            ? retainedTargetTraitKey === undefined
              ? []
              : [Object.freeze({ value: retainedTargetTraitKey, evaluation })]
            : evaluation.result.candidates.map((candidate) =>
                Object.freeze({ value: candidate.result.traitKey, evaluation: candidate }),
              ),
        );
        projectCache.options.set(key, projected);
        return projected;
      },
      circeResolution: (
        owner: TraitOfferAddress,
        value: AuthoredTraitOffer,
        optionKey: TraitOptionKey,
      ) =>
        requireProjectCache(cache, assembly, catalog, options).evaluator.evaluate({
          kind: 'circeResolutionDomain',
          trait: owner,
          value,
          optionKey,
        }),
      echoPomTarget: (
        owner: TraitOfferAddress,
        value: AuthoredTraitOffer,
        optionKey: TraitOptionKey,
      ) =>
        requireProjectCache(cache, assembly, catalog, options).evaluator.evaluate({
          kind: 'echoPomTargetDomain',
          trait: owner,
          value,
          optionKey,
        }),
      echoLastRunBoon: (
        owner: TraitOfferAddress,
        value: AuthoredTraitOffer,
        optionKey: TraitOptionKey,
      ) =>
        requireProjectCache(cache, assembly, catalog, options).evaluator.evaluate({
          kind: 'echoLastRunBoonDomain',
          trait: owner,
          value,
          optionKey,
        }),
      echoLastReward: (
        owner: TraitOfferAddress,
        value: AuthoredTraitOffer,
        optionKey: TraitOptionKey,
      ) =>
        requireProjectCache(cache, assembly, catalog, options).evaluator.evaluate({
          kind: 'echoLastRewardDomain',
          trait: owner,
          value,
          optionKey,
        }),
      levelResolution: (owner: LevelResolutionAddress, value: AuthoredLevelResolution) => {
        const capability = levelResolutionCandidateForProjectEvaluationAssembly(assembly, owner);
        if (capability === undefined) return undefined;
        const evaluations = capability.evaluate(value);
        const groups = new Map<
          string,
          {
            surface: LevelResolutionCandidateSurface;
            branchIndices: number[];
            evaluations: (typeof evaluations)[number][];
          }
        >();
        for (const [branchIndex, surface] of capability.branches.entries()) {
          const key = JSON.stringify([
            surface.effectKind,
            surface.emptyTargetAllowed ?? false,
            surface.levelCount,
            surface.requiredOfferCount,
            surface.eligibleTargetTraitKeys,
          ]);
          const entry = groups.get(key) ?? { surface, branchIndices: [], evaluations: [] };
          entry.branchIndices.push(branchIndex);
          const evaluation = evaluations.find((candidate) => candidate.branchIndex === branchIndex);
          if (evaluation !== undefined) entry.evaluations.push(evaluation);
          groups.set(key, entry);
        }
        return Object.freeze({
          groups: Object.freeze(
            [...groups.entries()].map(([key, group]) =>
              Object.freeze({
                key,
                surface: group.surface,
                branchIndices: Object.freeze(group.branchIndices),
                evaluations: Object.freeze(group.evaluations),
              }),
            ),
          ),
        });
      },
      bossCompletionArcana: (owner: BossCompletionArcanaAddress, arcanaKeys: readonly string[]) =>
        requireProjectCache(cache, assembly, catalog, options).evaluator.evaluate({
          kind: 'bossCompletionArcana',
          completion: owner,
          arcanaKeys,
        }),
      keepsakeSelections: (owner: KeepsakeSelectionAddress) => {
        const evaluation = requireProjectCache(
          cache,
          assembly,
          catalog,
          options,
        ).evaluator.evaluate({
          kind: 'keepsakeSelection',
          selection: owner,
        });
        if (evaluation.kind === 'unavailable') return Object.freeze([]);
        if (evaluation.kind !== 'keepsakeSelection') {
          throw new Error(
            `Keepsake candidate ${semanticAddressKey(owner)} returned ${evaluation.kind}`,
          );
        }
        return Object.freeze(
          evaluation.result.options.map((option) =>
            Object.freeze({
              value: option.key,
              // The engine publishes support per option. This shallow projection
              // preserves the exact evidence while adapting the shared picker shape.
              evaluation: Object.freeze({
                ...evaluation,
                result: Object.freeze({
                  ...evaluation.result,
                  selectedPossible: option.selectedPossible,
                }),
              }),
            }),
          ),
        );
      },
      acquisitionConversion: (owner: AcquisitionRoleAddress) =>
        requireProjectCache(cache, assembly, catalog, options).evaluator.evaluate({
          kind: 'acquisitionConversion',
          acquisition: owner,
        }) as CandidateProjectionEvaluation,
      keepsakeEquipResult: (
        owner: KeepsakeEquipResultAddress,
        value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults[keyof import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults],
      ) => {
        const evaluation = requireProjectCache(
          cache,
          assembly,
          catalog,
          options,
        ).evaluator.evaluate({
          kind: 'keepsakeEquipResult',
          result: owner,
          ...(value === undefined ? {} : { value }),
        });
        if (evaluation.kind === 'unavailable') return Object.freeze([]);
        if (evaluation.kind !== 'keepsakeEquipResult')
          throw new Error(
            `Keepsake equip result ${semanticAddressKey(owner)} returned ${evaluation.kind}`,
          );
        return Object.freeze(
          evaluation.result.options.map((option) =>
            Object.freeze({
              value: option.traitKey,
              evaluation: Object.freeze({
                ...evaluation,
                result: Object.freeze({
                  ...evaluation.result,
                  selectedPossible: option.selectedPossible,
                }),
              }),
            }),
          ),
        );
      },
      takeoverPrebossBatches: (source: ExitDecisionAddress, gameNames: readonly string[]) =>
        projectOptions(
          cache,
          assembly,
          `takeover:${semanticAddressKey(source)}:${domainKey(gameNames)}`,
          gameNames,
          gameNames.map((gameName) => ({ kind: 'takeoverPrebossBatch', source, gameName })),
          catalog,
          options,
        ),
      hubTerminalTakeover: (source: ExitDecisionAddress) => {
        const [candidate] = projectOptions(
          cache,
          assembly,
          `hub-takeover:${semanticAddressKey(source)}`,
          Object.freeze([source]),
          Object.freeze([{ kind: 'hubTerminalTakeover' as const, source }]),
          catalog,
          options,
        );
        if (candidate === undefined) {
          throw new Error(`Hub terminal candidate ${semanticAddressKey(source)} is missing`);
        }
        return candidate;
      },
    });
    boundSessionCache.set(assembly, session);
    return session;
  };
  return Object.freeze({ bind });
}

export type CandidateSupport = 'forced' | 'impossible' | 'possible' | 'unavailable';

function candidateSelectedPossible(evaluation: CandidateProjectionEvaluation): boolean {
  switch (evaluation.kind) {
    case 'encounter':
      return evaluation.result.support === 'forced' || evaluation.result.support === 'possible';
    case 'unavailable':
      return false;
    case 'roomTarget':
      return evaluation.result.pressure.selectedPossible;
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'acquisitionEntryOffer':
    case 'acquisitionOrder':
      return evaluation.result.supported;
    case 'takeoverPrebossBatch':
      return evaluation.result.support !== 'impossible';
    case 'hubTerminalTakeover':
      return evaluation.result.support !== 'impossible';
    case 'traitOffer':
      return evaluation.result.supported;
    case 'traitOfferFocusedOption':
    case 'traitAcquisitionTarget':
      return evaluation.result.supported;
    case 'bossCompletionArcana':
      return evaluation.result.selectedPossible;
    case 'keepsakeSelection':
      return evaluation.result.selectedPossible;
    case 'acquisitionConversion':
      return evaluation.result.goldSupported;
    default:
      return evaluation.result.selectedPossible;
  }
}

function candidateForced(
  evaluation: Exclude<CandidateProjectionEvaluation, { readonly kind: 'unavailable' }>,
): boolean {
  switch (evaluation.kind) {
    case 'encounter':
      return evaluation.result.support === 'forced';
    case 'bossCompletionArcana':
    case 'keepsakeSelection':
    case 'keepsakeEquipResult':
    case 'acquisitionConversion':
      return false;
    case 'roomTarget':
      return (
        evaluation.result.pressure.selectedPossible &&
        evaluation.result.pressure.requiredForcedRoomGameNames.includes(
          evaluation.result.pressure.selectedGameName,
        )
      );
    case 'startRoom':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportedGameNames.length === 1
      );
    case 'batchRewardStore':
      return evaluation.result.selectedPossible && evaluation.result.supportStoreKeys.length === 1;
    case 'fieldsCageOutcome':
      return evaluation.result.selectedPossible && evaluation.result.supportOutcomes.length === 1;
    case 'shipEncounterCount':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportEncounterCounts.length === 1
      );
    case 'rewardWheelStore':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportedStoreKeys.length === 1
      );
    case 'hubSlot':
    case 'hubVisitOrder':
    case 'rewardWheelOfferCount':
    case 'rewardWheelPicked':
    case 'sideRoomGeneration':
    case 'sideRoomEntryOrder':
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'acquisitionEntryOffer':
    case 'acquisitionOrder':
      return false;
    case 'takeoverPrebossBatch':
      return evaluation.result.support === 'required';
    case 'hubTerminalTakeover':
      return evaluation.result.support === 'required';
    case 'traitOffer':
    case 'traitOfferFocusedOption':
    case 'traitAcquisitionTarget':
      return false;
  }
}

export function candidateSupport(
  option: CandidateOptionProjection<unknown, CandidateProjectionEvaluation> | undefined,
): CandidateSupport {
  if (option === undefined || option.evaluation.kind === 'unavailable') return 'unavailable';
  if (option.evaluation.kind === 'encounter') return option.evaluation.result.support;
  if (!candidateSelectedPossible(option.evaluation)) return 'impossible';
  return candidateForced(option.evaluation) ? 'forced' : 'possible';
}

export function presentCandidateLabel(
  label: string,
  option: CandidateOptionProjection<unknown, CandidateProjectionEvaluation> | undefined,
): string {
  return candidateSupport(option) === 'impossible' ? `${label} — unavailable` : label;
}
