import type {
  WorkspaceRoomChoice,
  WorkspaceRoomIcon,
} from '@planner/projections/structured-workspace';
import { bossArtwork } from '@planner/ui/artwork/bosses/bossArtwork';
import { combatRoomArtwork } from '@planner/ui/artwork/combat-rooms/combatRoomArtwork';
import { emptyRoomArtwork } from '@planner/ui/artwork/empty-rooms/emptyRoomArtwork';
import { minibossIcon } from '@planner/ui/artwork/encounterArtwork';
import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { fountainIcon } from '@planner/ui/artwork/roomArtwork';

export const bossIcon = (biomeKey: string): string | undefined =>
  bossArtwork[biomeKey] ?? undefined;

/** The room's own icon: its enemies, empty scene, object, miniboss or NPC. */
export function roomKindIcon(room: WorkspaceRoomIcon): string | undefined {
  switch (room.kind) {
    case 'combat':
      return combatRoomArtwork[room.biomeKey] ?? undefined;
    case 'empty':
      return emptyRoomArtwork[room.biomeKey] ?? undefined;
    case 'fountain':
      return fountainIcon(room.biomeKey);
    case 'boss':
      return bossIcon(room.biomeKey);
    case 'shop':
      return rewardIcon('Shop');
    case 'chaos':
      return npcArtwork.Chaos ?? undefined;
    case 'contract':
      return npcArtwork.Zagreus ?? undefined;
    case 'miniboss':
      return room.encounterDefinitionKey === undefined
        ? undefined
        : minibossIcon(room.encounterDefinitionKey);
    case 'story':
      return room.npcKey === undefined ? undefined : (npcArtwork[room.npcKey] ?? undefined);
  }
}

/** The icon of the offered room with this game name. */
export function roomChoiceIcon(
  choices: readonly WorkspaceRoomChoice[],
  gameName: string,
): string | undefined {
  const choice = choices.find((candidate) => candidate.value === gameName);
  return choice === undefined ? undefined : roomKindIcon(choice.roomIcon);
}
