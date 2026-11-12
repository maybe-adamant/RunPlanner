import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceFeatureRollSlotInteraction } from '../contracts/features';
import type { WorkspaceOccurrenceInteractionRequirement } from './interaction-requirements';
import { createMemoizedStableIdentityPickerLoad } from './room-feature-picker-model';

type SlotsRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'featureRollSlots' }
>;

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

/** Binds each Well and Pool reroll's slot pins. */
export function bindFeatureRollInteractions(
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): {
  readonly featureRollSlots: ReadonlyMap<string, WorkspaceFeatureRollSlotInteraction>;
} {
  const featureRollSlots = new Map<string, WorkspaceFeatureRollSlotInteraction>();
  for (const requirement of requirements) {
    if (requirement.kind === 'featureRollSlots') bindSlots(requirement, featureRollSlots);
  }
  return Object.freeze({ featureRollSlots });
}
