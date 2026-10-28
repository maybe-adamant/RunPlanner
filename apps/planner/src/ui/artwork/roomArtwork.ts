import type { RoomActionReference } from '@run-planner/engine/authored-project';
import type { ResourceFamily } from '@run-planner/engine/catalog-schema';
import { keepsakeArtwork } from '@planner/ui/controls/keepsakes/keepsakeArtwork';

import { biomeArtwork } from './biomes/biomeArtwork';
import { elementArtwork } from './elements/elementArtwork';
import { fountainArtwork } from './fountains/fountainArtwork';
import { hubFountainArtwork } from './hub-fountains/hubFountainArtwork';
import { roomObjectArtwork } from './room-objects/roomObjectArtwork';
import { gatheringToolArtwork } from './tools/gatheringToolArtwork';

export type RoomObjectKey = 'stygianWell' | 'purgingPool' | 'hermesShrine' | 'keepsakeRack';

/** An in-world room object's icon. */
export function roomObjectIcon(key: RoomObjectKey): string | undefined {
  return roomObjectArtwork[key] ?? undefined;
}

/** A biome's fountain room icon; undefined where the biome has no fountain room. */
export function fountainIcon(biomeKey: string): string | undefined {
  return fountainArtwork[biomeKey] ?? undefined;
}

/** A Hub fountain's icon by its biome key. */
export function hubFountainIcon(biomeKey: string): string | undefined {
  return hubFountainArtwork[biomeKey] ?? undefined;
}

/** A gathering tool's icon by resource family. */
export function gatheringToolIcon(family: ResourceFamily): string | undefined {
  return gatheringToolArtwork[family] ?? undefined;
}

/** An element's icon. */
export function elementIcon(element: string | undefined): string | undefined {
  return element === undefined ? undefined : (elementArtwork[element] ?? undefined);
}

/** Eris is shown by her keepsake, the Discordant Bell, like the other NPC portraits. */
export const erisIcon: string | undefined = keepsakeArtwork.EscalatingKeepsake ?? undefined;

/** The object or NPC a room action uses; undefined for actions without one. */
export function roomActionIcon(
  reference: RoomActionReference,
  biomeKey: string,
): string | undefined {
  switch (reference.kind) {
    case 'purchaseStygianWellOffer':
    case 'rerollStygianWell':
      return roomObjectIcon('stygianWell');
    case 'purchaseHermesShrineOffer':
      return roomObjectIcon('hermesShrine');
    case 'sellPurgingPoolTrait':
    case 'rerollPurgingPool':
      return roomObjectIcon('purgingPool');
    case 'interactKeepsakeRack':
      return roomObjectIcon('keepsakeRack');
    case 'useFountain':
      return fountainIcon(biomeKey);
    case 'interactEris':
      return erisIcon;
    default:
      return undefined;
  }
}

/** A biome's icon by catalog biome key. */
export function biomeIcon(biomeKey: string): string | undefined {
  return biomeArtwork[biomeKey] ?? undefined;
}
