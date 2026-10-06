import type { ReactNode } from 'react';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomActions,
  WorkspaceRoomFeature,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import type { RoomOverviewSectionContent } from '../RoomOverviewSections';
import { ErisSpawnControl } from './ErisSpawnControl';
import { RoomResourceControls } from './ResourceControls';
import {
  RoomFeatureSection,
  type RoomFeatureGroup,
  type RoomFeaturePresence,
} from './RoomFeatureSection';

/** The group key is the section's accessible name. */
function featureGroup(
  key: string,
  features: readonly RoomFeaturePresence[],
): RoomFeatureGroup | undefined {
  return features.length === 0
    ? undefined
    : Object.freeze({
        key,
        label: key,
        entries: features.map((feature, index) =>
          Object.freeze({ kind: 'feature' as const, key: `${key}:${index}`, feature }),
        ),
      });
}

function contentGroup(key: string, label: ReactNode, content: ReactNode): RoomFeatureGroup {
  return Object.freeze({
    key,
    label,
    entries: [{ kind: 'content' as const, key: `${key}:content`, content }],
  });
}

/** Room feature products as Overview sections; individual controls retain their semantic owners. */
export function roomFeatureSections({
  features,
  interactions,
  roomActions,
  room,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly roomActions?: WorkspaceRoomActions;
  readonly room: WorkspaceRoomSummary;
}): Pick<RoomOverviewSectionContent, 'additionalExits' | 'objects' | 'resources' | 'npcs'> {
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
  const section = (group: RoomFeatureGroup | undefined): ReactNode =>
    group === undefined ? undefined : (
      <RoomFeatureSection
        group={group}
        interactions={interactions}
        {...(roomActions === undefined ? {} : { roomActions })}
      />
    );
  return {
    additionalExits: section(featureGroup('Additional Exits', additionalExits)),
    objects: section(featureGroup('Objects', roomObjects)),
    resources:
      room.resources === undefined || room.resources.length === 0
        ? undefined
        : section(
            contentGroup(
              'Resources',
              <>
                <span>Resources</span>{' '}
                <span className="room-feature-heading-note">
                  (Each successful element outcome can be placed once across the route)
                </span>
              </>,
              <RoomResourceControls interactions={interactions} room={room} />,
            ),
          ),
    npcs:
      room.erisObservation === undefined
        ? undefined
        : section(
            contentGroup(
              'NPCs',
              'NPCs',
              <ErisSpawnControl interactions={interactions} observation={room.erisObservation} />,
            ),
          ),
  };
}
