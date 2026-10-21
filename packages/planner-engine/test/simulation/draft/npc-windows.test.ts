import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { draftProject, simulateProjectAssembly, type DraftSpec } from '../../../src/simulation';
import { draftAttemptScore } from '../../../src/simulation/draft/generator';
import { draftNpcHostConditions, draftNpcHosts } from '../../../src/simulation/draft/npc-windows';
import type { ProjectEvaluationAssembly } from '../../../src/simulation/evaluation/evaluation-products';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;

const definition = (key: string) => catalog.encounterDefinitions.byKey[key]!;

describe('draftNpcHostConditions', () => {
  it('reads reward exclusions, the depth window, the gap and once per route', () => {
    const conditions = draftNpcHostConditions(definition('ArtemisCombatN'), 'Surface')!;
    expect(conditions.routeAllowed).toBe(true);
    expect(conditions.excludedRewardTypes).toEqual(
      expect.arrayContaining(['Boon', 'SpellDrop', 'Devotion', 'HermesUpgrade', 'WeaponUpgrade']),
    );
    expect(conditions.minimums).toEqual([{ axis: 'biomeDepthCache', min: 4 }]);
    expect(conditions.onceKeys).toContain('ArtemisCombatF');
    expect(conditions.gaps).toEqual([
      expect.objectContaining({
        roomWindow: 6,
        encounterKeys: expect.arrayContaining(['HeraclesCombatN']),
      }),
    ]);
  });

  it('reads structural tags and the route key', () => {
    expect(draftNpcHostConditions(definition('HeraclesCombatP'), 'Surface')!.requiredTags).toEqual([
      'Indoor',
    ]);
    expect(draftNpcHostConditions(definition('IcarusCombatP'), 'Surface')!.requiredTags).toEqual([
      'Outdoor',
    ]);
    expect(draftNpcHostConditions(definition('NemesisRandomEvent'), 'Dream')!.routeAllowed).toBe(
      false,
    );
    expect(draftNpcHostConditions(definition('NemesisCombatF'), 'FreshFile')!.routeAllowed).toBe(
      false,
    );
  });

  it('declines a requirement shape it cannot steer toward', () => {
    const artemis = definition('ArtemisCombatF');
    expect(
      draftNpcHostConditions(
        {
          ...artemis,
          requirements: { kind: 'any', requirements: [artemis.requirements!] },
        },
        'Underworld',
      ),
    ).toBeUndefined();
  });
});

describe('draftNpcHosts', () => {
  it('never steers toward an NPC its route excludes', () => {
    expect(draftNpcHosts(catalog, 'FreshFile', { F: ['Nemesis'] }).get('F')).toEqual([]);
    expect(
      draftNpcHosts(catalog, 'Underworld', { F: ['Nemesis'] })
        .get('F')!
        .map((host) => host.conditions.encounterKey),
    ).toEqual(['NemesisCombatF']);
  });

  it('hosts an indoor-only NPC only in indoor rooms', () => {
    const [host] = draftNpcHosts(catalog, 'Surface', { P: ['Heracles'] }).get('P')!;
    expect(host!.hostRooms.size).toBeGreaterThan(0);
    for (const gameName of host!.hostRooms)
      expect(catalog.rooms.byKey[gameName]!.structuralTags).toContain('Indoor');
  });
});

const surfaceN = createProjectDocument(catalog, {
  projectId: 'n',
  routeKey: 'Surface',
  configuredBiomeCount: 1,
});

/** A drafted Ephyra, with the generator's attempts. */
function draftN(fieldNpcs: readonly string[], seed: number): ProjectEvaluationAssembly {
  const spec: DraftSpec = {
    loadout,
    world: {
      godKeys: ['Zeus', 'Hera', 'Demeter', 'Ares'],
      storyNpcByBiome: { N: 'Medea' },
      fieldNpcsByBiome: { N: fieldNpcs },
    },
    basketTraitKeys: ['HeraCastBoon'],
    rackKeepsakeKeys: [null, null, null],
  };
  const result = draftProject(catalog, surfaceN, spec, seed);
  if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
  return simulateProjectAssembly(catalog, result.project);
}

/** N's field NPC encounters in visit order, with the rooms entered before each. */
function npcRecords(assembly: ProjectEvaluationAssembly) {
  const biome = assembly.evaluation.route.biomes[0]!;
  if (!('history' in biome)) throw new Error('N has no history');
  const { encounterRecords, roomAppearances } = biome.history.ledgers;
  return encounterRecords
    .filter((record) => catalog.fieldNpcEncounterKeys.includes(record.encounterKey))
    .map((record) => ({
      encounterKey: record.encounterKey,
      roomsBefore: roomAppearances.filter((room) => room.sequence < record.sequence).length,
    }));
}

describe('NPC windows in the draft walk', () => {
  it('meets Artemis in Ephyra', () => {
    for (const seed of [1, 2])
      expect(npcRecords(draftN(['Artemis'], seed)).map((r) => r.encounterKey)).toEqual([
        'ArtemisCombatN',
      ]);
  });

  it('keeps the gap between two NPCs selected in one biome', () => {
    const assembly = draftN(['Artemis', 'Heracles'], 1);
    expect(assembly.evaluation.findings).toEqual([]);
    const records = npcRecords(assembly);
    expect(records.map((r) => r.encounterKey).sort()).toEqual([
      'ArtemisCombatN',
      'HeraclesCombatN',
    ]);
    for (const [index, record] of records.entries())
      if (index > 0)
        expect(record.roomsBefore - records[index - 1]!.roomsBefore).toBeGreaterThanOrEqual(6);
  });

  it('scores a met NPC above an extra trait', () => {
    const report = (npcMet: boolean, traits: number) => ({
      targets: [
        { kind: 'fieldNpc' as const, key: 'Artemis', biomeKey: 'N', met: npcMet },
        ...Array.from({ length: 2 }, (_, i) => ({
          kind: 'basketTrait' as const,
          key: `T${i}`,
          met: i < traits,
        })),
      ],
      extras: [],
      met: 0,
    });
    const scheduled = (traits: number) => Array.from({ length: traits }, () => ({ met: true }));
    expect(draftAttemptScore(report(true, 1), scheduled(1), 0)).toBeGreaterThan(
      draftAttemptScore(report(false, 2), scheduled(2), 0),
    );
  });
});
