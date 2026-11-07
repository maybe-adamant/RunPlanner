import type { ReactNode } from 'react';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomFeature,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import type { RoomOverviewSectionContent } from '../RoomOverviewSections';
import { ErisSpawnControl } from './ErisSpawnControl';
import { RoomResourceControls } from './ResourceControls';
import { RoomObjectSlots } from './RoomObjectSlots';
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

/** The Objects section: the anchor slots line, then the Pedestal, which needs no anchor. */
function objectsGroup(
  features: readonly RoomFeaturePresence[],
  interactions: WorkspaceInteractionCatalog,
  room: WorkspaceRoomSummary,
): RoomFeatureGroup | undefined {
  const pedestals = features.filter((feature) => feature.kind === 'infernalContractPedestal');
  const entries = [
    ...(room.objectSlots === undefined
      ? []
      : [
          Object.freeze({
            kind: 'content' as const,
            key: 'Objects:slots',
            content: (
              <RoomObjectSlots
                features={features}
                interactions={interactions}
                objectSlots={room.objectSlots}
                room={room}
              />
            ),
          }),
        ]),
    ...pedestals.map((feature, index) =>
      Object.freeze({ kind: 'feature' as const, key: `Objects:${index}`, feature }),
    ),
  ];
  return entries.length === 0
    ? undefined
    : Object.freeze({ key: 'Objects', label: 'Objects', entries });
}

/** Room feature products as Overview sections; individual controls retain their semantic owners. */
export function roomFeatureSections({
  features,
  interactions,
  room,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}): Pick<RoomOverviewSectionContent, 'additionalExits' | 'objects' | 'resources' | 'npcs'> {
  const additionalExits = features.filter(
    (
      feature,
    ): feature is Extract<RoomFeaturePresence, { readonly kind: 'chaos' | 'zagreusContract' }> =>
      feature.kind === 'chaos' || feature.kind === 'zagreusContract',
  );
  const section = (group: RoomFeatureGroup | undefined): ReactNode =>
    group === undefined ? undefined : (
      <RoomFeatureSection group={group} interactions={interactions} />
    );
  return {
    additionalExits: section(featureGroup('Additional Exits', additionalExits)),
    objects: section(objectsGroup(features, interactions, room)),
    resources:
      room.resources === undefined || room.resources.length === 0
        ? undefined
        : section(
            contentGroup(
              'Resources',
              'Resources',
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
