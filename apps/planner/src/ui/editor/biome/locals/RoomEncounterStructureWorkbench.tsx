import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

export function RoomEncounterStructureWorkbench({
  children,
  features,
  interactions,
}: {
  readonly children?: ReactNode;
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const encounters = features.filter((feature) => feature.kind === 'nemesisEvent');
  if (children === undefined && encounters.length === 0) return null;
  return (
    <section aria-label="Encounter structure" className="room-structure-workbench">
      <div className="local-reward-heading">
        <h4>Encounters</h4>
      </div>
      {children}
      {encounters.map((feature) => {
        const interaction = requireWorkspaceInteraction(
          interactions.nemesisFeatures,
          feature.interactionKey,
        );
        return (
          <label className="room-feature-presence-row" key={feature.interactionKey}>
            <input
              checked={feature.action === 'remove'}
              onChange={() => executeIntent(interaction.intent)}
              type="checkbox"
            />
            <span>Nemesis Event</span>
          </label>
        );
      })}
    </section>
  );
}
