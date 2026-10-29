import { INITIAL_ROLL_KEY } from '@run-planner/engine/authored-project';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceFeatureRollActionsInteraction,
  WorkspaceFeatureRollSlotInteraction,
} from '../contracts/features';
import type { WorkspaceOccurrenceInteractionRequirement } from './interaction-requirements';
import { createMemoizedStableIdentityPickerLoad } from './room-feature-picker-model';

type ActionsRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'featureRollActions' }
>;
type SlotsRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'featureRollSlots' }
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

function bindActions(requirement: ActionsRequirement): WorkspaceFeatureRollActionsInteraction {
  const { owner } = requirement;
  const requireOption = (optionKey: string) => {
    const option = requirement.options.find((candidate) => candidate.key === optionKey);
    if (option === undefined)
      throw new StructuredWorkspaceProjectionContractError(
        `${optionKey} is not an option of ${requirement.interactionKey}`,
      );
    return option;
  };
  const choicesOf = (optionKey: string) => {
    const option = requireOption(optionKey);
    if (option.kind === 'reroll' || option.choices === undefined)
      throw new StructuredWorkspaceProjectionContractError(
        `${optionKey} of ${requirement.interactionKey} takes no choice`,
      );
    return { option, choices: option.choices };
  };
  return Object.freeze({
    key: requirement.interactionKey,
    owner,
    intentFor: (optionKey: string) => {
      const option = requireOption(optionKey);
      switch (option.kind) {
        case 'reroll':
          return Object.freeze({
            command: Object.freeze(
              requirement.feature === 'stygianWell'
                ? {
                    kind: 'InsertStygianWellReroll' as const,
                    occurrence: owner,
                    index: requirement.appendIndex,
                  }
                : {
                    kind: 'InsertPurgingPoolReroll' as const,
                    occurrence: owner,
                    index: requirement.appendIndex,
                  },
            ),
          });
        case 'wellPurchase':
          return Object.freeze({
            command: Object.freeze({
              kind: 'SetStygianWellPurchase' as const,
              occurrence: owner,
              generationKey: option.generationKey,
              purchased: true,
            }),
          });
        case 'poolSale':
          return Object.freeze({
            command: Object.freeze({
              kind: 'InsertRoomAction' as const,
              action: option.action,
              reference: option.sale,
              index: requirement.appendIndex,
            }),
          });
      }
    },
    choices: (optionKey: string) => choicesModel(choicesOf(optionKey).choices),
    choiceIntentFor: (optionKey: string, value: string) => {
      const { option, choices } = choicesOf(optionKey);
      if (!choices.some((choice) => choice.key === value))
        throw new StructuredWorkspaceProjectionContractError(
          `${value} is not offered by ${optionKey} of ${requirement.interactionKey}`,
        );
      if (option.kind === 'wellPurchase')
        return Object.freeze({
          command: Object.freeze({
            kind: 'SetStygianWellPurchase' as const,
            occurrence: owner,
            generationKey: option.generationKey,
            purchased: true,
            itemKey: value,
          }),
        });
      return Object.freeze({
        command: Object.freeze({
          kind: 'SellPurgingPoolRollSlot' as const,
          occurrence: owner,
          rollKey: option.sale.rollKey ?? INITIAL_ROLL_KEY,
          slotKey: option.sale.slotKey,
          traitKey: value,
          index: requirement.appendIndex,
        }),
      });
    },
  });
}

function bindSlots(
  requirement: SlotsRequirement,
  bound: Map<string, WorkspaceFeatureRollSlotInteraction>,
): void {
  for (const slot of requirement.slots) {
    if (bound.has(slot.interactionKey))
      throw new StructuredWorkspaceProjectionContractError(
        `${slot.interactionKey} has multiple bound roll slots`,
      );
    bound.set(
      slot.interactionKey,
      Object.freeze({
        key: slot.interactionKey,
        owner: requirement.action,
        load: createMemoizedStableIdentityPickerLoad<string | null>({
          assessment: slot.assessed ? 'assessed' : 'unassessed',
          choices: [
            { label: 'Any', value: null },
            ...slot.candidates.map((candidate) => ({
              label: candidate.label,
              value: candidate.key,
            })),
          ],
          selected: slot.value,
          selectedLabel: slot.valueLabel,
        }),
        intentFor: (value: string | null) =>
          Object.freeze({
            command: Object.freeze(
              requirement.feature === 'stygianWell'
                ? {
                    kind: 'ReplaceStygianWellRollOffer' as const,
                    action: requirement.action,
                    slotKey: slot.slotKey as 'healing' | 'secondLeft' | 'secondRight',
                    itemKey: value,
                  }
                : {
                    kind: 'ReplacePurgingPoolRollSlot' as const,
                    action: requirement.action,
                    slotKey: slot.slotKey as 'left' | 'middle' | 'right',
                    traitKey: value,
                  },
            ),
          }),
      }),
    );
  }
}

/** Binds each Well and Pool's Interact picker and its rerolls' slot pins. */
export function bindFeatureRollInteractions(
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): {
  readonly featureRollActions: ReadonlyMap<string, WorkspaceFeatureRollActionsInteraction>;
  readonly featureRollSlots: ReadonlyMap<string, WorkspaceFeatureRollSlotInteraction>;
} {
  const featureRollActions = new Map<string, WorkspaceFeatureRollActionsInteraction>();
  const featureRollSlots = new Map<string, WorkspaceFeatureRollSlotInteraction>();
  for (const requirement of requirements) {
    if (requirement.kind === 'featureRollSlots') bindSlots(requirement, featureRollSlots);
    if (requirement.kind !== 'featureRollActions') continue;
    if (featureRollActions.has(requirement.interactionKey))
      throw new StructuredWorkspaceProjectionContractError(
        `${requirement.interactionKey} has multiple bound Interact pickers`,
      );
    featureRollActions.set(requirement.interactionKey, bindActions(requirement));
  }
  return Object.freeze({ featureRollActions, featureRollSlots });
}
