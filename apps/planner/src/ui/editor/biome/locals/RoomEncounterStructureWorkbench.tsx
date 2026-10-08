import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { isIdentityFinding } from './encounterPhaseFindings';
import { hintProps } from '@planner/ui/controls/hint';

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
      <h5 className="room-feature-category-heading">Encounters</h5>
      <div className="room-overview-panel">
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
            isIdentityFinding,
          );
          return (
            <label className="room-feature-presence-row" key={feature.interactionKey}>
              <input
                {...target}
                {...hintProps(interaction.disabledReason, target['aria-description'])}
                checked={feature.action === 'remove'}
                disabled={interaction.disabledReason !== undefined}
                onChange={() => executeIntent(interaction.intent)}
                type="checkbox"
              />
              <span>Nemesis Event</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
