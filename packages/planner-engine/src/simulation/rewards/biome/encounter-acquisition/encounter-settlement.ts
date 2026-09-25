import type { ResolvedRoutePosition } from '../../../../authored-project/route-context';
import { resolveEntryDeclaration } from '../../../../authored-project/room-state/entry-resolution';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import type { Catalog } from '../../../../catalog-schema';
import {
  encounterResolutionContext,
  resolveMaterializedEncounterPhase,
} from '../../../encounters/resolve';
import { directEncounterDefinitionKeyForSlot } from '../../../../authored-project/room-state/encounter-envelope';
import { evaluateRequirement } from '../../../../requirements';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createJudgmentArcanaAddress,
  createFigurineArcanaAddress,
  createNemesisRandomEventAddress,
  createRoomActionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import { roomActionKey } from '../../../../authored-project/room-actions/key';
import { materializeGorgonAthenaOffer } from '../../../../authored-project/traits/state';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import { advanceStygianWellBossUses } from '../../../commerce/stygian-well';
import {
  activateTemporaryArcana,
  currentArcanaCards,
  type CurrentArcanaCard,
  judgmentRequiredCount,
  orderRandomArcanaSelection,
  randomArcanaDrawKeys,
} from '../../../arcana-fear';
import {
  assessGorgonChildSettlement,
  consumeGorgonAppearance,
} from '../../../keepsakes/encounter-effects';
import { refreshKeepsakeFatedStatus } from '../../../keepsakes/state';
import { consumeFigurine } from '../../../keepsakes/trait-effects';
import {
  foldTraitHistoryEvents,
  hasActiveChaosSemanticTag,
  settleNonFinalBossRarityBlocks,
  traitOfferGenerationLegal,
} from '../../../traits';
import { findingIdentityKey, ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import { createBiomeRewardFacts } from '../../facts';
import { historyFindingChronology, rewardFindingChronologyForRoom } from '../finding-chronology';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { GorgonPhaseCandidateSupport, NemesisRandomEventCandidateSupport } from '../../model';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';
import { consumeOlympianProviderForReachedOffer } from '../../offer-generation';
import {
  settleOwnedAcquisitionSite,
  withStoredArtificerReplacements,
} from '../../acquisition/site-settlement';
import type { AcquisitionRoleFrontier } from '../../acquisition/contracts';
import {
  settleEncounterTraitOffer,
  type ReachedTraitChildCheckpoint,
  type ReachedTraitOfferCandidateContact,
} from '../../trait-settlement/coordinator';
import { addRewardFinding, mergeRewardFindingEmissions, rewardFinding } from '../../findings';
import type { BossArcanaOutcome } from '../../model';
import type { PlannerTimelineFacts } from '../../../timeline-facts';
import { nemesisGeneratedPickupSiteKey } from '../../../../authored-project/acquisition/pickup-producers';
import {
  applyTraitOfferTransition,
  invalidatedTraitOffers,
  siteEntryTraitOffers,
  spawnIncomingRewardAtEncounterCompletion,
  spawnScreenProducedPickups,
  spawnTraitOffers,
  spawnWheelRewardAtEncounterCompletion,
} from '../offer-lifecycle/spawned-trait-offers';

type EncounterSettlementEvent = Extract<
  HistoryEvent,
  { readonly kind: 'bossDefeated' | 'encounterInteractionReached' | 'encounterCompleted' }
>;

export interface EncounterSettlementTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly roleFrontiers: readonly AcquisitionRoleFrontier[];
  readonly traitChildSettlements: readonly {
    readonly checkpoint: ReachedTraitChildCheckpoint;
    readonly occurrenceOwner: SemanticAddress;
  }[];
  readonly traitOfferCandidateContacts: readonly ReachedTraitOfferCandidateContact[];
  /** Exact successful Boss mutations, separate from their candidate domains. */
  readonly bossArcanaOutcomes?: readonly BossArcanaOutcome[];
  /** Boss mutation owners and their planner-resolved same-seam order. */
  readonly timelineFacts?: PlannerTimelineFacts;
  readonly judgmentCandidate?: {
    readonly key: string;
    readonly activeArcanaKeys: readonly string[];
    readonly activeArcana: readonly CurrentArcanaCard[];
    readonly inactiveArcanaKeys: readonly string[];
    readonly requiredCount: number;
  };
  readonly figurineCandidate?: {
    readonly key: string;
    readonly activeArcanaKeys: readonly string[];
    readonly activeArcana: readonly CurrentArcanaCard[];
    readonly inactiveArcanaKeys: readonly string[];
    readonly requiredCount: number;
    readonly rarity: import('../../../../catalog-schema').InRunTraitRarity;
  };
  readonly nemesisCandidate?: {
    readonly key: string;
    readonly value: NemesisRandomEventCandidateSupport;
  };
  readonly blockGorgonPhaseKey?: string;
  readonly gorgonEvaluationBlocked: boolean;
}

function chronology(
  snapshot: BiomeRewardSnapshot,
  room: CanonicalAuthoredRoom,
  event: EncounterSettlementEvent,
) {
  return rewardFindingChronologyForRoom(
    snapshot,
    room.origin,
    event.sequence,
    'localRoomLifecycle',
  );
}

function arcanaFrontier(branches: readonly RewardBranchState[]) {
  const first = branches[0]?.state.arcanaFear.arcana.active;
  if (first === undefined) return undefined;
  const identity = JSON.stringify(first);
  if (
    !branches.every((branch) => JSON.stringify(branch.state.arcanaFear.arcana.active) === identity)
  )
    throw new BiomeRewardSimulationContractError(
      'Automatic Boss Arcana frontier has divergent state across surviving branches',
    );
  return first;
}

/**
 * Settles the three encounter chronology seams.  Its inputs and returned
 * emissions are immutable; the chronology owner alone publishes them.
 */
export function applyEncounterSettlementTransition(inputs: {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: EncounterSettlementEvent;
  readonly room: CanonicalAuthoredRoom | CanonicalHubRoom | undefined;
  readonly view: ProgressiveRoomHistoryViews | undefined;
  readonly branches: readonly RewardBranchState[];
  readonly routePosition: ResolvedRoutePosition;
  readonly enteredBiomeCount: number;
  readonly fullRunBiomeCount: number;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  readonly gorgonEligible: boolean;
  readonly gorgonCandidate: GorgonPhaseCandidateSupport | undefined;
  readonly gorgonPhaseBlocked: boolean;
  readonly gorgonEvaluationBlocked: boolean;
}): EncounterSettlementTransition {
  const { catalog, event, snapshot } = inputs;
  const room = inputs.room;
  const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
  const findings = new Map<string, FindingRegionEntry>();
  const mergeTraitFindings = (entries: readonly FindingRegionEntry[]) => {
    for (const entry of entries)
      for (const evaluation of entry.levelResolutionEvaluations ?? [undefined])
        addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology, evaluation);
  };
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: {
    readonly checkpoint: ReachedTraitChildCheckpoint;
    readonly occurrenceOwner: SemanticAddress;
  }[] = [];
  const traitOfferCandidateContacts: ReachedTraitOfferCandidateContact[] = [];
  const recordChild = (
    checkpoint: ReachedTraitChildCheckpoint | undefined,
    owner: SemanticAddress,
  ) => {
    if (checkpoint !== undefined)
      traitChildSettlements.push(Object.freeze({ checkpoint, occurrenceOwner: owner }));
  };
  let branches = inputs.branches;
  let blockGorgonPhaseKey: string | undefined;
  let gorgonEvaluationBlocked = inputs.gorgonEvaluationBlocked;
  if (event.kind === 'bossDefeated')
    branches = Object.freeze(
      branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            stygianWell: advanceStygianWellBossUses(branch.state.stygianWell),
          }),
        }),
      ),
    );
  const nonFinalBossDefeated =
    event.kind === 'bossDefeated' &&
    room?.kind === 'authored' &&
    declaration?.mode.kind === 'authored' &&
    declaration.mode.templateKey === 'Boss' &&
    inputs.enteredBiomeCount < inputs.fullRunBiomeCount;
  if (nonFinalBossDefeated)
    branches = Object.freeze(
      branches.map((branch) => {
        const traitHistory = settleNonFinalBossRarityBlocks(
          catalog,
          branch.state.traitHistory,
          event.origin,
          event.sequence,
        );
        return traitHistory === branch.state.traitHistory
          ? branch
          : Object.freeze({
              ...branch,
              state: replaceSimulationTraitHistory(branch.state, traitHistory),
            });
      }),
    );

  if (
    event.kind === 'encounterInteractionReached' &&
    event.interaction === 'gorgon' &&
    room?.kind === 'authored' &&
    declaration !== undefined &&
    inputs.gorgonEligible
  ) {
    const result = room.encounters.gorgonResultByPhase?.[event.phaseKey];
    const phase = room.encounterPhases.find((candidate) => candidate.slotKey === event.phaseKey);
    const phaseAddress = createEncounterPhaseAddress(
      createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
      { kind: 'occurrence', occurrenceId: room.occurrenceId },
      event.phaseKey,
    );
    const owner = createTraitOfferAddress(
      createGorgonPhaseAddress(phaseAddress),
      'gorgonAthena',
    ).owner;
    const phaseKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
    const offered =
      result?.athenaOffer == null || inputs.gorgonCandidate?.rarity === undefined
        ? undefined
        : materializeGorgonAthenaOffer(catalog, result.athenaOffer, inputs.gorgonCandidate.rarity);
    const resolvedPhase =
      phase === undefined
        ? undefined
        : resolveMaterializedEncounterPhase(
            catalog,
            declaration,
            phase,
            encounterResolutionContext(room, declaration),
          );
    const eligible =
      resolvedPhase?.blocksGorgon !== true &&
      declaration.blocksGorgon !== true &&
      !inputs.gorgonPhaseBlocked;
    const gorgonTraitContext = Object.freeze({
      ...(declaration.boonRarityOverride === undefined
        ? {}
        : { boonRarityRoomOverride: declaration.boonRarityOverride }),
      ...(inputs.gorgonCandidate?.boonRarityItemOverride === undefined
        ? {}
        : { boonRarityItemOverride: inputs.gorgonCandidate.boonRarityItemOverride }),
      ...(inputs.gorgonCandidate?.rarity === undefined
        ? {}
        : { gorgonResolvedRarity: inputs.gorgonCandidate.rarity }),
      ...(inputs.gorgonCandidate?.suppressTemporaryBoonRarity === true
        ? { suppressTemporaryBoonRarity: true }
        : {}),
    });
    if (eligible && result?.athenaTriggerConditionMet === true && result.athenaOffer === null) {
      const effect = catalog.keepsakes.values.find(
        (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
      )?.effect;
      for (const branch of branches) {
        const settled = settleEncounterTraitOffer(
          catalog,
          branch,
          owner,
          null,
          event.sequence,
          'encounterCompleted',
          chronology(snapshot, room, event),
          'gorgonAthena',
          undefined,
          gorgonTraitContext,
          undefined,
          effect?.kind === 'gorgonAmulet' ? effect.providerKey : undefined,
        );
        mergeTraitFindings(settled.findingEntries);
        recordChild(settled.blockedChild, room.origin);
        if (settled.candidateContact !== undefined)
          traitOfferCandidateContacts.push(settled.candidateContact);
      }
      blockGorgonPhaseKey = phaseKey;
      gorgonEvaluationBlocked = true;
    } else if (
      eligible &&
      result?.athenaTriggerConditionMet === true &&
      result.athenaOffer != null &&
      offered !== undefined &&
      assessGorgonChildSettlement(catalog, result.athenaOffer)
    ) {
      const before = branches.map((branch) => branch.traitEvaluations?.length ?? 0);
      const settled = branches.map((branch) =>
        settleEncounterTraitOffer(
          catalog,
          branch,
          owner,
          offered,
          event.sequence,
          'encounterCompleted',
          chronology(snapshot, room, event),
          'gorgonAthena',
          undefined,
          gorgonTraitContext,
        ),
      );
      for (const item of settled) {
        mergeTraitFindings(item.findingEntries);
        if (item.candidateContact !== undefined)
          traitOfferCandidateContacts.push(item.candidateContact);
      }
      const processed = settled.map((item) => item.branch);
      const valid = processed.every((branch, index) => {
        const evaluations = branch.traitEvaluations ?? [];
        const evaluation = evaluations.at(-1);
        return (
          evaluations.length > before[index]! &&
          evaluation !== undefined &&
          traitOfferGenerationLegal(evaluation) &&
          evaluation.targetedAcquisition.legal
        );
      });
      if (valid)
        branches = Object.freeze(
          processed.map((branch) =>
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: consumeGorgonAppearance(branch.state.keepsakes),
              }),
            }),
          ),
        );
      else {
        blockGorgonPhaseKey = phaseKey;
        gorgonEvaluationBlocked = true;
      }
    } else if (result?.athenaTriggerConditionMet === true) {
      blockGorgonPhaseKey = phaseKey;
      gorgonEvaluationBlocked = true;
      findings.set(
        findingIdentityKey(
          rewardFinding('rewardAcquisitionUnavailable', owner, {
            reason:
              result.athenaOffer === undefined
                ? 'gorgonAthenaOfferMissing'
                : 'gorgonAthenaOfferInvalid',
          }),
        ),
        Object.freeze({
          finding: rewardFinding('rewardAcquisitionUnavailable', owner, {
            reason:
              result.athenaOffer === undefined
                ? 'gorgonAthenaOfferMissing'
                : 'gorgonAthenaOfferInvalid',
          }),
          atomicRegion: ownerRegion(owner),
          chronology: historyFindingChronology(event.sequence),
        }),
      );
    }
  }

  if (nonFinalBossDefeated) {
    const owner = createJudgmentArcanaAddress(room.origin, event.phaseKey);
    const figurineOwner = createFigurineArcanaAddress(room.origin, event.phaseKey);
    const judgmentBranches = branches.filter(
      (branch) => !hasActiveChaosSemanticTag(branch.state.traitHistory, 'Barren'),
    );
    const frontier = arcanaFrontier(judgmentBranches);
    const first = judgmentBranches[0]?.state.arcanaFear;
    const requiredCount =
      frontier === undefined || first === undefined
        ? undefined
        : judgmentRequiredCount(catalog, first, judgmentBranches[0]?.state.keepsakes.fatedStatus);
    const judgmentCandidate =
      requiredCount === undefined || first === undefined
        ? undefined
        : Object.freeze({
            key: semanticAddressKey(owner),
            requiredCount,
            activeArcanaKeys: Object.freeze(first.arcana.active.map((card) => card.key)),
            activeArcana: currentArcanaCards(first),
            inactiveArcanaKeys: randomArcanaDrawKeys(
              catalog,
              first,
              judgmentBranches[0]?.state.keepsakes.fatedStatus,
            ),
          });
    const judgmentSelected = room.encounters.judgmentArcanaKeysByPhase?.[event.phaseKey] ?? [];
    branches = Object.freeze(
      branches.flatMap((branch) => {
        if (hasActiveChaosSemanticTag(branch.state.traitHistory, 'Barren'))
          return [advanceRewardBranches([branch], event.sequence)[0]!];
        const required = judgmentRequiredCount(
          catalog,
          branch.state.arcanaFear,
          branch.state.keepsakes.fatedStatus,
        );
        if (required === undefined) return [advanceRewardBranches([branch], event.sequence)[0]!];
        const selected = judgmentSelected;
        if (selected.length !== required) {
          const finding = rewardFinding(
            selected.length === 0 ? 'judgmentOutcomeMissing' : 'judgmentOutcomeWrongCardinality',
            owner,
            Object.freeze({ required, selected: selected.length }),
          );
          findings.set(
            findingIdentityKey(finding),
            Object.freeze({
              finding,
              atomicRegion: ownerRegion(owner),
              chronology: historyFindingChronology(event.sequence),
            }),
          );
          return [];
        }
        if (selected.length === 0) return [advanceRewardBranches([branch], event.sequence)[0]!];
        const assessed = activateTemporaryArcana(catalog, branch.state.arcanaFear, selected, {
          owner,
          sequence: event.sequence,
        });
        if (
          !assessed.legal ||
          (branch.state.keepsakes.fatedStatus === 'Fated' &&
            selected.some((key) => catalog.arcanaCards.byKey[key]?.fatedIncompatible === true))
        ) {
          const finding = rewardFinding(
            'judgmentOutcomeTargetUnavailable',
            owner,
            Object.freeze({ reason: assessed.legal ? 'fatedExcluded' : assessed.reason }),
          );
          findings.set(
            findingIdentityKey(finding),
            Object.freeze({
              finding,
              atomicRegion: ownerRegion(owner),
              chronology: historyFindingChronology(event.sequence),
            }),
          );
          return [];
        }
        return [
          Object.freeze({
            ...branch,
            processedThroughHistorySequence: event.sequence,
            state: Object.freeze({
              ...branch.state,
              arcanaFear: assessed.state,
              keepsakes: refreshKeepsakeFatedStatus(
                catalog,
                branch.state.keepsakes,
                assessed.state,
              ),
            }),
          }),
        ];
      }),
    );
    const figurineBranches = branches;
    const figurineSource = figurineBranches[0]?.state.keepsakes.figurine;
    const figurineEffect = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === 'crystalFigurine',
    )?.effect;
    const figurineEligible =
      figurineSource?.status === 'pending' && figurineEffect?.kind === 'crystalFigurine';
    if (figurineEligible) {
      if (
        figurineBranches.some(
          (branch) =>
            JSON.stringify(branch.state.keepsakes.figurine) !== JSON.stringify(figurineSource),
        )
      )
        throw new BiomeRewardSimulationContractError(
          'Crystal Figurine source frontier has divergent state across surviving branches',
        );
      arcanaFrontier(figurineBranches);
    }
    const figurineFrontier = figurineEligible ? figurineBranches[0]?.state.arcanaFear : undefined;
    const figurineInactive =
      figurineEligible && figurineFrontier !== undefined
        ? randomArcanaDrawKeys(
            catalog,
            figurineFrontier,
            figurineBranches[0]?.state.keepsakes.fatedStatus,
          )
        : Object.freeze([]);
    const figurineRequiredCount = figurineEligible
      ? Math.min(figurineEffect.requestedCards, figurineInactive.length)
      : 0;
    const figurineCandidate =
      figurineEligible && figurineFrontier !== undefined
        ? Object.freeze({
            key: semanticAddressKey(figurineOwner),
            activeArcanaKeys: Object.freeze(figurineFrontier.arcana.active.map((card) => card.key)),
            activeArcana: currentArcanaCards(figurineFrontier),
            inactiveArcanaKeys: figurineInactive,
            requiredCount: figurineRequiredCount,
            rarity: figurineSource.rarity,
          })
        : undefined;
    const figurineSelected = room.encounters.figurineArcanaKeysByPhase?.[event.phaseKey] ?? [];
    branches = Object.freeze(
      figurineBranches.flatMap((branch) => {
        const source = branch.state.keepsakes.figurine;
        if (source?.status !== 'pending' || figurineEffect?.kind !== 'crystalFigurine')
          return [advanceRewardBranches([branch], event.sequence)[0]!];
        const selected = figurineSelected;
        if (selected.length !== figurineRequiredCount) {
          const finding = rewardFinding(
            selected.length === 0 ? 'figurineOutcomeMissing' : 'figurineOutcomeWrongCardinality',
            figurineOwner,
            Object.freeze({ required: figurineRequiredCount, selected: selected.length }),
          );
          findings.set(
            findingIdentityKey(finding),
            Object.freeze({
              finding,
              atomicRegion: ownerRegion(figurineOwner),
              chronology: historyFindingChronology(event.sequence),
            }),
          );
          return [];
        }
        if (selected.length === 0) {
          return [
            Object.freeze({
              ...branch,
              processedThroughHistorySequence: event.sequence,
              state: Object.freeze({
                ...branch.state,
                keepsakes: consumeFigurine(branch.state.keepsakes),
              }),
            }),
          ];
        }
        const assessed = activateTemporaryArcana(
          catalog,
          branch.state.arcanaFear,
          selected,
          { owner: figurineOwner, sequence: event.sequence },
          source.rarity,
        );
        if (
          !assessed.legal ||
          (branch.state.keepsakes.fatedStatus === 'Fated' &&
            selected.some((key) => catalog.arcanaCards.byKey[key]?.fatedIncompatible === true))
        ) {
          const finding = rewardFinding(
            'figurineOutcomeTargetUnavailable',
            figurineOwner,
            Object.freeze({ reason: assessed.legal ? 'fatedExcluded' : assessed.reason }),
          );
          findings.set(
            findingIdentityKey(finding),
            Object.freeze({
              finding,
              atomicRegion: ownerRegion(figurineOwner),
              chronology: historyFindingChronology(event.sequence),
            }),
          );
          return [];
        }
        return [
          Object.freeze({
            ...branch,
            processedThroughHistorySequence: event.sequence,
            state: Object.freeze({
              ...branch.state,
              arcanaFear: assessed.state,
              keepsakes: refreshKeepsakeFatedStatus(
                catalog,
                consumeFigurine(branch.state.keepsakes),
                assessed.state,
              ),
            }),
          }),
        ];
      }),
    );
    const judgmentOutcome: BossArcanaOutcome | undefined =
      judgmentCandidate !== undefined &&
      judgmentSelected.length === judgmentCandidate.requiredCount &&
      judgmentSelected.length > 0 &&
      branches.length > 0
        ? Object.freeze({
            owner,
            effect: 'judgment' as const,
            phaseKey: event.phaseKey,
            arcanaKeys: orderRandomArcanaSelection(
              catalog,
              judgmentCandidate.activeArcanaKeys,
              judgmentSelected,
            ),
            rarity: 'Epic' as const,
          })
        : undefined;
    const figurineOutcome: BossArcanaOutcome | undefined =
      figurineCandidate !== undefined &&
      figurineSelected.length === figurineCandidate.requiredCount &&
      branches.length > 0
        ? Object.freeze({
            owner: figurineOwner,
            effect: 'crystalFigurine' as const,
            phaseKey: event.phaseKey,
            arcanaKeys: orderRandomArcanaSelection(
              catalog,
              figurineCandidate.activeArcanaKeys,
              figurineSelected,
            ),
            rarity: figurineCandidate.rarity,
          })
        : undefined;
    const bossArcanaOutcomes = Object.freeze(
      [judgmentOutcome, figurineOutcome].filter(
        (outcome): outcome is BossArcanaOutcome => outcome !== undefined,
      ),
    );
    const timelineFacts: PlannerTimelineFacts = Object.freeze({
      nodes: Object.freeze(
        bossArcanaOutcomes.map((outcome) =>
          Object.freeze({ owner: outcome.owner, included: true }),
        ),
      ),
      dependencies:
        judgmentOutcome === undefined || figurineOutcome === undefined
          ? Object.freeze([])
          : Object.freeze([
              Object.freeze({
                owner: figurineOutcome.owner,
                afterOwner: judgmentOutcome.owner,
              }),
            ]),
    });
    return Object.freeze({
      branches,
      findings: Object.freeze([...findings.values()]),
      roleFrontiers: Object.freeze(roleFrontiers),
      traitChildSettlements: Object.freeze(traitChildSettlements),
      traitOfferCandidateContacts: Object.freeze(traitOfferCandidateContacts),
      ...(judgmentCandidate === undefined ? {} : { judgmentCandidate }),
      ...(figurineCandidate === undefined ? {} : { figurineCandidate }),
      bossArcanaOutcomes,
      timelineFacts,
      gorgonEvaluationBlocked,
      ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
    });
  }

  const view = inputs.view;
  if (
    room === undefined ||
    declaration === undefined ||
    view === undefined ||
    room.kind !== 'authored'
  )
    return Object.freeze({
      branches: advanceRewardBranches(branches, event.sequence),
      findings: Object.freeze([...findings.values()]),
      roleFrontiers: Object.freeze(roleFrontiers),
      traitChildSettlements: Object.freeze(traitChildSettlements),
      traitOfferCandidateContacts: Object.freeze(traitOfferCandidateContacts),
      gorgonEvaluationBlocked,
      ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
    });
  if (event.kind === 'encounterCompleted') {
    const entryDeclaration = resolveEntryDeclaration(declaration, inputs.routePosition);
    const roomEncounterKeys = room.encounterPhases.flatMap((phase) => {
      const resolved = resolveMaterializedEncounterPhase(
        catalog,
        entryDeclaration,
        phase,
        encounterResolutionContext(room, entryDeclaration),
      );
      return resolved === undefined ? [] : [resolved.encounterKey];
    });
    branches = Object.freeze(
      branches.map((branch) =>
        spawnWheelRewardAtEncounterCompletion(
          catalog,
          room,
          event.phaseKey,
          spawnIncomingRewardAtEncounterCompletion(catalog, room, roomEncounterKeys, branch),
        ),
      ),
    );
    const rewards =
      room.localRewards?.filter((reward) => reward.encounterPhaseKey === event.phaseKey) ?? [];
    if (room.lifecycleProfileKey === 'FieldsCombatRoom' || rewards.length === 0)
      return Object.freeze({
        branches: advanceRewardBranches(branches, event.sequence),
        findings: Object.freeze([...findings.values()]),
        roleFrontiers: Object.freeze(roleFrontiers),
        traitChildSettlements: Object.freeze(traitChildSettlements),
        traitOfferCandidateContacts: Object.freeze(traitOfferCandidateContacts),
        gorgonEvaluationBlocked,
        ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
      });
    if (rewards.length !== 1 || rewards[0] === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName}.${event.phaseKey} does not own exactly one local reward`,
      );
    const timelineOwner = room.roomActionRoster.rows.find(
      (candidate) =>
        !candidate.stale &&
        candidate.rank !== null &&
        candidate.reference.kind === 'interactLocalReward' &&
        candidate.reference.groupKey === 'cages' &&
        candidate.reference.slotKey === rewards[0]!.slotKey,
    )?.owner;
    const materialized = Object.freeze(
      branches.map((branch) =>
        consumeOlympianProviderForReachedOffer(catalog, branch, rewards[0]!.origin, 'free'),
      ),
    );
    const settlement = settleOwnedAcquisitionSite(
      catalog,
      materialized,
      {
        siteOwner: rewards[0].origin,
        pointKey: event.phaseKey,
        entryKey: rewards[0].slotKey,
        source: withStoredArtificerReplacements(
          room,
          Object.freeze({
            ...rewards[0],
            instanceProvenance: 'free',
            presentsMaterializedScreen: true,
          }),
        ),
        ...(timelineOwner === undefined ? {} : { timelineOwner }),
        historySequence: event.sequence,
        authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
      },
      (state) =>
        createBiomeRewardFacts({
          catalog,
          state,
          source: room,
          currentRoom: room,
          sourceDeclaration: declaration,
          view: view.preOutgoing ?? view.entry,
          hubBoardLookups: 'notConsulted',
        }),
      undefined,
      chronology(snapshot, room, event),
    );
    mergeRewardFindingEmissions(findings, settlement.findingEmissions);
    roleFrontiers.push(...(settlement.roleFrontiers ?? []));
    for (const checkpoint of settlement.traitChildSettlements ?? [])
      recordChild(checkpoint, room.origin);
    return Object.freeze({
      branches: settlement.branches,
      findings: Object.freeze([...findings.values()]),
      roleFrontiers: Object.freeze(roleFrontiers),
      traitChildSettlements: Object.freeze(traitChildSettlements),
      traitOfferCandidateContacts: Object.freeze(traitOfferCandidateContacts),
      gorgonEvaluationBlocked,
      ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
    });
  }
  if (event.kind === 'encounterInteractionReached' && event.interaction === 'gorgon')
    return Object.freeze({
      branches: advanceRewardBranches(branches, event.sequence),
      findings: Object.freeze([...findings.values()]),
      roleFrontiers: Object.freeze(roleFrontiers),
      traitChildSettlements: Object.freeze(traitChildSettlements),
      traitOfferCandidateContacts: Object.freeze(traitOfferCandidateContacts),
      gorgonEvaluationBlocked,
      ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
    });
  const encounterKey = directEncounterDefinitionKeyForSlot(
    catalog,
    declaration,
    room.encounters,
    event.phaseKey,
    semanticAddressKey(event.origin),
  );
  let nemesisCandidate: EncounterSettlementTransition['nemesisCandidate'];
  if (
    event.kind === 'encounterInteractionReached' &&
    event.interaction === 'encounter' &&
    encounterKey === 'NemesisRandomEvent'
  ) {
    const outcome = room.encounters.nemesisRandomEventByPhase?.[event.phaseKey];
    const owner = createNemesisRandomEventAddress(
      createEncounterPhaseAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        event.phaseKey,
      ),
    );
    const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
    if (policy !== undefined) {
      const interactionOwner = createRoomActionAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        room.occurrenceId,
        roomActionKey({ kind: 'interactEncounter', phaseKey: event.phaseKey }),
      );
      const assessments = Object.freeze(
        branches.map((branch) => {
          const facts = createBiomeRewardFacts({
            catalog,
            state: branch.state,
            source: room,
            currentRoom: room,
            sourceDeclaration: declaration,
            view: view.preOutgoing ?? view.entry,
            hubBoardLookups: 'notConsulted',
          });
          const runProgressLegal = (rewardType: 'StackUpgrade' | 'WeaponUpgrade') => {
            const entries = catalog.rewards.stores.byKey.RunProgress?.entries.filter(
              (entry) => entry.rewardType === rewardType,
            );
            return (
              entries === undefined ||
              entries.length === 0 ||
              entries.some(
                (entry) =>
                  entry.requirement === undefined ||
                  evaluateRequirement(entry.requirement, facts.requirements),
              )
            );
          };
          const talentLegal =
            (facts.requirements.records.useRecord.SpellDrop ?? 0) >= 1 &&
            facts.requirements.flags.allSpellInvested !== true;
          const applicable = (variant: {
            readonly rewardType: string;
            readonly enteredBiome: { readonly min?: number; readonly max?: number };
            readonly requirement: string;
          }) =>
            (variant.enteredBiome.min === undefined ||
              inputs.enteredBiomeCount >= variant.enteredBiome.min) &&
            (variant.enteredBiome.max === undefined ||
              inputs.enteredBiomeCount <= variant.enteredBiome.max) &&
            (variant.requirement === 'none' ||
              (variant.requirement === 'pomLegal' && runProgressLegal('StackUpgrade')) ||
              (variant.requirement === 'hammerEarlyOrLate' && runProgressLegal('WeaponUpgrade')) ||
              (variant.requirement === 'talentLegal' && talentLegal));
          const equipped = Object.values(branch.state.traitHistory.equippedTraits).filter(
            (trait) => {
              const declaration = catalog.traits.byKey[trait.traitKey];
              return (
                declaration !== undefined &&
                trait.providerKind === 'olympian' &&
                trait.rarity !== undefined
              );
            },
          );
          const common = equipped.filter((trait) => trait.rarity === 'Common');
          return Object.freeze({
            freeItemRewardTypes: Object.freeze([...policy.freeItem.resultRewardTypes]),
            goldTradeRewardTypes: Object.freeze(
              policy.goldTrade.variants.filter(applicable).map((variant) => variant.rewardType),
            ),
            damageTradeRewardTypes: Object.freeze(
              policy.damageTrade.variants.filter(applicable).map((variant) => variant.rewardType),
            ),
            damageContestSuccessRewardTypes: Object.freeze(
              policy.damageContest.successResultRewardTypes.filter((rewardType) =>
                rewardType === 'StackUpgrade'
                  ? runProgressLegal('StackUpgrade')
                  : rewardType === 'TalentDrop'
                    ? talentLegal
                    : true,
              ),
            ),
            traitTradeTraitKeys: Object.freeze(
              (common.length === 0 ? equipped : common).map((trait) => trait.traitKey),
            ),
          });
        }),
      );
      const candidate = Object.freeze({
        origin: owner,
        familyKeys: Object.freeze([
          'freeItem',
          'goldTrade',
          'damageTrade',
          'traitTrade',
          'damageContest',
        ] as const),
        goldTradeResponses: policy.goldTrade.response,
        damageTradeResponses: policy.damageTrade.response,
        traitTradeResponses: policy.traitTrade.response,
        damageContestResults: Object.freeze(['success', 'failure'] as const),
        traitTradeRewardType: policy.traitTrade.fixedResultRewardType,
        damageContestFailureRewardType: policy.damageContest.failureResultRewardType,
        branches: assessments,
      });
      nemesisCandidate = Object.freeze({ key: semanticAddressKey(owner), value: candidate });
      const result =
        room.acquisitionSites?.[`nemesisGenerated:${encodeURIComponent(event.phaseKey)}`]?.entries
          .result;
      const rewardType = result?.offer.rewardType;
      const familyMissing = outcome === null || outcome === undefined;
      const interactionMissing =
        !familyMissing &&
        (rewardType === undefined || (outcome.kind === 'traitTrade' && outcome.traitKey === null));
      const legal =
        !familyMissing &&
        !interactionMissing &&
        assessments.every((assessment) => {
          switch (outcome.kind) {
            case 'freeItem':
              return assessment.freeItemRewardTypes.includes(rewardType as never);
            case 'goldTrade':
              return assessment.goldTradeRewardTypes.includes(rewardType as never);
            case 'damageTrade':
              return assessment.damageTradeRewardTypes.includes(rewardType as never);
            case 'damageContest':
              return outcome.result === 'success'
                ? assessment.damageContestSuccessRewardTypes.includes(rewardType as never)
                : policy.damageContest.failureResultRewardType === rewardType;
            case 'traitTrade':
              return (
                rewardType === policy.traitTrade.fixedResultRewardType &&
                outcome.traitKey !== null &&
                assessment.traitTradeTraitKeys.includes(outcome.traitKey)
              );
          }
        });
      if (familyMissing || interactionMissing || !legal) {
        const finding = rewardFinding(
          familyMissing || interactionMissing
            ? 'nemesisOutcomeMissing'
            : 'nemesisOutcomeUnavailable',
          familyMissing ? owner : interactionOwner,
          outcome === null || outcome === undefined ? {} : { kind: outcome.kind },
        );
        findings.set(
          findingIdentityKey(finding),
          Object.freeze({
            finding,
            atomicRegion: ownerRegion(owner),
            chronology: chronology(snapshot, room, event),
          }),
        );
      } else {
        const removedTraitKey =
          outcome.kind === 'traitTrade' && outcome.response === 'accept' ? outcome.traitKey : null;
        const trade =
          removedTraitKey === null
            ? undefined
            : invalidatedTraitOffers(room.origin, 'nemesisTraitTrade');
        if (removedTraitKey !== null)
          branches = Object.freeze(
            branches.map((branch) => {
              const before = branch.state.traitHistory;
              const traitHistory = foldTraitHistoryEvents(catalog, [
                ...before.events,
                Object.freeze({
                  kind: 'traitRemoval' as const,
                  owner: createEncounterPhaseAddress(
                    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                    { kind: 'occurrence' as const, occurrenceId: room.occurrenceId },
                    event.phaseKey,
                  ),
                  acquisitionRole: 'nemesisTraitTrade',
                  sequence: event.sequence,
                  acquisitionPoint: 'encounterInteraction',
                  traitKey: removedTraitKey,
                  match: 'currentTraitKey' as const,
                }),
              ]);
              const traded = Object.freeze({
                ...branch,
                state: replaceSimulationTraitHistory(branch.state, traitHistory),
              });
              return trade === undefined ? traded : applyTraitOfferTransition(traded, trade);
            }),
          );
        // The trade's result loot is created after the sale clears live options.
        const resultSite = nemesisGeneratedPickupSiteKey(event.phaseKey);
        branches = Object.freeze(
          branches.map((branch) =>
            spawnTraitOffers(catalog, branch, siteEntryTraitOffers(room, resultSite)),
          ),
        );
      }
    }
  }
  // The remaining ordinary encounter offer settles after the specialized interaction effects above.
  const authored =
    encounterKey === undefined
      ? undefined
      : room.encounters.traitOffersByPhase?.[event.phaseKey]?.[encounterKey];
  if (authored !== undefined && encounterKey !== undefined) {
    const owner = createEncounterPhaseAddress(
      createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
      { kind: 'occurrence', occurrenceId: room.occurrenceId },
      event.phaseKey,
    );
    const encounterSource = Object.freeze(
      declaration.boonRarityOverride === undefined
        ? {}
        : { boonRarityRoomOverride: declaration.boonRarityOverride },
    );
    const provider = catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer?.giverKey;
    const settled = branches.map((branch) =>
      settleEncounterTraitOffer(
        catalog,
        branch,
        owner,
        authored,
        event.sequence,
        'encounterCompleted',
        chronology(snapshot, room, event),
        'selection',
        undefined,
        encounterSource,
        authored === null ? undefined : branches.map((candidate) => candidate.state.traitHistory),
        provider,
      ),
    );
    for (const item of settled) {
      mergeTraitFindings(item.findingEntries);
      recordChild(item.blockedChild, room.origin);
      if (item.candidateContact !== undefined)
        traitOfferCandidateContacts.push(item.candidateContact);
    }
    if (authored !== null)
      branches = Object.freeze(
        settled.map((item) =>
          item.screenCompleted
            ? spawnScreenProducedPickups(catalog, room, owner, 'selection', item.branch)
            : item.branch,
        ),
      );
  }
  return Object.freeze({
    branches,
    findings: Object.freeze([...findings.values()]),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
    traitOfferCandidateContacts: Object.freeze(traitOfferCandidateContacts),
    ...(nemesisCandidate === undefined ? {} : { nemesisCandidate }),
    gorgonEvaluationBlocked,
    ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
  });
}
