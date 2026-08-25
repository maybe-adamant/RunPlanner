import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionSession,
} from '@planner/projections/candidateProjection';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceHubSlotInteraction,
  WorkspaceHubVisitOrderInteraction,
  WorkspaceHubVisitOrderProposal,
} from '../contract';
import type { WorkspaceHubInteractionRequirement } from './interaction-requirements';

export interface WorkspaceHubInteractionCatalog {
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubVisitOrders: ReadonlyMap<string, WorkspaceHubVisitOrderInteraction>;
}

export function bindHubInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceHubInteractionRequirement>,
): WorkspaceHubInteractionCatalog {
  const hubSlots = new Map<string, WorkspaceHubSlotInteraction>();
  const hubVisitOrders = new Map<string, WorkspaceHubVisitOrderInteraction>();
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
    if (hubVisitOrders.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound Hub visit-order interactions`,
      );
    }
    const proposals = new Map<string, WorkspaceHubVisitOrderProposal>();
    hubVisitOrders.set(
      key,
      Object.freeze({
        key,
        owner: requirement.owner,
        proposalFor: (hubSlotKeys: readonly string[]) => {
          const value = Object.freeze([...hubSlotKeys]);
          const proposalKey = JSON.stringify(value);
          const existing = proposals.get(proposalKey);
          if (existing !== undefined) return existing;
          let loaded: readonly CandidateOptionProjection<readonly string[]>[] | undefined;
          const load = () =>
            (loaded ??= candidates.hubVisitOrders(requirement.owner, Object.freeze([value])));
          const proposal = Object.freeze({
            choices: Object.freeze([
              Object.freeze({
                label: value.length === 0 ? 'No visits' : value.join(' → '),
                value,
              }),
            ]),
            intent: () => {
              const candidate = load()[0];
              if (candidate === undefined || candidateSupport(candidate) === 'impossible') {
                throw new StructuredWorkspaceProjectionContractError(
                  `Hub visit order ${key} is not currently authorable.`,
                );
              }
              return Object.freeze({
                command: Object.freeze({
                  hub: requirement.owner,
                  hubSlotKeys: value,
                  kind: 'ReplaceHubVisitOrder' as const,
                }),
              });
            },
            key: `${key}:visit-order:${proposalKey}`,
            load,
            owner: requirement.owner,
            selected: value,
          });
          proposals.set(proposalKey, proposal);
          return proposal;
        },
        selectedHubSlotKeys: Object.freeze([...requirement.visitOrder]),
      }),
    );
  }
  return Object.freeze({ hubSlots, hubVisitOrders });
}
