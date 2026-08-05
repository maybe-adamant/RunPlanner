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

    expect(catalog.version).toBe('0.16.0-route-detours');
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

  it('normalizes Zagreus as the only closed, hidden additional door on the four Midshops', () => {
    const catalog = createCatalog(declarations);
    const sources = catalog.rooms.values.filter((room) => room.additionalExits.length > 0);

    expect(sources.map((room) => room.gameName).sort()).toEqual(
      zagreusSources.map(([gameName]) => gameName).sort(),
    );
    for (const [gameName, normalExitTypes] of zagreusSources) {
      const source = catalog.rooms.byKey[gameName];
      expect(source?.exits.map((exit) => exit.type)).toEqual(normalExitTypes);
      expect(source?.exits.map((exit) => exit.behavior)).toEqual(
        normalExitTypes.map(() => ({ kind: 'playerSelected', rewardPreview: 'visible' })),
      );
      expect(source?.additionalExits).toEqual([
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
      ]);
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
        additionalExits: { targetRoomGameName: string }[];
      }
    ).additionalExits[0]!.targetRoomGameName = 'B_Combat01';
    expect(() => createCatalog(retargeted)).toThrow(
      new CatalogContractError(
        `rooms[${fShopIndex}].additionalExits[0].targetRoomGameName`,
        'Zagreus contract target must be an authored C ContractBoss with automatic host return',
      ),
    );
  });
});
