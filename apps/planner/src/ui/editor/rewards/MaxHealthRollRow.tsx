import type { WorkspaceMaxHealthRoll } from '@planner/projections/structured-workspace';
import { SelectedOutcomeRow } from './SelectedOutcomeBlock';
import { ValueSlider } from './ValueSlider';

/** Edits the roll offset while showing the realized max health at the acquired rarity. */
export function MaxHealthRollRow({
  ariaLabel,
  onChange,
  roll,
}: {
  readonly ariaLabel: string;
  readonly onChange: (offset: number) => void;
  readonly roll: WorkspaceMaxHealthRoll;
}) {
  return (
    <SelectedOutcomeRow label={`Max health roll ${roll.minimum}–${roll.maximum}`}>
      <ValueSlider
        ariaLabel={ariaLabel}
        display={(offset) => String(roll.healthFor(offset))}
        maximum={roll.width}
        minimum={0}
        onChange={onChange}
        step={1}
        value={roll.offset}
      />
    </SelectedOutcomeRow>
  );
}
