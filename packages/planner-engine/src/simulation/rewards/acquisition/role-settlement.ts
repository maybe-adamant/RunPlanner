import { replaceSimulationTraitHistory } from '../../state/transitions';
import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
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
  isOfferSupportedAtResolutionPoint,
  locallyValidRewardOffers,
  resolveAcquisitionRole,
  type ConcreteAcquisitionEvent,
  type ResolvedRewardOffer,
} from '../../../reward-kernel';
import { consumeRoomRewardForfeit } from '../../arcana-fear';
import type { FindingChronology, FindingRegionEntry } from '../../finding-regions';
import { bankPathPoints, settlePathScreen } from '../../hex-progress';
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
  spawnPendingTraitOffers,
  traitOfferRoomOccurrence,
} from '../../state/pending-trait-offers';
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
import type { RewardEvent } from '../model';

export function applyProducerRoleHistory(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  incoming: AcquisitionSource,
  resolution: AcquisitionRoleResolution,
  facts: RewardFactsFactory,
  atomicRegion: string | undefined,
  findingChronology: FindingChronology | undefined,
  settlement: { readonly site: AcquisitionSiteAddress; readonly entry: AcquisitionEntryAddress },
  directTraitAgreementBranches?: readonly RewardBranchState[],
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
            createUnresolvedAcquisitionRewardState(catalog, offer, {
              kind: 'producerLifecycle',
              key: 'RoomReward',
            }),
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
  const next: RewardBranchState[] = [];
  const findingEmissions = new Map<string, FindingRegionEntry>();
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const realizedAcquisitionByBranch: (ConcreteAcquisitionEvent | undefined)[] = [];
  const priorTraitMutations = new Map<string, PriorTraitMutation>();
  const traitOfferCandidateContacts: ReachedTraitOfferCandidateContact[] = [];
  let unresolvedArtificerReplacement = false;
  let unresolvedTraitOffer = false;
  const seaStarSourceKey = semanticAddressKey(
    createAcquisitionRoleAddress(incoming.origin, resolution.role),
  );
  const retainSeaStarEligibility =
    authoredSeaStarDuplicateSiteKeys?.has(
      seaStarDuplicateSiteKey(createAcquisitionRoleAddress(incoming.origin, resolution.role)),
    ) === true;
  for (const branch of branches) {
    const branchFacts = facts(branch.state);
    if (
      !offerAlreadyGenerated &&
      !isOfferSupportedAtResolutionPoint(catalog.rewards, incoming.offer, branchFacts, {
        acquisitionRole: resolution.role,
      })
    ) {
      realizedAcquisitionByBranch.push(undefined);
      continue;
    }
    const acquisition = resolveAcquisitionRole(
      catalog.rewards,
      incoming.offer,
      resolution.role,
      resolution.lifecyclePoint,
    );
    const qualifyingRewardType =
      incoming.offer.rewardType === 'Boon' || incoming.offer.rewardType === 'HermesUpgrade'
        ? incoming.offer.rewardType
        : undefined;
    const fixedForfeit = branch.events.find(
      (event): event is Extract<RewardEvent, { readonly kind: 'rewardForfeited' }> =>
        event.kind === 'rewardForfeited' &&
        qualifyingRewardType !== undefined &&
        semanticAddressKey(event.origin) === semanticAddressKey(incoming.origin) &&
        event.rewardType === qualifyingRewardType,
    );
    const forfeit =
      fixedForfeit !== undefined
        ? Object.freeze({
            consumed: true as const,
            state: branch.state.arcanaFear,
            replacementRewardType: fixedForfeit.replacementRewardType,
          })
        : incoming.roomRewardForfeitEligible === true && qualifyingRewardType !== undefined
          ? consumeRoomRewardForfeit(catalog, branch.state.arcanaFear, qualifyingRewardType, {
              owner: incoming.origin,
              sequence: resolution.historySequence,
            })
          : Object.freeze({ consumed: false as const, state: branch.state.arcanaFear });
    const realizedAcquisition = forfeit.consumed
      ? Object.freeze({
          ...acquisition,
          acquisition: Object.freeze({
            kind: 'consumable' as const,
            gameName: forfeit.replacementRewardType,
          }),
        })
      : acquisition;
    realizedAcquisitionByBranch.push(forfeit.consumed ? realizedAcquisition : undefined);
    const forfeitBranch =
      forfeit.consumed && fixedForfeit === undefined && qualifyingRewardType !== undefined
        ? appendRewardEvent(
            Object.freeze({
              ...branch,
              state: Object.freeze({ ...branch.state, arcanaFear: forfeit.state }),
            }),
            resolution.historySequence,
            Object.freeze({
              kind: 'rewardForfeited' as const,
              origin: incoming.origin,
              rewardType: qualifyingRewardType,
              replacementRewardType: forfeit.replacementRewardType,
            }),
          )
        : branch;
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
          ...forfeitBranch,
          seaStarDuplicateEligibilityBySource: freezeRecord({
            ...(forfeitBranch.seaStarDuplicateEligibilityBySource ?? {}),
            [seaStarSourceKey]: seaStarAssessment,
          }),
        })
      : forfeitBranch;
    // A concrete god-loot acquisition is a materialization contact when the
    // producer marks it free. Blind Box hidden loot is also free even when its
    // containing Shop box was paid; the box itself is not god loot.
    const materializedProvider =
      incoming.instanceProvenance === 'free' || resolution.lifecyclePoint === 'afterUnwrap'
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
      next.push(
        appendRewardEvent(
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
        ),
      );
      continue;
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
    if (forfeit.consumed) {
      const history = applyConcreteAcquisition(
        catalog.rewards,
        materializedBranch.state.rewardHistory,
        realizedAcquisition.acquisition,
      );
      next.push(
        appendRewardEvent(
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
        ),
      );
      continue;
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
      unresolvedArtificerReplacement ||= conversion.status === 'missing';
      for (const generated of conversion.generatedReplacements) {
        // The conversion spawns the replacement loot, whose options are built now.
        const spawned = Object.freeze({
          ...generated.branch,
          state: spawnPendingTraitOffers(catalog, generated.branch.state, [generated.source]),
        });
        if (deferArtificerReplacement) {
          next.push(spawned);
          continue;
        }
        let replacementBranches: readonly RewardBranchState[] = Object.freeze([spawned]);
        for (const binding of generated.roles) {
          const replacementSettlement = applyProducerRoleHistory(
            catalog,
            replacementBranches,
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
          replacementBranches = replacementSettlement.branches;
          mergeRewardFindingEmissions(findingEmissions, replacementSettlement.findingEmissions);
          roleFrontiers.push(...replacementSettlement.roleFrontiers);
          traitChildSettlements.push(...replacementSettlement.traitChildSettlements);
        }
        next.push(...replacementBranches);
      }
      if (conversion.status !== 'unavailable') continue;
    }
    const concreteDeclaration =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName];
    const pickupEffect = concreteDeclaration?.pickupEffect;
    const authoredAnvilResult = incoming.anvilResult;
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
        continue;
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
                findings: assessment.findings,
              },
            ),
            atomicRegion,
            findingChronology ?? historyChronology(resolution.historySequence),
          );
          continue;
        }
      }
    }
    const history = applyConcreteAcquisition(
      catalog.rewards,
      branch.state.rewardHistory,
      acquisition.acquisition,
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
    let acquisitionBranch: RewardBranchState = Object.freeze({
      ...materializedBranch,
      state: replaceSimulationTraitHistory(
        Object.freeze({ ...materializedBranch.state, rewardHistory: history }),
        acquisitionTraitHistory,
      ),
    });
    const pathPointGrant: 1 | 3 | 5 | undefined =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.pathPointGrant ??
      (acquisition.acquisition.gameName === 'SpellDrop' &&
      isAspectSpellDropDormant(catalog, materializedBranch.state.equipment.aspectKey)
        ? (3 as const)
        : undefined);
    if (pathPointGrant !== undefined)
      acquisitionBranch = settlePathScreen(catalog, acquisitionBranch, pathPointGrant);
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
    const traitSettlement = applyTraitOfferForAcquisition(
      catalog,
      acquisitionBranch,
      incoming,
      resolution.role,
      resolution.lifecyclePoint,
      resolution.historySequence,
      findingChronology,
      {
        directTraitSetBranchHistories: (directTraitAgreementBranches ?? branches).map(
          (candidate) => candidate.state.traitHistory,
        ),
      },
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
    });
    if (traitSettlement.blockedChild !== undefined) {
      unresolvedTraitOffer = true;
      traitChildSettlements.push(
        Object.freeze({ ...traitSettlement.blockedChild, branch: withEvent }),
      );
    } else {
      const completed = publishTraitOfferScreenCompletion(withEvent, traitSettlement.completion);
      next.push(
        seaStarResult?.kind === 'proc' && traitSettlement.completion !== undefined
          ? spawnSeaStarDuplicate(catalog, completed, incoming, resolution.role)
          : completed,
      );
    }
  }
  if (next.length === 0 && !unresolvedArtificerReplacement && !unresolvedTraitOffer) {
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
      branchesBeforeRole: branches,
      ...(realizedAcquisitionByBranch.some((acquisition) => acquisition !== undefined)
        ? { realizedAcquisitionByBranch: Object.freeze(realizedAcquisitionByBranch) }
        : {}),
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
      ...(artificerReplacementOptions === undefined ? {} : { artificerReplacementOptions }),
      ...(artificerReplacementRewardTypes.length === 0
        ? {}
        : {
            artificerReplacementCandidate: Object.freeze({
              rewardTypes: artificerReplacementRewardTypes,
              evaluateOffer: (offer: ResolvedRewardOffer) => {
                const supported = branches.every((branch) => {
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
                        catalog.rewards.stores.byKey.RunProgress!,
                        prepared.bag,
                        offer,
                        facts(prepared.branch.state),
                        { ineligibleRewardTypes: new Set(['Devotion', 'SpellDrop']) },
                      ).length > 0
                    );
                  } catch {
                    return false;
                  }
                });
                return Object.freeze({ findings: Object.freeze([]), supported });
              },
            }),
          }),
      ...(resolution.blocksArtificerConversion === true
        ? { blocksArtificerConversion: true as const }
        : {}),
    }),
  );
  return Object.freeze({
    branches: Object.freeze(next),
    findingEmissions: Object.freeze([...findingEmissions.values()]),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}
