import type {
  BiomeLayout,
  CatalogCollection,
  LinearBiomeLayout,
  RoomDeclaration,
} from '@run-planner/core';

import type { RawLinearBiomeLayoutDeclaration } from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

export function normalizeBiomeLayouts(
  rawLayouts: readonly RawLinearBiomeLayoutDeclaration[],
  routeSteps: ReadonlySet<string>,
  rooms: CatalogCollection<RoomDeclaration>,
): CatalogCollection<BiomeLayout> {
  const layouts = rawLayouts.map((layout, layoutIndex): LinearBiomeLayout => {
    const path = `biomeLayouts[${layoutIndex}]`;
    requireNonEmpty(layout.biomeStepKey, `${path}.biomeStepKey`);
    if (!routeSteps.has(layout.biomeStepKey)) {
      fail(`${path}.biomeStepKey`, `unknown biome step ${layout.biomeStepKey}`);
    }

    const roomGameNames = freezeUniqueStrings(
      layout.start.roomGameNames,
      `${path}.start.roomGameNames`,
    );
    if (roomGameNames.length === 0) {
      fail(`${path}.start.roomGameNames`, 'must not be empty');
    }
    roomGameNames.forEach((gameName, roomIndex) => {
      const room = rooms.byKey[gameName];
      if (room === undefined) {
        fail(`${path}.start.roomGameNames[${roomIndex}]`, `unknown room ${gameName}`);
      }
      if (room.biomeStepKey !== layout.biomeStepKey || room.kind !== 'Opening') {
        fail(
          `${path}.start.roomGameNames[${roomIndex}]`,
          `${gameName} must be an Opening in ${layout.biomeStepKey}`,
        );
      }
    });

    const terminalRoom = rooms.byKey[layout.terminal.roomGameName];
    if (terminalRoom === undefined) {
      fail(`${path}.terminal.roomGameName`, `unknown room ${layout.terminal.roomGameName}`);
    }
    if (terminalRoom.biomeStepKey !== layout.biomeStepKey || terminalRoom.kind !== 'Preboss') {
      fail(
        `${path}.terminal.roomGameName`,
        `${layout.terminal.roomGameName} must be a Preboss in ${layout.biomeStepKey}`,
      );
    }

    return Object.freeze({
      biomeStepKey: layout.biomeStepKey,
      kind: 'LinearBiome',
      start: Object.freeze({ mode: 'oneOf', roomGameNames }),
      continuation: Object.freeze({ defaultBatchRuleKey: 'Standard' }),
      terminal: Object.freeze({
        roomGameName: layout.terminal.roomGameName,
        transitionRuleKey: 'PrebossEntry',
        exitPolicy: Object.freeze({ kind: 'allExitsTerminal' }),
      }),
      bounds: Object.freeze({
        maxBatches: requirePositiveInteger(layout.bounds.maxBatches, `${path}.bounds.maxBatches`),
        maxTargets: requirePositiveInteger(layout.bounds.maxTargets, `${path}.bounds.maxTargets`),
      }),
    });
  });

  return createCollection(layouts, 'biomeLayouts', (layout) => layout.biomeStepKey, 'biomeStepKey');
}
