import { purgingPoolInteractions, stygianWellInteractions } from './feature-roll-seams';
import { roomObjectInteractions } from './object-interaction-seams';
import { createRoomObjectInteractionArtifacts } from '../../commerce/object-interactions';
import { semanticAddressKey, type SemanticAddress } from '../../../authored-project/addresses';
import type { BiomeRewardSimulation } from '../model';
import { createAcquisitionConversionCandidateArtifacts } from '../acquisition/artifacts';
import {
  createDerivedAcquisitionEntryCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../acquisition/artifacts';
import { createSteadyGrowthCandidateArtifacts } from '../../candidates/steady-growth';
import {
  createTranscendentEmbryoCandidateArtifacts,
  createFountainRarityCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';
import { createPurgingPoolCandidateArtifacts } from '../../commerce/purging-pool';
import { createHermesShrineCandidateArtifacts } from '../../commerce/hermes-shrine';
import { createStygianWellCandidateArtifacts } from '../../commerce/stygian-well';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
  type TraitOfferCandidateContacts,
} from '../../candidates/trait-offer/capability';
import type { TraitOfferCandidateContext } from '../../traits';
import { BiomeRewardSimulationContractError } from './biome-contract';
import { publishRunStateThroughCoverage } from '../run-state';
import { createRoomLifecycleCandidateArtifacts } from '../lifecycle-artifacts';
import { selectedTraitOfferProducts } from './selected-trait-products';
import { createRerollSurfaceCandidateArtifacts } from './reroll-surfaces';
import type { ChronologyAccumulation } from './chronology-accumulator';
import { type ChronologyWalkContext, type ChronologyWalkState } from './chronology-walk';
import {
  publishBiomeRewardEvaluationAssembly,
  type BiomeRewardEvaluationAssembly,
} from './publication';

import { createRewardProducerCandidateArtifacts } from '../producer-frontiers';
import { publicRewardBranch } from '../branch-lifecycle';
import { createJudgmentArcanaCandidateArtifacts } from '../../arcana-fear';
import {
  createFigurineArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';

function oneContext(
  key: string,
  contexts: readonly TraitOfferCandidateContext[] | undefined,
): TraitOfferCandidateContext | undefined {
  if (contexts !== undefined && contexts.length > 1)
    throw new BiomeRewardSimulationContractError(
      `trait offer ${key} reached more than one context`,
    );
  return contexts?.[0];
}

/**
 * Each reached trait offer's contacts. The offer's own context comes from its
 * selected assessment, else its reached contact, else the blocked child that
 * stopped it; a blocked target or All Together child also keeps its own
 * pre-effect context under its address.
 */
function traitOfferCandidateContacts(
  selected: ReadonlyMap<string, TraitOfferCandidateContext>,
  accumulation: ChronologyAccumulation,
): ReadonlyMap<string, TraitOfferCandidateContacts> {
  const offers = new Map<string, TraitOfferCandidateContext>();
  const children = new Map<string, Map<string, TraitOfferCandidateContext>>();
  for (const [key, context] of selected) offers.set(key, context);
  for (const [key, contexts] of accumulation.reachedTraitOfferCandidateContexts) {
    const context = oneContext(key, contexts);
    if (context !== undefined && !offers.has(key)) offers.set(key, context);
  }
  const blockedOffers = new Map<string, TraitOfferCandidateContext>();
  for (const [childKey, checkpoint] of accumulation.traitChildSettlements) {
    const context = oneContext(childKey, checkpoint.candidateContexts);
    if (context === undefined) continue;
    const address = checkpoint.address;
    switch (address.kind) {
      case 'traitOffer':
      case 'naturalSelectionResult': {
        // A missing offer, a Concave Stone result or Natural Selection blocks at the offer's own contact.
        const key = address.kind === 'traitOffer' ? childKey : semanticAddressKey(address.trait);
        if (!blockedOffers.has(key)) blockedOffers.set(key, context);
        break;
      }
      case 'traitAcquisitionTarget':
      case 'allTogetherSet': {
        const key = semanticAddressKey(address.trait);
        const keyed = children.get(key) ?? new Map<string, TraitOfferCandidateContext>();
        keyed.set(childKey, context);
        children.set(key, keyed);
        if (!blockedOffers.has(key)) blockedOffers.set(key, context);
        break;
      }
      default:
        // Other selected children are queried through their offer, never by their own address.
        break;
    }
  }
  for (const [key, context] of blockedOffers) if (!offers.has(key)) offers.set(key, context);
  return new Map(
    [...offers].map(([key, offer]) => [
      key,
      Object.freeze({ offer, children: children.get(key) ?? new Map() }),
    ]),
  );
}

/** Publishes one biome's reward evaluation from its frozen walk and finished accumulation. */
export function publishChronology(
  context: ChronologyWalkContext,
  walk: ChronologyWalkState,
  accumulation: ChronologyAccumulation,
  through: BiomeRewardEvaluationAssembly['through'],
  /** The last history sequence the published walk reached; producer acquisitions stop there. */
  reachedThrough = Number.POSITIVE_INFINITY,
  /** The room whose Overview the cut stops: its Timeline is unreached. */
  overviewStopped?: SemanticAddress,
): BiomeRewardEvaluationAssembly {
  const { catalog, snapshot } = context;
  // Object interactions append to a Timeline, so a room stopped at its Overview offers none.
  const interactionWalk: ChronologyWalkState =
    overviewStopped === undefined
      ? walk
      : Object.freeze({
          ...walk,
          roomActionEnds: new Map(
            [...walk.roomActionEnds].filter(
              ([roomKey]) => roomKey !== semanticAddressKey(overviewStopped),
            ),
          ),
        });
  const immutableFindingRegions = accumulation.findingRegions;
  const immutableFindings = Object.freeze(immutableFindingRegions.map((entry) => entry.finding));
  const traitProducts = selectedTraitOfferProducts(
    walk.branches,
    immutableFindingRegions.flatMap((entry) =>
      entry.levelResolutionEvaluations === undefined ? [] : entry.levelResolutionEvaluations,
    ),
    catalog,
  );
  const traitCandidateContacts = traitOfferCandidateContacts(
    traitProducts.candidateContexts,
    accumulation,
  );
  const levelCandidateContexts = new Map(traitProducts.levelCandidateContexts);
  const discoveredRunStateSnapshots = Object.freeze(
    [...accumulation.runStateSnapshots].sort((left, right) => {
      const leftRoom = left.owner.kind === 'roomRunStateCheckpoint';
      const rightRoom = right.owner.kind === 'roomRunStateCheckpoint';
      return leftRoom === rightRoom ? 0 : leftRoom ? 1 : -1;
    }),
  );
  const runStatePublication = publishRunStateThroughCoverage(
    discoveredRunStateSnapshots,
    discoveredRunStateSnapshots,
  );
  const publishedHermesShrineAssessments = Object.freeze(
    [...walk.hermesShrineAssessments.values()].map(({ origin, assessment }) => {
      const travelDealRefill = walk.hermesShrineTravelDealRefills.get(
        semanticAddressKey(origin),
      )?.assessment;
      return Object.freeze({
        origin,
        assessment:
          travelDealRefill === undefined
            ? assessment
            : Object.freeze({ ...assessment, travelDealRefill }),
      });
    }),
  );
  const simulation: BiomeRewardSimulation = Object.freeze({
    ...(accumulation.generatedPickupPlacements.length === 0
      ? {}
      : { generatedPickupPlacements: accumulation.generatedPickupPlacements }),
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && walk.branches.length > 0 ? 'valid' : 'invalid',
    ...(accumulation.echoKeepsakeReplayOutcome === undefined
      ? {}
      : { volatileEchoKeepsakeReplay: accumulation.echoKeepsakeReplayOutcome }),
    timelineFacts: accumulation.timelineFacts,
    wellRefillRealizations: Object.freeze([...walk.wellRefillRealizations.values()]),
    purchasePriceContexts: Object.freeze([...walk.purchasePriceContexts.values()]),
    goldEvents: walk.goldEvents,
    bossArcanaOutcomes: accumulation.bossArcanaOutcomes,
    phantomExits: accumulation.phantomExits,
    rerolls: accumulation.rerolls,
    rerollPool: accumulation.rerollPool,
    rerollSurfaces: accumulation.rerollSurfaces,
    storeSupport: accumulation.storeSupport,
    targetHistory: accumulation.targetHistory,
    frontier: walk.branches[0] === undefined ? undefined : publicRewardBranch(walk.branches[0]),
    findings: immutableFindings,
    runStateSnapshots: runStatePublication.snapshots,
    runStateAvailability: runStatePublication.availability,
    hubDepartures: accumulation.hubDepartures,
    ...(Object.keys(accumulation.midBiomeStartStates).length === 0
      ? {}
      : { midBiomeStartStates: accumulation.midBiomeStartStates }),
    purgingPoolAssessments: Object.freeze([...walk.purgingPoolAssessments.values()]),
    hermesShrineAssessments: publishedHermesShrineAssessments,
    stygianWellAssessments: Object.freeze([...walk.stygianWellAssessments.values()]),
    hermesShrineDeliveries: Object.freeze([
      ...new Map(
        walk.branches
          .flatMap((branch) => Object.values(branch.state.pendingHermesShrineDeliveries))
          .map(
            (delivery) =>
              [
                delivery.entryKey,
                Object.freeze({
                  ...delivery,
                  deliveryKind:
                    delivery.due === undefined ? ('pending' as const) : ('countdown' as const),
                }),
              ] as const,
          ),
      ).values(),
    ]),
    selectedTraitOffers: traitProducts.selectedTraitOffers,
    selectedLevelResolutions: traitProducts.selectedLevelResolutions,
    figLeafPhaseCandidates: accumulation.figLeafPhaseCandidates,
    gorgonPhaseCandidates: accumulation.gorgonPhaseCandidates,
    nemesisRandomEventCandidates: accumulation.nemesisRandomEventCandidates,
    steadyGrowthOutcomes: Object.freeze(
      [...accumulation.steadyGrowthOutcomes.values()].map(({ address, landing, threshold }) =>
        Object.freeze({
          address,
          owner: landing.owner,
          sourceTraitKey: threshold.traitKey,
          phaseKey: landing.phaseKey,
          ...(threshold.targetTraitKey === undefined
            ? {}
            : { targetTraitKey: threshold.targetTraitKey }),
          requiredInterval: threshold.requiredInterval,
          progressBefore:
            threshold.before.equippedTraits[threshold.traitKey]?.steadyGrowthProgress ?? 0,
        }),
      ),
    ),
    transcendentEmbryoOutcomes: Object.freeze(
      [...accumulation.transcendentEmbryoOutcomes.values()].map(
        ({ address, landing, threshold }) => {
          const value = threshold.source.transformations[String(threshold.cycle)];
          return Object.freeze({
            address,
            owner: landing.owner,
            sourceBlessingKey: threshold.source.markedBlessingKey,
            phaseKey: landing.phaseKey,
            ...(value === undefined ? {} : { value }),
            transformationRarity: threshold.source.rarity,
            progressBefore: threshold.source.progress,
          });
        },
      ),
    ),
    derivedAcquisitionEntries: Object.freeze(
      [...accumulation.derivedAcquisitionEntryContexts.values()].flatMap((frontier) => {
        const capability = attestDerivedAcquisitionEntryCandidateCapability(frontier);
        return capability === undefined
          ? []
          : [Object.freeze({ address: frontier.address, ...capability })];
      }),
    ),
  });
  return publishBiomeRewardEvaluationAssembly({
    simulation,
    producerArtifacts: createRewardProducerCandidateArtifacts(
      accumulation.producerFrontiers,
      reachedThrough,
    ),
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(walk.shipLifecycleContexts),
    traitOfferArtifacts: createTraitOfferCandidateArtifacts(catalog, traitCandidateContacts),
    levelResolutionArtifacts: createLevelResolutionCandidateArtifacts(
      catalog,
      levelCandidateContexts,
    ),
    judgmentArcanaArtifacts: createJudgmentArcanaCandidateArtifacts(
      accumulation.judgmentArcanaContexts,
    ),
    figurineArcanaArtifacts: createFigurineArcanaCandidateArtifacts(
      accumulation.figurineArcanaContexts,
    ),
    keepsakeSelectionArtifacts: createKeepsakeSelectionCandidateArtifacts(
      accumulation.keepsakeSelectionContexts,
    ),
    keepsakeEquipResultArtifacts: createKeepsakeEquipResultCandidateArtifacts(
      accumulation.keepsakeEquipResultContexts,
    ),
    acquisitionConversionArtifacts: createAcquisitionConversionCandidateArtifacts(
      catalog,
      accumulation.acquisitionConversionContexts,
      accumulation.fixedAcquisitionRealizations,
    ),
    derivedAcquisitionEntryArtifacts: createDerivedAcquisitionEntryCandidateArtifacts(
      accumulation.derivedAcquisitionEntryContexts,
    ),
    steadyGrowthArtifacts: createSteadyGrowthCandidateArtifacts(
      catalog,
      new Map(
        [...accumulation.steadyGrowthOutcomes].map(([key, { threshold }]) => [key, threshold]),
      ),
    ),
    transcendentEmbryoArtifacts: createTranscendentEmbryoCandidateArtifacts(
      catalog,
      new Map(
        [...accumulation.transcendentEmbryoOutcomes].map(([key, { threshold }]) => [
          key,
          threshold,
        ]),
      ),
    ),
    fountainRarityArtifacts: createFountainRarityCandidateArtifacts(
      accumulation.fountainRarityCandidateContexts,
    ),
    purgingPoolArtifacts: (() => {
      const interactions = purgingPoolInteractions(context, interactionWalk);
      return createPurgingPoolCandidateArtifacts(
        new Map(
          [...walk.purgingPoolAssessments.values()].map((room) => {
            const key = semanticAddressKey(room.origin);
            const interaction = interactions.get(key);
            return [key, interaction === undefined ? room : { ...room, interaction }];
          }),
        ),
      );
    })(),
    hermesShrineArtifacts: createHermesShrineCandidateArtifacts(
      new Map(
        publishedHermesShrineAssessments.map(({ origin, assessment }) => [
          semanticAddressKey(origin),
          assessment,
        ]),
      ),
    ),
    rerollSurfaceArtifacts: createRerollSurfaceCandidateArtifacts(
      accumulation.rerollSurfaceCapabilities,
    ),
    stygianWellArtifacts: createStygianWellCandidateArtifacts(
      new Map(
        [...walk.stygianWellAssessments.values()].map(({ origin, entry, actions }) => [
          semanticAddressKey(origin),
          { entry, actions },
        ]),
      ),
      stygianWellInteractions(context, interactionWalk),
    ),
    objectInteractionArtifacts: createRoomObjectInteractionArtifacts(
      roomObjectInteractions(
        context,
        interactionWalk,
        accumulation.derivedAcquisitionEntryContexts,
      ),
    ),
    findingRegions: Object.freeze(immutableFindingRegions),
    encounterEntryVowRanks: walk.encounterEntryVowRanks,
    through,
  });
}
