import { useId } from 'react';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

interface RoomActionPlacementChoice {
  readonly key: string;
  readonly label: string;
  readonly structurallyAuthorable: boolean;
}

export function RoomActionPlacementPicker({
  label,
  trigger,
  choices,
  onApply,
}: {
  readonly label: string;
  readonly trigger: string;
  readonly choices: readonly RoomActionPlacementChoice[];
  readonly onApply: (key: string) => void;
}) {
  const id = useId();
  return (
    <div className="room-action-placement-picker">
      <ContextualPicker
        id={id}
        label=""
        ariaLabel={label}
        placeholder={trigger}
        disabled={choices.length === 0}
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
                      ...(!available
                        ? { explanation: 'Conflicts with the required action order or timing.' }
                        : {}),
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
