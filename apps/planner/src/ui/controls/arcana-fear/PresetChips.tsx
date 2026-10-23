import { useState } from 'react';

import type { ProjectCommand } from '@run-planner/engine/authored-project';
import type { PresetChip } from '@planner/projections/loadoutPresets';

/**
 * The planner's presets of one kind, atop the editor's Arcana or Fear picker while any exist. A chip replaces the
 * selection in one step; one that does not fit says why and changes nothing.
 */
export function PresetChips({
  chips,
  label,
  onApply,
}: {
  readonly chips: readonly PresetChip[];
  /** Such as "Arcana presets". */
  readonly label: string;
  readonly onApply: (commands: readonly ProjectCommand[]) => void;
}) {
  const [refused, setRefused] = useState<{ readonly id: string; readonly reason: string } | null>(
    null,
  );
  return (
    <div className="preset-chips">
      <div aria-label={label} className="preset-chip-row" role="group">
        <span className="preset-chip-label">Presets</span>
        {chips.map((chip) => (
          <button
            aria-pressed={chip.current}
            className="library-chip preset-chip"
            data-refused={refused?.id === chip.id || undefined}
            key={chip.id}
            onClick={() => {
              const outcome = chip.outcome;
              if (outcome.kind === 'refused') {
                setRefused({ id: chip.id, reason: outcome.reason });
                return;
              }
              setRefused(null);
              if (outcome.kind === 'apply') onApply(outcome.commands);
            }}
            type="button"
          >
            {chip.name}
          </button>
        ))}
      </div>
      <p className="preset-chip-reason" role="status">
        {refused === null
          ? null
          : `${chips.find((chip) => chip.id === refused.id)?.name ?? 'Preset'}: ${refused.reason}`}
      </p>
    </div>
  );
}
