import type { ReactNode } from 'react';
import {
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { OverviewRow, type RoomOverviewSectionContent } from '../RoomOverviewSections';
import { RoomPositions } from '../room-layout/RoomPositions';
import {
  ChaosGatePosition,
  ChaosSpawnWorkbench,
  ZagreusSpawnWorkbench,
} from './AdditionalExitControls';
import { ErisSpawnControl } from './ErisSpawnControl';
import { InfernalContractPedestalPanel } from './InfernalContractPedestalPanel';
import { RoomResourceControls } from './ResourceControls';
import { RoomObjectContents, RoomObjectPresence } from './RoomObjects';

type Block = readonly [key: string, content: ReactNode];

/**
 * Room features as Overview blocks: exits, objects, resources and NPCs in the
 * room; each object's contents and the Pedestal's item; and every position.
 * Individual controls retain their semantic owners.
 */
export function roomFeatureSections({
  features,
  interactions,
  room,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}): Required<Pick<RoomOverviewSectionContent, 'present' | 'contents' | 'positions'>> {
  const exits = features.filter(
    (
      feature,
    ): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'chaos' | 'zagreusContract' }> =>
      feature.kind === 'chaos' || feature.kind === 'zagreusContract',
  );
  const chaos = exits.find(
    (feature): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'chaos' }> =>
      feature.kind === 'chaos',
  );
  const pedestals = features.filter(
    (
      feature,
    ): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'infernalContractPedestal' }> =>
      feature.kind === 'infernalContractPedestal',
  );
  const objectSlots = room.objectSlots;
  const present: Block[] = [];
  if (exits.length > 0)
    present.push([
      'exits',
      <OverviewRow key="exits" label="Exits">
        {exits.map((feature) =>
          feature.kind === 'chaos' ? (
            <ChaosSpawnWorkbench
              feature={feature}
              interactions={interactions}
              key={workspaceInteractionKey(
                feature.action === 'add' ? feature.control.owner : feature.owner,
              )}
            />
          ) : (
            <ZagreusSpawnWorkbench
              feature={feature}
              interactions={interactions}
              key={workspaceInteractionKey(
                feature.action === 'add' ? feature.control.owner : feature.owner,
              )}
            />
          ),
        )}
      </OverviewRow>,
    ]);
  if (objectSlots !== undefined && objectSlots.objects.length > 0)
    present.push([
      'objects',
      <OverviewRow label="Objects">
        <RoomObjectPresence interactions={interactions} objectSlots={objectSlots} />
      </OverviewRow>,
    ]);
  if (room.resources !== undefined && room.resources.length > 0)
    present.push([
      'resources',
      <OverviewRow label="Resources">
        <RoomResourceControls interactions={interactions} room={room} />
      </OverviewRow>,
    ]);
  if (room.erisObservation !== undefined)
    present.push([
      'npcs',
      <OverviewRow label="NPCs">
        <ErisSpawnControl interactions={interactions} observation={room.erisObservation} />
      </OverviewRow>,
    ]);
  const contents: Block[] = [];
  const held = objectSlots?.objects.some(
    (object) =>
      object.present &&
      (object.object === 'challengeSwitch'
        ? room.challengeSwitch !== undefined
        : features.some((feature) => feature.kind === object.object)),
  );
  if (objectSlots !== undefined && held === true)
    contents.push([
      'objects',
      <RoomObjectContents
        features={features}
        interactions={interactions}
        objectSlots={objectSlots}
        room={room}
      />,
    ]);
  for (const [index, feature] of pedestals.entries())
    contents.push([
      `pedestal:${index}`,
      <InfernalContractPedestalPanel feature={feature} interactions={interactions} />,
    ]);
  const chaosPosition =
    chaos?.action === 'remove' && chaos.position !== undefined ? (
      <ChaosGatePosition feature={chaos} interactions={interactions} />
    ) : undefined;
  const hasPositions =
    room.layout !== undefined ||
    objectSlots?.objects.some((object) => object.present) === true ||
    (room.roomLocal.kind === 'fields' && room.roomLocal.spatial.length > 0) ||
    chaosPosition !== undefined;
  return {
    present,
    contents,
    positions: hasPositions
      ? [
          [
            'positions',
            <RoomPositions chaosGate={chaosPosition} interactions={interactions} room={room} />,
          ],
        ]
      : [],
  };
}
