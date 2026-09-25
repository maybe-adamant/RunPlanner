import {
  hubVisitSlotKeys,
  semanticAddressKey,
  type HubAction,
} from '@run-planner/engine/authored-project';
import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionSession,
} from '@planner/projections/candidates/candidateProjection';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceHubBoardResetInteraction,
  WorkspaceHubSlotInteraction,
  WorkspaceHubActionOrderInteraction,
  WorkspaceHubActionOrderProposal,
} from '../contracts/structure';
import type { WorkspaceHubInteractionRequirement } from './interaction-requirements';

export interface WorkspaceHubInteractionCatalog {
  readonly hubBoardResets: ReadonlyMap<string, WorkspaceHubBoardResetInteraction>;
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubActionOrders: ReadonlyMap<string, WorkspaceHubActionOrderInteraction>;
}

export function bindHubInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceHubInteractionRequirement>,
): WorkspaceHubInteractionCatalog {
  const hubBoardResets = new Map<string, WorkspaceHubBoardResetInteraction>();
  const hubSlots = new Map<string, WorkspaceHubSlotInteraction>();
  const hubActionOrders = new Map<string, WorkspaceHubActionOrderInteraction>();
  const assertCandidateMayBeAuthored = <T>(
    options: readonly CandidateOptionProjection<T>[],
    value: T,
    label: string,
  ): void => {
    const option = options.find((candidate) => Object.is(candidate.value, value));
    if (option === undefined || candidateSupport(option) === 'impossible') {
      throw new StructuredWorkspaceProjectionContractError(`${label} is not currently authorable.`);
    }
  };
  for (const requirement of requirements) {
    for (const slot of requirement.slots) {
      const key = semanticAddressKey(slot.owner);
      if (hubSlots.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Hub-slot interactions`,
        );
      }
      const values = Object.freeze(slot.choices.map((choice) => choice.value));
      if (!slot.selected) {
        hubSlots.set(
          key,
          Object.freeze({
            beginOpeningAttempt: () => {
              const proposedOccurrenceId = allocateOccurrenceId();
              const localOccurrenceIdsBySlot = Object.freeze(
                Object.fromEntries(
                  slot.localSlotKeys.map((slotKey) => [slotKey, allocateOccurrenceId()] as const),
                ),
              );
              let loaded: readonly CandidateOptionProjection<boolean>[] | undefined;
              const load = () =>
                (loaded ??= candidates.hubSlots(
                  slot.owner,
                  proposedOccurrenceId,
                  localOccurrenceIdsBySlot,
                  values,
                ));
              return Object.freeze({
                choices: slot.choices,
                intentFor: (open: true) => {
                  assertCandidateMayBeAuthored(load(), open, `Hub slot ${key} opening`);
                  return Object.freeze({
                    command: Object.freeze({
                      kind: 'OpenHubSlot' as const,
                      occurrenceId: proposedOccurrenceId,
                      localOccurrenceIdsBySlot,
                      slot: slot.owner,
                    }),
                  });
                },
                key: `${key}:opening:${proposedOccurrenceId}`,
                load,
                owner: slot.owner,
                selected: false,
              });
            },
            key,
            owner: slot.owner,
            selected: false as const,
          }),
        );
        continue;
      }
      const closeRequirement = slot.close;
      const close =
        closeRequirement === undefined
          ? undefined
          : (() => {
              let loaded: readonly CandidateOptionProjection<boolean>[] | undefined;
              const load = () =>
                (loaded ??= candidates.hubSlots(
                  slot.owner,
                  slot.openedOccurrenceId,
                  Object.freeze({}),
                  values,
                ));
              return Object.freeze({
                choices: slot.choices,
                intentFor: (open: false) => {
                  assertCandidateMayBeAuthored(load(), open, `Hub slot ${key} closure`);
                  return Object.freeze({
                    command: closeRequirement.command,
                  });
                },
                key: `${key}:close`,
                load,
                owner: slot.owner,
                selected: true,
              });
            })();
      hubSlots.set(
        key,
        Object.freeze({
          ...(close === undefined ? {} : { close }),
          key,
          owner: slot.owner,
          selected: true as const,
        }),
      );
    }
    const key = semanticAddressKey(requirement.owner);
    if (hubActionOrders.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound Hub action-order interactions`,
      );
    }
    const proposals = new Map<string, WorkspaceHubActionOrderProposal>();
    hubBoardResets.set(
      key,
      Object.freeze({
        intent: Object.freeze({
          command: Object.freeze({ kind: 'ResetHubBoard' as const, hub: requirement.owner }),
        }),
        key,
        owner: requirement.owner,
      }),
    );
    hubActionOrders.set(
      key,
      Object.freeze({
        key,
        owner: requirement.owner,
        proposalFor: (actions: readonly HubAction[]) => {
          const value = Object.freeze([...actions]);
          const proposalKey = JSON.stringify(value);
          const existing = proposals.get(proposalKey);
          if (existing !== undefined) return existing;
          let loaded: readonly CandidateOptionProjection<readonly HubAction[]>[] | undefined;
          const load = () =>
            (loaded ??= candidates.hubActionOrders(requirement.owner, Object.freeze([value])));
          const proposal = Object.freeze({
            choices: Object.freeze([
              Object.freeze({
                label:
                  value.length === 0
                    ? 'No Hub actions'
                    : value
                        .map((action) =>
                          action.kind === 'roomVisit' ? action.hubSlotKey : 'Fountain',
                        )
                        .join(' → '),
                value,
              }),
            ]),
            intent: () => {
              const candidate = load()[0];
              if (candidate === undefined || candidateSupport(candidate) === 'impossible') {
                throw new StructuredWorkspaceProjectionContractError(
                  `Hub action order ${key} is not currently authorable.`,
                );
              }
              return Object.freeze({
                command: Object.freeze({
                  actions: value,
                  hub: requirement.owner,
                  kind: 'ReplaceHubActionOrder' as const,
                }),
              });
            },
            key: `${key}:action-order:${proposalKey}`,
            load,
            owner: requirement.owner,
            selected: value,
          });
          proposals.set(proposalKey, proposal);
          return proposal;
        },
        selectedActions: requirement.actions,
        selectedHubSlotKeys: hubVisitSlotKeys(requirement),
      }),
    );
  }
  return Object.freeze({ hubBoardResets, hubSlots, hubActionOrders });
}
