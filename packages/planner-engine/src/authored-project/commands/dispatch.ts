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
import { applyProjectMetadataCommand } from './history';
import { applyLinearRewardCommand } from './rewards';
import { applyLinearRoomStateCommand } from './room-state';
import { applyHubCommand } from './topology-hub';
import { applyLinearTopologyCommand } from './topology-linear';
import type { ProjectCommand } from './types';

function applyUnchecked(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  if (command.kind === 'RenameProject' || command.kind === 'ConfigureRoutePrefix') {
    return applyProjectMetadataCommand(document, catalog, command);
  }

  const located = locateBiome(document, catalog, command);
  if (located.kind === 'HubBiome') {
    const { layout, plan } = located;
    switch (command.kind) {
      case 'CreateHubTopology':
      case 'OpenHubSlot':
      case 'CloseHubSlot':
      case 'AppendHubVisit':
      case 'ReplaceHubVisit':
      case 'RemoveHubVisitsFrom':
      case 'ReplaceSideRoomGeneration':
      case 'ReplaceSideRoomEntryOrder':
      case 'ClearTopology':
      case 'ReplaceIncomingReward':
      case 'ReplaceLocalReward':
      case 'ReplaceShopOffer':
      case 'SetShopPurchase':
        return applyHubCommand(document, catalog, located, plan, layout, command);
      case 'CreateStart':
      case 'CreateBatch':
      case 'ReplaceBatchRewardStore':
      case 'ReplaceFieldsCageOutcome':
      case 'ReplaceShipEncounterCount':
      case 'ReplaceRewardWheelOfferCount':
      case 'ReplaceRewardWheelStore':
      case 'ReplaceRewardWheelOffer':
      case 'ReplaceRewardWheelPicked':
      case 'CreateTerminalTransition':
      case 'CreateTarget':
      case 'SetPicked':
      case 'SetTerminalPicked':
      case 'ReconcileExitCapacity':
      case 'ReconcileTerminalExitCapacity':
      case 'RemoveBatch':
      case 'RemoveTerminalTransition':
      case 'ReplaceWithTerminalTransition':
      case 'ReplaceWithBatch':
      case 'ReplaceOccurrenceRoom':
        return failCommand(command, `${command.kind} is not available for HubBiome`);
    }
  }
  const { layout, plan } = located;
  switch (command.kind) {
    case 'CreateHubTopology':
    case 'OpenHubSlot':
    case 'CloseHubSlot':
    case 'AppendHubVisit':
    case 'ReplaceHubVisit':
    case 'RemoveHubVisitsFrom':
    case 'ReplaceSideRoomGeneration':
    case 'ReplaceSideRoomEntryOrder':
      return failCommand(command, `${command.kind} requires HubBiome`);
    case 'CreateStart':
    case 'CreateBatch':
    case 'CreateTerminalTransition':
    case 'CreateTarget':
    case 'SetPicked':
    case 'SetTerminalPicked':
    case 'ReconcileExitCapacity':
    case 'ReconcileTerminalExitCapacity':
    case 'RemoveBatch':
    case 'RemoveTerminalTransition':
    case 'ReplaceWithTerminalTransition':
    case 'ReplaceWithBatch':
    case 'ClearTopology':
      return applyLinearTopologyCommand(document, catalog, located, plan, layout, command);
    case 'ReplaceOccurrenceRoom':
      return applyLinearRoomStateCommand(document, catalog, located, plan, layout, command);
    case 'ReplaceBatchRewardStore':
    case 'ReplaceFieldsCageOutcome':
    case 'ReplaceShipEncounterCount':
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelPicked':
    case 'ReplaceRewardWheelOffer':
    case 'ReplaceIncomingReward':
    case 'ReplaceLocalReward':
    case 'ReplaceShopOffer':
    case 'SetShopPurchase':
      return applyLinearRewardCommand(document, catalog, located, plan, layout, command);
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
    if (error instanceof ProjectCommandContractError) {
      throw error;
    }
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
export type { ProjectCommand } from './types';
