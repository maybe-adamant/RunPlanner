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
import { authoredShopOffer } from '../../../src/authored-project/shop';
import { latestRunState } from '../../../src/simulation/draft/report';
import { DRAFT_ILLEGAL_ECHO_TRAIT_KEYS } from '../../../src/simulation/draft/basket';
import { draftLoadoutProject } from '../../../src/simulation/draft/spec';
import { startDraftWalk } from '../../support/draft-walk';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '../../../src/simulation/evaluation/project-evaluation-assembly';

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
      // Every reached encounter decision is drafted; Aetos appears at most once in Olympus.
      const assembly = simulateProjectAssembly(catalog, result.project);
      const phases = reachedEncounterPhasesForProjectEvaluationAssembly(assembly);
      expect(phases.length).toBeGreaterThan(0);
      for (const phase of phases) {
        const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase);
        const definitionKey = status?.kind === 'active' ? status.encounterDefinitionKey : undefined;
        const decided = result.project.route.biomes
          .find((biome) => biome.biomeKey === phase.biomeKey)!
          .topology!.occurrences.find(
            (occurrence) => occurrence.occurrenceId === phase.owner.occurrenceId,
          )!.encounters.customizationByPhase?.[phase.phaseKey];
        for (const decision of catalog.encounterDefinitions.byKey[definitionKey ?? '']
          ?.customization ?? [])
          expect(
            decided?.[decision.key],
            `${phase.owner.occurrenceId}.${phase.phaseKey}`,
          ).toBeDefined();
      }
      const olympus = result.project.route.biomes.find((biome) => biome.biomeKey === 'P');
      expect(
        (olympus?.topology?.occurrences ?? []).flatMap((occurrence) =>
          Object.keys(occurrence.encounters.aetosWaveByPhase ?? {}),
        ).length,
      ).toBeLessThanOrEqual(1);
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
    let assembly = simulateProjectAssembly(
      catalog,
      draftLoadoutProject(catalog, base, echoSpec.loadout),
    );
    for (const biomeIndex of [0, 1]) {
      const walk = startDraftWalk(base, echoSpec, 6, { from: assembly });
      expect(walk.runBiome(biomeIndex, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome)).toBe(true);
      assembly = walk.assembly;
    }
    const echoChoices = echoSelections(assembly.project);
    expect(echoChoices.length).toBeGreaterThan(0);
    for (const traitKey of echoChoices)
      expect(DRAFT_ILLEGAL_ECHO_TRAIT_KEYS.has(traitKey)).toBe(false);
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
    const startWalk = (draft: DraftSpec) => startDraftWalk(base, draft, 1);

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

  it('walks the same biome for the same seed', () => {
    const { base, spec } = cases[0]!;
    const walked = () => {
      const walk = startDraftWalk(base, spec, 7);
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      return walk.project;
    };
    expect(walked()).toEqual(walked());
  });

  describe('a planned prefix', () => {
    const duo = 'ApolloSecondStageCastBoon';
    const prefixSpec: DraftSpec = {
      loadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: { F: 'Arachne', G: 'Narcissus', H: 'Echo' },
        fieldNpcsByBiome: {},
      },
      basketTraitKeys: ['ApolloCastBoon', 'ApolloExCastBoon', 'ZeusWeaponBoon', duo],
      rackKeepsakeKeys: ['DoorHealReserveKeepsake', 'BossPreDamageKeepsake', null],
    };
    const fg = createProjectDocument(catalog, {
      projectId: 'p',
      routeKey: 'Underworld',
      configuredBiomeCount: 2,
    });

    it('drafts and reports only the planned biomes, with the rack in each one', () => {
      const result = draftProject(catalog, fg, prefixSpec, 1);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      expect(result.command.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G']);
      const drafted = applyProjectCommand(fg, catalog, result.command);
      expect(drafted.route.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G']);
      expect(simulateProjectAssembly(catalog, drafted).evaluation.findings).toEqual([]);
      // Echo in H lies past the plan; the rack after G is in G's Postboss.
      expect(result.report.targets.filter((target) => target.kind !== 'basketTrait')).toEqual([
        { kind: 'storyNpc', key: 'Arachne', biomeKey: 'F', met: true },
        { kind: 'storyNpc', key: 'Narcissus', biomeKey: 'G', met: true },
        { kind: 'rackKeepsake', key: 'DoorHealReserveKeepsake', biomeKey: 'F', met: true },
        { kind: 'rackKeepsake', key: 'BossPreDamageKeepsake', biomeKey: 'G', met: true },
      ]);
    });

    it('never declines a ready Duo in G, the last planned biome', () => {
      // Zeus's third queued trait readies the Duo, so on these seeds it falls due in G.
      const late: DraftSpec = {
        ...prefixSpec,
        world: { ...prefixSpec.world, storyNpcByBiome: {} },
        basketTraitKeys: [
          'ApolloCastBoon',
          'ApolloExCastBoon',
          'ZeusSprintBoon',
          'ZeusManaBoon',
          'ZeusSpecialBoon',
          duo,
        ],
        rackKeepsakeKeys: [null, null, null],
      };
      for (const seed of [3, 5, 7]) {
        const walk = startDraftWalk(fg, late, seed);
        expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
        const declinedInF = walk.duoDeclines().get(duo) ?? 0;
        expect(walk.runBiome(1, walk.steps + DEFAULT_DRAFT_BUDGET.maxStepsPerBiome)).toBe(true);
        expect(walk.duoDeclines().get(duo) ?? 0).toBe(declinedInF);
        expect(Object.keys(latestRunState(walk.assembly)?.traits.equippedTraits ?? {})).toContain(
          duo,
        );
      }
    });
  });

  describe('Shop purchases', () => {
    /** Each Shop purchase as biome, reward type and the trait its boon offer selected. */
    const shopBuys = (project: ProjectDocument): string[] =>
      project.route.biomes.flatMap((biome) =>
        (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
          (occurrence.roomActions?.order ?? []).flatMap((action) => {
            if (action.kind !== 'interactShopOffer') return [];
            const reward = authoredShopOffer(occurrence, action.offerKey)?.reward;
            const traits = Object.values(reward?.traitOffersByAcquisitionRole ?? {}).flatMap(
              (offer) =>
                offer?.kind === 'traits'
                  ? [
                      offer.options[
                        ['option1', 'option2', 'option3'].indexOf(offer.selectedOptionKey)
                      ]!.traitKey,
                    ]
                  : [],
            );
            return [`${biome.biomeKey}:${reward?.offer.rewardType}:${traits.join('/')}`];
          }),
        ),
      );
    const underworld = cases[0]!.base;

    it("buys the boon of a god whose next basket trait it can take, keeping each god's order", () => {
      const zeus = ['ZeusWeaponBoon', 'ZeusCastBoon', 'DoubleBoltBoon', 'FocusLightningBoon'];
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketTraitKeys: [
          'ZeusWeaponBoon',
          'ApolloSpecialBoon',
          'ZeusCastBoon',
          'HestiaSprintBoon',
          'AphroditeManaBoon',
          'DoubleBoltBoon',
          'FocusLightningBoon',
          'ApolloRetaliateBoon',
        ],
        rackKeepsakeKeys: [null, null, null],
      };
      const result = draftProject(catalog, underworld, spec, 5);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      // Zeus's next queued trait, from a bought boon.
      expect(shopBuys(result.project)).toContain('F:RandomLoot:DoubleBoltBoon');
      const held = Object.keys(
        latestRunState(simulateProjectAssembly(catalog, result.project))?.traits.equippedTraits ??
          {},
      );
      const zeusHeld = zeus.filter((key) => held.includes(key));
      expect(zeusHeld).toEqual(zeus.slice(0, zeusHeld.length));
      // The soft pace never runs far past two purchases per planned biome.
      expect(shopBuys(result.project).length).toBeLessThanOrEqual(9);
    });

    it("enters each planned biome's midshop when the player prefers midshops", () => {
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketTraitKeys: ['ZeusWeaponBoon', 'ApolloCastBoon'],
        rackKeepsakeKeys: [null, null, null],
      };
      const fg = createProjectDocument(catalog, {
        projectId: 'm',
        routeKey: 'Underworld',
        configuredBiomeCount: 2,
      });
      const midshops = (prefer: boolean) => {
        const result = draftProject(
          catalog,
          fg,
          { ...spec, ...(prefer ? { preferMidshops: true } : {}) },
          1,
        );
        if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
        return simulateProjectAssembly(catalog, result.project).evaluation.route.biomes.flatMap(
          (biome) =>
            'history' in biome
              ? biome.history.ledgers.roomAppearances
                  .filter(
                    (entry) =>
                      entry.origin.biomeKey === biome.biomeKey &&
                      catalog.rooms.byKey[entry.gameName]?.kind === 'Shop',
                  )
                  .map((entry) => entry.gameName)
              : [],
        );
      };
      expect(midshops(false)).toEqual([]);
      expect(midshops(true)).toEqual(['F_Shop01', 'G_Shop01']);
    });

    it('takes the Clockwork Goal doors in Tartarus when told to pursue the goal', () => {
      const spec: DraftSpec = {
        ...cases[0]!.spec,
        world: { ...cases[0]!.spec.world, storyNpcByBiome: {}, fieldNpcsByBiome: {} },
        rackKeepsakeKeys: [null, null, null],
      };
      const nonGoals = (pursue: boolean) => {
        const result = draftProject(
          catalog,
          underworld,
          { ...spec, ...(pursue ? { pursueTartarusGoal: true } : {}) },
          1,
        );
        if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
        const tartarus = simulateProjectAssembly(
          catalog,
          result.project,
        ).evaluation.route.biomes.find((biome) => biome.biomeKey === 'I');
        if (tartarus === undefined || !('history' in tartarus)) throw new Error('no Tartarus');
        return tartarus.history.ledgers.counters.clockworkNonGoalRewardsAcquired ?? 0;
      };
      // Every door it can is a Goal, so fewer non-goal rewards are taken on the way down.
      expect(nonGoals(true)).toBeLessThan(nonGoals(false));
    });

    it('buys a Dream elemental boost of the element a waiting Infusion needs', () => {
      const { loadout: base } = cases[2]!.spec;
      const spec: DraftSpec = {
        loadout: { ...base, fearRanks: { ...base.fearRanks, BoonSkipShrineUpgrade: 1 } },
        world: {
          godKeys: ['Zeus', 'Apollo', 'Poseidon', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketTraitKeys: [
          'PoseidonManaBoon',
          'FocusLightningBoon',
          'DoubleRewardBoon',
          'ZeusSpecialBoon',
          'ElementalDamageFloorBoon',
          'ElementalRallyBoon',
          'ApolloCastBoon',
          'ElementalHealthBoon',
        ],
        rackKeepsakeKeys: [null, null, null],
      };
      const result = draftProject(catalog, cases[2]!.base, spec, 5);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      // Air for Zeus's waiting Infusion, from the first Dream Shop.
      expect(shopBuys(result.project)).toContain('H:AirBoost:');
    });
  });

  it('refuses the FreshFile route', () => {
    const base = createProjectDocument(catalog, { projectId: 'f', routeKey: 'FreshFile' });
    expect(draftProject(catalog, base, cases[0]!.spec, 1)).toEqual({
      kind: 'refused',
      refusals: [{ kind: 'freshFileRoute' }],
    });
  });
});
