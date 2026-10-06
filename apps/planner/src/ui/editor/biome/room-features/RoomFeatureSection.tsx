import type { ReactNode } from 'react';
import {
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { RoomInventoryPanel } from '../commerce/RoomInventoryPanel';
import { ChaosSpawnWorkbench, ZagreusSpawnWorkbench } from './AdditionalExitControls';

export type RoomFeaturePresence = Exclude<WorkspaceRoomFeature, { readonly kind: 'nemesisEvent' }>;

type RoomFeatureEntry =
  | { readonly kind: 'content'; readonly key: string; readonly content: ReactNode }
  | { readonly kind: 'feature'; readonly key: string; readonly feature: RoomFeaturePresence };

export type RoomFeatureGroup = {
  readonly key: string;
  readonly label: ReactNode;
  readonly entries: readonly RoomFeatureEntry[];
};

/** One titled Overview section of room feature controls. */
export function RoomFeatureSection({
  group,
  interactions,
  roomActions,
}: {
  readonly group: RoomFeatureGroup;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly roomActions?: WorkspaceRoomActions;
}) {
  return (
    <section className="room-overview-section">
      <h5 className="room-feature-category-heading">{group.label}</h5>
      <div className="room-overview-panel">
        {group.entries.map((entry) => {
          if (entry.kind === 'content') {
            return (
              <div className="room-feature-category-content" key={entry.key}>
                {entry.content}
              </div>
            );
          }
          const feature = entry.feature;
          switch (feature.kind) {
            case 'zagreusContract':
              return (
                <ZagreusSpawnWorkbench
                  feature={feature}
                  interactions={interactions}
                  key={workspaceInteractionKey(
                    feature.action === 'add' ? feature.control.owner : feature.owner,
                  )}
                />
              );
            case 'chaos':
              return (
                <ChaosSpawnWorkbench
                  feature={feature}
                  interactions={interactions}
                  key={workspaceInteractionKey(
                    feature.action === 'add' ? feature.control.owner : feature.owner,
                  )}
                />
              );
            case 'hermesShrine':
            case 'purgingPool':
            case 'stygianWell':
              return (
                <RoomInventoryPanel
                  feature={feature}
                  interactions={interactions}
                  key={workspaceInteractionKey(
                    feature.kind === 'purgingPool'
                      ? feature.inventoryAddress
                      : (feature.inventoryAddress ?? feature.presenceAddress),
                  )}
                  {...(roomActions === undefined ? {} : { roomActions })}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </section>
  );
}
