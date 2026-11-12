import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceRoomObjectEntryInteraction,
  WorkspaceRoomChoicesInteraction,
} from '../contracts/features';
import type {
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceRoomObjectActionRequirement,
} from './interaction-requirements';

type EntryRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomObjectActions' }
>;

function bindEntry(requirement: EntryRequirement): WorkspaceRoomObjectEntryInteraction {
  const requireOption = (optionKey: string): WorkspaceRoomObjectActionRequirement => {
    const option = requirement.options.find((candidate) => candidate.key === optionKey);
    if (option === undefined)
      throw new StructuredWorkspaceProjectionContractError(
        `${optionKey} is not an option of ${requirement.interactionKey}`,
      );
    return option;
  };
  return Object.freeze({
    key: requirement.interactionKey,
    owner: requirement.owner,
    intentFor: (optionKey: string) => Object.freeze({ command: requireOption(optionKey).command }),
  });
}

type ChoicesRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomChoices' }
>;

function bindChoices(requirement: ChoicesRequirement): WorkspaceRoomChoicesInteraction {
  return Object.freeze({
    key: requirement.interactionKey,
    owner: requirement.owner,
    intentFor: (choiceKey: string) => {
      const choice = requirement.choices.find((candidate) => candidate.key === choiceKey);
      if (choice === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${choiceKey} is not a choice of ${requirement.interactionKey}`,
        );
      return Object.freeze({ commands: choice.commands });
    },
  });
}

/** Binds each room's locked-door toggles and keyed placement choices. */
export function bindRoomObjectInteractions(
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): {
  readonly roomObjectEntries: ReadonlyMap<string, WorkspaceRoomObjectEntryInteraction>;
  readonly roomChoices: ReadonlyMap<string, WorkspaceRoomChoicesInteraction>;
} {
  const roomObjectEntries = new Map<string, WorkspaceRoomObjectEntryInteraction>();
  const roomChoices = new Map<string, WorkspaceRoomChoicesInteraction>();
  for (const requirement of requirements) {
    if (requirement.kind === 'roomChoices') {
      if (roomChoices.has(requirement.interactionKey))
        throw new StructuredWorkspaceProjectionContractError(
          `${requirement.interactionKey} has multiple bound room choices`,
        );
      roomChoices.set(requirement.interactionKey, bindChoices(requirement));
      continue;
    }
    if (requirement.kind !== 'roomObjectActions') continue;
    if (roomObjectEntries.has(requirement.interactionKey))
      throw new StructuredWorkspaceProjectionContractError(
        `${requirement.interactionKey} has multiple bound entries`,
      );
    roomObjectEntries.set(requirement.interactionKey, bindEntry(requirement));
  }
  return Object.freeze({ roomObjectEntries, roomChoices });
}
