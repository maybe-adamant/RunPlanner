import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceRoomObjectEntryInteraction } from '../contracts/features';
import type {
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceRoomObjectActionRequirement,
} from './interaction-requirements';

type EntryRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomObjectActions' }
>;

function choicesModel(
  choices: readonly { readonly key: string; readonly label: string }[],
): ContextualPickerModel<string> {
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
              value: choice.key,
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
  const choicesOf = (optionKey: string) => {
    const option = requireOption(optionKey);
    if (
      option.rewardTypeChoices === undefined ||
      option.command.kind !== 'PurchaseHermesShrineOffer'
    )
      throw new StructuredWorkspaceProjectionContractError(
        `${optionKey} of ${requirement.interactionKey} takes no choice`,
      );
    return { command: option.command, choices: option.rewardTypeChoices };
  };
  return Object.freeze({
    key: requirement.interactionKey,
    owner: requirement.owner,
    intentFor: (optionKey: string) => Object.freeze({ command: requireOption(optionKey).command }),
    choices: (optionKey: string) => choicesModel(choicesOf(optionKey).choices),
    choiceIntentFor: (optionKey: string, value: string) => {
      const { command, choices } = choicesOf(optionKey);
      if (!choices.some((choice) => choice.key === value))
        throw new StructuredWorkspaceProjectionContractError(
          `${value} is not offered by ${optionKey} of ${requirement.interactionKey}`,
        );
      return Object.freeze({ command: Object.freeze({ ...command, rewardType: value }) });
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
