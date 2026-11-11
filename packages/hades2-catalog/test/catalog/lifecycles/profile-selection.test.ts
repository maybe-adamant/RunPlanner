import { describe, expect, it } from 'vitest';

import { catalog, CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import {
  authoredRoomLifecycleProfileKey,
  biomeStartRoomGameNames,
  resolveBiomeStart,
  resolveEntryDeclaration,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { RoomLifecycleProfileSelection } from '@run-planner/engine/catalog-schema';

import { declarations, type RawCatalogInput } from '../../../src/declarations';

/** Fixture: the occurrence states the engine's selection distinguishes. */
const occurrences = [
  { state: { kind: 'none' } },
  { state: { kind: 'counted', reward: null } },
  { state: { kind: 'counted', reward: { rewardType: 'Probe' } } },
  { state: { kind: 'shop' } },
].map((occurrence) => occurrence as unknown as RoomOccurrence);

/** The declared candidate the occurrence state picks. */
function selectedProfileKey(
  selection: RoomLifecycleProfileSelection,
  occurrence: RoomOccurrence,
): string {
  switch (selection.kind) {
    case 'fixed':
      return selection.profileKey;
    case 'clockworkGoal':
      return occurrence.state.kind === 'counted' && occurrence.state.reward === null
        ? selection.goalProfileKey
        : selection.rewardProfileKey;
    case 'prebossOffer':
      return occurrence.state.kind === 'shop'
        ? selection.shopProfileKey
        : selection.freeRewardProfileKey;
  }
}

function malformedCatalog(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

describe('declared room lifecycle selection', () => {
  // A biome start room enters through `resolveEntryRoom`, which owns its lifecycle.
  it("equals the engine's derived profile for every room, route and occurrence state", () => {
    const mismatches: string[] = [];
    for (const route of catalog.routes.values) {
      const startRooms = new Set(
        catalog.biomeLayouts.values.flatMap((layout) =>
          biomeStartRoomGameNames(resolveBiomeStart(catalog, route.key, layout)),
        ),
      );
      for (const room of catalog.rooms.values.filter((room) => !startRooms.has(room.gameName))) {
        const routed = resolveEntryDeclaration(room, { routeKey: route.key, isFirst: false });
        for (const occurrence of occurrences) {
          const derived = authoredRoomLifecycleProfileKey(routed, occurrence);
          const declared = selectedProfileKey(routed.lifecycleProfile, occurrence);
          if (declared !== derived)
            mismatches.push(
              `${route.key} ${room.gameName} ${occurrence.state.kind}: ${declared} != ${derived}`,
            );
        }
        if (routed.localVisitLifecycleProfileKey !== undefined) {
          const derived = authoredRoomLifecycleProfileKey(routed, occurrences[0]!, 'ephyraSide');
          if (routed.localVisitLifecycleProfileKey !== derived)
            mismatches.push(`${route.key} ${room.gameName} local visit: ${derived}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('declares a local-visit lifecycle exactly for Ephyra side rooms', () => {
    const sideRooms = catalog.rooms.values.filter(
      (room) => room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraSideRoom',
    );
    expect(sideRooms.length).toBeGreaterThan(0);
    expect(
      catalog.rooms.values
        .filter((room) => room.localVisitLifecycleProfileKey !== undefined)
        .map((room) => room.gameName),
    ).toEqual(sideRooms.map((room) => room.gameName));
  });

  it('gives a route overlay its own template lifecycle', () => {
    const bridge = catalog.rooms.byKey.H_Bridge01!;
    expect(bridge.lifecycleProfile).toEqual({ kind: 'fixed', profileKey: 'StoryPickupRoom' });
    expect(bridge.routeOverlays?.map((overlay) => overlay.lifecycleProfile)).toEqual([
      { kind: 'fixed', profileKey: 'WorldShopRoom' },
    ]);
  });

  it('rejects a fixed template with no lifecycle for the room envelope', () => {
    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          roomTemplateLifecycles: {
            ...declarations.roomTemplateLifecycles,
            StandardCombat: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
          },
        }),
      ),
    ).toThrow(/roomTemplateLifecycles\.StandardCombat\.profileKeys.*PEncounter/);
  });

  it('rejects a candidate lifecycle that does not support the room envelope', () => {
    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          roomTemplateLifecycles: {
            ...declarations.roomTemplateLifecycles,
            ClockworkCombat: {
              kind: 'clockworkGoal',
              goalProfileKey: 'PCombatRoom',
              rewardProfileKey: 'StandardRewardRoom',
            },
          },
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        'roomTemplateLifecycles.ClockworkCombat',
        'PCombatRoom does not support the room encounter envelope',
      ),
    );
  });
});
