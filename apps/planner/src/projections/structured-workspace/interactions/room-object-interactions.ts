import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceRoomObjectChoice,
  WorkspaceRoomObjectEntryInteraction,
} from '../contracts/features';
import type {
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceRoomObjectActionChoice,
  WorkspaceRoomObjectActionRequirement,
} from './interaction-requirements';

type EntryRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomObjectActions' }
>;

function choicesModel(
  choices: readonly WorkspaceRoomObjectActionChoice[],
): ContextualPickerModel<WorkspaceRoomObjectChoice> {
  return Object.freeze({
    sections: Object.freeze([
      Object.freeze({
        collapsible: false,
        items: Object.freeze(
          choices.map((choice) =>
            Object.freeze({
              disabled: false,
              key: choice.key,
              label: choice.label,
              selected: false,
              state: 'possible' as const,
              value: Object.freeze({ key: choice.key, rewardType: choice.rewardType }),
            }),
          ),
        ),
        key: 'category:available',
        kind: 'category' as const,
        label: 'Available',
      }),
    ]),
  });
}

function bindEntry(requirement: EntryRequirement): WorkspaceRoomObjectEntryInteraction {
  const requireOption = (optionKey: string): WorkspaceRoomObjectActionRequirement => {
    const option = requirement.options.find((candidate) => candidate.key === optionKey);
    if (option === undefined)
      throw new StructuredWorkspaceProjectionContractError(
        `${optionKey} is not an option of ${requirement.interactionKey}`,
      );
    return option;
  };
  const choicesOf = (optionKey: string): readonly WorkspaceRoomObjectActionChoice[] => {
    const choices = requireOption(optionKey).choices;
    if (choices === undefined)
      throw new StructuredWorkspaceProjectionContractError(
        `${optionKey} of ${requirement.interactionKey} takes no choice`,
      );
    return choices;
  };
  return Object.freeze({
    key: requirement.interactionKey,
    owner: requirement.owner,
    intentFor: (optionKey: string) => Object.freeze({ command: requireOption(optionKey).command }),
    choices: (optionKey: string) => choicesModel(choicesOf(optionKey)),
    choiceIntentFor: (optionKey: string, choiceKey: string) => {
      const choice = choicesOf(optionKey).find((candidate) => candidate.key === choiceKey);
      if (choice === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${choiceKey} is not offered by ${optionKey} of ${requirement.interactionKey}`,
        );
      return Object.freeze({ command: choice.command });
    },
  });
}

/** Binds each World Shop, Hermes Shrine and Champion item entry. */
export function bindRoomObjectInteractions(
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): {
  readonly roomObjectEntries: ReadonlyMap<string, WorkspaceRoomObjectEntryInteraction>;
} {
  const roomObjectEntries = new Map<string, WorkspaceRoomObjectEntryInteraction>();
  for (const requirement of requirements) {
    if (requirement.kind !== 'roomObjectActions') continue;
    if (roomObjectEntries.has(requirement.interactionKey))
      throw new StructuredWorkspaceProjectionContractError(
        `${requirement.interactionKey} has multiple bound entries`,
      );
    roomObjectEntries.set(requirement.interactionKey, bindEntry(requirement));
  }
  return Object.freeze({ roomObjectEntries });
}
