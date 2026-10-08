import { useId } from 'react';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';

interface RoomActionPlacementChoice {
  readonly key: string;
  readonly label: string;
  readonly structurallyAuthorable: boolean;
  readonly explanations: readonly string[];
}

export function RoomActionPlacementPicker({
  findingMark,
  label,
  trigger,
  choices,
  disabledHint,
  onApply,
}: {
  /** Findings repaired by moving this action. */
  readonly findingMark?: FindingMarkProps;
  readonly label: string;
  readonly trigger: string;
  readonly choices: readonly RoomActionPlacementChoice[];
  /** Hover text while no destination is structurally authorable. */
  readonly disabledHint?: string;
  readonly onApply: (key: string) => void;
}) {
  const id = useId();
  const noDestination = !choices.some((choice) => choice.structurallyAuthorable);
  return (
    <div className="room-action-placement-picker">
      <ContextualPicker
        {...(findingMark === undefined ? {} : { findingMark })}
        id={id}
        label=""
        ariaLabel={label}
        placeholder={trigger}
        disabled={noDestination}
        {...(noDestination && disabledHint !== undefined ? { disabledHint } : {})}
        model={{
          sections: [true, false].flatMap((available) => {
            const matches = choices.filter((choice) => choice.structurallyAuthorable === available);
            return matches.length === 0
              ? []
              : [
                  {
                    key: available ? 'available' : 'unavailable',
                    kind: available ? ('category' as const) : ('unavailable' as const),
                    label: available ? 'Available' : 'Unavailable',
                    collapsible: !available,
                    items: matches.map((choice) => ({
                      key: choice.key,
                      value: choice.key,
                      label: choice.label,
                      selected: false,
                      disabled: !available,
                      state: available ? ('possible' as const) : ('impossible' as const),
                      ...(!available ? { explanation: choice.explanations.join(' ') } : {}),
                    })),
                  },
                ];
          }),
        }}
        onSelect={onApply}
      />
    </div>
  );
}
