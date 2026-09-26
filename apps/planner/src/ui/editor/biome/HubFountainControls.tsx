import type {
  WorkspaceHubFountain,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';

/** Read-only timing and the Hub-owned Phial target, hosted after the preceding room. */
export function HubFountainControls({
  fountain,
  interactions,
}: {
  readonly fountain: WorkspaceHubFountain;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  return (
    <section
      aria-label="Hub fountain"
      className="hub-fountain-controls"
      {...(fountain.rarity === undefined ? findingTarget(fountain.outcomeMarker.address) : {})}
      tabIndex={-1}
    >
      <p>
        <strong>Fountain used in the Hub after this room.</strong>
      </p>
      {fountain.rarity === undefined ? null : (
        <FountainRarityEffectRow control={fountain.rarity} interactions={interactions} />
      )}
    </section>
  );
}
