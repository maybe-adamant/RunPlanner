import type { Catalog } from '../../catalog-schema';
import { decodeProjectDocument } from '../codec';
import type { ProjectDocument } from '../model';
import { ProjectDocumentContractError } from '../validation';
import { locateBiome, projectCommandAddress, ProjectCommandContractError } from './contract';
import type { ProjectCommandApplyOptions } from './encounter-authorization';
import { applyOccurrenceCommand } from './occurrence';
import { applyProjectStateCommand } from './project-state';
import { applyRoomReplacementCommand } from './room-replacement';
import { applyRouteDetourCommand } from './route-detours';
import { applyTopologyCommand } from './topology';
import { applyTraitOfferCommand } from './trait-offer';
import type { ProjectCommand } from './types';

function applyUnchecked(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
  options: ProjectCommandApplyOptions,
): ProjectDocument {
  switch (command.kind) {
    case 'RenameProject':
    case 'ReplaceRouteLoadout':
    case 'ConfigureRoutePrefix':
    case 'ReplaceBiomeField':
      return applyProjectStateCommand(document, catalog, command);
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
    case 'ReplaceIncomingReward':
    case 'ReplaceLocalReward':
    case 'ReplaceSideRoomGeneration':
    case 'ReplaceSideRoomEntryOrder':
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelOffer':
    case 'ReplaceRewardWheelPicked':
    case 'ReplaceShopOffer':
    case 'ReplaceShopPurchaseOrder':
      return applyOccurrenceCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'ReplaceTraitOffer':
    case 'ReplaceTraitSelection':
      return applyTraitOfferCommand(
        document,
        catalog,
        locateBiome(document, catalog, command),
        command,
      );
    case 'SelectEncounter':
    case 'ResetEncounter':
      if (options.encounterAuthorization === undefined) {
        throw new ProjectCommandContractError(
          command.kind,
          projectCommandAddress(command),
          'encounter selection requires an exact candidate authorization',
        );
      }
      options.encounterAuthorization.assertAuthorized(document, catalog, command);
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
  options: ProjectCommandApplyOptions = {},
): ProjectDocument {
  try {
    const proposal = applyUnchecked(document, catalog, command, options);
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
export type { EncounterOccurrenceCommand, ProjectCommand } from './types';
export type {
  EncounterCommandAuthorization,
  ProjectCommandApplyOptions,
} from './encounter-authorization';
