import type { ReactNode } from 'react';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomFeature,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import type { RoomOverviewSectionContent } from '../RoomOverviewSections';
import { ChallengeSwitchControls } from './ChallengeSwitchControls';
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

type RoomObjectKind = 'stygianWell' | 'purgingPool' | 'hermesShrine' | 'infernalContractPedestal';

/** The game's secret spawn order: the Well, Pool and Shrine claim spots before the switch. */
const spawnPriority: readonly RoomObjectKind[] = ['stygianWell', 'purgingPool', 'hermesShrine'];
const afterSwitch: readonly RoomObjectKind[] = ['infernalContractPedestal'];

/** The Objects section in spawn order, the challenge switch after the objects that outrank it. */
function objectsGroup(
  features: readonly RoomFeaturePresence[],
  interactions: WorkspaceInteractionCatalog,
  room: WorkspaceRoomSummary,
): RoomFeatureGroup | undefined {
  const ofKinds = (kinds: readonly RoomObjectKind[]) =>
    kinds.flatMap((kind) => features.filter((feature) => feature.kind === kind));
  const feature = (entry: RoomFeaturePresence, index: number) =>
    Object.freeze({ kind: 'feature' as const, key: `Objects:${index}`, feature: entry });
  const before = ofKinds(spawnPriority);
  const after = ofKinds(afterSwitch);
  const entries = [
    ...before.map(feature),
    ...(room.challengeSwitch === undefined
      ? []
      : [
          Object.freeze({
            kind: 'content' as const,
            key: 'Objects:challengeSwitch',
            content: (
              <ChallengeSwitchControls
                interactions={interactions}
                observation={room.challengeSwitch}
              />
            ),
          }),
        ]),
    ...after.map((entry, index) => feature(entry, before.length + index)),
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
