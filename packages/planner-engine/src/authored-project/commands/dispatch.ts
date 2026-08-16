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
import {
  applyAcquisitionSiteCommand,
  materializeDerivedShopEntryDefault,
} from './acquisition-site';
import { applyAcquisitionConversionCommand } from './acquisition-conversion';
import { applyBossCompletionCommand } from './boss-completion';
import { applyKeepsakeCommand } from './keepsake';
import type { ProjectCommand } from './types';
import { createAcquisitionEntryAddress, semanticAddressKey } from '../addresses';

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
    case 'ReplaceAllTogetherSet':
      return command.set.trait.owner.kind === 'acquisitionEntry'
        ? command.set.trait.owner
        : undefined;
    case 'ReplaceLevelResolution':
      return command.levelResolution.owner.kind === 'acquisitionEntry'
        ? command.levelResolution.owner
        : undefined;
    case 'ReplaceAcquisitionConversion':
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
    case 'RenameProject':
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
    case 'ReplaceFieldsActionOrder':
    case 'ReplaceFieldsOptionalRewardCount':
    case 'ReplaceIncomingReward':
    case 'ReplaceLocalReward':
    case 'ReplaceSideRoomGeneration':
    case 'ReplaceSideRoomEntryOrder':
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
    case 'ReplaceAcquisitionOrder':
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
      const materialized = materializeDerivedShopEntryDefault(document, catalog, located, command);
      return applyUnchecked(materialized, catalog, command.edit);
    }
    case 'ReplaceTraitOffer':
    case 'ReplaceGorgonAthenaOffer':
    case 'ReplaceTraitSelection':
    case 'ReplaceAllTogetherSet':
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
    case 'ReplaceAcquisitionConversion':
      return applyAcquisitionConversionCommand(
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
    return proposal === document ? document : decodeProjectDocument(proposal, catalog);
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
} from './types';
