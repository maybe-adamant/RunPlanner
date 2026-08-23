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
import { applyBossCompletionCommand } from './boss-completion';
import { applyKeepsakeCommand } from './keepsake';
import type { ProjectCommand } from './types';
import { createAcquisitionEntryAddress, semanticAddressKey } from '../addresses';
import { applyRoomActionCommand } from './room-actions';
import { reconcileNewRequiredRoomActions } from '../room-action-defaults';

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
    case 'RemoveNaturalChaos':
    case 'ReplaceNaturalChaosMap':
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
    case 'ReplaceShopDeathDefianceCondition':
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
    case 'ReplaceBossCompletionArcana':
      return applyBossCompletionCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplacePEncounterSequence':
    case 'SelectEncounter':
    case 'ResetEncounter':
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
    const reconciled = reconcileNewRequiredRoomActions(document, proposal, catalog);
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
