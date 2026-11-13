import {
  createAdditionalExitAddress,
  createBiomeAddress,
  createFieldsSpatialAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
} from '../authored-project/addresses';
import { chaosGateSpawnPoint } from '../authored-project/chaos-gate-position';
import type { ProjectCommand } from '../authored-project/commands/types';
import type { ProjectDocument, RoomLayout } from '../authored-project/model';
import type { Catalog } from '../catalog-schema';
import { candidateBiome, candidateBiomeRooms } from './candidates/evaluated-biome';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';
import { fieldsSpatialPositions } from './fields/spatial';
import { roomObjectAnchorPositions } from './room-layout/object-anchor-positions';
import type { RoomLayoutSettlement } from './room-layout/settlement';
import type { StockFill } from './stock-fill';

/** A position fill; a layout fill also names only the blanks it stores. */
export interface PositionFill extends StockFill {
  readonly filledLayout?: RoomLayout;
}

/**
 * The positions a reached room stores in its layout's blanks: a rolled flip,
 * and an entry the game picks among several the flip allows, each as the walk
 * drew it. What the room or its arrival door decides stays unstored.
 */
function filledLayout(
  settlement: RoomLayoutSettlement,
  authored: RoomLayout | undefined,
): RoomLayout | undefined {
  const { flip, entry } = settlement;
  const flipped = flip.kind === 'roll' && authored?.flipped === undefined ? flip.value : undefined;
  const tied =
    entry.kind === 'choice' &&
    entry.eligible.filter((option) => option.flipped === undefined || option.flipped === flip.value)
      .length > 1;
  const entryStartPointId =
    tied && authored?.entryStartPointId === undefined ? entry.point.startPointId : undefined;
  if (flipped === undefined && entryStartPointId === undefined) return undefined;
  return Object.freeze({
    ...(flipped === undefined ? {} : { flipped }),
    ...(entryStartPointId === undefined ? {} : { entryStartPointId }),
  });
}

/**
 * Every blank position in a room the evaluated walk entered, with the command
 * storing the position the walk drew for it: the rolled flip and tied entry,
 * each anchor object's anchor, each active Fields slot's point and the Chaos
 * gate's spawn point. The walk claims its draws in the game's spawn order
 * around every stored position, so storing them all at once is collision-free
 * and leaves the walk unchanged.
 */
export function positionFills(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
): readonly PositionFill[] {
  const { project, evaluation } = assembly;
  const routeKey = project.route.routeKey;
  const fills: PositionFill[] = [];
  for (const biome of evaluation.route.biomes) {
    if (!('rewards' in biome)) continue;
    const plan = project.route.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
    const evaluated = candidateBiome(evaluation, routeKey, biome.biomeKey);
    const canonical = new Map(
      (evaluated === undefined ? [] : candidateBiomeRooms(evaluated)).map((room) => [
        semanticAddressKey(room.origin),
        room,
      ]),
    );
    for (const settlement of biome.rewards.roomLayouts) {
      const owner = settlement.owner;
      const ownerKey = semanticAddressKey(owner);
      const occurrence = plan?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === owner.occurrenceId,
      );
      if (occurrence === undefined) continue;
      const filled = filledLayout(settlement, occurrence.layout);
      if (filled !== undefined)
        fills.push(
          Object.freeze<PositionFill>({
            key: `layout:${ownerKey}`,
            owner: createRoomFeatureAddress(owner, {
              kind: filled.entryStartPointId === undefined ? 'roomLayoutFlip' : 'roomLayoutEntry',
            }),
            command: {
              kind: 'ReplaceRoomLayout',
              occurrence: owner,
              layout: Object.freeze({ ...occurrence.layout, ...filled }),
            },
            filledLayout: filled,
          }),
        );
      for (const [object, position] of roomObjectAnchorPositions(
        catalog,
        occurrence,
        routeKey,
        ownerKey,
      )) {
        if (position.source !== 'drawn') continue;
        const anchor = createRoomFeatureAddress(owner, { kind: 'objectAnchor', object });
        fills.push(
          Object.freeze<StockFill>({
            key: semanticAddressKey(anchor),
            owner: anchor,
            command: {
              kind: 'ReplaceRoomObjectAnchor',
              occurrence: owner,
              object,
              anchorId: position.anchorId,
            },
          }),
        );
      }
      const room = canonical.get(ownerKey);
      if (room?.entered === true)
        for (const position of fieldsSpatialPositions(catalog, room)) {
          if (position.source !== 'drawn') continue;
          const spatial = createFieldsSpatialAddress(owner, position.target);
          fills.push(
            Object.freeze<StockFill>({
              key: semanticAddressKey(spatial),
              owner: spatial,
              command: { kind: 'ReplaceFieldsSpatialPoint', spatial, pointId: position.pointId },
            }),
          );
        }
      const declaration = catalog.rooms.byKey[occurrence.gameName];
      for (const exit of occurrence.additionalExits ?? []) {
        if (
          exit.kind !== 'chaos' ||
          exit.spawnPointIndex !== undefined ||
          declaration === undefined
        )
          continue;
        const additional = createAdditionalExitAddress(
          createBiomeAddress(routeKey, owner.biomeKey),
          owner.occurrenceId,
          exit.key,
        );
        const spawnPointIndex = chaosGateSpawnPoint(
          declaration,
          semanticAddressKey(additional),
          undefined,
        );
        if (spawnPointIndex === undefined) continue;
        fills.push(
          Object.freeze<StockFill>({
            key: semanticAddressKey(additional),
            owner: additional,
            command: { kind: 'SetChaosSpawnPoint', additional, spawnPointIndex },
          }),
        );
      }
    }
  }
  return Object.freeze(fills);
}

/**
 * A position fill as it lands on another plan, such as the plan before an
 * edit: a layout fill stores only its blanks that plan also left blank,
 * beside that plan's own layout.
 */
export function positionFillOn(project: ProjectDocument, fill: PositionFill): ProjectCommand {
  const { command, filledLayout: filled } = fill;
  if (filled === undefined || command.kind !== 'ReplaceRoomLayout') return command;
  const layout = project.route.biomes
    .find((plan) => plan.biomeKey === command.occurrence.biomeKey)
    ?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === command.occurrence.occurrenceId,
    )?.layout;
  return Object.freeze({ ...command, layout: Object.freeze({ ...filled, ...layout }) });
}
