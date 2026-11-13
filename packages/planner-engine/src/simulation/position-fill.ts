import {
  createAdditionalExitAddress,
  createBiomeAddress,
  createFieldsSpatialAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
} from '../authored-project/addresses';
import { chaosGateSpawnPoint } from '../authored-project/chaos-gate-position';
import type { RoomLayout } from '../authored-project/model';
import type { Catalog } from '../catalog-schema';
import { candidateBiome, candidateBiomeRooms } from './candidates/evaluated-biome';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';
import { fieldsSpatialPositions } from './fields/spatial';
import { roomObjectAnchorPositions } from './room-layout/object-anchor-positions';
import type { RoomLayoutSettlement } from './room-layout/settlement';
import type { StockFill } from './stock-fill';

/**
 * The layout a reached room stores in place of its blanks: a rolled flip, and
 * an entry the game picks among several the flip allows, each as the walk
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
    ...authored,
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
): readonly StockFill[] {
  const { project, evaluation } = assembly;
  const routeKey = project.route.routeKey;
  const fills: StockFill[] = [];
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
      const layout = filledLayout(settlement, occurrence.layout);
      if (layout !== undefined)
        fills.push(
          Object.freeze<StockFill>({
            key: `layout:${ownerKey}`,
            owner: createRoomFeatureAddress(owner, {
              kind: layout.entryStartPointId === undefined ? 'roomLayoutFlip' : 'roomLayoutEntry',
            }),
            command: { kind: 'ReplaceRoomLayout', occurrence: owner, layout },
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
