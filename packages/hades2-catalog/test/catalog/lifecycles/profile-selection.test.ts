import { describe, expect, it } from 'vitest';

import { catalog, CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';

import { declarations, type RawCatalogInput } from '../../../src/declarations';

function malformedCatalog(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

describe('declared room lifecycle selection', () => {
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
