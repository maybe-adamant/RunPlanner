import type { Catalog } from '../../../../catalog-schema';
import { offeredExitDoorOrder } from '../../../../catalog-schema/exit-door-order';
import type { HubDecisionAddress } from '../../../../authored-project/addresses';
import type {
  HubDecision,
  OccurrenceId,
  ProjectDocument,
} from '../../../../authored-project/model';

/**
 * The game's reward-assignment order for an open Hub board.
 *
 * `SetupDefaultDoor` inserts each open door into `MapState.OfferedExitDoors`
 * in the map's fixed door-setup order, and `DoUnlockRoomExits` processes the
 * table in native exit-door order. Each door draws its reward in that order,
 * after the doors before it.
 */
export interface HubBoardDoor {
  readonly physicalDoorId: number;
  readonly offeredExitInsertionRank: number;
  /** The door's obstacle name in the Hub room's door-setup order. */
  readonly obstacleName: string;
}

/** Returns the doors in the order the game assigns their rewards. */
export function hubBoardRewardAssignmentOrder<Door extends HubBoardDoor>(
  doors: readonly Door[],
): readonly Door[] {
  const inserted = [...doors].sort(
    (left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank,
  );
  const byId = new Map(inserted.map((door) => [door.physicalDoorId, door]));
  const walked = offeredExitDoorOrder(
    inserted.map((door) => ({ doorId: door.physicalDoorId, obstacleName: door.obstacleName })),
  );
  return Object.freeze(walked.map((id) => byId.get(id)!));
}

/** One declared slot of a Hub board, as the authored open set leaves it. */
export type HubBoardSlotDraw =
  | { readonly hubSlotKey: string; readonly open: false }
  | {
      readonly hubSlotKey: string;
      readonly open: true;
      readonly occurrenceId: OccurrenceId;
      /** 1-based position at which the game draws this door's reward among the open doors. */
      readonly drawPosition: number;
    };

/**
 * Every declared slot of an authored Hub board in declaration order, each
 * open door with its reward draw position. The order follows the open set
 * alone, so it is published for an incomplete or invalid board too.
 * Undefined when the Hub is not authored.
 */
export function hubBoardDrawPositions(
  catalog: Catalog,
  document: ProjectDocument,
  hub: HubDecisionAddress,
): readonly HubBoardSlotDraw[] | undefined {
  const progression = catalog.biomeLayouts.byKey[hub.biomeKey]?.progression;
  if (progression?.kind !== 'hub' || progression.hubKey !== hub.hubKey) return undefined;
  const decision = document.route.biomes
    .find((biome) => biome.biomeKey === hub.biomeKey)
    ?.topology?.decisions.find(
      (candidate): candidate is HubDecision =>
        candidate.kind === 'hub' && candidate.hubKey === hub.hubKey,
    );
  if (decision === undefined) return undefined;
  const setup = catalog.rooms.byKey[progression.terminal.roomGameName]?.exitDoorSetupOrder ?? [];
  const open = new Map(decision.openTargets.map((target) => [target.hubSlotKey, target]));
  const doors = progression.slots.flatMap((slot) => {
    const target = open.get(slot.slotKey);
    const obstacleName = setup.find((door) => door.doorId === slot.physicalDoorId)?.obstacleName;
    return target === undefined || obstacleName === undefined
      ? []
      : [{ ...slot, obstacleName, occurrenceId: target.occurrenceId }];
  });
  const positions = new Map(
    hubBoardRewardAssignmentOrder(doors).map((door, index) => [door.slotKey, index + 1]),
  );
  return Object.freeze(
    progression.slots.map((slot): HubBoardSlotDraw => {
      const position = positions.get(slot.slotKey);
      const target = open.get(slot.slotKey);
      return Object.freeze(
        position === undefined || target === undefined
          ? { hubSlotKey: slot.slotKey, open: false as const }
          : {
              hubSlotKey: slot.slotKey,
              open: true as const,
              occurrenceId: target.occurrenceId,
              drawPosition: position,
            },
      );
    }),
  );
}
