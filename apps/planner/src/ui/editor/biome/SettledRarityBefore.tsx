import type { WorkspaceSettledRarity } from '@planner/projections/structured-workspace';
import { TimelineChip } from '../rewards/TimelineChip';

/** The target as it was before a settled growth, then the arrow to its picker; nothing when it stayed. */
export function SettledRarityBefore({
  label,
  settled,
  targetTraitKey,
}: {
  readonly label: string;
  readonly settled: WorkspaceSettledRarity | undefined;
  readonly targetTraitKey: string | undefined;
}) {
  if (settled === undefined || targetTraitKey === undefined || settled.before === settled.after)
    return null;
  return (
    <>
      <TimelineChip
        chip={{
          key: targetTraitKey,
          label: `${label}, ${settled.before}`,
          icon: targetTraitKey,
          rarity: settled.before,
          state: 'shown',
        }}
      />
      <span aria-hidden="true" className="row-reward-arrow">
        →
      </span>
    </>
  );
}
