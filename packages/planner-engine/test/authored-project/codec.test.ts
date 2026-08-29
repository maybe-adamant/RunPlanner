import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  decodeProjectDocument,
  encodeProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import surfaceNResourcesRaw from '../../../../test/fixtures/authored-project/checkpoints/surface-n-resources.runplanner.json';
import naturalChaosRaw from '../../../../test/fixtures/authored-project/checkpoints/natural-chaos-unresolved-trial.runplanner.json';
// The migration CLI is intentionally not a production engine dependency.
// @ts-expect-error test contact imports the schema migration boundary directly.
import { migrateProjectDocument } from '../../../../schema/migrate-project.js';

function encodedFStart(): Record<string, unknown> {
  return JSON.parse(encodeProjectDocument(createCompleteFGProject())) as Record<string, unknown>;
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
  const occurrence = (fTopology(document).occurrences as Array<Record<string, unknown>>).find(
    (candidate) => candidate.gameName === (role === 'boss' ? 'F_Boss01' : 'F_PostBoss01'),
  );
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
      decoded.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.gameName === 'F_Boss01',
      )?.encounters.judgmentArcanaKeysByPhase?.Encounter,
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

  it('strictly validates fixed occurrence identity, action domain, acquisition sites, and topology collision', () => {
    const wrongId = encodedFStart();
    completionOccurrence(wrongId, 'boss').occurrenceId = 'ordinary-id';
    expect(() => decodeProjectDocument(wrongId, catalog)).toThrow(
      'fixedRoomLinks[0]: must reference existing occurrences',
    );

    const collision = encodedFStart();
    (fTopology(collision).occurrences as Array<Record<string, unknown>>)[0]!.occurrenceId =
      'golden-f-preboss-shop:boss';
    expect(() => decodeProjectDocument(collision, catalog)).toThrow(
      'duplicates occurrence golden-f-preboss-shop:boss',
    );

    const acquisition = encodedFStart();
    completionOccurrence(acquisition, 'boss').acquisitionSites = {
      roomExit: { pickupEntries: {} },
    };
    expect(() => decodeProjectDocument(acquisition, catalog)).toThrow(
      'has no selected pickup producer',
    );
  });

  it('requires the selected Preboss fixed completion chain and no arbitrary links', () => {
    const missing = encodedFStart();
    (fTopology(missing).fixedRoomLinks as Array<Record<string, unknown>>).pop();
    expect(() => decodeProjectDocument(missing, catalog)).toThrow(
      'must contain exactly 2 fixed room links for the selected Preboss',
    );

    const extra = encodedFStart();
    const links = fTopology(extra).fixedRoomLinks as Array<Record<string, unknown>>;
    links.push({ ...links[0] });
    expect(() => decodeProjectDocument(extra, catalog)).toThrow('must not repeat fixed room links');

    const wrongChain = encodedFStart();
    const wrongLinks = fTopology(wrongChain).fixedRoomLinks as Array<Record<string, unknown>>;
    wrongLinks[0]!.sourceOccurrenceId = 'golden-f-preboss-free';
    expect(() => decodeProjectDocument(wrongChain, catalog)).toThrow(
      'must match the selected Preboss fixed completion chain',
    );

    const unselected = encodedFStart();
    const prebossDecision = (
      fTopology(unselected).decisions as Array<Record<string, unknown>>
    ).find((decision) =>
      (
        decision.normal as { targets?: Array<{ occurrenceId?: string }> } | undefined
      )?.targets?.some((target) => target.occurrenceId === 'golden-f-preboss-shop'),
    );
    if (prebossDecision === undefined) throw new Error('missing F Preboss decision');
    prebossDecision.selection = { kind: 'unresolved' };
    expect(() => decodeProjectDocument(unselected, catalog)).toThrow(
      'must be empty when no Preboss is selected',
    );
  });

  it('decodes the real Surface resource checkpoint after schema-68 migration', () => {
    const migrated = migrateProjectDocument(surfaceNResourcesRaw).document;
    const surface = migrated.routes.find(
      (route: { routeKey: string }) => route.routeKey === 'Surface',
    );
    expect(surface?.resourcePlacements.Shovel).toEqual({
      biomeKey: 'N',
      occurrenceId: 'surface-n-preboss:postboss',
    });
    expect(() => decodeProjectDocument(migrated, catalog)).not.toThrow();
  });

  it('decodes either schema-70 legacy Chaos kind after unified migration', () => {
    for (const kind of ['naturalChaos', 'sparkChaos']) {
      const legacy = JSON.parse(JSON.stringify(naturalChaosRaw)) as {
        schemaVersion: number;
        catalogVersion: string;
        routes: Array<{
          biomes: Array<{
            topology: {
              occurrences: Array<{
                occurrenceId: string;
                additionalExits: Array<Record<string, unknown>>;
              }>;
              decisions: Array<Record<string, unknown>>;
            };
          }>;
        }>;
      };
      legacy.schemaVersion = 70;
      legacy.catalogVersion = '0.49.0-completion-topology';
      const topology = legacy.routes[0]!.biomes[0]!.topology;
      const opening = topology.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'fixture-chaos-opening',
      );
      if (opening === undefined) throw new Error('legacy Chaos opening is missing');
      const chaos = opening.additionalExits[0];
      if (chaos === undefined) throw new Error('legacy Chaos gate is missing');
      chaos.kind = kind;
      chaos.key = kind;
      const decision = topology.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          (candidate.source as { occurrenceId?: string } | undefined)?.occurrenceId ===
            'fixture-chaos-opening',
      );
      if (decision === undefined) throw new Error('legacy Chaos decision is missing');
      decision.selection = { kind: 'additional', additionalExitKey: kind };

      const migrated = migrateProjectDocument(legacy).document;
      expect(() => decodeProjectDocument(migrated, catalog)).not.toThrow();
    }
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

  it('rejects an Aspect Hex tree on a non-Selene route loadout', () => {
    const encoded = encodedFStart();
    const route = (encoded.routes as Array<Record<string, unknown>>)[0]!;
    (route.loadout as Record<string, unknown>).aspectHexTree = {
      layoutKey: 'Lung',
      rareTalentKeys: ['MoonBeamConsecutiveDamageTalent', 'MoonBeamDefenseTalent'],
      epicTalentKeys: ['MoonBeamTargetTalent'],
    };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'aspectHexTree: is supported only for Aspect of Selene',
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
