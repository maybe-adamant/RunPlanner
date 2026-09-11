import type {
  BiomeDeclaration,
  BiomeLayout,
  CatalogCollection,
  ExitTypeDeclaration,
  ProgressionDescriptor,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RewardStoreDeclaration } from '@run-planner/engine/reward-kernel';

import type { RawBiomeLayoutDeclaration } from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { normalizeAuthoredFields } from './descriptors';
import { fail } from './errors';
import { normalizeGeneratedProgression } from './layout-generated-progression';
import { normalizeHubDecision, validateHubEntryStart } from './layout-hub-progression';
import { normalizeLayoutCompletion, normalizeLayoutStart } from './layout-start-completion';

/** Chronologically assembles independently normalized layout products. */
export function normalizeBiomeLayouts(
  rawLayouts: readonly RawBiomeLayoutDeclaration[],
  biomes: CatalogCollection<BiomeDeclaration>,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): CatalogCollection<BiomeLayout> {
  const layouts = rawLayouts.map((layout, layoutIndex): BiomeLayout => {
    const path = `biomeLayouts[${layoutIndex}]`;
    requireNonEmpty(layout.biomeKey, `${path}.biomeKey`);
    if (biomes.byKey[layout.biomeKey] === undefined) {
      fail(`${path}.biomeKey`, `unknown biome ${layout.biomeKey}`);
    }
    const start = normalizeLayoutStart(layout.start, layout.biomeKey, rooms, `${path}.start`);
    const progression: ProgressionDescriptor =
      layout.progression.kind === 'generated'
        ? normalizeGeneratedProgression(
            layout.progression,
            layout.biomeKey,
            rooms,
            rewardStores,
            `${path}.progression`,
          )
        : layout.progression.kind === 'hub'
          ? normalizeHubDecision(
              layout.progression,
              layout.biomeKey,
              rooms,
              rewardStores,
              exitTypes,
              `${path}.progression`,
            )
          : fail(
              `${path}.progression.kind`,
              `unknown progression ${String((layout.progression as { kind?: unknown }).kind)}`,
            );
    if (progression.kind === 'hub') {
      validateHubEntryStart(start, progression, layout.biomeKey, rooms, path);
    }
    const chaos =
      layout.chaos === undefined
        ? undefined
        : (() => {
            const roomGameNames = freezeUniqueStrings(
              layout.chaos.roomGameNames,
              `${path}.chaos.roomGameNames`,
            );
            if (roomGameNames.length === 0) {
              fail(`${path}.chaos.roomGameNames`, 'must not be empty');
            }
            for (const [index, roomGameName] of roomGameNames.entries()) {
              const room = rooms.byKey[roomGameName];
              if (
                room === undefined ||
                room.roomSetKey !== 'Chaos' ||
                room.mode.kind !== 'authored' ||
                room.mode.templateKey !== 'Chaos'
              ) {
                fail(`${path}.chaos.roomGameNames[${index}]`, 'must name an authored Chaos room');
              }
            }
            const defaultRoomGameName = requireNonEmpty(
              layout.chaos.defaultRoomGameName,
              `${path}.chaos.defaultRoomGameName`,
            );
            if (!roomGameNames.includes(defaultRoomGameName)) {
              fail(`${path}.chaos.defaultRoomGameName`, 'must belong to roomGameNames');
            }
            const offerSpacingWindow = requirePositiveInteger(
              layout.chaos.offerSpacingWindow,
              `${path}.chaos.offerSpacingWindow`,
            );
            return Object.freeze({
              roomGameNames: roomGameNames as [string, ...string[]],
              defaultRoomGameName,
              offerSpacingWindow,
            });
          })();
    return Object.freeze({
      biomeKey: layout.biomeKey,
      initialCounters: Object.freeze({
        biomeDepthCache: requireNonNegativeInteger(
          layout.initialCounters.biomeDepthCache,
          `${path}.initialCounters.biomeDepthCache`,
        ),
        biomeEncounterDepth: requireNonNegativeInteger(
          layout.initialCounters.biomeEncounterDepth,
          `${path}.initialCounters.biomeEncounterDepth`,
        ),
      }),
      start,
      progression,
      ...(chaos === undefined ? {} : { chaos }),
      completion: normalizeLayoutCompletion(
        layout.completion,
        layout.biomeKey,
        rooms,
        `${path}.completion`,
      ),
      fields: normalizeAuthoredFields(layout.fields ?? [], `${path}.fields`),
    });
  });
  return createCollection(layouts, 'biomeLayouts', (layout) => layout.biomeKey, 'biomeKey');
}
