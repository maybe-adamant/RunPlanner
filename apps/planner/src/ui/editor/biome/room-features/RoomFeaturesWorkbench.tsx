import type { ReactNode } from 'react';
import {
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomFeature,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { RoomInventoryPanel } from '../commerce/RoomInventoryPanel';
import { ChaosSpawnWorkbench, ZagreusSpawnWorkbench } from './AdditionalExitControls';
import { RoomResourceControls } from './ResourceControls';

type RoomFeaturePresence = Exclude<WorkspaceRoomFeature, { readonly kind: 'nemesisEvent' }>;

type RoomFeatureEntry =
  | { readonly kind: 'heading'; readonly key: string; readonly label: ReactNode }
  | { readonly kind: 'content'; readonly key: string; readonly content: ReactNode }
  | { readonly kind: 'feature'; readonly key: string; readonly feature: RoomFeaturePresence };

function featureEntries(
  key: string,
  label: string,
  features: readonly RoomFeaturePresence[],
): readonly RoomFeatureEntry[] {
  return features.length === 0
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({ kind: 'heading' as const, key: `${key}:heading`, label }),
        ...features.map((feature, index) =>
          Object.freeze({ kind: 'feature' as const, key: `${key}:${index}`, feature }),
        ),
      ]);
}

function contentEntries(
  key: string,
  label: ReactNode,
  content: ReactNode | undefined,
): readonly RoomFeatureEntry[] {
  return content === undefined
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({ kind: 'heading' as const, key: `${key}:heading`, label }),
        Object.freeze({ kind: 'content' as const, key: `${key}:content`, content }),
      ]);
}

/** Composes closed room feature products; individual controls retain their semantic owners. */
export function RoomFeaturesWorkbench({
  features,
  interactions,
  roomActions,
  room,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly roomActions?: WorkspaceRoomActions;
  readonly room: WorkspaceRoomSummary;
}) {
  const additionalExits = features.filter(
    (
      feature,
    ): feature is Extract<RoomFeaturePresence, { readonly kind: 'chaos' | 'zagreusContract' }> =>
      feature.kind === 'chaos' || feature.kind === 'zagreusContract',
  );
  const roomObjects = features.filter(
    (
      feature,
    ): feature is Extract<
      RoomFeaturePresence,
      { readonly kind: 'hermesShrine' | 'purgingPool' | 'stygianWell' }
    > =>
      feature.kind === 'hermesShrine' ||
      feature.kind === 'purgingPool' ||
      feature.kind === 'stygianWell',
  );
  const entries: readonly RoomFeatureEntry[] = Object.freeze([
    ...(room.resources === undefined || room.resources.length === 0
      ? []
      : contentEntries(
          'resources',
          <>
            <span>Resources</span>{' '}
            <span className="room-feature-heading-note">
              (Each successful element outcome can be placed once across the route)
            </span>
          </>,
          <RoomResourceControls interactions={interactions} room={room} />,
        )),
    ...featureEntries('additional-exits', 'Additional Exits', additionalExits),
    ...featureEntries('room-objects', 'Objects', roomObjects),
  ]);
  if (entries.length === 0) return null;
  return (
    <section aria-label="Room features" className="room-features-workbench">
      {entries.map((entry) => {
        if (entry.kind === 'heading') {
          return (
            <h5 className="room-feature-category-heading" key={entry.key}>
              {entry.label}
            </h5>
          );
        }
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
    </section>
  );
}
