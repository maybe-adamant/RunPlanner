import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';
import { describe, expect, it } from 'vitest';

const anomalyRoomGameNames = [
  'B_Combat01',
  'B_Combat05',
  'B_Combat06',
  'B_Combat07',
  'B_Combat08',
  'B_Combat10',
  'B_Combat21',
] as const;

const anomalyTargets = Array.from(
  { length: 20 },
  (_, index) => `G_Combat${String(index + 1).padStart(2, '0')}`,
);

const zagreusSources = [
  ['F_Shop01', ['ErebusExitDoor', 'ErebusExitDoor']],
  ['G_Shop01', ['OceanusExitDoor', 'OceanusExitDoor']],
  ['O_Shop01', ['ShipsExitDoor']],
  ['P_Shop01', ['OlympusIndoorExitDoor', 'OlympusOutdoorExitDoor']],
] as const;

const naturalChaosSources = [
  'N_Opening01',
  'F_Opening01',
  'F_Opening02',
  'F_Opening03',
  'F_Combat01',
  'F_Combat02',
  'F_Combat03',
  'F_Combat04',
  'F_Combat05',
  'F_Combat06',
  'F_Combat07',
  'F_Combat08',
  'F_Combat09',
  'F_Combat10',
  'F_Combat11',
  'F_Combat12',
  'F_Combat13',
  'F_Combat14',
  'F_Combat15',
  'F_Combat16',
  'F_Combat17',
  'F_Combat18',
  'F_Combat19',
  'F_Combat20',
  'F_Combat21',
  'F_Combat22',
  'F_Story01',
  'F_Reprieve01',
  'F_Shop01',
  'G_Intro',
  'G_Combat01',
  'G_Combat02',
  'G_Combat03',
  'G_Combat04',
  'G_Combat05',
  'G_Combat06',
  'G_Combat07',
  'G_Combat08',
  'G_Combat09',
  'G_Combat10',
  'G_Combat11',
  'G_Combat12',
  'G_Combat13',
  'G_Combat14',
  'G_Combat15',
  'G_Combat16',
  'G_Combat17',
  'G_Combat18',
  'G_Combat19',
  'G_Combat20',
  'G_MiniBoss01',
  'G_MiniBoss02',
  'G_MiniBoss03',
  'G_Story01',
  'G_Reprieve01',
  'G_Shop01',
  'P_Intro',
  'P_Combat01',
  'P_Combat02',
  'P_Combat03',
  'P_Combat04',
  'P_Combat05',
  'P_Combat06',
  'P_Combat07',
  'P_Combat08',
  'P_Combat09',
  'P_Combat10',
  'P_Combat11',
  'P_Combat12',
  'P_Combat13',
  'P_Combat14',
  'P_Combat15',
  'P_Combat16',
  'P_Combat17',
  'P_Combat18',
  'P_Combat19',
  'P_Reprieve01',
  'P_Shop01',
] as const;

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

function roomIndex(raw: RawCatalogInput, gameName: string): number {
  const index = raw.rooms.findIndex((room) => room.gameName === gameName);
  if (index < 0) throw new Error(`missing ${gameName} declaration`);
  return index;
}

function layoutIndex(raw: RawCatalogInput, biomeKey: string): number {
  const index = raw.biomeLayouts.findIndex((layout) => layout.biomeKey === biomeKey);
  if (index < 0) throw new Error(`missing ${biomeKey} layout declaration`);
  return index;
}

function gAnomalyDeclaration(raw: RawCatalogInput) {
  const index = layoutIndex(raw, 'G');
  const layout = raw.biomeLayouts[index];
  if (
    layout?.progression.kind !== 'generated' ||
    layout.progression.anomalyReplacement === undefined
  ) {
    throw new Error('G Anomaly replacement declaration is missing');
  }
  return layout.progression.anomalyReplacement;
}

describe('route detour catalog declarations', () => {
  it('keeps detour room-set identity separate from the supported route layouts', () => {
    const catalog = createCatalog(declarations);

    expect(catalog.version).toBe('0.17.0-natural-chaos');
    expect(catalog.biomes.values.map((biome) => biome.key)).not.toContain('Anomaly');
    expect(catalog.biomes.values.map((biome) => biome.key)).not.toContain('C');
    expect(catalog.biomeLayouts.values.map((layout) => layout.biomeKey)).not.toContain('Anomaly');
    expect(catalog.biomeLayouts.values.map((layout) => layout.biomeKey)).not.toContain('C');
    expect(
      catalog.rooms.values
        .filter((room) => room.roomSetKey === 'Anomaly')
        .map((room) => room.gameName),
    ).toEqual(anomalyRoomGameNames);

    for (const gameName of anomalyRoomGameNames) {
      expect(catalog.rooms.byKey[gameName]).toMatchObject({
        roomSetKey: 'Anomaly',
        kind: 'Combat',
        mode: { kind: 'authored', templateKey: 'Anomaly' },
        incomingReward: {
          kind: 'countedChoice',
          ineligibleRewardTypes: ['Devotion', 'SpellDrop'],
        },
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        exits: [
          {
            type: 'AnomalyAutoExitDoor',
            behavior: { kind: 'automaticHostContinuation', rewardPreview: 'hidden' },
          },
        ],
        additionalExits: [],
        encounterSlotBindings: [
          {
            slotKey: 'Encounter',
            kind: 'fixed',
            encounterDefinitionKey: 'GeneratedAnomalyB',
          },
        ],
      });
    }

    expect(catalog.rooms.byKey.C_Boss01).toMatchObject({
      roomSetKey: 'C',
      kind: 'Boss',
      mode: { kind: 'authored', templateKey: 'ContractBoss' },
      incomingReward: {
        kind: 'fixed',
        offer: { rewardType: 'InfernalContractBoon' },
      },
      enteredRewardStoreHistory: { kind: 'none' },
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      exits: [
        {
          type: 'AnomalyAutoExitDoor',
          behavior: { kind: 'automaticHostContinuation', rewardPreview: 'hidden' },
        },
      ],
      additionalExits: [],
      encounterSlotBindings: [
        {
          slotKey: 'Encounter',
          kind: 'fixed',
          encounterDefinitionKey: 'BossZagreus01',
        },
      ],
    });
    expect(catalog.encounterDefinitions.byKey.GeneratedAnomalyB).toMatchObject({
      countsEncounterDepth: true,
    });
    expect(catalog.encounterDefinitions.byKey.BossZagreus01).toMatchObject({
      countsEncounterDepth: false,
    });
    expect(catalog.rewards.rewardTypes.byKey.InfernalContractBoon).toMatchObject({
      label: 'Infernal Contract',
    });
    expect(catalog.rewards.acquisitions.byKey.InfernalContractBoon).toMatchObject({
      kind: 'loot',
      historyProjection: 'lootAndUse',
    });
    expect(catalog.rewards.rewardTypes.byKey).not.toHaveProperty('GemPointsBigDrop');
  });

  it('normalizes the complete closed Oceanus Anomaly replacement matrix', () => {
    const catalog = createCatalog(declarations);
    const g = catalog.biomeLayouts.byKey.G;
    if (g?.progression.kind !== 'generated') throw new Error('G generated progression is missing');

    expect(g.progression.anomalyReplacement).toEqual({
      kind: 'oceanusAnomaly',
      source: {
        minimumBiomeDepthCache: 3,
        excludedRoomGameNames: ['G_Shop01', 'G_Story01', 'G_PreBoss01', 'C_Boss01'],
        excludedSourceEncounterGameNames: ['ArtemisCombatG', 'NemesisRandomEvent'],
        maxEnteredReplacementsThisRoute: 0,
      },
      replaceableTargetRoomGameNames: anomalyTargets,
      replacementRoomGameNames: anomalyRoomGameNames,
      defaultReplacementRoomGameName: 'B_Combat01',
    });

    for (const layout of catalog.biomeLayouts.values) {
      if (layout.biomeKey === 'G' || layout.progression.kind !== 'generated') continue;
      expect(layout.progression.anomalyReplacement).toBeUndefined();
    }
  });

  it('normalizes the closed Zagreus contracts on the four Midshops', () => {
    const catalog = createCatalog(declarations);
    const sources = catalog.rooms.values.filter((room) =>
      room.additionalExits.some((exit) => exit.kind === 'zagreusContract'),
    );

    expect(sources.map((room) => room.gameName).sort()).toEqual(
      zagreusSources.map(([gameName]) => gameName).sort(),
    );
    for (const [gameName, normalExitTypes] of zagreusSources) {
      const source = catalog.rooms.byKey[gameName];
      expect(source?.exits.map((exit) => exit.type)).toEqual(normalExitTypes);
      expect(source?.exits.map((exit) => exit.behavior)).toEqual(
        normalExitTypes.map(() => ({ kind: 'playerSelected', rewardPreview: 'visible' })),
      );
      expect(source?.additionalExits.find((exit) => exit.kind === 'zagreusContract')).toEqual(
        {
          kind: 'zagreusContract',
          key: 'zagreusContract',
          physicalExit: {
            type: 'ZagContract',
            compatibilityPolicyKey: 'Unconstrained',
            behavior: { kind: 'playerSelected', rewardPreview: 'hidden' },
          },
          targetRoomGameName: 'C_Boss01',
          maxEnteredThisRoute: 0,
        },
      );
    }
  });

  it('rejects malformed room-set identity and automatic continuation declarations', () => {
    const unknownRoomSet = input();
    const cBossIndex = roomIndex(unknownRoomSet, 'C_Boss01');
    (unknownRoomSet.rooms[cBossIndex] as { roomSetKey: string }).roomSetKey = 'B';
    expect(() => createCatalog(unknownRoomSet)).toThrow(
      new CatalogContractError(`rooms[${cBossIndex}].roomSetKey`, 'unknown room set B'),
    );

    const misplacedAnomaly = input();
    const anomalyRoomIndex = roomIndex(misplacedAnomaly, 'B_Combat01');
    (misplacedAnomaly.rooms[anomalyRoomIndex] as { roomSetKey: string }).roomSetKey = 'G';
    expect(() => createCatalog(misplacedAnomaly)).toThrow(
      new CatalogContractError(
        `rooms[${anomalyRoomIndex}].roomSetKey`,
        'Anomaly template requires the Anomaly room set',
      ),
    );

    const misplacedContractBoss = input();
    const contractBossIndex = roomIndex(misplacedContractBoss, 'C_Boss01');
    (misplacedContractBoss.rooms[contractBossIndex] as { roomSetKey: string }).roomSetKey = 'F';
    expect(() => createCatalog(misplacedContractBoss)).toThrow(
      new CatalogContractError(
        `rooms[${contractBossIndex}].roomSetKey`,
        'ContractBoss template requires the C room set',
      ),
    );

    const nonAutomaticAnomaly = input();
    const anomalyIndex = roomIndex(nonAutomaticAnomaly, 'B_Combat01');
    (
      nonAutomaticAnomaly.rooms[anomalyIndex] as unknown as {
        exits: { index: number; type: string }[];
      }
    ).exits = [{ index: 1, type: 'OceanusExitDoor' }];
    expect(() => createCatalog(nonAutomaticAnomaly)).toThrow(
      new CatalogContractError(
        `rooms[${anomalyIndex}].exits`,
        'B_Combat01 must declare exactly one automatic host continuation',
      ),
    );

    const visibleAutomaticDoor = input();
    const autoExitIndex = visibleAutomaticDoor.exitTypes.findIndex(
      (exit) => exit.key === 'AnomalyAutoExitDoor',
    );
    if (autoExitIndex < 0) throw new Error('Anomaly automatic exit type is missing');
    (
      visibleAutomaticDoor.exitTypes[autoExitIndex] as {
        behavior: { kind: string; rewardPreview: string };
      }
    ).behavior = { kind: 'automaticHostContinuation', rewardPreview: 'visible' };
    expect(() => createCatalog(visibleAutomaticDoor)).toThrow(
      new CatalogContractError(
        `exitTypes[${autoExitIndex}].behavior.rewardPreview`,
        'automatic host continuations must hide reward preview',
      ),
    );
  });

  it('normalizes the exact natural Chaos source and host-map matrices', () => {
    const catalog = createCatalog(declarations);
    const sources = catalog.rooms.values
      .filter((room) => room.additionalExits.some((exit) => exit.kind === 'naturalChaos'))
      .map((room) => room.gameName)
      .sort();

    expect(sources).toEqual([...naturalChaosSources].sort());
    for (const gameName of naturalChaosSources) {
      expect(
        catalog.rooms.byKey[gameName]?.additionalExits.find(
          (exit) => exit.kind === 'naturalChaos',
        ),
      ).toMatchObject({
        kind: 'naturalChaos',
        key: 'naturalChaos',
        physicalExit: {
          type: 'ChaosExitDoor',
          compatibilityPolicyKey: 'Unconstrained',
          behavior: { kind: 'playerSelected', rewardPreview: 'visible' },
        },
      });
    }
    expect(catalog.biomeLayouts.byKey.F?.naturalChaos).toEqual({
      roomGameNames: ['Chaos_01', 'Chaos_02', 'Chaos_03', 'Chaos_04', 'Chaos_05', 'Chaos_06'],
      defaultRoomGameName: 'Chaos_01',
      offerSpacingWindow: 10,
    });
    expect(catalog.biomeLayouts.byKey.G?.naturalChaos).toEqual(
      catalog.biomeLayouts.byKey.F?.naturalChaos,
    );
    expect(catalog.biomeLayouts.byKey.N?.naturalChaos).toEqual({
      roomGameNames: ['Chaos_03', 'Chaos_06'],
      defaultRoomGameName: 'Chaos_03',
      offerSpacingWindow: 10,
    });
    expect(catalog.biomeLayouts.byKey.P?.naturalChaos).toEqual(
      catalog.biomeLayouts.byKey.F?.naturalChaos,
    );
    for (const gameName of ['Chaos_01', 'Chaos_02', 'Chaos_03', 'Chaos_04', 'Chaos_05', 'Chaos_06']) {
      expect(catalog.rooms.byKey[gameName]).toMatchObject({
        roomSetKey: 'Chaos',
        mode: { kind: 'authored', templateKey: 'Chaos' },
        exits: [
          {
            type: 'ChaosReturnExitDoor',
            behavior: { kind: 'playerSelected', rewardPreview: 'visible' },
          },
        ],
        incomingReward: { kind: 'fixed', offer: { rewardType: 'TrialUpgrade' } },
      });
    }
    expect(
      catalog.rooms.byKey.P_Intro?.additionalExits.find((exit) => exit.kind === 'naturalChaos'),
    ).toMatchObject({
      requirement: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { max: 5 },
      },
    });
  });

  it('rejects malformed Anomaly declaration structure and references', () => {
    const duplicateSourceEncounter = input();
    (
      gAnomalyDeclaration(duplicateSourceEncounter).source as unknown as {
        excludedSourceEncounterGameNames: string[];
      }
    ).excludedSourceEncounterGameNames = ['ArtemisCombatG', 'ArtemisCombatG'];
    expect(() => createCatalog(duplicateSourceEncounter)).toThrow(
      new CatalogContractError(
        `biomeLayouts[${layoutIndex(duplicateSourceEncounter, 'G')}].progression.anomalyReplacement.source.excludedSourceEncounterGameNames[1]`,
        'duplicates ArtemisCombatG',
      ),
    );

    const defaultOutsideReplacementDomain = input();
    (
      gAnomalyDeclaration(defaultOutsideReplacementDomain) as unknown as {
        defaultReplacementRoomGameName: string;
      }
    ).defaultReplacementRoomGameName = 'NotAReplacement';
    expect(() => createCatalog(defaultOutsideReplacementDomain)).toThrow(
      new CatalogContractError(
        `biomeLayouts[${layoutIndex(defaultOutsideReplacementDomain, 'G')}].progression.anomalyReplacement.defaultReplacementRoomGameName`,
        'must belong to the replacement room domain',
      ),
    );

    const alteredReplacementDomain = input();
    (
      gAnomalyDeclaration(alteredReplacementDomain) as unknown as {
        replacementRoomGameNames: string[];
      }
    ).replacementRoomGameNames = [...anomalyRoomGameNames.slice(0, -1), 'G_Combat20'];
    expect(() => createCatalog(alteredReplacementDomain)).toThrow(
      new CatalogContractError(
        `biomeLayouts[${layoutIndex(alteredReplacementDomain, 'G')}].progression.anomalyReplacement.replacementRoomGameNames[6]`,
        'G_Combat20 must be an authored Anomaly combat room with automatic host return',
      ),
    );
  });

  it('rejects misplaced and retargeted Zagreus contracts', () => {
    const misplaced = input();
    const combatIndex = roomIndex(misplaced, 'F_Combat01');
    (misplaced.rooms[combatIndex] as { additionalExits: unknown }).additionalExits = [
      {
        kind: 'zagreusContract',
        key: 'zagreusContract',
        exitType: 'ZagContract',
        targetRoomGameName: 'C_Boss01',
        maxEnteredThisRoute: 0,
      },
    ];
    expect(() => createCatalog(misplaced)).toThrow(
      new CatalogContractError(
        `rooms[${combatIndex}].additionalExits`,
        'additional Zagreus exits require a Shop room',
      ),
    );

    const retargeted = input();
    const fShopIndex = roomIndex(retargeted, 'F_Shop01');
    (
      retargeted.rooms[fShopIndex] as unknown as {
        additionalExits: { kind: string; targetRoomGameName?: string }[];
      }
    ).additionalExits.find((exit) => exit.kind === 'zagreusContract')!.targetRoomGameName =
      'B_Combat01';
    expect(() => createCatalog(retargeted)).toThrow(
      new CatalogContractError(
        `rooms[${fShopIndex}].additionalExits[1].targetRoomGameName`,
        'Zagreus contract target must be an authored C ContractBoss with automatic host return',
      ),
    );
  });
});
