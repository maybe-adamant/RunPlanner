import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

const expectedClosureMatrix = [
  {
    routeKey: 'Underworld',
    routeIndex: 0,
    biomeKey: 'F',
    label: 'Erebus',
    layoutKind: 'LinearBiome',
    roomCount: 34,
    authoredRoomCount: 32,
    progressionKind: 'eligibilityDriven',
    batchKind: 'standard',
    rewardStoreKind: 'authoredBaseStore',
    rewardStoreOverrides: [],
    terminalKind: 'forkedTransition',
    completionRoomGameNames: ['F_Boss01', 'F_PostBoss01'],
    nextBiomeKey: 'G',
  },
  {
    routeKey: 'Underworld',
    routeIndex: 1,
    biomeKey: 'G',
    label: 'Oceanus',
    layoutKind: 'LinearBiome',
    roomCount: 30,
    authoredRoomCount: 28,
    progressionKind: 'eligibilityDriven',
    batchKind: 'standard',
    rewardStoreKind: 'authoredBaseStore',
    rewardStoreOverrides: [],
    terminalKind: 'forkedTransition',
    completionRoomGameNames: ['G_Boss01', 'G_PostBoss01'],
    nextBiomeKey: 'H',
  },
  {
    routeKey: 'Underworld',
    routeIndex: 2,
    biomeKey: 'H',
    label: 'Fields',
    layoutKind: 'LinearBiome',
    roomCount: 22,
    authoredRoomCount: 20,
    progressionKind: 'fixedCount',
    batchKind: 'fields',
    rewardStoreKind: 'none',
    rewardStoreOverrides: [],
    terminalKind: 'forkedTransition',
    completionRoomGameNames: ['H_Boss01', 'H_PostBoss01'],
    nextBiomeKey: 'I',
  },
  {
    routeKey: 'Underworld',
    routeIndex: 3,
    biomeKey: 'I',
    label: 'Tartarus',
    layoutKind: 'LinearBiome',
    roomCount: 32,
    authoredRoomCount: 29,
    progressionKind: 'eligibilityDriven',
    batchKind: 'clockwork',
    rewardStoreKind: 'none',
    rewardStoreOverrides: [],
    terminalKind: 'generatedTarget',
    completionRoomGameNames: ['I_Boss01', 'I_PostBoss01'],
    nextBiomeKey: null,
  },
  {
    routeKey: 'Surface',
    routeIndex: 0,
    biomeKey: 'N',
    label: 'Ephyra',
    layoutKind: 'HubBiome',
    roomCount: 47,
    authoredRoomCount: 44,
    progressionKind: null,
    batchKind: null,
    rewardStoreKind: 'none',
    rewardStoreOverrides: [],
    terminalKind: 'fixedAuthoredSlot',
    completionRoomGameNames: ['N_Boss01', 'N_PostBoss01'],
    nextBiomeKey: 'O',
  },
  {
    routeKey: 'Surface',
    routeIndex: 1,
    biomeKey: 'O',
    label: 'Thessaly',
    layoutKind: 'LinearBiome',
    roomCount: 25,
    authoredRoomCount: 23,
    progressionKind: 'fixedCount',
    batchKind: 'standard',
    rewardStoreKind: 'authoredBaseStore',
    rewardStoreOverrides: ['sourceOfferPoint'],
    terminalKind: 'directTransition',
    completionRoomGameNames: ['O_Boss01', 'O_PostBoss01'],
    nextBiomeKey: 'P',
  },
  {
    routeKey: 'Surface',
    routeIndex: 2,
    biomeKey: 'P',
    label: 'Olympus',
    layoutKind: 'LinearBiome',
    roomCount: 28,
    authoredRoomCount: 26,
    progressionKind: 'eligibilityDriven',
    batchKind: 'standard',
    rewardStoreKind: 'authoredBaseStore',
    rewardStoreOverrides: [],
    terminalKind: 'forkedTransition',
    completionRoomGameNames: ['P_Boss01', 'P_PostBoss01'],
    nextBiomeKey: 'Q',
  },
  {
    routeKey: 'Surface',
    routeIndex: 3,
    biomeKey: 'Q',
    label: 'Summit',
    layoutKind: 'LinearBiome',
    roomCount: 23,
    authoredRoomCount: 22,
    progressionKind: 'staged',
    batchKind: 'standard',
    rewardStoreKind: 'none',
    rewardStoreOverrides: [],
    terminalKind: 'directTransition',
    completionRoomGameNames: ['Q_Boss01'],
    nextBiomeKey: null,
  },
] as const;

describe('Phase 2.8 cross-biome catalog closure', () => {
  it('matches the complete route, layout, policy, and room parity matrix', () => {
    const actual = catalog.routes.values.flatMap((route) =>
      route.biomeKeys.map((biomeKey, routeIndex) => {
        const biome = catalog.biomes.byKey[biomeKey];
        const layout = catalog.biomeLayouts.byKey[biomeKey];
        if (biome === undefined || layout === undefined) {
          throw new Error(`missing ${biomeKey} biome closure fixture`);
        }
        const rooms = catalog.rooms.values.filter((room) => room.biomeKey === biomeKey);
        const linear = layout.kind === 'LinearBiome' ? layout : undefined;

        return {
          routeKey: route.key,
          routeIndex,
          biomeKey,
          label: biome.label,
          layoutKind: layout.kind,
          roomCount: rooms.length,
          authoredRoomCount: rooms.filter((room) => room.mode.kind === 'authored').length,
          progressionKind: linear?.continuation.progressionPolicy.kind ?? null,
          batchKind: linear?.continuation.batchPolicy.kind ?? null,
          rewardStoreKind:
            layout.kind === 'LinearBiome'
              ? layout.continuation.rewardStorePolicy.kind
              : layout.hub.rewardStorePolicy.kind,
          rewardStoreOverrides:
            linear?.continuation.rewardStoreOverrides.map((override) => override.policy.kind) ?? [],
          terminalKind: layout.terminal.kind,
          completionRoomGameNames: layout.completion.rooms.map((room) => room.roomGameName),
          nextBiomeKey: route.biomeKeys[routeIndex + 1] ?? null,
        };
      }),
    );

    expect(actual).toEqual(expectedClosureMatrix);
    expect(new Set(actual.map((entry) => entry.biomeKey)).size).toBe(8);
    expect(actual).toHaveLength(catalog.biomes.values.length);
    expect(catalog.biomeLayouts.values).toHaveLength(catalog.biomes.values.length);
  });

  it('keeps completion ownership biome-local and route transitions route-owned', () => {
    for (const expected of expectedClosureMatrix) {
      const layout = catalog.biomeLayouts.byKey[expected.biomeKey];
      if (layout === undefined) {
        throw new Error(`missing ${expected.biomeKey} layout`);
      }
      for (const completion of layout.completion.rooms) {
        const room = catalog.rooms.byKey[completion.roomGameName];
        expect(room?.biomeKey).toBe(expected.biomeKey);
        expect(room?.mode).toEqual({ kind: 'derived', classification: 'completion' });
        expect(room?.kind).toBe(completion.role === 'boss' ? 'Boss' : 'PostBoss');
      }
      expect(layout.completion.transitionEffects).toEqual([
        { kind: 'resetCounter', axis: 'biomeDepthCache' },
        { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
      ]);
    }

    expect(JSON.stringify(catalog.biomeLayouts.values)).not.toContain('nextBiomeKey');
    expect(JSON.stringify(catalog.biomeLayouts.values)).not.toContain('routeKey');
  });

  it('closes every normalized room reference inside the eight-biome catalog', () => {
    for (const room of catalog.rooms.values) {
      expect(catalog.biomes.byKey[room.biomeKey]).toBeDefined();
      expect(catalog.biomeLayouts.byKey[room.biomeKey]).toBeDefined();
      expect(catalog.encounterProfiles.byKey[room.encounterProfileKey]).toBeDefined();
      for (const exit of room.exits) {
        expect(catalog.exitTypes.byKey[exit.type]).toBeDefined();
        expect(catalog.exitCompatibilityPolicies.byKey[exit.compatibilityPolicyKey]).toBeDefined();
      }
      for (const child of room.localChildren) {
        if (child.kind !== 'fixedRoomSlots') {
          continue;
        }
        for (const slot of child.slots) {
          const childRoom = catalog.rooms.byKey[slot.roomGameName];
          expect(childRoom?.biomeKey).toBe(room.biomeKey);
          expect(childRoom?.mode.kind).toBe('authored');
        }
      }
    }
  });
});
