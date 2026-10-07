import type {
  WorkspaceHubFountain,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';

/** Read-only timing and the Hub-owned Phial target, hosted after the preceding room. */
export function HubFountainControls({
  fountain,
  interactions,
}: {
  readonly fountain: WorkspaceHubFountain;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingAnchor = useFindingAnchor();
  return (
    <section
      aria-label="Hub fountain"
      className="hub-fountain-controls"
      {...(fountain.rarity === undefined ? findingAnchor(fountain.outcomeMarker.address) : {})}
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
