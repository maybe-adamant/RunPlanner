import type { Catalog } from '../../../../catalog-schema';
import { evaluateRequirement } from '../../../../requirements';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createJudgmentArcanaAddress,
  createFigurineArcanaAddress,
  createNemesisRandomEventAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import { materializeGorgonAthenaOffer } from '../../../../authored-project/traits';
import { selectedEncounterAuthoringProfileKey } from '../../../../authored-project/room-state/encounter-envelope';
import type { RouteLoadout } from '../../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import { advanceStygianWellBossUses } from '../../../stygian-well';
import {
  activateTemporaryArcana,
  inactiveArcanaKeys,
  judgmentRequiredCount,
} from '../../../arcana-fear';
import {
  assessGorgonChildSettlement,
  consumeGorgonAppearance,
  refreshKeepsakeFatedStatus,
  consumeFigurine,
} from '../../../keepsakes';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  hasActiveChaosSemanticTag,
} from '../../../traits';
import { findingIdentityKey, ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import { createBiomeRewardFacts } from '../../facts';
import { historyFindingChronology, rewardFindingChronologyForRoom } from '../finding-chronology';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { GorgonPhaseCandidateSupport, NemesisRandomEventCandidateSupport } from '../../model';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches, consumeOlympianProviderForReachedOffer } from '../../processing';
import {
  settleOwnedAcquisitionSite,
  withStoredArtificerReplacements,
  type AcquisitionRoleFrontier,
} from '../../acquisition-settlement';
import {
  processEncounterTraitOffer,
  settleEncounterTraitOffer,
  type ReachedTraitChildCheckpoint,
} from '../../trait-settlement';
import { rewardFinding } from '../../findings';

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
  readonly judgmentCandidate?: {
    readonly key: string;
    readonly inactiveArcanaKeys: readonly string[];
    readonly requiredCount: number;
  };
  readonly figurineCandidate?: {
    readonly key: string;
    readonly inactiveArcanaKeys: readonly string[];
    readonly requiredCount: number;
    readonly rarity: import('../../../../catalog-schema').InRunTraitRarity;
  };
  readonly nemesisCandidate?: {
    readonly key: string;
    readonly value: NemesisRandomEventCandidateSupport;
  };
  readonly runtimeOfferFallback?: {
    readonly key: string;
    readonly address: SemanticAddress;
    readonly preferredKey: string;
    readonly fallbackKey: string;
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
  const first = branches[0]?.arcanaFear.arcana.active;
  if (first === undefined) return undefined;
  const identity = JSON.stringify(first);
  if (!branches.every((branch) => JSON.stringify(branch.arcanaFear.arcana.active) === identity))
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
  readonly routeLoadout: RouteLoadout;
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
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: {
    readonly checkpoint: ReachedTraitChildCheckpoint;
    readonly occurrenceOwner: SemanticAddress;
  }[] = [];
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
          stygianWell: advanceStygianWellBossUses(branch.stygianWell),
        }),
      ),
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
    const eligible =
      phase?.blocksGorgon !== true &&
      declaration.blocksGorgon !== true &&
      !inputs.gorgonPhaseBlocked;
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
          findings,
          chronology(snapshot, room, event),
          'gorgonAthena',
          inputs.gorgonCandidate?.rarity,
          Object.freeze({
            ...inputs.routeLoadout,
            ...(declaration.boonRarityOverride === undefined
              ? {}
              : { boonRarityRoomOverride: declaration.boonRarityOverride }),
          }),
          undefined,
          effect?.kind === 'gorgonAmulet' ? effect.providerKey : undefined,
        );
        recordChild(settled.blockedChild, room.origin);
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
      const processed = branches.map((branch) =>
        processEncounterTraitOffer(
          catalog,
          branch,
          owner,
          offered,
          event.sequence,
          'encounterCompleted',
          findings,
          chronology(snapshot, room, event),
          'gorgonAthena',
          inputs.gorgonCandidate?.rarity,
        ),
      );
      const valid = processed.every((branch, index) => {
        const evaluations = branch.traitEvaluations ?? [];
        const evaluation = evaluations.at(-1);
        return (
          evaluations.length > before[index]! &&
          evaluation !== undefined &&
          evaluation.assessments.every((assessment) => assessment.legal) &&
          evaluation.composition.legal &&
          evaluation.replacementComposition.legal &&
          evaluation.targetedAcquisition.legal
        );
      });
      if (valid)
        branches = Object.freeze(
          processed.map((branch) =>
            Object.freeze({ ...branch, keepsakes: consumeGorgonAppearance(branch.keepsakes) }),
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

  if (
    event.kind === 'bossDefeated' &&
    room?.kind === 'authored' &&
    declaration?.mode.kind === 'authored' &&
    declaration.mode.templateKey === 'Boss' &&
    inputs.enteredBiomeCount < inputs.fullRunBiomeCount
  ) {
    const owner = createJudgmentArcanaAddress(room.origin, event.phaseKey);
    const figurineOwner = createFigurineArcanaAddress(room.origin, event.phaseKey);
    const judgmentBranches = branches.filter(
      (branch) =>
        !hasActiveChaosSemanticTag(branch.traitHistory ?? createTraitHistoryState(), 'Barren'),
    );
    const frontier = arcanaFrontier(judgmentBranches);
    const first = judgmentBranches[0]?.arcanaFear;
    const requiredCount =
      frontier === undefined || first === undefined
        ? undefined
        : judgmentRequiredCount(catalog, first);
    const judgmentCandidate =
      requiredCount === undefined || first === undefined
        ? undefined
        : Object.freeze({
            key: semanticAddressKey(owner),
            requiredCount,
            inactiveArcanaKeys: Object.freeze(
              inactiveArcanaKeys(catalog, first).filter(
                (key) =>
                  judgmentBranches[0]?.keepsakes.fatedStatus !== 'Fated' ||
                  catalog.arcanaCards.byKey[key]?.fatedIncompatible !== true,
              ),
            ),
          });
    branches = Object.freeze(
      branches.flatMap((branch) => {
        if (hasActiveChaosSemanticTag(branch.traitHistory ?? createTraitHistoryState(), 'Barren'))
          return [advanceRewardBranches([branch], event.sequence)[0]!];
        const required = judgmentRequiredCount(catalog, branch.arcanaFear);
        if (required === undefined) return [advanceRewardBranches([branch], event.sequence)[0]!];
        const selected = room.encounters.judgmentArcanaKeysByPhase?.[event.phaseKey] ?? [];
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
        const assessed = activateTemporaryArcana(catalog, branch.arcanaFear, selected, {
          owner,
          sequence: event.sequence,
        });
        if (
          !assessed.legal ||
          (branch.keepsakes.fatedStatus === 'Fated' &&
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
            arcanaFear: assessed.state,
            keepsakes: refreshKeepsakeFatedStatus(catalog, branch.keepsakes, assessed.state),
            processedThroughHistorySequence: event.sequence,
          }),
        ];
      }),
    );
    const figurineBranches = branches;
    const figurineSource = figurineBranches[0]?.keepsakes.figurine;
    const figurineEffect = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === 'crystalFigurine',
    )?.effect;
    const figurineEligible =
      figurineSource?.status === 'pending' && figurineEffect?.kind === 'crystalFigurine';
    if (figurineEligible) {
      if (
        figurineBranches.some(
          (branch) => JSON.stringify(branch.keepsakes.figurine) !== JSON.stringify(figurineSource),
        )
      )
        throw new BiomeRewardSimulationContractError(
          'Crystal Figurine source frontier has divergent state across surviving branches',
        );
      arcanaFrontier(figurineBranches);
    }
    const figurineFrontier = figurineEligible ? figurineBranches[0]?.arcanaFear : undefined;
    const figurineInactive =
      figurineEligible && figurineFrontier !== undefined
        ? Object.freeze(
            inactiveArcanaKeys(catalog, figurineFrontier).filter(
              (key) =>
                figurineBranches[0]?.keepsakes.fatedStatus !== 'Fated' ||
                catalog.arcanaCards.byKey[key]?.fatedIncompatible !== true,
            ),
          )
        : Object.freeze([]);
    const figurineRequiredCount = figurineEligible
      ? Math.min(figurineEffect.requestedCards, figurineInactive.length)
      : 0;
    const figurineCandidate =
      figurineEligible && figurineFrontier !== undefined
        ? Object.freeze({
            key: semanticAddressKey(figurineOwner),
            inactiveArcanaKeys: figurineInactive,
            requiredCount: figurineRequiredCount,
            rarity: figurineSource.rarity,
          })
        : undefined;
    branches = Object.freeze(
      figurineBranches.flatMap((branch) => {
        const source = branch.keepsakes.figurine;
        if (source?.status !== 'pending' || figurineEffect?.kind !== 'crystalFigurine')
          return [advanceRewardBranches([branch], event.sequence)[0]!];
        const selected = room.encounters.figurineArcanaKeysByPhase?.[event.phaseKey] ?? [];
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
              keepsakes: consumeFigurine(branch.keepsakes),
              processedThroughHistorySequence: event.sequence,
            }),
          ];
        }
        const assessed = activateTemporaryArcana(
          catalog,
          branch.arcanaFear,
          selected,
          { owner: figurineOwner, sequence: event.sequence },
          source.rarity,
        );
        if (
          !assessed.legal ||
          (branch.keepsakes.fatedStatus === 'Fated' &&
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
            arcanaFear: assessed.state,
            keepsakes: refreshKeepsakeFatedStatus(
              catalog,
              consumeFigurine(branch.keepsakes),
              assessed.state,
            ),
            processedThroughHistorySequence: event.sequence,
          }),
        ];
      }),
    );
    return Object.freeze({
      branches,
      findings: Object.freeze([...findings.values()]),
      roleFrontiers: Object.freeze(roleFrontiers),
      traitChildSettlements: Object.freeze(traitChildSettlements),
      ...(judgmentCandidate === undefined ? {} : { judgmentCandidate }),
      ...(figurineCandidate === undefined ? {} : { figurineCandidate }),
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
      gorgonEvaluationBlocked,
      ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
    });
  if (event.kind === 'encounterCompleted') {
    const rewards =
      room.localRewards?.filter((reward) => reward.encounterPhaseKey === event.phaseKey) ?? [];
    if (room.lifecycleProfileKey === 'FieldsCombatRoom' || rewards.length === 0)
      return Object.freeze({
        branches: advanceRewardBranches(branches, event.sequence),
        findings: Object.freeze([...findings.values()]),
        roleFrontiers: Object.freeze(roleFrontiers),
        traitChildSettlements: Object.freeze(traitChildSettlements),
        gorgonEvaluationBlocked,
        ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
      });
    if (rewards.length !== 1 || rewards[0] === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName}.${event.phaseKey} does not own exactly one local reward`,
      );
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
          Object.freeze({ ...rewards[0], instanceProvenance: 'free' }),
        ),
        historySequence: event.sequence,
        authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
      },
      (history) =>
        createBiomeRewardFacts(
          catalog,
          room,
          room,
          declaration,
          view.preOutgoing ?? view.entry,
          history,
          inputs.enteredBiomeCount,
        ),
      findings,
      undefined,
      chronology(snapshot, room, event),
    );
    roleFrontiers.push(...(settlement.roleFrontiers ?? []));
    for (const checkpoint of settlement.traitChildSettlements ?? [])
      recordChild(checkpoint, room.origin);
    return Object.freeze({
      branches: settlement.branches,
      findings: Object.freeze([...findings.values()]),
      roleFrontiers: Object.freeze(roleFrontiers),
      traitChildSettlements: Object.freeze(traitChildSettlements),
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
      gorgonEvaluationBlocked,
      ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
    });
  const encounterKey = selectedEncounterAuthoringProfileKey(
    catalog,
    declaration,
    room.encounters,
    event.phaseKey,
    semanticAddressKey(event.origin),
  );
  let nemesisCandidate: EncounterSettlementTransition['nemesisCandidate'];
  let runtimeOfferFallback: EncounterSettlementTransition['runtimeOfferFallback'];
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
      const assessments = Object.freeze(
        branches.map((branch) => {
          const facts = createBiomeRewardFacts(
            catalog,
            room,
            room,
            declaration,
            view.preOutgoing ?? view.entry,
            branch.history,
            inputs.enteredBiomeCount,
          );
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
          const equipped = Object.values(
            (branch.traitHistory ?? createTraitHistoryState()).equippedTraits,
          ).filter((trait) => {
            const declaration = catalog.traits.byKey[trait.traitKey];
            return (
              declaration !== undefined &&
              trait.providerKind === 'olympian' &&
              trait.rarity !== undefined
            );
          });
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
      const legal =
        outcome !== null &&
        outcome !== undefined &&
        rewardType !== undefined &&
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
                assessment.traitTradeTraitKeys.includes(outcome.traitKey)
              );
          }
        });
      if (outcome === null || outcome === undefined || !legal) {
        const finding = rewardFinding(
          outcome === null || outcome === undefined
            ? 'nemesisOutcomeMissing'
            : 'nemesisOutcomeUnavailable',
          owner,
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
        if (outcome.kind === 'traitTrade' && outcome.response === 'accept')
          branches = Object.freeze(
            branches.map((branch) => {
              const before = branch.traitHistory ?? createTraitHistoryState();
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
                  traitKey: outcome.traitKey,
                  match: 'currentTraitKey' as const,
                }),
              ]);
              return Object.freeze({
                ...branch,
                history: attachTraitHistory(branch.history, traitHistory),
                traitHistory,
              });
            }),
          );
        if (outcome.kind === 'freeItem') {
          const edge = policy.freeItem.runtimeOfferFallbacks.find(
            (candidate) => candidate.preferredRewardType === rewardType,
          );
          if (
            edge !== undefined &&
            assessments.every((assessment) =>
              assessment.freeItemRewardTypes.includes(edge.fallbackRewardType as never),
            )
          )
            runtimeOfferFallback = Object.freeze({
              key: semanticAddressKey(owner),
              address: owner,
              preferredKey: edge.preferredRewardType,
              fallbackKey: edge.fallbackRewardType,
            });
        }
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
    const loadout = Object.freeze({
      ...inputs.routeLoadout,
      ...(declaration.boonRarityOverride === undefined
        ? {}
        : { boonRarityRoomOverride: declaration.boonRarityOverride }),
    });
    const provider = catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer?.giverKey;
    const settled = branches.map((branch) =>
      settleEncounterTraitOffer(
        catalog,
        branch,
        owner,
        authored,
        event.sequence,
        'encounterCompleted',
        findings,
        chronology(snapshot, room, event),
        'selection',
        undefined,
        loadout,
        authored === null
          ? undefined
          : branches.map((candidate) => candidate.traitHistory ?? createTraitHistoryState()),
        provider,
      ),
    );
    for (const item of settled) recordChild(item.blockedChild, room.origin);
    if (authored !== null) branches = Object.freeze(settled.map((item) => item.branch));
  }
  return Object.freeze({
    branches,
    findings: Object.freeze([...findings.values()]),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
    ...(nemesisCandidate === undefined ? {} : { nemesisCandidate }),
    ...(runtimeOfferFallback === undefined ? {} : { runtimeOfferFallback }),
    gorgonEvaluationBlocked,
    ...(blockGorgonPhaseKey === undefined ? {} : { blockGorgonPhaseKey }),
  });
}
