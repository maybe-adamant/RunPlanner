import { useState } from 'react';
import type {
  WorkspaceFieldsCageOrderControl,
  WorkspaceRoomActionInteraction,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { NumberedSlots } from '@planner/ui/editor/rewards/NumberedSlots';

function ordinal(position: number): string {
  const tens = position % 100;
  if (tens >= 11 && tens <= 13) return `${position}th`;
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

/**
 * The cages in clear order, one chip per clear. Picking a cage for a clear swaps it with the
 * clear that had it; until every clear has a cage the order stays local.
 */
export function FieldsCageOrderControl({
  control,
  id,
  interaction,
}: {
  readonly control: WorkspaceFieldsCageOrderControl;
  readonly id: string;
  readonly interaction: WorkspaceRoomActionInteraction;
}) {
  const executeIntent = useCommandIntent();
  const source = JSON.stringify([id, control]);
  const [draft, setDraft] = useState<{
    readonly source: string;
    readonly phaseKeys: readonly (string | null)[];
  }>();
  // Clears without a cage yet are empty slots still to choose.
  const shown: readonly (string | null)[] =
    draft?.source === source
      ? draft.phaseKeys
      : control.choices.map((_choice, index) => control.phaseKeys[index] ?? null);
  const intentFor = interaction.fieldsCageOrderIntentFor;
  const choose = (position: number, phaseKey: string): void => {
    if (intentFor === undefined) return;
    const next = [...shown];
    const elsewhere = next.indexOf(phaseKey);
    if (elsewhere >= 0 && elsewhere !== position) next[elsewhere] = next[position] ?? null;
    next[position] = phaseKey;
    if (next.every((key): key is string => key !== null)) {
      executeIntent(intentFor(Object.freeze(next)));
      setDraft(undefined);
      return;
    }
    setDraft({ source, phaseKeys: Object.freeze(next) });
  };
  const items = control.choices.map((choice) => ({
    key: choice.phaseKey,
    value: choice.phaseKey,
    label: choice.fullLabel,
  }));
  return (
    <div className="fields-cage-order">
      <span aria-hidden="true" className="fields-cage-order-label">
        Combat Order
      </span>
      <NumberedSlots label="Combat order">
        {shown.map((phaseKey, index) => {
          const choice = control.choices.find((candidate) => candidate.phaseKey === phaseKey);
          const cleared = `Cleared ${ordinal(index + 1)}`;
          return (
            <span className="numbered-slot" key={index}>
              <ContextualPicker
                ariaLabel={choice === undefined ? cleared : `${cleared}: ${choice.fullLabel}`}
                locked={intentFor === undefined}
                {...(control.unavailableReason !== undefined
                  ? { disabledHint: control.unavailableReason }
                  : {})}
                id={`${id}-${index + 1}`}
                itemIcon={(item) => {
                  const offer = control.choices.find(
                    (candidate) => candidate.phaseKey === item.value,
                  )?.offer;
                  return offer === undefined ? undefined : offerIcon(offer);
                }}
                label=""
                layout="inline"
                model={declaredChoicesPicker(items, phaseKey ?? undefined)}
                onSelect={(selected) => choose(index, selected)}
                placeholder="Choose cage"
                searchable={false}
                {...(choice === undefined
                  ? {}
                  : {
                      triggerBadge: `C${choice.slot}`,
                      triggerIcon: choice.offer === undefined ? undefined : offerIcon(choice.offer),
                      triggerLabel: choice.fullLabel,
                    })}
                triggerSize="icon"
              />
            </span>
          );
        })}
      </NumberedSlots>
    </div>
  );
}
