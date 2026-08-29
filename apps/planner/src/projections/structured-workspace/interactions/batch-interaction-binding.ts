import { semanticAddressKey } from '@run-planner/engine/authored-project';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceBatchRewardStoreInteraction,
  WorkspaceExitSelectionInteraction,
  WorkspaceFieldsCageOutcomeInteraction,
  WorkspaceZagreusContractInteraction,
  WorkspaceChaosExitInteraction,
} from '../contract';
import type { WorkspaceBatchInteractionRequirement } from './interaction-requirements';
import { candidateInteraction } from './interaction-binding-primitives';

export interface WorkspaceBatchInteractionCatalog {
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceBatchRewardStoreInteraction>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceFieldsCageOutcomeInteraction>;
  readonly zagreusContracts: ReadonlyMap<string, WorkspaceZagreusContractInteraction>;
  readonly chaosExits: ReadonlyMap<string, WorkspaceChaosExitInteraction>;
}

export function bindBatchInteractions(
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceBatchInteractionRequirement>,
): WorkspaceBatchInteractionCatalog {
  const batchRewardStores = new Map<string, WorkspaceBatchRewardStoreInteraction>();
  const exitSelections = new Map<string, WorkspaceExitSelectionInteraction>();
  const fieldsCageOutcomes = new Map<string, WorkspaceFieldsCageOutcomeInteraction>();
  const zagreusContracts = new Map<string, WorkspaceZagreusContractInteraction>();
  const chaosExits = new Map<string, WorkspaceChaosExitInteraction>();
  for (const requirement of requirements) {
    if (requirement.exitSelection !== undefined) {
      const { exitSelection } = requirement;
      const key = semanticAddressKey(exitSelection.owner);
      if (exitSelections.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound exit-selection interactions`,
        );
      }
      exitSelections.set(
        key,
        Object.freeze({
          key,
          owner: requirement.owner,
          ...(exitSelection.selectedExitKey === undefined
            ? {}
            : { selectedExitKey: exitSelection.selectedExitKey }),
          targets: exitSelection.targets,
        }),
      );
    }
    if (requirement.rewardStore !== undefined) {
      const { rewardStore } = requirement;
      const key = semanticAddressKey(rewardStore.owner);
      if (batchRewardStores.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound batch reward-store interactions`,
        );
      }
      const storeKeys = Object.freeze(rewardStore.storeChoices.map((choice) => choice.value));
      const candidate = candidateInteraction(
        rewardStore.owner,
        rewardStore.storeChoices,
        rewardStore.selected,
        () => candidates.batchRewardStores(rewardStore.owner, storeKeys),
      );
      batchRewardStores.set(
        key,
        Object.freeze({
          ...candidate,
          intentFor: (storeKey: string) =>
            Object.freeze({
              command:
                (requirement.persistence ?? 'authored') === 'authored'
                  ? Object.freeze({
                      kind: 'ReplaceBatchRewardStore' as const,
                      rewardStore: rewardStore.owner,
                      storeKey,
                    })
                  : Object.freeze({
                      kind: 'InitializeExitDecision' as const,
                      decision: requirement.owner,
                      edit: Object.freeze({ kind: 'rewardStore' as const, storeKey }),
                    }),
              focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
            }),
        }),
      );
    }
    if (requirement.fieldsCageOutcome !== undefined) {
      const { fieldsCageOutcome } = requirement;
      const key = semanticAddressKey(fieldsCageOutcome.owner);
      if (fieldsCageOutcomes.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Fields cage-outcome interactions`,
        );
      }
      const values = Object.freeze(fieldsCageOutcome.outcomeChoices.map((choice) => choice.value));
      const candidate = candidateInteraction(
        fieldsCageOutcome.owner,
        fieldsCageOutcome.outcomeChoices,
        fieldsCageOutcome.selected,
        () => candidates.fieldsCageOutcomes(fieldsCageOutcome.owner, values),
      );
      fieldsCageOutcomes.set(
        key,
        Object.freeze({
          ...candidate,
          intentFor: (cageOutcome: 'min' | 'max') =>
            Object.freeze({
              command:
                (requirement.persistence ?? 'authored') === 'authored'
                  ? Object.freeze({
                      kind: 'ReplaceFieldsCageOutcome' as const,
                      decision: requirement.owner,
                      cageOutcome,
                    })
                  : Object.freeze({
                      kind: 'InitializeExitDecision' as const,
                      decision: requirement.owner,
                      edit: Object.freeze({ kind: 'fieldsCageOutcome' as const, cageOutcome }),
                    }),
              focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
            }),
        }),
      );
    }
    if (requirement.zagreusContract !== undefined) {
      const { owner } = requirement.zagreusContract;
      const key = semanticAddressKey(owner);
      if (zagreusContracts.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Zagreus contract interactions`,
        );
      }
      zagreusContracts.set(
        key,
        Object.freeze({
          key,
          owner,
          removeIntent: Object.freeze({
            command: Object.freeze({ kind: 'RemoveZagreusContract' as const, additional: owner }),
          }),
          selectIntent: Object.freeze({
            command: Object.freeze({
              kind: 'SetExitSelection' as const,
              selection: Object.freeze({
                kind: 'exitSelection' as const,
                routeKey: owner.routeKey,
                biomeKey: owner.biomeKey,
                source: { kind: 'occurrence' as const, occurrenceId: owner.occurrenceId },
              }),
              value: Object.freeze({
                kind: 'additional' as const,
                additionalExitKey: owner.additionalExitKey,
              }),
            }),
          }),
        }),
      );
    }
    if (requirement.chaos !== undefined) {
      const { owner, occurrence } = requirement.chaos;
      const key = semanticAddressKey(owner);
      if (chaosExits.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Chaos exit interactions`,
        );
      }
      chaosExits.set(
        key,
        Object.freeze({
          key,
          owner,
          mapIntent: (gameName: string) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceChaosMap' as const,
                occurrence,
                gameName,
              }),
            }),
          ...(requirement.chaos.forced
            ? {}
            : {
                removeIntent: Object.freeze({
                  command: Object.freeze({
                    kind: 'RemoveChaos' as const,
                    additional: owner,
                  }),
                }),
              }),
          selectIntent: Object.freeze({
            command: Object.freeze({
              kind: 'SetExitSelection' as const,
              selection: Object.freeze({
                kind: 'exitSelection' as const,
                routeKey: owner.routeKey,
                biomeKey: owner.biomeKey,
                source: { kind: 'occurrence' as const, occurrenceId: owner.occurrenceId },
              }),
              value: Object.freeze({
                kind: 'additional' as const,
                additionalExitKey: owner.additionalExitKey,
              }),
            }),
          }),
        }),
      );
    }
  }
  return Object.freeze({
    batchRewardStores,
    exitSelections,
    fieldsCageOutcomes,
    zagreusContracts,
    chaosExits,
  });
}
