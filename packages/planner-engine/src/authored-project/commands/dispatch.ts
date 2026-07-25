import type { Catalog } from '../../catalog-schema';
import { decodeProjectDocument } from '../codec';
import type { ProjectDocument } from '../model';
import { ProjectDocumentContractError } from '../validation';
import { locateBiome, projectCommandAddress, ProjectCommandContractError } from './contract';
import { applyProjectMetadataCommand } from './history';
import { applyUnifiedTopologyCommand } from './unified-topology';
import type { ProjectCommand } from './types';

function applyUnchecked(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  if (command.kind === 'RenameProject' || command.kind === 'ConfigureRoutePrefix') {
    return applyProjectMetadataCommand(document, catalog, command);
  }
  return applyUnifiedTopologyCommand(
    document,
    catalog,
    locateBiome(document, catalog, command),
    command,
  );
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
export type { ProjectCommand } from './types';
