import type { Catalog } from '../../../catalog-schema';
import type { ProjectDocument } from '../../model';
import type { LocatedBiome } from '../contract';
import type { TopologyCommand } from '../types';
import {
  createStart,
  createBatch,
  initializeExitDecision,
  createTarget,
  setExitSelection,
  replaceBatchRewardStore,
  replaceFieldsCageOutcome,
  removeExitDecision,
  clearTopology,
  reconcileBatchExitCapacity,
} from './ordinary';
import { replaceTakeoverBatch } from './takeover';
import { replaceWithHubDecision, removeHubDecision, updateHub } from './hub';
import { updateLocalVisit } from './local-visits';

/** The exhaustive internal topology-command entry keeps each command family in its owning module. */
export function applyTopologyCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: TopologyCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'CreateStart':
      return createStart(document, catalog, located, command);
    case 'CreateBatch':
      return createBatch(document, catalog, located, command);
    case 'InitializeExitDecision':
      return initializeExitDecision(document, catalog, located, command);
    case 'CreateTarget':
      return createTarget(document, catalog, located, command);
    case 'CreateTakeoverBatch':
    case 'ReplaceWithTakeoverBatch':
    case 'ReconcileTakeoverBatch':
      return replaceTakeoverBatch(document, catalog, located, command);
    case 'ReconcileBatchExitCapacity':
      return reconcileBatchExitCapacity(document, catalog, located, command);
    case 'ReplaceBatchRewardStore':
      return replaceBatchRewardStore(document, catalog, located, command);
    case 'ReplaceFieldsCageOutcome':
      return replaceFieldsCageOutcome(document, catalog, located, command);
    case 'SetExitSelection':
      return setExitSelection(document, catalog, located, command);
    case 'RemoveExitDecision':
      return removeExitDecision(document, located, command);
    case 'ReplaceWithHubDecision':
      return replaceWithHubDecision(document, catalog, located, command);
    case 'RemoveHubDecision':
      return removeHubDecision(document, catalog, located, command);
    case 'OpenHubSlot':
    case 'CloseHubSlot':
    case 'ResetHubBoard':
    case 'ReplaceHubVisitOrder':
      return updateHub(document, catalog, located, command);
    case 'SetLocalVisitGeneration':
    case 'ReplaceLocalVisitOrder':
      return updateLocalVisit(document, catalog, located, command);
    case 'ClearTopology':
      return clearTopology(document, located, command);
  }
}
