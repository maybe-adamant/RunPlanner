import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceId,
  createProjectDocument,
  decodeProjectDocument,
  encodeProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';

function encodedFStart(): Record<string, unknown> {
  const biome = createBiomeAddress('Underworld', 'F');
  const project = applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'codec-f',
      configuredBiomeCounts: { Underworld: 1 },
    }),
    catalog,
    {
      kind: 'CreateStart',
      biome,
      occurrenceId: createOccurrenceId('codec-f-start'),
      gameName: 'F_Opening01',
    },
  );
  return JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
}

function fTopology(document: Record<string, unknown>): Record<string, unknown> {
  const routes = document.routes as Array<Record<string, unknown>>;
  const underworld = routes.find((route) => route.routeKey === 'Underworld');
  const biome = (underworld?.biomes as Array<Record<string, unknown>> | undefined)?.[0];
  const topology = biome?.topology;
  if (topology === null || topology === undefined || typeof topology !== 'object') {
    throw new Error('missing encoded F topology');
  }
  return topology as Record<string, unknown>;
}

function firstOccurrence(document: Record<string, unknown>): Record<string, unknown> {
  const occurrence = (fTopology(document).occurrences as Array<Record<string, unknown>>)[0];
  if (occurrence === undefined) throw new Error('missing encoded F occurrence');
  return occurrence;
}

function completionOccurrence(
  document: Record<string, unknown>,
  role: 'boss' | 'postboss',
): Record<string, unknown> {
  const routes = document.routes as Array<Record<string, unknown>>;
  const underworld = routes.find((route) => route.routeKey === 'Underworld');
  const biome = (underworld?.biomes as Array<Record<string, unknown>> | undefined)?.[0];
  const occurrence = (
    biome?.completionOccurrences as Array<Record<string, unknown>> | undefined
  )?.find((candidate) => candidate.occurrenceId === `completion:F:${role}`);
  if (occurrence === undefined) throw new Error(`missing encoded F ${role} completion occurrence`);
  return occurrence;
}

const roomActionReferences: readonly RoomActionReference[] = [
  { kind: 'completeFieldsCage', phaseKey: 'wave1' },
  { kind: 'interactIncomingReward', producerPoint: 'beforeCombat', acquisitionRole: 'source' },
  { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
  { kind: 'chooseRewardWheel', wheelKey: 'wheel1' },
  { kind: 'interactWheelReward', wheelKey: 'wheel1' },
  { kind: 'interactShopOffer', offerKey: 'Major' },
  { kind: 'interactEncounter', phaseKey: 'main' },
  { kind: 'interactGorgon', phaseKey: 'main' },
  { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: 'pickup1' },
];

function replaceTopology(
  document: Record<string, unknown>,
  replacement: Record<string, unknown>,
): Record<string, unknown> {
  const routes = document.routes as Array<Record<string, unknown>>;
  return {
    routes: routes.map((route, index) =>
      index === 0
        ? {
            ...route,
            biomes: (route.biomes as Array<Record<string, unknown>>).map((biome, biomeIndex) =>
              biomeIndex === 0
                ? { ...biome, topology: { ...fTopology(document), ...replacement } }
                : biome,
            ),
          }
        : route,
    ),
  };
}

const codecRejections: readonly {
  readonly name: string;
  readonly mutate: (document: Record<string, unknown>) => unknown;
}[] = [
  { name: 'a null root', mutate: () => null },
  { name: 'an array root', mutate: () => [] },
  { name: 'a schema-47 document', mutate: (document) => ({ ...document, schemaVersion: 47 }) },
  { name: 'a blank project ID', mutate: (document) => ({ ...document, projectId: ' ' }) },
  { name: 'a legacy project name', mutate: (document) => ({ ...document, name: 'Legacy' }) },
  {
    name: 'an incompatible catalog version',
    mutate: (document) => ({ ...document, catalogVersion: 'incompatible' }),
  },
  { name: 'an undeclared root field', mutate: (document) => ({ ...document, extra: true }) },
  { name: 'a missing required route', mutate: (document) => ({ ...document, routes: [] }) },
  {
    name: 'a duplicate route',
    mutate: (document) => ({
      ...document,
      routes: [...(document.routes as unknown[]), (document.routes as unknown[])[0]],
    }),
  },
  {
    name: 'an unknown route',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0 ? { ...route, routeKey: 'Missing' } : route,
      ),
    }),
  },
  {
    name: 'a route without biomes',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0 ? { routeKey: route.routeKey } : route,
      ),
    }),
  },
  {
    name: 'a noncontiguous biome identity',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0
          ? {
              ...route,
              biomes: [{ ...(route.biomes as Record<string, unknown>[])[0], biomeKey: 'G' }],
            }
          : route,
      ),
    }),
  },
  {
    name: 'unknown biome state data',
    mutate: (document) => ({
      ...document,
      routes: (document.routes as Array<Record<string, unknown>>).map((route, index) =>
        index === 0
          ? {
              ...route,
              biomes: [
                { ...(route.biomes as Record<string, unknown>[])[0], state: { unknown: true } },
              ],
            }
          : route,
      ),
    }),
  },
  {
    name: 'a missing topology start occurrence',
    mutate: (document) => ({
      ...document,
      ...replaceTopology(document, { startOccurrenceId: 'missing' }),
    }),
  },
  {
    name: 'an unknown topology room declaration',
    mutate: (document) => ({
      ...document,
      ...replaceTopology(document, {
        occurrences: [
          {
            ...(fTopology(document).occurrences as Record<string, unknown>[])[0],
            gameName: 'Missing',
          },
        ],
      }),
    }),
  },
  {
    name: 'a duplicated topology occurrence ID',
    mutate: (document) => {
      const occurrence = (fTopology(document).occurrences as Record<string, unknown>[])[0];
      return {
        ...document,
        ...replaceTopology(document, { occurrences: [occurrence, occurrence] }),
      };
    },
  },
];

describe('project document codec', () => {
  it('round-trips the exact closed room-action reference union', () => {
    const encoded = encodedFStart();
    firstOccurrence(encoded).roomActions = { order: roomActionReferences };

    const decoded = decodeProjectDocument(encoded, catalog);
    expect(decoded.routes[0]?.biomes[0]?.topology?.occurrences[0]?.roomActions.order).toEqual(
      roomActionReferences,
    );
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(decoded)), catalog)).toEqual(
      decoded,
    );
  });

  it('requires one strict occurrence-level roomActions object', () => {
    const missing = encodedFStart();
    delete firstOccurrence(missing).roomActions;
    expect(() => decodeProjectDocument(missing, catalog)).toThrow('roomActions');

    const extra = encodedFStart();
    firstOccurrence(extra).roomActions = { order: [], extra: true };
    expect(() => decodeProjectDocument(extra, catalog)).toThrow(
      'roomActions.extra: is not a project document field',
    );
  });

  it('rejects unknown, malformed, and duplicate room-action references', () => {
    const unknown = encodedFStart();
    firstOccurrence(unknown).roomActions = { order: [{ kind: 'unknown' }] };
    expect(() => decodeProjectDocument(unknown, catalog)).toThrow('unknown room action unknown');

    const malformed = encodedFStart();
    firstOccurrence(malformed).roomActions = {
      order: [{ kind: 'interactEncounter', phaseKey: ' ' }],
    };
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow('phaseKey');

    const duplicate = encodedFStart();
    firstOccurrence(duplicate).roomActions = {
      order: [roomActionReferences[0], roomActionReferences[0]],
    };
    expect(() => decodeProjectDocument(duplicate, catalog)).toThrow('duplicates room action');
  });

  it('round-trips a canonical dormant Boss Judgment Arcana set on its phase', () => {
    const encoded = encodedFStart();
    const boss = completionOccurrence(encoded, 'boss');
    boss.encounters = {
      ...(boss.encounters as Record<string, unknown>),
      judgmentArcanaKeysByPhase: { Encounter: ['CardDraw', 'CastCount'] },
    };

    const decoded = decodeProjectDocument(encoded, catalog);
    expect(
      decoded.routes[0]?.biomes[0]?.completionOccurrences[0]?.encounters.judgmentArcanaKeysByPhase
        ?.Encounter,
    ).toEqual(['CastCount', 'CardDraw']);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(decoded)), catalog)).toEqual(
      decoded,
    );
  });

  it.each([
    ['unknown', ['MissingArcana']],
    ['duplicate', ['CardDraw', 'CardDraw']],
  ] as const)('rejects an %s Boss Judgment Arcana set', (_name, arcanaKeys) => {
    const encoded = encodedFStart();
    const boss = completionOccurrence(encoded, 'boss');
    boss.encounters = {
      ...(boss.encounters as Record<string, unknown>),
      judgmentArcanaKeysByPhase: { Encounter: arcanaKeys },
    };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow();
  });

  it('strictly validates automatic occurrence identity, action domain, acquisition sites, and topology collision', () => {
    const wrongId = encodedFStart();
    completionOccurrence(wrongId, 'boss').occurrenceId = 'ordinary-id';
    expect(() => decodeProjectDocument(wrongId, catalog)).toThrow('fixed completion occurrence id');

    const invalidAction = encodedFStart();
    completionOccurrence(invalidAction, 'postboss').roomActions = {
      order: [{ kind: 'interactShopOffer', offerKey: 'Boon' }],
    };
    expect(() => decodeProjectDocument(invalidAction, catalog)).toThrow('inactive room action');

    const missingFountain = encodedFStart();
    completionOccurrence(missingFountain, 'postboss').roomActions = { order: [] };
    expect(() => decodeProjectDocument(missingFountain, catalog)).toThrow('required useFountain');

    const collision = encodedFStart();
    (fTopology(collision).occurrences as Array<Record<string, unknown>>)[0]!.occurrenceId =
      'completion:F:boss';
    fTopology(collision).startOccurrenceId = 'completion:F:boss';
    expect(() => decodeProjectDocument(collision, catalog)).toThrow(
      'collides with editable topology',
    );

    const acquisition = encodedFStart();
    completionOccurrence(acquisition, 'boss').acquisitionSites = {
      roomExit: { pickupEntries: {} },
    };
    expect(() => decodeProjectDocument(acquisition, catalog)).toThrow(
      'has no selected pickup producer',
    );
  });

  it('round-trips the complete Arcana and Fear loadout', () => {
    const encoded = encodedFStart();
    const routes = encoded.routes as Array<Record<string, unknown>>;
    const first = routes[0]!;
    const loadout = first.loadout as Record<string, unknown>;
    loadout.manualArcanaKeys = ['CastCount', 'ChanneledCast'];
    loadout.fearRanks = {
      ...(loadout.fearRanks as Record<string, number>),
      EnemyDamageShrineUpgrade: 3,
    };

    const decoded = decodeProjectDocument(encoded, catalog);
    expect(decoded.routes[0]?.loadout).toMatchObject({
      manualArcanaKeys: ['ChanneledCast', 'CastCount'],
      fearRanks: { EnemyDamageShrineUpgrade: 3 },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(decoded)), catalog)).toEqual(
      decoded,
    );
  });

  it.each([
    [
      'the base 30-Grasp capacity',
      [
        'ManaOverTime',
        'StatusVulnerability',
        'StartingGold',
        'RarityBoost',
        'LastStand',
        'ScreenReroll',
        'LowManaDamageBonus',
        'HealthRegen',
      ],
      0,
      30,
    ],
    [
      'the configured Vow of Void capacity',
      ['ManaOverTime', 'StatusVulnerability', 'StartingGold', 'CastCount'],
      2,
      12,
    ],
  ] as const)('rejects a starting Arcana selection above %s', (_name, keys, voidRank, capacity) => {
    const encoded = encodedFStart();
    const route = (encoded.routes as Array<Record<string, unknown>>)[0]!;
    const loadout = route.loadout as Record<string, unknown>;
    loadout.manualArcanaKeys = keys;
    loadout.fearRanks = {
      ...(loadout.fearRanks as Record<string, number>),
      LimitGraspShrineUpgrade: voidRank,
    };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      `exceeds starting Grasp capacity ${capacity}`,
    );
  });

  it.each([
    [
      'an automatic manual Arcana entry',
      (loadout: Record<string, unknown>) => {
        loadout.manualArcanaKeys = ['CardDraw'];
      },
    ],
    [
      'a duplicate manual Arcana entry',
      (loadout: Record<string, unknown>) => {
        loadout.manualArcanaKeys = ['ChanneledCast', 'ChanneledCast'];
      },
    ],
    [
      'an out-of-range Fear rank',
      (loadout: Record<string, unknown>) => {
        loadout.fearRanks = {
          ...(loadout.fearRanks as Record<string, number>),
          BossDifficultyShrineUpgrade: 5,
        };
      },
    ],
    [
      'a missing Fear rank',
      (loadout: Record<string, unknown>) => {
        const fearRanks = { ...(loadout.fearRanks as Record<string, number>) };
        delete fearRanks.BossDifficultyShrineUpgrade;
        loadout.fearRanks = fearRanks;
      },
    ],
  ] as const)('rejects %s', (_name, mutate) => {
    const encoded = encodedFStart();
    const route = (encoded.routes as Array<Record<string, unknown>>)[0]!;
    mutate(route.loadout as Record<string, unknown>);
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow();
  });

  it.each(codecRejections)('rejects %s', ({ mutate }) => {
    expect(() => decodeProjectDocument(mutate(encodedFStart()), catalog)).toThrow();
  });
});
