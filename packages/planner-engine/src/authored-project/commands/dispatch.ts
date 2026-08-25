import type { Catalog } from '../../catalog-schema';
import { decodeProjectDocument } from '../codec';
import type { ProjectDocument } from '../model';
import { ProjectDocumentContractError } from '../validation';
import {
  failCommand,
  locateBiome,
  projectCommandAddress,
  ProjectCommandContractError,
} from './contract';
import { applyOccurrenceCommand } from './occurrence';
import { applyProjectStateCommand } from './project-state';
import { applyRoomReplacementCommand } from './room-replacement';
import { applyRouteDetourCommand } from './route-detours';
import { applyTopologyCommand } from './topology';
import { applyTraitOfferCommand } from './trait-offer';
import { applyLevelResolutionCommand } from './level-resolution';
import { applyAcquisitionSiteCommand, materializeDerivedShopEntry } from './acquisition-site';
import { applyAcquisitionDispositionCommand } from './acquisition-conversion';
import { applySeaStarResultCommand } from './sea-star';
import { applyJudgmentArcanaCommand } from './judgment-arcana';
import { applySteadyGrowthCommand } from './steady-growth';
import { applyKeepsakeCommand } from './keepsake';
import { applyResourcePlacementCommand } from './resources';
import type { ProjectCommand } from './types';
import {
  createAcquisitionEntryAddress,
  createBiomeAddress,
  semanticAddressKey,
} from '../addresses';
import { applyRoomActionCommand } from './room-actions';
import { reconcileNewRequiredRoomActions } from '../room-action-defaults';
import { reconcileSelectedPickupProducerState } from '../traits';

/**
 * Generated pickup sites are derived from their exact source acquisition. Run
 * the one occurrence-local reconciliation after every semantic command so a
 * source replacement cannot leave orphan sites or actions behind.
 */
function reconcileGeneratedPickupProducerState(
  previous: ProjectDocument,
  document: ProjectDocument,
  catalog: Catalog,
): ProjectDocument {
  let changed = false;
  const routes = document.routes.map((route) => {
    const previousRoute = previous.routes.find(
      (candidate) => candidate.routeKey === route.routeKey,
    );
    const biomes = route.biomes.map((plan) => {
      if (plan.topology === null) return plan;
      const previousPlan = previousRoute?.biomes.find(
        (candidate) => candidate.biomeKey === plan.biomeKey,
      );
      const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
      let occurrencesChanged = false;
      const occurrences = plan.topology.occurrences.map((occurrence) => {
        const previousOccurrence = previousPlan?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        );
        if (previousOccurrence === occurrence) return occurrence;
        const reconciled = reconcileSelectedPickupProducerState(catalog, biome, occurrence);
        if (reconciled !== occurrence) occurrencesChanged = true;
        return reconciled;
      });
      if (!occurrencesChanged) return plan;
      changed = true;
      return Object.freeze({
        ...plan,
        topology: Object.freeze({ ...plan.topology, occurrences: Object.freeze(occurrences) }),
      });
    });
    if (!biomes.some((biome, index) => biome !== route.biomes[index])) return route;
    return Object.freeze({ ...route, biomes: Object.freeze(biomes) });
  });
  return changed ? Object.freeze({ ...document, routes: Object.freeze(routes) }) : document;
}

/** Topology owns occurrence lifetime. A route-owned resource singleton retains
 * through room replacement, but is removed atomically when its exact target is
 * structurally deleted. */
function reconcileResourcePlacementTopology(document: ProjectDocument): ProjectDocument {
  let changed = false;
  const routes = document.routes.map((route) => {
    const existing = new Set(
      route.biomes.flatMap((biome) =>
        [...(biome.topology?.occurrences ?? []), ...biome.completionOccurrences].map(
          (occurrence) => `${biome.biomeKey}:${occurrence.occurrenceId}`,
        ),
      ),
    );
    const next = { ...route.resourcePlacements };
    let routeChanged = false;
    for (const [family, placement] of Object.entries(route.resourcePlacements)) {
      if (placement !== null && !existing.has(`${placement.biomeKey}:${placement.occurrenceId}`)) {
        next[family as keyof typeof next] = null;
        routeChanged = true;
      }
    }
    if (!routeChanged) return route;
    changed = true;
    return Object.freeze({ ...route, resourcePlacements: Object.freeze(next) });
  });
  return changed ? Object.freeze({ ...document, routes: Object.freeze(routes) }) : document;
}

function derivedPayloadEntryAddress(
  command: Extract<ProjectCommand, { readonly kind: 'EditDerivedShopEntry' }>['edit'],
) {
  switch (command.kind) {
    case 'ReplaceAcquisitionEntryOffer':
      return command.entry;
    case 'ReplaceTraitOffer':
    case 'ReplaceGorgonAthenaOffer':
    case 'ReplaceTraitSelection':
      return command.trait.owner.kind === 'acquisitionEntry' ? command.trait.owner : undefined;
    case 'ReplaceLevelResolution':
      return command.levelResolution.owner.kind === 'acquisitionEntry'
        ? command.levelResolution.owner
        : undefined;
    case 'ReplaceAcquisitionDisposition':
      return command.acquisition.owner.kind === 'acquisitionEntry'
        ? command.acquisition.owner
        : undefined;
  }
}

function applyUnchecked(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceResourcePlacement':
      return applyResourcePlacementCommand(document, catalog, command);
    case 'ReplaceRouteLoadout':
    case 'ReplaceManualArcanaSelection':
    case 'ReplaceFearVowRank':
    case 'ReplaceStartingKeepsake':
    case 'ConfigureRoutePrefix':
    case 'ReplaceBiomeField':
      return applyProjectStateCommand(document, catalog, command);
    case 'ReplacePostbossKeepsake':
      return applyKeepsakeCommand(document, catalog, command);
    case 'ReplaceJeweledPomEquipResult':
    case 'ReplaceExperimentalHammerEquipResult':
      return applyKeepsakeCommand(document, catalog, command);
    case 'CreateStart':
    case 'CreateBatch':
    case 'InitializeExitDecision':
    case 'CreateTarget':
    case 'CreateTakeoverBatch':
    case 'ReplaceWithTakeoverBatch':
    case 'ReconcileTakeoverBatch':
    case 'ReconcileBatchExitCapacity':
    case 'ReplaceWithHubDecision':
    case 'RemoveHubDecision':
    case 'OpenHubSlot':
    case 'CloseHubSlot':
    case 'ReplaceHubVisitOrder':
    case 'SetLocalVisitGeneration':
    case 'ReplaceLocalVisitOrder':
    case 'SetExitSelection':
    case 'RemoveExitDecision':
    case 'ReplaceBatchRewardStore':
    case 'ReplaceFieldsCageOutcome':
    case 'ClearTopology':
      return applyTopologyCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceOccurrenceRoom':
      return applyRoomReplacementCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'InsertRoomAction':
    case 'RemoveRoomAction':
    case 'MoveRoomAction':
    case 'ReplaceShopPurchaseParticipation':
      return applyRoomActionCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'SwitchTargetToAnomaly':
    case 'ReplaceAnomalyMap':
    case 'ReplaceAnomalySuccess':
    case 'RevertAnomaly':
    case 'AddZagreusContract':
    case 'RemoveZagreusContract':
    case 'AddNaturalChaos':
    case 'AddSparkChaos':
    case 'RemoveNaturalChaos':
    case 'RemoveSparkChaos':
    case 'ReplaceNaturalChaosMap':
    case 'ReplaceSparkChaosMap':
      return applyRouteDetourCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceShipEncounterCount':
    case 'ReplaceFieldsOptionalRewardCount':
    case 'ReplaceIncomingReward':
    case 'ReplaceLocalReward':
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelOffer':
    case 'ReplaceRewardWheelPicked':
    case 'ReplaceShopOffer':
    case 'SetPurgingPoolInteraction':
    case 'ReplacePurgingPoolSlot':
    case 'AddStygianWell':
    case 'RemoveStygianWell':
    case 'SetStygianWellInteraction':
    case 'ReplaceStygianWellOffer':
    case 'SetStygianWellPurchase':
    case 'ReplaceStygianWellTwistResult':
    case 'ReplaceStygianWellTravelDealRefill':
    case 'SetHermesShrinePresence':
    case 'ReplaceHermesShrineOffer':
    case 'SetHermesShrinePurchase':
    case 'ReplaceHermesShrineTravelDealRefill':
      return applyOccurrenceCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'SelectDerivedShopEntry':
    case 'ReplaceAcquisitionEntryOffer':
      return applyAcquisitionSiteCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'EditDerivedShopEntry': {
      const expectedEntry = createAcquisitionEntryAddress(command.site, command.entryKey);
      const editedEntry = derivedPayloadEntryAddress(command.edit);
      if (
        editedEntry === undefined ||
        semanticAddressKey(editedEntry) !== semanticAddressKey(expectedEntry)
      )
        failCommand(command, 'payload edit must belong to the addressed derived Shop entry');
      const located = locateBiome(document, catalog, command);
      const materialized = materializeDerivedShopEntry(document, catalog, located, command);
      return applyUnchecked(materialized, catalog, command.edit);
    }
    case 'ReplaceTraitOffer':
    case 'ResetEncounterTraitOffer':
    case 'ReplaceGorgonAthenaOffer':
    case 'ReplaceTraitSelection':
      return applyTraitOfferCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceLevelResolution':
      return applyLevelResolutionCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceAcquisitionDisposition':
      return applyAcquisitionDispositionCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceSeaStarResult':
      return applySeaStarResultCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceJudgmentArcana':
      return applyJudgmentArcanaCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceSteadyGrowthTarget':
      return applySteadyGrowthCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'SelectEncounter':
    case 'ResetEncounter':
    case 'ReplaceNemesisRandomEventOutcome':
    case 'ReplaceFigLeafSkip':
    case 'ReplaceGorgonDeathDefianceCondition':
      return applyOccurrenceCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
  }
}

export function applyProjectCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  try {
    const proposal = applyUnchecked(document, catalog, command);
    if (proposal === document) return document;
    // First close normal source actions, then derive source-owned pickup sites,
    // then schedule the newly active generated actions. This is one ordered
    // command-local composition rather than an ambient fixed-point pass.
    const withTopologyImpact = reconcileResourcePlacementTopology(proposal);
    const withSourceActions = reconcileNewRequiredRoomActions(
      document,
      withTopologyImpact,
      catalog,
    );
    const withGeneratedPickupState = reconcileGeneratedPickupProducerState(
      document,
      withSourceActions,
      catalog,
    );
    const reconciled = reconcileNewRequiredRoomActions(
      withSourceActions,
      withGeneratedPickupState,
      catalog,
    );
    return decodeProjectDocument(reconciled, catalog);
  } catch (error) {
    if (error instanceof ProjectCommandContractError) throw error;
    if (error instanceof ProjectDocumentContractError) {
      throw new ProjectCommandContractError(
        command.kind,
        projectCommandAddress(command),
        `${error.path}: ${error.detail}`,
        { cause: error },
      );
    }
    throw error;
  }
}

export { projectCommandAddress, ProjectCommandContractError } from './contract';
export type {
  DerivedShopEntryEditCommand,
  EncounterOccurrenceCommand,
  ProjectCommand,
  RoomActionCommand,
} from './types';
