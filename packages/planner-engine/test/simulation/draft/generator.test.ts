import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, type ProjectDocument } from '../../../src/authored-project';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { draftProject, simulateProjectAssembly, type DraftSpec } from '../../../src/simulation';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;

const cases: readonly { name: string; base: ProjectDocument; spec: DraftSpec }[] = [
  {
    name: 'Underworld',
    base: createProjectDocument(catalog, {
      projectId: 'u',
      routeKey: 'Underworld',
      configuredBiomeCount: 4,
    }),
    spec: {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: { F: 'Arachne', G: 'Narcissus', H: 'Echo', I: 'Hades' },
        fieldNpcsByBiome: { F: ['Artemis'], I: ['Nemesis'] },
      },
      basketTraitKeys: ['ZeusWeaponBoon', 'ApolloCastBoon'],
      rackKeepsakeKeys: ['DoorHealReserveKeepsake', null, 'BossPreDamageKeepsake'],
    },
  },
  {
    name: 'Surface',
    base: createProjectDocument(catalog, {
      projectId: 's',
      routeKey: 'Surface',
      configuredBiomeCount: 4,
    }),
    spec: {
      loadout,
      world: {
        godKeys: ['Zeus', 'Hera', 'Demeter', 'Ares'],
        storyNpcByBiome: { N: 'Medea', O: 'Circe', P: 'Dionysus' },
        fieldNpcsByBiome: { N: ['Heracles'], O: ['Icarus'], P: ['Athena'] },
      },
      basketTraitKeys: ['HeraCastBoon'],
      rackKeepsakeKeys: ['DoorHealReserveKeepsake', null, null],
    },
  },
  {
    name: 'Dream',
    base: createProjectDocument(catalog, {
      projectId: 'd',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['H', 'F', 'N', 'I'],
      configuredBiomeCount: 4,
    }),
    spec: {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Poseidon', 'Hestia'],
        storyNpcByBiome: { H: 'Echo', F: 'Arachne', N: 'Medea', I: 'Hades' },
        fieldNpcsByBiome: { F: ['Artemis'], N: ['Heracles'] },
      },
      basketTraitKeys: ['ZeusWeaponBoon'],
      rackKeepsakeKeys: [null, 'DoorHealReserveKeepsake', null],
    },
  },
];

describe('draftProject', () => {
  for (const { name, base, spec } of cases)
    it(`drafts a zero-finding ${name} route that meets its story, field, rack and Hermes targets`, () => {
      const result = draftProject(catalog, base, spec, 1);
      if (result.kind !== 'drafted') throw new Error(`${name} draft ${result.kind}`);
      const drafted = simulateProjectAssembly(
        catalog,
        applyProjectCommand(base, catalog, result.command),
      ).evaluation;
      expect(drafted.status).toBe('valid');
      expect(drafted.findings).toEqual([]);
      expect(result.report.targets.length).toBeGreaterThan(0);
      for (const target of result.report.targets)
        if (
          target.kind === 'storyNpc' ||
          target.kind === 'fieldNpc' ||
          target.kind === 'rackKeepsake'
        )
          expect(target).toMatchObject({ met: true });
      expect(result.report.extras).toEqual([]);
      expect(result.report.targets).toContainEqual(
        expect.objectContaining({ kind: 'hermes', met: true }),
      );
      expect(result.command.loadout).toMatchObject({
        weaponKey: spec.loadout.weaponKey,
        startingKeepsakeKey: spec.loadout.startingKeepsakeKey,
      });
    });

  it('drafts the same route for the same seed', () => {
    const { base, spec } = cases[0]!;
    const first = draftProject(catalog, base, spec, 7);
    const second = draftProject(catalog, base, spec, 7);
    expect(first.kind).toBe('drafted');
    expect(second).toEqual(first);
  });

  it('refuses the FreshFile route', () => {
    const base = createProjectDocument(catalog, { projectId: 'f', routeKey: 'FreshFile' });
    expect(draftProject(catalog, base, cases[0]!.spec, 1)).toEqual({
      kind: 'refused',
      refusals: [{ kind: 'freshFileRoute' }],
    });
  });
});
