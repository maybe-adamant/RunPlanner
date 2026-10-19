import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createRouteAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { draftProject, simulateProjectAssembly, type DraftSpec } from '../../../src/simulation';
import { DEFAULT_DRAFT_BUDGET } from '../../../src/simulation/draft/generator';
import { latestRunState } from '../../../src/simulation/draft/report';
import { draftGodSchedule } from '../../../src/simulation/draft/schedule';
import { draftLoadoutProject } from '../../../src/simulation/draft/spec';
import { createDraftRng, DraftWalk } from '../../../src/simulation/draft/walk';

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

/** The selected trait of every authored Echo choice screen. */
function echoSelections(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(echoSelections);
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const options = record.options as readonly { readonly traitKey: string }[] | undefined;
  const selected = /^option(\d)$/.exec(String(record.selectedOptionKey))?.[1];
  const own =
    record.giverKey === 'Echo' && options !== undefined && selected !== undefined
      ? [options[Number(selected) - 1]!.traitKey]
      : [];
  return [...own, ...Object.values(record).flatMap(echoSelections)];
}

describe('draftProject', () => {
  for (const { name, base, spec } of cases)
    it(`drafts a zero-finding ${name} route that meets its story, field and rack targets`, () => {
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
      expect(result.command.loadout).toMatchObject({
        weaponKey: spec.loadout.weaponKey,
        startingKeepsakeKey: spec.loadout.startingKeepsakeKey,
      });
    });

  it('takes the basket Attack and keeps every other Attack out of the run', () => {
    const { base, spec } = cases[0]!;
    const result = draftProject(catalog, base, spec, 2);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    const equipped = Object.keys(
      latestRunState(simulateProjectAssembly(catalog, result.project))?.traits.equippedTraits ?? {},
    );
    const attacks = equipped.filter((key) => catalog.traits.byKey[key]?.equipmentSlot === 'Melee');
    expect(attacks).toEqual(['ZeusWeaponBoon']);
  });

  it('never selects an Echo choice that replays or duplicates acquisitions', () => {
    // Walks F then H, ending at Echo's story room; unbanned, this seed takes EchoLastReward.
    const { spec } = cases[2]!;
    const base = createProjectDocument(catalog, {
      projectId: 'e',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['F', 'H', 'N', 'I'],
      configuredBiomeCount: 4,
    });
    const echoSpec: DraftSpec = {
      ...spec,
      world: { ...spec.world, storyNpcByBiome: { F: 'Arachne', H: 'Echo' }, fieldNpcsByBiome: {} },
    };
    const schedule = draftGodSchedule(catalog, base.route, echoSpec, createDraftRng(6));
    let assembly = simulateProjectAssembly(
      catalog,
      draftLoadoutProject(catalog, base, echoSpec.loadout),
    );
    for (const biomeIndex of [0, 1]) {
      const walk = new DraftWalk(catalog, assembly, echoSpec, createDraftRng(6), schedule);
      expect(walk.runBiome(biomeIndex, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome)).toBe(true);
      assembly = walk.assembly;
    }
    const echoChoices = echoSelections(assembly.project);
    expect(echoChoices.length).toBeGreaterThan(0);
    for (const traitKey of echoChoices)
      expect(['EchoLastReward', 'EchoRepeatKeepsakeBoon', 'EchoDoubleShop']).not.toContain(
        traitKey,
      );
  });

  it('drafts a route with a Practice start and keeps the start point', () => {
    const { base, spec } = cases[0]!;
    const practice = applyProjectCommand(base, catalog, {
      kind: 'ReplacePracticeStart',
      route: createRouteAddress(base.route.routeKey),
      startPoint: { biomeKey: 'G', point: 'opening' },
    });
    const result = draftProject(catalog, practice, spec, 1);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    const drafted = applyProjectCommand(practice, catalog, result.command);
    expect(drafted.route.practiceStart).toEqual({ biomeKey: 'G', point: 'opening' });
    const evaluation = simulateProjectAssembly(catalog, drafted).evaluation;
    expect(evaluation.status).toBe('valid');
    expect(evaluation.findings).toEqual([]);
  });

  describe('Hermes reserved for waiting basket traits', () => {
    const { base, spec } = cases[0]!;
    // Success Rate waits on an Artemis trait from G, and Paid Dues waits on Success Rate.
    const waiting: DraftSpec = {
      ...spec,
      world: { ...spec.world, fieldNpcsByBiome: { G: ['Artemis'] } },
      basketTraitKeys: ['CritBonusBoon', 'LuckyBoon', 'TimeStopLastStandBoon'],
    };
    const startWalk = (draft: DraftSpec) =>
      new DraftWalk(
        catalog,
        simulateProjectAssembly(catalog, draftLoadoutProject(catalog, base, draft.loadout)),
        draft,
        createDraftRng(1),
        draftGodSchedule(catalog, base.route, draft, createDraftRng(1)),
      );

    it('reserves Hermes only while every free Hermes room is owed to a waiting trait', () => {
      expect(startWalk(waiting).hermesReserved()).toBe(true);
      expect(
        startWalk({ ...waiting, basketTraitKeys: ['CritBonusBoon', 'LuckyBoon'] }).hermesReserved(),
      ).toBe(false);
      expect(
        startWalk({
          ...waiting,
          basketTraitKeys: ['HermesWeaponBoon', 'TimeStopLastStandBoon'],
        }).hermesReserved(),
      ).toBe(false);
    });

    it('drafts Success Rate after its late Artemis prerequisite and Paid Dues after it', () => {
      const result = draftProject(catalog, base, waiting, 1);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      const assembly = simulateProjectAssembly(catalog, result.project);
      expect(assembly.evaluation.status).toBe('valid');
      expect(assembly.evaluation.findings).toEqual([]);
      for (const traitKey of waiting.basketTraitKeys)
        expect(result.report.targets).toContainEqual(
          expect.objectContaining({ kind: 'basketTrait', key: traitKey, met: true }),
        );
      const hermes = catalog.traitGivers.byKey.Hermes!.traitKeys;
      const equipped = Object.keys(latestRunState(assembly)?.traits.equippedTraits ?? {});
      expect(equipped.filter((key) => hermes.includes(key)).sort()).toEqual([
        'LuckyBoon',
        'TimeStopLastStandBoon',
      ]);
    });
  });

  it("holds an NPC trait's prerequisite before meeting the NPC", () => {
    // Ingenious Strike needs a god Attack before Icarus in O; Duo prerequisites crowd the Attack.
    const icarus: DraftSpec = {
      ...cases[1]!.spec,
      world: { ...cases[1]!.spec.world, fieldNpcsByBiome: { O: ['Icarus'] } },
      basketTraitKeys: [
        'HeraCastBoon',
        'DemeterSpecialBoon',
        'ZeusSprintBoon',
        'AresManaBoon',
        'AresWeaponBoon',
        'BloodDropRevengeBoon',
        'KeepsakeLevelBoon',
        'RootStrikeBoon',
        'BloodRetentionBoon',
        'FocusAttackDamageTrait',
      ],
      rackKeepsakeKeys: [null, null, null],
    };
    const result = draftProject(catalog, cases[1]!.base, icarus, 1);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    for (const target of [
      { kind: 'basketTrait', key: 'AresWeaponBoon' },
      { kind: 'basketTrait', key: 'FocusAttackDamageTrait' },
      { kind: 'fieldNpc', key: 'Icarus', biomeKey: 'O' },
    ])
      expect(result.report.targets).toContainEqual({ ...target, met: true });
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
