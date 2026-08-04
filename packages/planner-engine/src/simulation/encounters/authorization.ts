import type { Catalog } from '../../catalog-schema';
import {
  ProjectCommandContractError,
  projectCommandAddress,
  type EncounterCommandAuthorization,
  type EncounterOccurrenceCommand,
  type ProjectDocument,
} from '../../authored-project';
import {
  assertProjectEvaluationAssembly,
  candidateArtifactsForProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '../project';
import { createBiomeAddress } from '../../authored-project/addresses';

/**
 * Binds an encounter mutation to the exact project-evaluation publication
 * that proved its active candidate domain. The authored command layer keeps
 * no mutable simulation dependency; application coordination injects this
 * narrow engine capability at dispatch time.
 */
export function createEncounterCommandAuthorization(
  expectedCatalog: Catalog,
  assembly: ProjectEvaluationAssembly,
): EncounterCommandAuthorization {
  assertProjectEvaluationAssembly(assembly);
  return Object.freeze({
    assertAuthorized(
      document: ProjectDocument,
      catalog: Catalog,
      command: EncounterOccurrenceCommand,
    ): void {
      if (catalog !== expectedCatalog) {
        throw new ProjectCommandContractError(
          command.kind,
          projectCommandAddress(command),
          'encounter authorization was created for a different catalog',
        );
      }
      if (document !== assembly.project) {
        throw new ProjectCommandContractError(
          command.kind,
          projectCommandAddress(command),
          'encounter authorization requires the exact current evaluation assembly',
        );
      }
      const support = candidateArtifactsForProjectEvaluationAssembly(assembly)
        .biomeAt(createBiomeAddress(command.phase.routeKey, command.phase.biomeKey))
        ?.encounters.at(command.phase);
      if (support === undefined || !support.active) {
        throw new ProjectCommandContractError(
          command.kind,
          projectCommandAddress(command),
          'encounter phase is not structurally active in the current evaluation',
        );
      }
      // A reset restores the declaration-owned default, which may itself be
      // context-invalid until another retained authored setting is repaired.
      // Only a new Select needs an activation-valid candidate domain.
      if (command.kind === 'SelectEncounter' && !support.activationSatisfied) {
        throw new ProjectCommandContractError(
          command.kind,
          projectCommandAddress(command),
          'encounter phase activation is unavailable in the current evaluation',
        );
      }
      if (
        command.kind === 'SelectEncounter' &&
        !support.candidateEncounterKeys.includes(command.encounterKey)
      ) {
        throw new ProjectCommandContractError(
          command.kind,
          projectCommandAddress(command),
          `${command.encounterKey} is not an eligible encounter candidate`,
        );
      }
    },
  });
}
