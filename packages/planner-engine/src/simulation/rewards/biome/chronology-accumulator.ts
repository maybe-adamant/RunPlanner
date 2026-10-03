import type { TimedEffectContact } from '../timed-effects/contacts';
import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
  type HubDecisionAddress,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TraitOfferOwnerAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '../../../authored-project/addresses';
import type { ResolvedRewardOffer, ShopOptionSelection } from '../../../reward-kernel';
import type { JudgmentArcanaCandidateCapability } from '../../arcana-fear';
import {
  findingIdentityKey,
  type FindingChronology,
  type FindingRegionEntry,
} from '../../finding-regions';
import type {
  FigurineArcanaCandidateCapability,
  FountainRarityCandidateCapability,
  KeepsakeEquipResultCandidateCapability,
  KeepsakeSelectionCandidateCapability,
} from '../../keepsakes/candidate-artifacts';
import type { ReachedTranscendentEmbryoThreshold } from '../../keepsakes/trait-effects';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../materialization';
import type { SemanticFinding } from '../../model';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  type PlannerTimelineDependency,
  type PlannerTimelineFacts,
  type PlannerTimelineNode,
} from '../../timeline-facts';
import type { ReachedLevelResolutionEvaluation, TraitOfferCandidateContext } from '../../traits';
import { traitOfferContextIdentity } from '../../traits';
import type { ReachedSteadyGrowthThreshold } from '../../traits/history/transitions';
import type {
  AcquisitionRoleFrontier,
  GeneratedPickupPlacement,
  DerivedAcquisitionEntryFrontier,
} from '../acquisition/contracts';
import type { RewardBranchState } from '../branch-primitives';
import { addRewardFinding, mergeRewardFindingEmissions } from '../findings';
import type {
  BiomeRewardSimulation,
  BossArcanaOutcome,
  FigLeafPhaseCandidateSupport,
  GorgonPhaseCandidateSupport,
  HubDepartureRunState,
  NemesisRandomEventCandidateSupport,
  RewardStoreSupportEntry,
  TargetRewardHistoryCheckpoint,
} from '../model';
import { indexRewardProducerFrontier, type RewardProducerFrontier } from '../producer-frontiers';
import type { RunStateSnapshot } from '../run-state';
import type {
  ReachedTraitChildCheckpoint,
  ReachedTraitOfferCandidateContact,
} from '../trait-settlement/coordinator';
import { BiomeRewardSimulationContractError } from './biome-contract';
import type { AuthoredSiteSettlementResult } from './generation/authored-site-settlement';

function fail(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

/** A finding added through the merging writer; an evaluation joins the existing entry. */
export interface AddedChronologyFinding {
  readonly finding: SemanticFinding;
  readonly atomicRegion: string;
  readonly chronology?: FindingChronology | undefined;
  readonly levelResolutionEvaluation?: ReachedLevelResolutionEvaluation;
}

/**
 * One ordered accumulator write. Findings name their write rule: `add` merges
 * into the identity entry, `set` replaces it in place, `merge` expands each
 * entry's level-resolution evaluations through `add`.
 */
export type ChronologyEmission =
  | {
      readonly kind: 'generatedPickupPlacements';
      readonly placements: readonly GeneratedPickupPlacement[];
    }
  | {
      readonly kind: 'findings';
      readonly rule: 'add';
      readonly entries: readonly AddedChronologyFinding[];
    }
  | {
      readonly kind: 'findings';
      readonly rule: 'set' | 'merge';
      readonly entries: readonly FindingRegionEntry[];
    }
  | {
      readonly kind: 'acquisitionRoleFrontiers';
      readonly frontiers: readonly AcquisitionRoleFrontier[] | undefined;
    }
  | {
      readonly kind: 'traitOfferCandidateContacts';
      readonly contacts: readonly ReachedTraitOfferCandidateContact[] | undefined;
    }
  | {
      readonly kind: 'derivedAcquisitionEntryFrontiers';
      readonly frontiers: readonly DerivedAcquisitionEntryFrontier[] | undefined;
    }
  | {
      readonly kind: 'timelineFacts';
      readonly facts:
        | {
            readonly nodes?: readonly PlannerTimelineNode[];
            readonly dependencies?: readonly PlannerTimelineDependency[];
          }
        | undefined;
    }
  | {
      readonly kind: 'traitChildSettlements';
      readonly checkpoints: readonly ReachedTraitChildCheckpoint[] | undefined;
      readonly occurrenceOwner: SemanticAddress;
    }
  | { readonly kind: 'producerFrontiers'; readonly frontiers: readonly RewardProducerFrontier[] }
  | {
      readonly kind: 'runStateSnapshot';
      readonly ownerKey: string;
      readonly snapshot: RunStateSnapshot;
    }
  | {
      readonly kind: 'traitChildRunStateSnapshot';
      readonly childKey: string;
      readonly ownerKey: string;
      readonly snapshot: RunStateSnapshot;
    }
  | { readonly kind: 'targetHistory'; readonly checkpoint: TargetRewardHistoryCheckpoint }
  | { readonly kind: 'storeSupport'; readonly entries: readonly RewardStoreSupportEntry[] }
  | {
      readonly kind: 'hubDeparture';
      readonly hub: HubDecisionAddress;
      readonly hubGameName: string;
      readonly departure: RunStateSnapshot;
      /** A fountain use replaces the current interval's departure. */
      readonly replace: boolean;
    }
  | {
      readonly kind: 'keepsakeSelectionCandidate';
      readonly key: string;
      readonly candidate: KeepsakeSelectionCandidateCapability;
    }
  | {
      readonly kind: 'keepsakeEquipResultCandidates';
      readonly candidates: readonly {
        readonly key: string;
        readonly candidate: KeepsakeEquipResultCandidateCapability;
      }[];
    }
  | {
      readonly kind: 'echoKeepsakeReplayOutcome';
      readonly outcome: BiomeRewardSimulation['volatileEchoKeepsakeReplay'];
    }
  | {
      readonly kind: 'figLeafPhaseCandidates';
      readonly candidates: readonly {
        readonly key: string;
        readonly candidate: FigLeafPhaseCandidateSupport;
      }[];
    }
  | {
      readonly kind: 'gorgonPhaseCandidate';
      readonly key: string;
      readonly candidate: GorgonPhaseCandidateSupport;
    }
  | {
      readonly kind: 'judgmentArcanaCandidate';
      readonly key: string;
      readonly candidate: JudgmentArcanaCandidateCapability;
    }
  | {
      readonly kind: 'figurineArcanaCandidate';
      readonly key: string;
      readonly candidate: FigurineArcanaCandidateCapability;
    }
  | {
      readonly kind: 'nemesisRandomEventCandidate';
      readonly key: string;
      readonly candidate: NemesisRandomEventCandidateSupport;
    }
  | { readonly kind: 'bossArcanaOutcomes'; readonly outcomes: readonly BossArcanaOutcome[] }
  | {
      readonly kind: 'timedEffectContacts';
      readonly contacts: readonly TimedEffectContact[];
    }
  | {
      readonly kind: 'steadyGrowthThresholds';
      readonly thresholds: readonly {
        readonly address: SteadyGrowthOutcomeAddress;
        readonly threshold: ReachedSteadyGrowthThreshold;
      }[];
    }
  | {
      readonly kind: 'transcendentEmbryoThresholds';
      readonly thresholds: readonly {
        readonly address: TranscendentEmbryoOutcomeAddress;
        readonly threshold: ReachedTranscendentEmbryoThreshold;
      }[];
    }
  | {
      readonly kind: 'fountainRarityCandidate';
      readonly key: string;
      readonly candidate: FountainRarityCandidateCapability;
    };

export interface TraitChildSettlementAccumulation {
  readonly address: SemanticAddress;
  readonly occurrenceOwner: SemanticAddress;
  readonly branches: readonly RewardBranchState[];
  readonly candidateContexts: readonly TraitOfferCandidateContext[];
  readonly runStateSnapshots: ReadonlyMap<string, RunStateSnapshot>;
}

/** The biome accumulators, complete once the walk and finalization have merged everything. */
export interface ChronologyAccumulation {
  readonly timedEffects: readonly TimedEffectContact[];
  readonly generatedPickupPlacements: readonly GeneratedPickupPlacement[];
  readonly findingRegions: readonly FindingRegionEntry[];
  readonly producerFrontiers: ReadonlyMap<string, RewardProducerFrontier>;
  readonly reachedTraitOfferCandidateContexts: ReadonlyMap<
    string,
    readonly TraitOfferCandidateContext[]
  >;
  readonly acquisitionConversionContexts: ReadonlyMap<string, readonly AcquisitionRoleFrontier[]>;
  readonly derivedAcquisitionEntryContexts: ReadonlyMap<
    string,
    readonly DerivedAcquisitionEntryFrontier[]
  >;
  readonly timelineFacts: PlannerTimelineFacts;
  readonly runStateSnapshots: readonly RunStateSnapshot[];
  readonly traitChildSettlements: ReadonlyMap<string, TraitChildSettlementAccumulation>;
  readonly targetHistory: readonly TargetRewardHistoryCheckpoint[];
  readonly storeSupport: readonly RewardStoreSupportEntry[];
  readonly hubDepartures: readonly HubDepartureRunState[];
  readonly echoKeepsakeReplayOutcome: BiomeRewardSimulation['volatileEchoKeepsakeReplay'];
  readonly keepsakeSelectionContexts: ReadonlyMap<string, KeepsakeSelectionCandidateCapability>;
  readonly keepsakeEquipResultContexts: ReadonlyMap<string, KeepsakeEquipResultCandidateCapability>;
  readonly figLeafPhaseCandidates: readonly FigLeafPhaseCandidateSupport[];
  readonly gorgonPhaseCandidates: readonly GorgonPhaseCandidateSupport[];
  readonly nemesisRandomEventCandidates: readonly NemesisRandomEventCandidateSupport[];
  readonly judgmentArcanaContexts: ReadonlyMap<string, JudgmentArcanaCandidateCapability>;
  readonly figurineArcanaContexts: ReadonlyMap<string, FigurineArcanaCandidateCapability>;
  readonly bossArcanaOutcomes: readonly BossArcanaOutcome[];
  readonly steadyGrowthCandidateContexts: ReadonlyMap<
    string,
    readonly ReachedSteadyGrowthThreshold[]
  >;
  readonly steadyGrowthOutcomeAddresses: ReadonlyMap<string, SteadyGrowthOutcomeAddress>;
  readonly transcendentEmbryoCandidateContexts: ReadonlyMap<
    string,
    readonly ReachedTranscendentEmbryoThreshold[]
  >;
  readonly transcendentEmbryoOutcomeAddresses: ReadonlyMap<
    string,
    TranscendentEmbryoOutcomeAddress
  >;
  readonly fountainRarityCandidateContexts: ReadonlyMap<string, FountainRarityCandidateCapability>;
}

/**
 * Stage-local builder for one biome chronology. Every write goes through
 * `mergeEmissions`, which applies emissions in order; `finish` ends writing.
 */
export interface ChronologyAccumulator {
  mergeEmissions(emissions: readonly ChronologyEmission[]): void;
  findingEntries(): readonly FindingRegionEntry[];
  derivedAcquisitionEntryFrontiers(key: string): readonly DerivedAcquisitionEntryFrontier[];
  gorgonPhaseCandidate(key: string): GorgonPhaseCandidateSupport | undefined;
  hasRunStateSnapshot(ownerKey: string): boolean;
  hasTargetHistory(originKey: string): boolean;
  /** Trait-child settlements of one occurrence still lacking this owner's snapshot. */
  traitChildCheckpointsAwaiting(
    occurrenceOwner: SemanticAddress,
    ownerKey: string,
  ): readonly { readonly key: string; readonly branches: readonly RewardBranchState[] }[];
  finish(): ChronologyAccumulation;
}

function traitMutationAcquisitionContact(
  owner: SemanticAddress,
): { readonly owner: TraitOfferOwnerAddress; readonly acquisitionRole: string } | undefined {
  switch (owner.kind) {
    case 'traitOffer':
    case 'acquisitionRole':
    case 'levelResolution':
      return Object.freeze({ owner: owner.owner, acquisitionRole: owner.acquisitionRole });
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'naturalSelectionResult':
    case 'echoLastRunBoon':
    case 'echoLastReward':
    case 'allTogetherSet':
      return Object.freeze({
        owner: owner.trait.owner,
        acquisitionRole: owner.trait.acquisitionRole,
      });
    default:
      return undefined;
  }
}

/** Map a nested trait-history mutation back to the atomic Room Action that
 * execution publishes. The compiler receives only this already-resolved edge. */
function traitMutationTimelineOwner(
  owner: SemanticAddress,
  acquisitionRole: string,
  acquisitionFrontiers: ReadonlyMap<string, readonly AcquisitionRoleFrontier[]>,
): SemanticAddress {
  const contact = traitMutationAcquisitionContact(owner);
  const acquisitionOwner =
    contact?.owner ??
    (owner.kind === 'incomingReward' ||
    owner.kind === 'localReward' ||
    owner.kind === 'rewardWheelOffer' ||
    owner.kind === 'shopOffer' ||
    owner.kind === 'encounterPhase' ||
    owner.kind === 'gorgonPhase' ||
    owner.kind === 'acquisitionEntry'
      ? owner
      : undefined);
  if (acquisitionOwner !== undefined) {
    const address = createAcquisitionRoleAddress(
      acquisitionOwner,
      contact?.acquisitionRole ?? acquisitionRole,
    );
    const timelineOwners = new Map<string, SemanticAddress>();
    for (const frontier of acquisitionFrontiers.get(semanticAddressKey(address)) ?? []) {
      if (frontier.timelineOwner !== undefined)
        timelineOwners.set(semanticAddressKey(frontier.timelineOwner), frontier.timelineOwner);
    }
    if (timelineOwners.size > 1)
      throw new BiomeRewardSimulationContractError(
        `trait mutation ${semanticAddressKey(owner)} maps to multiple active Room Actions`,
      );
    const timelineOwner = timelineOwners.values().next().value as SemanticAddress | undefined;
    if (timelineOwner !== undefined) return timelineOwner;
  }
  return owner.kind === 'fountainRarityOutcome' ? owner.action : owner;
}

interface TraitChildSettlementBuilder {
  readonly address: SemanticAddress;
  readonly occurrenceOwner: SemanticAddress;
  readonly branches: RewardBranchState[];
  readonly candidateContexts: TraitOfferCandidateContext[];
  readonly runStateSnapshots: Map<string, RunStateSnapshot>;
}

export function createChronologyAccumulator(
  rooms: ReadonlyMap<string, CanonicalAuthoredRoom | CanonicalHubRoom>,
): ChronologyAccumulator {
  let finished = false;
  const findings = new Map<string, FindingRegionEntry>();
  const producerFrontiers = new Map<string, RewardProducerFrontier>();
  const reachedTraitOfferCandidateContexts = new Map<string, TraitOfferCandidateContext[]>();
  const reachedTraitOfferCandidateFingerprints = new Map<string, Set<string>>();
  const acquisitionConversionContexts = new Map<string, readonly AcquisitionRoleFrontier[]>();
  const timedEffects: TimedEffectContact[] = [];
  const generatedPickupPlacements = new Map<string, GeneratedPickupPlacement>();
  const derivedAcquisitionEntryContexts = new Map<
    string,
    readonly DerivedAcquisitionEntryFrontier[]
  >();
  const timelineFactNodes = new Map<string, PlannerTimelineNode>();
  const timelineFactDependencies = new Map<string, PlannerTimelineDependency>();
  const runStateSnapshotsByOwner = new Map<string, RunStateSnapshot>();
  const traitChildSettlementBuilders = new Map<string, TraitChildSettlementBuilder>();
  const targetHistoryByOrigin = new Map<string, TargetRewardHistoryCheckpoint>();
  const storeSupportEntries: RewardStoreSupportEntry[] = [];
  const hubDepartures: HubDepartureRunState[] = [];
  let echoKeepsakeReplayOutcome: BiomeRewardSimulation['volatileEchoKeepsakeReplay'];
  const keepsakeSelectionContexts = new Map<string, KeepsakeSelectionCandidateCapability>();
  const keepsakeEquipResultContexts = new Map<string, KeepsakeEquipResultCandidateCapability>();
  const figLeafPhaseCandidates = new Map<string, FigLeafPhaseCandidateSupport>();
  const gorgonPhaseCandidates = new Map<string, GorgonPhaseCandidateSupport>();
  const nemesisRandomEventCandidates = new Map<string, NemesisRandomEventCandidateSupport>();
  const judgmentArcanaContexts = new Map<string, JudgmentArcanaCandidateCapability>();
  const figurineArcanaContexts = new Map<string, FigurineArcanaCandidateCapability>();
  const bossArcanaOutcomes = new Map<string, BossArcanaOutcome>();
  const steadyGrowthCandidateContexts = new Map<string, ReachedSteadyGrowthThreshold[]>();
  const steadyGrowthOutcomeAddresses = new Map<string, SteadyGrowthOutcomeAddress>();
  const transcendentEmbryoCandidateContexts = new Map<
    string,
    ReachedTranscendentEmbryoThreshold[]
  >();
  const transcendentEmbryoOutcomeAddresses = new Map<string, TranscendentEmbryoOutcomeAddress>();
  const fountainRarityCandidateContexts = new Map<string, FountainRarityCandidateCapability>();

  function recordTimelineNode(owner: SemanticAddress, included: boolean): void {
    const key = semanticAddressKey(owner);
    const current = timelineFactNodes.get(key);
    if (current === undefined) timelineFactNodes.set(key, Object.freeze({ owner, included }));
    else if (included && !current.included)
      timelineFactNodes.set(
        key,
        Object.freeze({
          owner: current.owner,
          included: current.included || included,
        }),
      );
  }

  function recordTimelineDependency(owner: SemanticAddress, afterOwner: SemanticAddress): void {
    const ownerKey = semanticAddressKey(owner);
    const afterKey = semanticAddressKey(afterOwner);
    if (ownerKey === afterKey) return;
    timelineFactDependencies.set(
      `${ownerKey}\u0000${afterKey}`,
      Object.freeze({ owner, afterOwner }),
    );
  }

  function recordTraitOfferCandidateContacts(
    contacts: readonly ReachedTraitOfferCandidateContact[] | undefined,
  ): void {
    for (const contact of contacts ?? []) {
      const key = semanticAddressKey(contact.address);
      const fingerprint = JSON.stringify(traitOfferContextIdentity(contact.context));
      const fingerprints = reachedTraitOfferCandidateFingerprints.get(key) ?? new Set<string>();
      if (fingerprints.has(fingerprint)) continue;
      fingerprints.add(fingerprint);
      reachedTraitOfferCandidateFingerprints.set(key, fingerprints);
      const current = reachedTraitOfferCandidateContexts.get(key) ?? [];
      current.push(contact.context);
      reachedTraitOfferCandidateContexts.set(key, current);
    }
  }

  function recordAcquisitionRoleFrontiers(
    frontiers: readonly AcquisitionRoleFrontier[] | undefined,
  ): void {
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.address);
      acquisitionConversionContexts.set(
        key,
        Object.freeze([...(acquisitionConversionContexts.get(key) ?? []), frontier]),
      );
      recordTraitOfferCandidateContacts(frontier.traitOfferCandidateContacts);
      const replacement = frontier.artificerReplacementCandidate;
      const replacementKey = semanticAddressKey(frontier.artificerReplacementAddress);
      if (replacement !== undefined && !producerFrontiers.has(replacementKey))
        indexRewardProducerFrontier(
          producerFrontiers,
          Object.freeze({
            generationPolicy: 'sequential',
            generationHistorySequence: frontier.historySequence,
            reachableBranchCount: frontier.branchesBeforeRole.length,
            acquisitionHorizon: 'ownEnteredLifecycle',
            owners: Object.freeze([frontier.artificerReplacementAddress]),
            evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) =>
              semanticAddressKey(owner) === replacementKey
                ? replacement.evaluateOffer(offer)
                : fail('Artificer replacement frontier received a foreign owner'),
          }),
        );
      const consumerOwner = frontier.timelineOwner;
      // Optional acquisition actions are guidance until a planner-owned
      // resolution makes them a consequential contact. Blind boxes must be
      // retained for their provider resolution; authored trait/level screens,
      // generated children, and consumed Well effects likewise publish their
      // exact action owner here rather than asking execution to infer it.
      const roleOffer =
        frontier.source.traitOffersByAcquisitionRole?.[frontier.address.acquisitionRole];
      const roleLevel =
        frontier.source.levelResolutionsByAcquisitionRole?.[frontier.address.acquisitionRole];
      const consequential =
        frontier.source.offer.rewardType === 'BlindBoxLoot' ||
        frontier.source.producer !== undefined;
      if (consequential && consumerOwner === undefined)
        throw new BiomeRewardSimulationContractError(
          `reached acquisition ${semanticAddressKey(frontier.address)} has no active Room Action owner`,
        );
      if (consumerOwner === undefined) continue;
      if (
        frontier.source.offer.rewardType === 'BlindBoxLoot' ||
        (roleOffer !== undefined && roleOffer !== null) ||
        (roleLevel !== undefined && roleLevel !== null) ||
        frontier.source.producer !== undefined
      )
        recordTimelineNode(consumerOwner, true);
      for (const mutation of frontier.priorTraitMutations ?? [])
        recordTimelineDependency(
          consumerOwner,
          traitMutationTimelineOwner(
            mutation.owner,
            mutation.acquisitionRole,
            acquisitionConversionContexts,
          ),
        );
      const producer = frontier.source.producer;
      if (producer === undefined) continue;
      if (producer.sourceTimelineOwner !== undefined)
        recordTimelineDependency(consumerOwner, producer.sourceTimelineOwner);
    }
  }

  function recordDerivedAcquisitionEntryFrontiers(
    frontiers: readonly DerivedAcquisitionEntryFrontier[] | undefined,
  ): void {
    const incomingByOwner = new Map<string, DerivedAcquisitionEntryFrontier[]>();
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.inventoryOwner ?? frontier.address);
      incomingByOwner.set(key, [...(incomingByOwner.get(key) ?? []), frontier]);
    }
    for (const [key, incoming] of incomingByOwner) {
      const firstIncoming = incoming[0];
      const completeIncomingCohort =
        firstIncoming !== undefined && incoming.length === firstIncoming.branchCohortSize;
      const combined = Object.freeze(
        completeIncomingCohort
          ? incoming
          : [...(derivedAcquisitionEntryContexts.get(key) ?? []), ...incoming],
      );
      derivedAcquisitionEntryContexts.set(key, combined);
      const first = combined[0];
      if (first?.kind === 'travelDealRefill' && first.address.site.owner.kind === 'occurrence') {
        const origin = first.address.site.owner;
        const host = rooms.get(semanticAddressKey(origin));
        const authoredEntry =
          host?.kind === 'authored'
            ? host.entryState?.kind === 'shop'
              ? host.entryState.travelDealRefill
              : undefined
            : undefined;
        if (authoredEntry !== undefined) {
          const realizationOwner = createTravelDealRefillRealizationAddress(
            createBiomeAddress(origin.routeKey, origin.biomeKey),
            origin.occurrenceId,
          );
          recordTimelineNode(realizationOwner, true);
          const replacementAction =
            host?.kind === 'authored'
              ? host.roomActionRoster.rows.find(
                  (row) =>
                    !row.stale &&
                    row.rank !== null &&
                    row.reference.kind === 'interactAcquisitionEntry' &&
                    row.reference.siteKey === first.address.site.pointKey &&
                    row.reference.entryKey === first.address.entryKey,
                )
              : undefined;
          if (replacementAction !== undefined)
            recordTimelineDependency(replacementAction.owner, realizationOwner);
        }
      }
      if (
        (first?.kind !== 'travelDealRefill' &&
          first?.kind !== 'acquisitionResolvedReward' &&
          first?.kind !== 'echoDoubleShopReward') ||
        combined.length !== first.branchCohortSize ||
        combined.some((candidate) => candidate.evaluateOffer === undefined) ||
        producerFrontiers.has(key)
      )
        continue;
      recordAcquisitionRoleFrontiers(
        combined.flatMap((candidate) => candidate.roleFrontiers ?? Object.freeze([])),
      );
      indexRewardProducerFrontier(
        producerFrontiers,
        Object.freeze({
          generationPolicy:
            first.kind === 'travelDealRefill'
              ? ('jointShopInventory' as const)
              : ('sequential' as const),
          generationHistorySequence: Math.max(
            ...combined.flatMap((candidate) =>
              candidate.branchesBeforeEntry.map((branch) => branch.processedThroughHistorySequence),
            ),
          ),
          reachableBranchCount: combined.length,
          acquisitionHorizon:
            first.kind === 'travelDealRefill' ||
            (first.kind === 'echoDoubleShopReward' && first.fixedReward !== undefined)
              ? ('generationOnly' as const)
              : ('ownEnteredLifecycle' as const),
          owners: Object.freeze([first.inventoryOwner ?? first.address]),
          evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
            if (semanticAddressKey(owner) !== key)
              return fail('derived acquisition frontier received a foreign owner');
            const results = combined.map((candidate) => candidate.evaluateOffer!(offer));
            return Object.freeze({
              findings: Object.freeze(results.flatMap((result) => result.findings)),
              supported: results.every((result) => result.supported),
            });
          },
          ...(first.evaluateShopOption === undefined
            ? {}
            : {
                evaluateShopOption: (_owner: SemanticAddress, selection: ShopOptionSelection) => {
                  const results = combined.map((candidate) =>
                    candidate.evaluateShopOption!(selection),
                  );
                  return Object.freeze({
                    findings: Object.freeze(results.flatMap((result) => result.findings)),
                    supported: results.every((result) => result.supported),
                  });
                },
              }),
        }),
      );
    }
  }

  function recordTraitChildSettlements(
    checkpoints: readonly ReachedTraitChildCheckpoint[] | undefined,
    occurrenceOwner: SemanticAddress,
  ): void {
    for (const checkpoint of checkpoints ?? []) {
      const key = semanticAddressKey(checkpoint.address);
      const current = traitChildSettlementBuilders.get(key);
      if (current === undefined)
        traitChildSettlementBuilders.set(key, {
          address: checkpoint.address,
          occurrenceOwner,
          branches: [checkpoint.branch],
          candidateContexts:
            checkpoint.candidateContext === undefined ? [] : [checkpoint.candidateContext],
          runStateSnapshots: new Map(),
        });
      else {
        current.branches.push(checkpoint.branch);
        if (checkpoint.candidateContext !== undefined)
          current.candidateContexts.push(checkpoint.candidateContext);
      }
    }
  }

  function recordHubDeparture(
    emission: Extract<ChronologyEmission, { readonly kind: 'hubDeparture' }>,
  ): void {
    const previous = hubDepartures.at(-1);
    if (emission.replace) {
      if (previous === undefined)
        throw new BiomeRewardSimulationContractError(
          `${emission.hubGameName} fountain use has no Hub interval`,
        );
      hubDepartures[hubDepartures.length - 1] = Object.freeze({
        ...previous,
        departure: emission.departure,
      });
      return;
    }
    hubDepartures.push(
      Object.freeze({
        hub: emission.hub,
        precedingVisitCount: previous === undefined ? 0 : previous.precedingVisitCount + 1,
        departure: emission.departure,
      }),
    );
  }

  function mergeFindings(
    emission: Extract<ChronologyEmission, { readonly kind: 'findings' }>,
  ): void {
    switch (emission.rule) {
      case 'add':
        for (const entry of emission.entries)
          addRewardFinding(
            findings,
            entry.finding,
            entry.atomicRegion,
            entry.chronology,
            entry.levelResolutionEvaluation,
          );
        return;
      case 'set':
        for (const entry of emission.entries)
          findings.set(findingIdentityKey(entry.finding), entry);
        return;
      case 'merge':
        mergeRewardFindingEmissions(findings, emission.entries);
        return;
      default: {
        const unreachable: never = emission;
        return unreachable;
      }
    }
  }

  function mergeEmission(emission: ChronologyEmission): void {
    switch (emission.kind) {
      case 'timedEffectContacts':
        timedEffects.push(...emission.contacts);
        return;
      case 'generatedPickupPlacements':
        for (const placement of emission.placements) {
          const key = semanticAddressKey(placement.address);
          if (!generatedPickupPlacements.has(key)) generatedPickupPlacements.set(key, placement);
        }
        break;
      case 'findings':
        mergeFindings(emission);
        return;
      case 'acquisitionRoleFrontiers':
        recordAcquisitionRoleFrontiers(emission.frontiers);
        return;
      case 'traitOfferCandidateContacts':
        recordTraitOfferCandidateContacts(emission.contacts);
        return;
      case 'derivedAcquisitionEntryFrontiers':
        recordDerivedAcquisitionEntryFrontiers(emission.frontiers);
        return;
      case 'timelineFacts':
        for (const node of emission.facts?.nodes ?? [])
          recordTimelineNode(node.owner, node.included);
        for (const dependency of emission.facts?.dependencies ?? [])
          recordTimelineDependency(dependency.owner, dependency.afterOwner);
        return;
      case 'traitChildSettlements':
        recordTraitChildSettlements(emission.checkpoints, emission.occurrenceOwner);
        return;
      case 'producerFrontiers':
        for (const frontier of emission.frontiers)
          indexRewardProducerFrontier(producerFrontiers, frontier);
        return;
      case 'runStateSnapshot':
        if (!runStateSnapshotsByOwner.has(emission.ownerKey))
          runStateSnapshotsByOwner.set(emission.ownerKey, emission.snapshot);
        return;
      case 'traitChildRunStateSnapshot': {
        const builder = traitChildSettlementBuilders.get(emission.childKey);
        if (builder === undefined)
          throw new BiomeRewardSimulationContractError(
            `trait-child settlement ${emission.childKey} is not accumulated`,
          );
        if (!builder.runStateSnapshots.has(emission.ownerKey))
          builder.runStateSnapshots.set(emission.ownerKey, emission.snapshot);
        return;
      }
      case 'targetHistory':
        targetHistoryByOrigin.set(
          semanticAddressKey(emission.checkpoint.origin),
          emission.checkpoint,
        );
        return;
      case 'storeSupport':
        storeSupportEntries.push(...emission.entries);
        return;
      case 'hubDeparture':
        recordHubDeparture(emission);
        return;
      case 'keepsakeSelectionCandidate':
        keepsakeSelectionContexts.set(emission.key, emission.candidate);
        return;
      case 'keepsakeEquipResultCandidates':
        for (const entry of emission.candidates)
          keepsakeEquipResultContexts.set(entry.key, entry.candidate);
        return;
      case 'echoKeepsakeReplayOutcome':
        echoKeepsakeReplayOutcome = emission.outcome;
        return;
      case 'figLeafPhaseCandidates':
        for (const entry of emission.candidates)
          figLeafPhaseCandidates.set(entry.key, entry.candidate);
        return;
      case 'gorgonPhaseCandidate':
        gorgonPhaseCandidates.set(emission.key, emission.candidate);
        return;
      case 'judgmentArcanaCandidate':
        judgmentArcanaContexts.set(emission.key, emission.candidate);
        return;
      case 'figurineArcanaCandidate':
        figurineArcanaContexts.set(emission.key, emission.candidate);
        return;
      case 'nemesisRandomEventCandidate':
        nemesisRandomEventCandidates.set(emission.key, emission.candidate);
        return;
      case 'bossArcanaOutcomes':
        for (const outcome of emission.outcomes)
          bossArcanaOutcomes.set(semanticAddressKey(outcome.owner), outcome);
        return;
      case 'steadyGrowthThresholds':
        for (const { address, threshold } of emission.thresholds) {
          const key = semanticAddressKey(address);
          steadyGrowthOutcomeAddresses.set(key, address);
          const current = steadyGrowthCandidateContexts.get(key) ?? [];
          current.push(threshold);
          steadyGrowthCandidateContexts.set(key, current);
        }
        return;
      case 'transcendentEmbryoThresholds':
        for (const { address, threshold } of emission.thresholds) {
          const key = semanticAddressKey(address);
          transcendentEmbryoOutcomeAddresses.set(key, address);
          const current = transcendentEmbryoCandidateContexts.get(key) ?? [];
          current.push(threshold);
          transcendentEmbryoCandidateContexts.set(key, current);
        }
        return;
      case 'fountainRarityCandidate':
        fountainRarityCandidateContexts.set(emission.key, emission.candidate);
        return;
      default: {
        const unreachable: never = emission;
        return unreachable;
      }
    }
  }

  return Object.freeze({
    mergeEmissions(emissions: readonly ChronologyEmission[]): void {
      if (finished)
        throw new BiomeRewardSimulationContractError('chronology accumulator is already finished');
      for (const emission of emissions) mergeEmission(emission);
    },
    findingEntries: () => Object.freeze([...findings.values()]),
    derivedAcquisitionEntryFrontiers: (key: string) =>
      derivedAcquisitionEntryContexts.get(key) ?? Object.freeze([]),
    gorgonPhaseCandidate: (key: string) => gorgonPhaseCandidates.get(key),
    hasRunStateSnapshot: (ownerKey: string) => runStateSnapshotsByOwner.has(ownerKey),
    hasTargetHistory: (originKey: string) => targetHistoryByOrigin.has(originKey),
    traitChildCheckpointsAwaiting(occurrenceOwner: SemanticAddress, ownerKey: string) {
      const occurrenceKey = semanticAddressKey(occurrenceOwner);
      return Object.freeze(
        [...traitChildSettlementBuilders]
          .filter(
            ([, builder]) =>
              semanticAddressKey(builder.occurrenceOwner) === occurrenceKey &&
              !builder.runStateSnapshots.has(ownerKey),
          )
          .map(([key, builder]) => Object.freeze({ key, branches: builder.branches })),
      );
    },
    finish(): ChronologyAccumulation {
      finished = true;
      return Object.freeze({
        timedEffects: Object.freeze(timedEffects),
        findingRegions: Object.freeze([...findings.values()]),
        generatedPickupPlacements: Object.freeze([...generatedPickupPlacements.values()]),
        producerFrontiers,
        reachedTraitOfferCandidateContexts,
        acquisitionConversionContexts,
        derivedAcquisitionEntryContexts,
        timelineFacts:
          timelineFactNodes.size === 0 && timelineFactDependencies.size === 0
            ? EMPTY_PLANNER_TIMELINE_FACTS
            : Object.freeze({
                nodes: Object.freeze([...timelineFactNodes.values()]),
                dependencies: Object.freeze([...timelineFactDependencies.values()]),
              }),
        runStateSnapshots: Object.freeze([...runStateSnapshotsByOwner.values()]),
        traitChildSettlements: traitChildSettlementBuilders,
        targetHistory: Object.freeze([...targetHistoryByOrigin.values()]),
        storeSupport: Object.freeze(storeSupportEntries),
        hubDepartures: Object.freeze([...hubDepartures]),
        echoKeepsakeReplayOutcome,
        keepsakeSelectionContexts,
        keepsakeEquipResultContexts,
        figLeafPhaseCandidates: Object.freeze([...figLeafPhaseCandidates.values()]),
        gorgonPhaseCandidates: Object.freeze([...gorgonPhaseCandidates.values()]),
        nemesisRandomEventCandidates: Object.freeze([...nemesisRandomEventCandidates.values()]),
        judgmentArcanaContexts,
        figurineArcanaContexts,
        bossArcanaOutcomes: Object.freeze([...bossArcanaOutcomes.values()]),
        steadyGrowthCandidateContexts,
        steadyGrowthOutcomeAddresses,
        transcendentEmbryoCandidateContexts,
        transcendentEmbryoOutcomeAddresses,
        fountainRarityCandidateContexts,
      });
    },
  });
}

/** Lifecycle-transition findings, added through the merging writer. */
export function lifecycleFindings(
  findings: readonly {
    readonly finding: SemanticFinding;
    readonly region: string;
    readonly chronology: FindingChronology;
  }[],
): ChronologyEmission {
  return Object.freeze({
    kind: 'findings' as const,
    rule: 'add' as const,
    entries: findings.map((entry) => ({
      finding: entry.finding,
      atomicRegion: entry.region,
      chronology: entry.chronology,
    })),
  });
}

/** Generation findings, added through the merging writer without their evaluations. */
export function generationFindings(entries: readonly FindingRegionEntry[]): ChronologyEmission {
  return Object.freeze({
    kind: 'findings' as const,
    rule: 'add' as const,
    entries: entries.map((entry) => ({
      finding: entry.finding,
      atomicRegion: entry.atomicRegion,
      chronology: entry.chronology,
    })),
  });
}

/** Settlement findings replace their identity entry in place. */
export function settledFindings(entries: readonly FindingRegionEntry[]): ChronologyEmission {
  return Object.freeze({ kind: 'findings' as const, rule: 'set' as const, entries });
}

/** Region emissions merged with each retained level-resolution evaluation. */
export function mergedFindings(entries: readonly FindingRegionEntry[]): ChronologyEmission {
  return Object.freeze({ kind: 'findings' as const, rule: 'merge' as const, entries });
}

/** Ordered accumulator writes for one authored-site settlement. */
export function siteSettlementEmissions(
  result: AuthoredSiteSettlementResult,
  occurrenceOwner: SemanticAddress,
): readonly ChronologyEmission[] {
  return [
    {
      kind: 'findings',
      rule: 'add',
      entries: result.emissions.findings.flatMap((entry) => {
        const evaluations = entry.levelResolutionEvaluations ?? [];
        const added = {
          finding: entry.finding,
          atomicRegion: entry.atomicRegion,
          chronology: entry.chronology,
        };
        return evaluations.length === 0
          ? [added]
          : evaluations.map((evaluation) => ({ ...added, levelResolutionEvaluation: evaluation }));
      }),
    },
    { kind: 'acquisitionRoleFrontiers', frontiers: result.emissions.acquisitionRoleFrontiers },
    { kind: 'timelineFacts', facts: result.emissions.timelineFacts },
    {
      kind: 'derivedAcquisitionEntryFrontiers',
      frontiers: result.emissions.derivedEntryFrontiers,
    },
    {
      kind: 'traitChildSettlements',
      checkpoints: result.emissions.traitChildSettlements,
      occurrenceOwner,
    },
    { kind: 'producerFrontiers', frontiers: result.producerFrontiers },
  ];
}
