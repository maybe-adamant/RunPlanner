import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

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
  const findingTarget = useFindingTarget();
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
        // The checkbox repairs the Passive phase selection; customization keeps its own launcher.
        const target = findingTarget(
          interaction.owner,
          undefined,
          interaction.owner,
          (finding) => finding.code !== 'encounterCustomizationUnavailable',
        );
        const description = [target['aria-description'], interaction.disabledReason]
          .filter((entry) => entry !== undefined)
          .join(' ');
        return (
          <label
            className="room-feature-presence-row"
            key={feature.interactionKey}
            title={interaction.disabledReason}
          >
            <input
              {...target}
              aria-description={description === '' ? undefined : description}
              checked={feature.action === 'remove'}
              disabled={interaction.disabledReason !== undefined}
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
