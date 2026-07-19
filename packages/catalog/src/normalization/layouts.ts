import type {
  BiomeLayout,
  CatalogCollection,
  LinearBiomeLayout,
  RoomDeclaration,
} from '@run-planner/core';
import type { RewardStoreDeclaration } from '@run-planner/core/reward-kernel';

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
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
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
    if (layout.start.mode === 'fixed' && roomGameNames.length !== 1) {
      fail(`${path}.start.roomGameNames`, 'fixed start must reference exactly one room');
    }
    roomGameNames.forEach((gameName, roomIndex) => {
      const room = rooms.byKey[gameName];
      if (room === undefined) {
        fail(`${path}.start.roomGameNames[${roomIndex}]`, `unknown room ${gameName}`);
      }
      const requiredKind = layout.start.mode === 'fixed' ? 'Intro' : 'Opening';
      if (room.biomeStepKey !== layout.biomeStepKey || room.kind !== requiredKind) {
        fail(
          `${path}.start.roomGameNames[${roomIndex}]`,
          `${gameName} must be an ${requiredKind} in ${layout.biomeStepKey}`,
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

    const rewardStoreKeys = freezeUniqueStrings(
      layout.continuation.rewardStorePolicy.storeKeys,
      `${path}.continuation.rewardStorePolicy.storeKeys`,
    );
    if (layout.continuation.rewardStorePolicy.kind !== 'authoredBaseStore') {
      fail(
        `${path}.continuation.rewardStorePolicy.kind`,
        `unknown reward-store policy ${String(layout.continuation.rewardStorePolicy.kind)}`,
      );
    }
    if (layout.continuation.batchStateDefault !== null) {
      fail(`${path}.continuation.batchStateDefault`, 'must be null for Standard');
    }
    if (rewardStoreKeys.length === 0) {
      fail(`${path}.continuation.rewardStorePolicy.storeKeys`, 'must not be empty');
    }
    for (const [index, storeKey] of rewardStoreKeys.entries()) {
      if (rewardStores.byKey[storeKey] === undefined) {
        fail(
          `${path}.continuation.rewardStorePolicy.storeKeys[${index}]`,
          `unknown reward store ${storeKey}`,
        );
      }
    }
    if (!rewardStoreKeys.includes(layout.continuation.rewardStorePolicy.defaultStoreKey)) {
      fail(
        `${path}.continuation.rewardStorePolicy.defaultStoreKey`,
        'must belong to the authored base store domain',
      );
    }

    return Object.freeze({
      biomeStepKey: layout.biomeStepKey,
      kind: 'LinearBiome',
      start: Object.freeze({ mode: layout.start.mode, roomGameNames }),
      continuation: Object.freeze({
        defaultBatchRuleKey: 'Standard',
        rewardStorePolicy: Object.freeze({
          kind: 'authoredBaseStore',
          storeKeys: rewardStoreKeys,
          defaultStoreKey: layout.continuation.rewardStorePolicy.defaultStoreKey,
        }),
        batchStateDefault: null,
      }),
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
