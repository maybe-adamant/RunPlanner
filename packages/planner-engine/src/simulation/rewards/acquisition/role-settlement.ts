import { replaceSimulationTraitHistory } from '../../state/transitions';
import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
} from '../../../authored-project/addresses';
import { artificerReplacementEntryKey } from '../../../authored-project/acquisition/artificer';
import {
  createUnresolvedAcquisitionRewardState,
  optionIndex,
} from '../../../authored-project/traits/state';
import type { Catalog } from '../../../catalog-schema';
import {
  applyConcreteAcquisition,
  consumeCountedOffer,
  countedStoreTypeStanding,
  creditResourceGains,
  isOfferSupportedAtResolutionPoint,
  locallyValidRewardOffers,
  resolveAcquisitionRole,
  type ConcreteAcquisitionEvent,
  type ResolvedRewardOffer,
} from '../../../reward-kernel';
import {
  creditItemArmor,
  creditMaxStatGain,
  recordGodLootPickup,
} from '../../../reward-kernel/history';
import { grantPickupRerolls } from '../../arcana-fear';
import type { FindingChronology, FindingRegionEntry } from '../../finding-regions';
import { bankPathPoints } from '../../hex-progress';
import type { HexActivationContext } from '../../hex-activation';
import {
  hexActivationFindingEvidence,
  settleAuthoredPathScreen,
} from '../trait-settlement/hex-settlement';
import {
  consumeOlympianProviderMaterialized,
  consumeTimePieceCharge,
} from '../../keepsakes/reward-effects';
import {
  foldTraitHistoryEvents,
  isAspectSpellDropDormant,
  recordFixedAcquisitionTraitGrant,
} from '../../traits';
import { anvilTransformationEvent, assessAnvilResult } from '../anvil-settlement';
import {
  appendRewardEvent,
  freezeRecord,
  offerEvidence,
  withBag,
  type RewardBranchState,
} from '../branch-primitives';
import {
  addRewardFinding,
  historyChronology,
  mergeRewardFindingEmissions,
  rewardFinding,
} from '../findings';
import {
  applyTraitOfferForAcquisition,
  publishTraitOfferScreenCompletion,
  type PriorTraitMutation,
  type ReachedTraitChildCheckpoint,
  type ReachedTraitOfferCandidateContact,
} from '../trait-settlement/coordinator';
import type {
  AcquisitionRoleFrontier,
  AcquisitionRoleResolution,
  ProducerRoleSettlementProduct,
  RewardFactsFactory,
} from './contracts';
import {
  assessArtificerConversion,
  assessSeaStarDuplication,
  assessTimePieceConversion,
  generateArtificerReplacement,
} from './conversions';
import { resolvedAcquisitionSource, type AcquisitionSource } from './source';
import {
  isPendingTraitOffer,
  spawnPendingTraitOffers,
  traitOfferRoomOccurrence,
} from '../../state/pending-trait-offers';
import { settleRewardSpawn } from '../biome/offer-lifecycle/spawned-trait-offers';
import {
  collectPendingResourcePickup,
  forfeitedPickupOf,
  resolveProducedMaxStatGrant,
  resolveProducedRerollGrant,
  spawnPickups,
} from '../../state/pending-resource-pickups';
import {
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  seaStarDuplicateAcquisitionSite,
  seaStarDuplicateSiteKey,
} from '../../../authored-project/acquisition/sea-star';

/** A Sea Star duplicate loot is created after its source screen closes. */
function spawnSeaStarDuplicate(
  catalog: Catalog,
  branch: RewardBranchState,
  incoming: AcquisitionSource,
  role: string,
): RewardBranchState {
  const occurrence = traitOfferRoomOccurrence(incoming.origin);
  if (occurrence === undefined || incoming.levelResolutionsByAcquisitionRole === undefined)
    return branch;
  const origin = createAcquisitionEntryAddress(
    seaStarDuplicateAcquisitionSite(
      occurrence,
      createAcquisitionRoleAddress(incoming.origin, role),
    ),
    SEA_STAR_DUPLICATE_ENTRY_KEY,
  );
  const state = spawnPendingTraitOffers(catalog, branch.state, [
    Object.freeze({
      origin,
      offer: incoming.offer,
      levelResolutionsByAcquisitionRole: incoming.levelResolutionsByAcquisitionRole,
    }),
  ]);
  return state === branch.state ? branch : Object.freeze({ ...branch, state });
}
import type { CountedRewardBinding } from '../../../reward-kernel/bindings';
import { staticallyExcludedCandidateResult } from '../producer-frontiers';
import {
  reachedRewardOfferExclusion,
  peerlessCountedOfferReason,
  staticCountedOfferExclusion,
} from '../offer-exclusions';

// Artificer redraws from RunProgress without Devotion or Selene.
const ARTIFICER_INELIGIBLE_REWARD_TYPES: readonly string[] = ['Devotion', 'SpellDrop'];
const ARTIFICER_REDRAW_OPTIONS = Object.freeze({
  ineligibleRewardTypes: new Set(ARTIFICER_INELIGIBLE_REWARD_TYPES),
});
const ARTIFICER_REDRAW_BINDING: CountedRewardBinding = Object.freeze({
  kind: 'countedChoice',
  storeKeys: Object.freeze(['RunProgress']),
  eligibleRewardTypes: Object.freeze([]),
  ineligibleRewardTypes: ARTIFICER_INELIGIBLE_REWARD_TYPES,
  allowedRewardTypes: Object.freeze([]),
  producerLifecycleKey: 'Artificer',
});

export function applyProducerRoleHistory(
  catalog: Catalog,
  reached: RewardBranchState | undefined,
  incoming: AcquisitionSource,
  resolution: AcquisitionRoleResolution,
  facts: RewardFactsFactory,
  atomicRegion: string | undefined,
  findingChronology: FindingChronology | undefined,
  settlement: { readonly site: AcquisitionSiteAddress; readonly entry: AcquisitionEntryAddress },
  directTraitSetBranch?: RewardBranchState,
  deferArtificerReplacement = false,
  offerAlreadyGenerated = false,
  authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>,
): ProducerRoleSettlementProduct {
  const artificerReplacementRewardTypes = Object.freeze(
    [
      ...new Set(
        (catalog.rewards.stores.byKey.RunProgress?.entries ?? []).map((entry) => entry.rewardType),
      ),
    ].filter((rewardType) => rewardType !== 'Devotion' && rewardType !== 'SpellDrop'),
  );
  // Only a materialized source screen publishes replacement options; a request
  // without one retains the unresolved candidate alone.
  const artificerReplacementOptions = !incoming.presentsMaterializedScreen
    ? undefined
    : Object.freeze(
        artificerReplacementRewardTypes.flatMap((rewardType) =>
          locallyValidRewardOffers(catalog.rewards, rewardType).map((offer) =>
            createUnresolvedAcquisitionRewardState(
              catalog,
              offer,
              {
                kind: 'producerLifecycle',
                key: 'RoomReward',
              },
              settlement.site.routeKey,
            ),
          ),
        ),
      );
  const exactArtificerSite = incoming.artificerReplacementSiteByAcquisitionRole?.[resolution.role];
  const artificerReplacementAddress = createAcquisitionEntryAddress(
    exactArtificerSite ?? settlement.site,
    exactArtificerSite === undefined
      ? artificerReplacementEntryKey(settlement.entry.entryKey, resolution.role)
      : artificerReplacementEntryKey(incoming.origin, resolution.role),
  );
  const findingEmissions = new Map<string, FindingRegionEntry>();
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  let realizedAcquisitionAtRole: ConcreteAcquisitionEvent | undefined;
  const priorTraitMutations = new Map<string, PriorTraitMutation>();
  const traitOfferCandidateContacts: ReachedTraitOfferCandidateContact[] = [];
  let unresolvedArtificerReplacement = false;
  let unresolvedTraitOffer = false;
  let unresolvedHexActivation = false;
  let hexActivationContext: HexActivationContext | undefined;
  const seaStarSourceKey = semanticAddressKey(
    createAcquisitionRoleAddress(incoming.origin, resolution.role),
  );
  const retainSeaStarEligibility =
    authoredSeaStarDuplicateSiteKeys?.has(
      seaStarDuplicateSiteKey(createAcquisitionRoleAddress(incoming.origin, resolution.role)),
    ) === true;
  const settleRole = (branch: RewardBranchState): RewardBranchState | undefined => {
    const branchFacts = facts(branch.state);
    if (
      !offerAlreadyGenerated &&
      !isOfferSupportedAtResolutionPoint(catalog.rewards, incoming.offer, branchFacts, {
        acquisitionRole: resolution.role,
      })
    ) {
      return undefined;
    }
    const acquisition = resolveAcquisitionRole(
      catalog.rewards,
      incoming.offer,
      resolution.role,
      resolution.lifecyclePoint,
    );
    // Loot the walk did not spawn earlier (an Opening or Devotion gate reward)
    // spawns at this contact; loot already spawned keeps its spawn's decision.
    const spawnedBranch =
      incoming.roomRewardForfeitEligible === true &&
      !isPendingTraitOffer(branch.state, createTraitOfferAddress(incoming.origin, resolution.role))
        ? settleRewardSpawn(
            catalog,
            branch,
            {
              origin: incoming.origin,
              offer: incoming.offer,
              producerLifecycleKey: incoming.producerLifecycleKey,
              forfeitEligible: true,
            },
            resolution.historySequence,
          )
        : branch;
    const forfeited = forfeitedPickupOf(spawnedBranch.state, incoming.origin, resolution.role);
    const realizedAcquisition = forfeited ?? acquisition;
    if (forfeited !== undefined) realizedAcquisitionAtRole = forfeited;
    const seaStarAssessment = assessSeaStarDuplication(
      catalog,
      branch,
      incoming,
      resolution,
      realizedAcquisition,
    );
    const seaStarResult = seaStarAssessment.supported
      ? Object.freeze({ kind: retainSeaStarEligibility ? ('proc' as const) : ('noProc' as const) })
      : undefined;
    const attestedBranch = retainSeaStarEligibility
      ? Object.freeze({
          ...spawnedBranch,
          seaStarDuplicateEligibilityBySource: freezeRecord({
            ...(spawnedBranch.seaStarDuplicateEligibilityBySource ?? {}),
            [seaStarSourceKey]: seaStarAssessment,
          }),
        })
      : spawnedBranch;
    // A concrete god-loot acquisition is a materialization contact when the
    // producer gives it free; directly created loot is not given. Blind Box
    // hidden loot is always given, even from a paid or created box. A
    // room-reward object spent its keepsake as it spawned.
    const materializedProvider =
      (incoming.instanceProvenance === 'free' &&
        incoming.createdNotGiven !== true &&
        incoming.roomRewardForfeitEligible !== true) ||
      resolution.lifecyclePoint === 'afterUnwrap'
        ? catalog.traitGiverByAcquisitionGameName[realizedAcquisition.acquisition.gameName]
        : undefined;
    const materializedBranch =
      materializedProvider === undefined
        ? attestedBranch
        : Object.freeze({
            ...attestedBranch,
            state: Object.freeze({
              ...attestedBranch.state,
              keepsakes: consumeOlympianProviderMaterialized(
                attestedBranch.state.keepsakes,
                materializedProvider,
                'free',
              ),
            }),
          });
    // Time Piece is assessed at the exact concrete role, after offer/bag
    // evidence exists but before any acquisition, trait, Pom, level, or
    // element effects can be folded. Shop purchases take their separate paid
    // settlement path and consequently never enter this free producer path.
    const disposition =
      incoming.dispositionByAcquisitionRole?.[resolution.role] ??
      Object.freeze({ kind: 'normal' as const });
    const conversion = assessTimePieceConversion(
      catalog,
      branch,
      incoming,
      resolution.role,
      resolution.lifecyclePoint,
      realizedAcquisition,
    );
    if (disposition.kind === 'timePiece' && conversion.supported) {
      return appendRewardEvent(
        Object.freeze({
          ...materializedBranch,
          state: Object.freeze({
            ...materializedBranch.state,
            keepsakes: consumeTimePieceCharge(materializedBranch.state.keepsakes),
          }),
        }),
        resolution.historySequence,
        {
          kind: 'conversionToGold',
          origin: incoming.origin,
          source: resolvedAcquisitionSource(incoming),
          acquisition: realizedAcquisition,
          settlement,
        },
      );
    }
    if (disposition.kind === 'timePiece') {
      addRewardFinding(
        findingEmissions,
        rewardFinding(
          'timePieceConversionUnavailable',
          createAcquisitionRoleAddress(incoming.origin, resolution.role),
          {
            ...conversion.evidence,
          },
        ),
        atomicRegion,
        findingChronology ?? historyChronology(resolution.historySequence),
      );
    }
    if (forfeited !== undefined) {
      const history = applyConcreteAcquisition(
        catalog.rewards,
        materializedBranch.state.rewardHistory,
        realizedAcquisition.acquisition,
      );
      return appendRewardEvent(
        Object.freeze({
          ...materializedBranch,
          state: Object.freeze({ ...materializedBranch.state, rewardHistory: history }),
        }),
        resolution.historySequence,
        {
          kind: 'concreteAcquisition',
          origin: incoming.origin,
          source: resolvedAcquisitionSource(incoming),
          acquisition: realizedAcquisition,
          settlement,
        },
      );
    }
    if (disposition.kind === 'artificer') {
      const conversion = generateArtificerReplacement(
        catalog,
        branch,
        incoming,
        resolution,
        acquisition,
        artificerReplacementAddress,
        facts,
        atomicRegion,
        findingChronology,
        settlement,
      );
      mergeRewardFindingEmissions(findingEmissions, conversion.findingEmissions);
      // A missing or unavailable conversion blocks the role; the source is not acquired.
      unresolvedArtificerReplacement ||= conversion.status !== 'converted';
      const generated = conversion.generatedReplacement;
      if (generated === undefined) return undefined;
      // The conversion spawns the replacement loot (GiftLogic.lua:29), whose
      // options are built now.
      const decided = settleRewardSpawn(
        catalog,
        generated.branch,
        { ...generated.source, forfeitEligible: true },
        resolution.historySequence,
      );
      const spawned = Object.freeze({
        ...decided,
        state: spawnPendingTraitOffers(catalog, decided.state, [generated.source]),
      });
      if (deferArtificerReplacement) return spawned;
      let replacement: RewardBranchState | undefined = spawned;
      for (const binding of generated.roles) {
        const replacementSettlement = applyProducerRoleHistory(
          catalog,
          replacement,
          generated.source,
          Object.freeze({ ...binding, historySequence: resolution.historySequence }),
          facts,
          atomicRegion,
          findingChronology,
          Object.freeze({
            site: artificerReplacementAddress.site,
            entry: artificerReplacementAddress,
          }),
          undefined,
          false,
          true,
          authoredSeaStarDuplicateSiteKeys,
        );
        replacement = replacementSettlement.branch;
        mergeRewardFindingEmissions(findingEmissions, replacementSettlement.findingEmissions);
        roleFrontiers.push(...replacementSettlement.roleFrontiers);
        traitChildSettlements.push(...replacementSettlement.traitChildSettlements);
      }
      return replacement;
    }
    const concreteDeclaration =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName];
    const pickupEffect = concreteDeclaration?.pickupEffect;
    const authoredAnvilResult = incoming.anvilResultsByAcquisitionRole?.[resolution.role];
    if (pickupEffect !== undefined && disposition.kind === 'normal') {
      if (authoredAnvilResult === undefined || authoredAnvilResult === null) {
        addRewardFinding(
          findingEmissions,
          rewardFinding(
            'rewardMissing',
            createAcquisitionRoleAddress(incoming.origin, resolution.role),
            {
              acquisitionRole: resolution.role,
              pickupEffect: pickupEffect.kind,
            },
          ),
          atomicRegion,
          findingChronology ?? historyChronology(resolution.historySequence),
        );
        return undefined;
      }
      if (pickupEffect.kind === 'anvilOfFates') {
        const temporaryHammerTraitKeys = new Set(
          materializedBranch.state.keepsakes.experimentalHammers
            .filter((hammer) => hammer.active)
            .map((hammer) => hammer.traitKey),
        );
        const assessment = assessAnvilResult(
          catalog,
          materializedBranch.state,
          authoredAnvilResult,
          incoming.traitContext ?? Object.freeze({}),
          temporaryHammerTraitKeys,
        );
        if (!assessment.legal) {
          addRewardFinding(
            findingEmissions,
            rewardFinding(
              'rewardAcquisitionUnavailable',
              createAcquisitionRoleAddress(incoming.origin, resolution.role),
              {
                pickupEffect: pickupEffect.kind,
                findings: assessment.issues.map((issue) => issue.key),
              },
            ),
            atomicRegion,
            findingChronology ?? historyChronology(resolution.historySequence),
          );
          return undefined;
        }
      }
    }
    // `UseConsumableItem` grants the object's stored amount; a Sea Star-retained
    // object is collected again with that same amount.
    const duplicateSource =
      incoming.producer?.kind === 'seaStarDuplicate' ? incoming.producer : undefined;
    const collected = collectPendingResourcePickup(
      catalog,
      materializedBranch.state,
      {
        owner: duplicateSource?.sourceOwner ?? incoming.origin,
        role: duplicateSource?.sourceRole ?? resolution.role,
        acquisitionGameName: acquisition.acquisition.gameName,
        producerLifecycleKey: incoming.producerLifecycleKey,
      },
      seaStarResult?.kind === 'proc',
    );
    const acquiredHistory = applyConcreteAcquisition(
      catalog.rewards,
      branch.state.rewardHistory,
      acquisition.acquisition,
    );
    const history = creditItemArmor(
      creditMaxStatGain(
        collected.amounts === undefined
          ? acquiredHistory
          : creditResourceGains(acquiredHistory, collected.amounts),
        resolveProducedMaxStatGrant(
          catalog,
          acquisition.acquisition.gameName,
          incoming.producerLifecycleKey,
          branch.state.reached.routePosition.routeKey,
        ),
      ),
      concreteDeclaration?.armorGrant,
    );
    let acquisitionTraitHistory = materializedBranch.state.traitHistory;
    if (pickupEffect?.kind === 'anvilOfFates' && authoredAnvilResult?.kind === 'anvilOfFates') {
      acquisitionTraitHistory = foldTraitHistoryEvents(
        catalog,
        Object.freeze([
          ...acquisitionTraitHistory.events,
          anvilTransformationEvent(
            incoming.origin,
            resolution.role,
            resolution.historySequence,
            resolution.lifecyclePoint,
            authoredAnvilResult,
          ),
        ]),
      );
    }
    const fixedTraitKey =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.grantedTraitKey;
    const contributions =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.elementContributions;
    // A Sea Star duplicate is the same object used again, granting its source's rerolls.
    const rerolls = resolveProducedRerollGrant(
      catalog,
      materializedBranch.state.traitHistory,
      acquisition.acquisition.gameName,
      incoming.producerLifecycleKey,
      duplicateSource === undefined
        ? settlement.entry.entryKey
        : duplicateSource.sourceOwner.kind === 'acquisitionEntry'
          ? duplicateSource.sourceOwner.entryKey
          : undefined,
    );
    let acquisitionBranch: RewardBranchState = Object.freeze({
      ...materializedBranch,
      state: replaceSimulationTraitHistory(
        Object.freeze({
          ...collected.state,
          rewardHistory: history,
          arcanaFear: grantPickupRerolls(collected.state.arcanaFear, rerolls),
        }),
        acquisitionTraitHistory,
      ),
    });
    const pathPointGrant: 1 | 3 | 5 | undefined =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.pathPointGrant ??
      (acquisition.acquisition.gameName === 'SpellDrop' &&
      isAspectSpellDropDormant(catalog, materializedBranch.state.equipment.aspectKey)
        ? (3 as const)
        : undefined);
    let investedHexNodeKeys: readonly string[] | undefined;
    if (pathPointGrant !== undefined) {
      const screen = settleAuthoredPathScreen(
        catalog,
        acquisitionBranch,
        pathPointGrant,
        incoming.hexActivationsByAcquisitionRole?.[resolution.role],
      );
      hexActivationContext = screen.context;
      if (screen.kind !== 'settled') {
        unresolvedHexActivation = true;
        addRewardFinding(
          findingEmissions,
          rewardFinding(
            screen.kind === 'missing' ? 'hexActivationMissing' : 'hexActivationUnavailable',
            createAcquisitionRoleAddress(incoming.origin, resolution.role),
            screen.kind === 'missing'
              ? { count: screen.context.count }
              : hexActivationFindingEvidence(screen.context, screen.violations),
          ),
          atomicRegion,
          findingChronology ?? historyChronology(resolution.historySequence),
        );
        return undefined;
      }
      acquisitionBranch = screen.branch;
      investedHexNodeKeys = screen.selectedNodeKeys;
    }
    if (fixedTraitKey !== undefined) {
      acquisitionTraitHistory = recordFixedAcquisitionTraitGrant(
        catalog,
        acquisitionTraitHistory,
        incoming.origin,
        resolution.historySequence,
        resolution.lifecyclePoint,
        fixedTraitKey,
      );
      acquisitionBranch = Object.freeze({
        ...acquisitionBranch,
        state: replaceSimulationTraitHistory(acquisitionBranch.state, acquisitionTraitHistory),
      });
    }
    if (contributions !== undefined) {
      acquisitionTraitHistory = foldTraitHistoryEvents(
        catalog,
        Object.freeze([
          ...acquisitionTraitHistory.events,
          Object.freeze({
            kind: 'elementContribution' as const,
            owner: incoming.origin,
            acquisitionRole: resolution.role,
            sequence: resolution.historySequence,
            acquisitionPoint: resolution.lifecyclePoint,
            contributions,
          }),
        ]),
      );
      acquisitionBranch = Object.freeze({
        ...acquisitionBranch,
        state: replaceSimulationTraitHistory(acquisitionBranch.state, acquisitionTraitHistory),
      });
    }
    const traitEventCountBeforeSettlement = acquisitionBranch.state.traitHistory.events.length ?? 0;
    const directTraitSetHistory = (directTraitSetBranch ?? branch).state.traitHistory;
    const traitSettlement = applyTraitOfferForAcquisition(
      catalog,
      acquisitionBranch,
      incoming,
      resolution.role,
      resolution.lifecyclePoint,
      resolution.historySequence,
      findingChronology,
      directTraitSetHistory === undefined ? {} : { directTraitSetHistory },
    );
    mergeRewardFindingEmissions(findingEmissions, traitSettlement.findingEntries);
    if (traitSettlement.candidateContact !== undefined)
      traitOfferCandidateContacts.push(traitSettlement.candidateContact);
    for (const mutation of traitSettlement.priorTraitMutations ?? [])
      priorTraitMutations.set(
        `${semanticAddressKey(mutation.owner)}\u0000${mutation.acquisitionRole}`,
        mutation,
      );
    const installedSpellEvent =
      acquisition.acquisition.gameName === 'SpellDrop' && pathPointGrant === undefined
        ? traitSettlement.branch.state.traitHistory.events
            .slice(traitEventCountBeforeSettlement)
            .findLast(
              (event) =>
                event.kind === 'traitOffer' &&
                event.sequence === resolution.historySequence &&
                event.acquisitionRole === resolution.role &&
                event.giverKey === 'SpellDrop',
            )
        : undefined;
    const spellBonus =
      installedSpellEvent?.kind === 'traitOffer'
        ? catalog.traitGivers.byKey.SpellDrop?.selectedOptionPathPointBonuses?.[
            optionIndex(installedSpellEvent.selectedOptionKey)
          ]
        : undefined;
    const settledTraitBranch =
      spellBonus === undefined
        ? traitSettlement.branch
        : bankPathPoints(traitSettlement.branch, spellBonus);
    const withEvent = appendRewardEvent(settledTraitBranch, resolution.historySequence, {
      kind: 'concreteAcquisition',
      origin: incoming.origin,
      source: resolvedAcquisitionSource(incoming),
      acquisition,
      settlement,
      ...(seaStarResult === undefined ? {} : { seaStarResult }),
      ...(investedHexNodeKeys === undefined ? {} : { investedHexNodeKeys }),
    });
    if (traitSettlement.blockedChild !== undefined) {
      unresolvedTraitOffer = true;
      traitChildSettlements.push(
        Object.freeze({ ...traitSettlement.blockedChild, branch: withEvent }),
      );
      return undefined;
    }
    {
      // A completed selection screen records its loot in `GameState.LootPickups`.
      const pickupHistory =
        traitSettlement.completion === undefined
          ? withEvent.state.rewardHistory
          : recordGodLootPickup(
              catalog.rewards,
              withEvent.state.rewardHistory,
              acquisition.acquisition.gameName,
            );
      const pickedUp =
        pickupHistory === withEvent.state.rewardHistory
          ? withEvent
          : Object.freeze({
              ...withEvent,
              state: Object.freeze({ ...withEvent.state, rewardHistory: pickupHistory }),
            });
      const closed = publishTraitOfferScreenCompletion(pickedUp, traitSettlement.completion);
      // The screen's generated pickups spawn after its selection is equipped.
      const screenPickups =
        traitSettlement.completion === undefined
          ? undefined
          : incoming.screenProducedPickupsByAcquisitionRole?.[resolution.role];
      const completed =
        screenPickups === undefined
          ? closed
          : Object.freeze({
              ...closed,
              state: spawnPickups(catalog, closed.state, screenPickups),
            });
      return seaStarResult?.kind === 'proc' && traitSettlement.completion !== undefined
        ? spawnSeaStarDuplicate(catalog, completed, incoming, resolution.role)
        : completed;
    }
  };
  const next = reached === undefined ? undefined : settleRole(reached);
  if (
    next === undefined &&
    !unresolvedArtificerReplacement &&
    !unresolvedTraitOffer &&
    !unresolvedHexActivation
  ) {
    addRewardFinding(
      findingEmissions,
      rewardFinding('rewardAcquisitionUnavailable', incoming.origin, {
        ...offerEvidence(incoming.offer),
        role: resolution.role,
        lifecyclePoint: resolution.lifecyclePoint,
      }),
      atomicRegion,
      findingChronology ?? historyChronology(resolution.historySequence),
    );
  }
  roleFrontiers.push(
    Object.freeze({
      address: createAcquisitionRoleAddress(incoming.origin, resolution.role),
      ...(incoming.timelineOwner === undefined ? {} : { timelineOwner: incoming.timelineOwner }),
      beforeRole: reached,
      ...(realizedAcquisitionAtRole === undefined
        ? {}
        : { realizedAcquisition: realizedAcquisitionAtRole }),
      source: incoming,
      lifecyclePoint: resolution.lifecyclePoint,
      historySequence: resolution.historySequence,
      settlement,
      artificerReplacementAddress,
      ...(priorTraitMutations.size === 0
        ? {}
        : { priorTraitMutations: Object.freeze([...priorTraitMutations.values()]) }),
      ...(traitOfferCandidateContacts.length === 0
        ? {}
        : { traitOfferCandidateContacts: Object.freeze(traitOfferCandidateContacts) }),
      ...(hexActivationContext === undefined ? {} : { hexActivationContext }),
      ...(artificerReplacementOptions === undefined ? {} : { artificerReplacementOptions }),
      ...(artificerReplacementRewardTypes.length === 0
        ? {}
        : {
            artificerReplacementCandidate: Object.freeze({
              rewardTypes: artificerReplacementRewardTypes,
              evaluateOffer: (offer: ResolvedRewardOffer) => {
                const store = catalog.rewards.stores.byKey.RunProgress!;
                const redraws = (branch: RewardBranchState) => {
                  const artificer = assessArtificerConversion(
                    catalog,
                    branch,
                    incoming,
                    resolution,
                  );
                  if (!artificer.supported) return false;
                  const prepared = withBag(catalog, branch, 'RunProgress');
                  if (prepared === undefined) return false;
                  try {
                    return (
                      consumeCountedOffer(
                        catalog.rewards,
                        store,
                        prepared.bag,
                        offer,
                        facts(prepared.branch.state),
                        ARTIFICER_REDRAW_OPTIONS,
                      ) !== undefined
                    );
                  } catch {
                    return false;
                  }
                };
                const standing = (branch: RewardBranchState) => {
                  const prepared = withBag(catalog, branch, 'RunProgress');
                  if (prepared === undefined) return undefined;
                  try {
                    return countedStoreTypeStanding(
                      store,
                      prepared.bag,
                      offer.rewardType,
                      facts(prepared.branch.state),
                      ARTIFICER_REDRAW_OPTIONS,
                    );
                  } catch {
                    return undefined;
                  }
                };
                const countedStoreStanding = reached === undefined ? undefined : standing(reached);
                const countedStore =
                  countedStoreStanding === undefined ? {} : { countedStore: countedStoreStanding };
                const supported = reached === undefined || redraws(reached);
                if (supported)
                  return Object.freeze({ findings: Object.freeze([]), supported, ...countedStore });
                const routeKey = reached?.state.reached.routePosition.routeKey;
                const fixed =
                  routeKey === undefined
                    ? undefined
                    : staticCountedOfferExclusion(
                        catalog,
                        ARTIFICER_REDRAW_BINDING,
                        'RunProgress',
                        offer,
                        routeKey,
                      );
                if (fixed !== undefined) return staticallyExcludedCandidateResult(fixed);
                // The reached state must redraw it; a supported state cites nothing.
                const redrawReason = (branch: RewardBranchState) => {
                  if (!assessArtificerConversion(catalog, branch, incoming, resolution).supported)
                    return undefined;
                  const prepared = withBag(catalog, branch, 'RunProgress');
                  if (prepared === undefined) return undefined;
                  try {
                    return peerlessCountedOfferReason(
                      catalog.rewards,
                      store,
                      prepared.bag,
                      offer,
                      facts(prepared.branch.state),
                      ARTIFICER_REDRAW_OPTIONS,
                    );
                  } catch {
                    return undefined;
                  }
                };
                const exclusions = reachedRewardOfferExclusion(
                  reached === undefined ? undefined : redrawReason(reached),
                );
                return Object.freeze({
                  findings: Object.freeze([]),
                  supported,
                  ...(exclusions === undefined ? {} : { exclusions }),
                  ...countedStore,
                });
              },
            }),
          }),
      ...(resolution.blocksArtificerConversion === true
        ? { blocksArtificerConversion: true as const }
        : {}),
    }),
  );
  return Object.freeze({
    branch: next,
    findingEmissions: Object.freeze([...findingEmissions.values()]),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}
