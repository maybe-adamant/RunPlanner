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
import { draftBasketTraitKeys, draftLoadoutProject } from '../../../src/simulation/draft/spec';
import { startDraftWalk } from '../../support/draft-walk';
import { DRAFT_CORPUS_SPEC_COUNT, draftCorpusEntry } from '../../draft-corpus/corpus';
import type { ProjectEvaluationAssembly } from '../../../src/simulation/evaluation/evaluation-products';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '../../../src/simulation/evaluation/project-evaluation-assembly';
import { draftBasket } from '../../support/draft-basket';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;

const underworld = {
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
    basketByGiver: draftBasket(['ZeusWeaponBoon', 'ApolloCastBoon']),
    rackKeepsakeKeys: ['DoorHealReserveKeepsake', null, 'BossPreDamageKeepsake'],
  } satisfies DraftSpec,
};
const surface = {
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
    basketByGiver: draftBasket(['HeraCastBoon']),
    rackKeepsakeKeys: ['DoorHealReserveKeepsake', null, null],
  } satisfies DraftSpec,
};
const dream = {
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
    basketByGiver: draftBasket(['ZeusWeaponBoon']),
    rackKeepsakeKeys: [null, 'DoorHealReserveKeepsake', null],
  } satisfies DraftSpec,
};
/** A route planned to its first biomes only. */
const planned = (routeKey: string, configuredBiomeCount: number) =>
  createProjectDocument(catalog, { projectId: 'planned', routeKey, configuredBiomeCount });

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
  it('drafts a zero-finding Surface route that meets its story, field and rack targets', () => {
    const { base, spec } = surface;
    const result = draftProject(catalog, base, spec, 1);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
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
    const walk = startDraftWalk(underworld.base, underworld.spec, 2);
    expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
    const equipped = Object.keys(latestRunState(walk.assembly)?.traits.equippedTraits ?? {});
    const attacks = equipped.filter((key) => catalog.traits.byKey[key]?.equipmentSlot === 'Melee');
    expect(attacks).toEqual(['ZeusWeaponBoon']);
  });

  it('never selects an Echo choice that replays or duplicates acquisitions', () => {
    // Walks F then H, ending at Echo's story room; unbanned, this seed takes EchoLastReward.
    const { spec } = dream;
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

  describe('Hermes reserved for waiting basket traits', () => {
    const { base, spec } = underworld;
    // Success Rate waits on an Artemis trait from G, and Paid Dues waits on Success Rate.
    const waiting: DraftSpec = {
      ...spec,
      world: { ...spec.world, fieldNpcsByBiome: { G: ['Artemis'] } },
      basketByGiver: draftBasket(['CritBonusBoon', 'LuckyBoon', 'TimeStopLastStandBoon']),
    };
    const startWalk = (draft: DraftSpec) => startDraftWalk(base, draft, 1);

    it('reserves Hermes only while every free Hermes room is owed to a waiting trait', () => {
      expect(startWalk(waiting).hermesReserved()).toBe(true);
      expect(
        startWalk({
          ...waiting,
          basketByGiver: draftBasket(['CritBonusBoon', 'LuckyBoon']),
        }).hermesReserved(),
      ).toBe(false);
      expect(
        startWalk({
          ...waiting,
          basketByGiver: draftBasket(['HermesWeaponBoon', 'TimeStopLastStandBoon']),
        }).hermesReserved(),
      ).toBe(false);
    });

    it('drafts Success Rate after its late Artemis prerequisite and Paid Dues after it', () => {
      // Paid Dues needs a Hermes room after Success Rate in G, so the plan runs into H.
      const result = draftProject(catalog, planned('Underworld', 3), waiting, 1);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      const assembly = simulateProjectAssembly(catalog, result.project);
      for (const traitKey of draftBasketTraitKeys(waiting))
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
      ...surface.spec,
      world: { ...surface.spec.world, fieldNpcsByBiome: { O: ['Icarus'] } },
      basketByGiver: draftBasket(
        [
          'HeraCastBoon',
          'DemeterSpecialBoon',
          'ZeusSprintBoon',
          'AresManaBoon',
          'AresWeaponBoon',
          'KeepsakeLevelBoon',
          'RootStrikeBoon',
          'BloodRetentionBoon',
          'FocusAttackDamageTrait',
        ],
        {},
        surface.spec.world.godKeys,
      ),
      rackKeepsakeKeys: [null, null, null],
    };
    const result = draftProject(catalog, planned('Surface', 2), icarus, 3);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    for (const target of [
      { kind: 'basketTrait', key: 'AresWeaponBoon' },
      { kind: 'basketTrait', key: 'FocusAttackDamageTrait' },
      { kind: 'fieldNpc', key: 'Icarus', biomeKey: 'O' },
    ])
      expect(result.report.targets).toContainEqual({ ...target, met: true });
  });

  it('takes a hosted Duo from its host only', () => {
    const duo = 'ApolloSecondStageCastBoon';
    for (const host of ['Zeus', 'Apollo']) {
      const spec: DraftSpec = {
        ...underworld.spec,
        basketByGiver: draftBasket(['ApolloCastBoon', 'ApolloExCastBoon', duo, 'ZeusWeaponBoon'], {
          [duo]: host,
        }),
      };
      const result = draftProject(catalog, underworld.base, spec, 1);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      expect(result.report.targets).toContainEqual({ kind: 'basketTrait', key: duo, met: true });
      const drafted = applyProjectCommand(underworld.base, catalog, result.command);
      const held = latestRunState(simulateProjectAssembly(catalog, drafted))?.traits.equippedTraits[
        duo
      ];
      expect(held?.giverKey).toBe(host);
    }
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
      basketByGiver: draftBasket(['ApolloCastBoon', 'ApolloExCastBoon', 'ZeusWeaponBoon', duo], {
        [duo]: 'Zeus',
      }),
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
    /** The Shop rooms each walked biome entered. */
    const shopRooms = (assembly: ProjectEvaluationAssembly): string[] =>
      assembly.evaluation.route.biomes.flatMap((biome) =>
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

    it("buys the boon of a god whose next basket trait it can take, keeping each god's order", () => {
      const zeus = ['ZeusWeaponBoon', 'ZeusCastBoon', 'DoubleBoltBoon', 'FocusLightningBoon'];
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketByGiver: draftBasket([
          'ZeusWeaponBoon',
          'ApolloSpecialBoon',
          'ZeusCastBoon',
          'HestiaSprintBoon',
          'AphroditeManaBoon',
          'DoubleBoltBoon',
          'FocusLightningBoon',
          'ApolloRetaliateBoon',
        ]),
        rackKeepsakeKeys: [null, null, null],
      };
      const result = draftProject(catalog, planned('Underworld', 2), spec, 2);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      // A trait taken from a bought god boon is a basket trait, in its god's order.
      const boughtTraits = shopBuys(result.project).flatMap((buy) => {
        const traits = buy.split(':')[2];
        return traits === undefined || traits === '' ? [] : traits.split('/');
      });
      expect(boughtTraits.length).toBeGreaterThan(0);
      for (const traitKey of boughtTraits) expect(draftBasketTraitKeys(spec)).toContain(traitKey);
      const held = Object.keys(
        latestRunState(simulateProjectAssembly(catalog, result.project))?.traits.equippedTraits ??
          {},
      );
      const zeusHeld = zeus.filter((key) => held.includes(key));
      expect(zeusHeld).toEqual(zeus.slice(0, zeusHeld.length));
      // The soft pace never runs far past two purchases per planned biome.
      expect(shopBuys(result.project).length).toBeLessThanOrEqual(5);
    });

    it('never buys a god boon at no purchases per biome, while Hermes still follows its need', () => {
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketByGiver: draftBasket([
          'ZeusWeaponBoon',
          'ApolloCastBoon',
          'HermesWeaponBoon',
          'AphroditeSprintBoon',
          'HestiaManaBoon',
          'TimeStopLastStandBoon',
          'ZeusSpecialBoon',
        ]),
        rackKeepsakeKeys: [null, null, null],
      };
      const buys = (purchasesPerBiome?: number) => {
        const result = draftProject(
          catalog,
          planned('Underworld', 3),
          purchasesPerBiome === undefined ? spec : { ...spec, purchasesPerBiome },
          2,
        );
        if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
        return shopBuys(result.project);
      };
      // At the default pace this seed buys a god-side boon; at none only the due Hermes boon.
      expect(buys().some((buy) => !buy.includes(':ShopHermesUpgrade:'))).toBe(true);
      expect(buys(0)).toEqual(['G:ShopHermesUpgrade:HermesWeaponBoon']);
    });

    it('takes the retries per biome after each first success', () => {
      const entry = draftCorpusEntry(
        Array.from({ length: DRAFT_CORPUS_SPEC_COUNT }, (_, index) => index).find(
          (index) => draftCorpusEntry(index).name === 'U3 heavy Hermes Artemis trait',
        )!,
      );
      const attempts = (retriesPerBiome: number) => {
        const result = draftProject(catalog, entry.base, { ...entry.spec, retriesPerBiome }, 2);
        if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
        return result.attempts;
      };
      // A seed whose first successes miss local targets: each retry is a further attempt.
      expect(attempts(1)).toBeGreaterThan(attempts(0));
    });

    it('rolls resource rooms at the spec chance, none at 0', () => {
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketByGiver: draftBasket(['ZeusWeaponBoon']),
        rackKeepsakeKeys: [null, null, null],
      };
      const placed = (resourceRoomChance: number) => {
        const result = draftProject(
          catalog,
          planned('Underworld', 2),
          { ...spec, resourceRoomChance },
          1,
        );
        if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
        return Object.values(result.project.route.resourcePlacements).filter((p) => p !== null)
          .length;
      };
      expect(placed(0)).toBe(0);
      expect(placed(50)).toBeGreaterThan(0);
    });

    it("enters the planned biome's midshop when the player prefers midshops", () => {
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketByGiver: draftBasket(['ZeusWeaponBoon', 'ApolloCastBoon']),
        rackKeepsakeKeys: [null, null, null],
        preferMidshops: true,
      };
      const walk = startDraftWalk(underworld.base, spec, 1);
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      expect(shopRooms(walk.assembly)).toEqual(['F_Shop01']);
    });

    it('takes the Clockwork Goal doors in Tartarus from a kept Practice start', () => {
      const spec: DraftSpec = {
        ...underworld.spec,
        world: { ...underworld.spec.world, storyNpcByBiome: {}, fieldNpcsByBiome: {} },
        rackKeepsakeKeys: [null, null, null],
      };
      const startPoint = { biomeKey: 'I', point: 'opening' } as const;
      const practice = applyProjectCommand(underworld.base, catalog, {
        kind: 'ReplacePracticeStart',
        route: createRouteAddress(underworld.base.route.routeKey),
        startPoint,
      });
      const nonGoals = (pursue: boolean) => {
        const result = draftProject(
          catalog,
          practice,
          { ...spec, ...(pursue ? { pursueTartarusGoal: true } : {}) },
          2,
        );
        if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
        const drafted = applyProjectCommand(practice, catalog, result.command);
        expect(drafted.route.practiceStart).toEqual(startPoint);
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
      const { loadout: base } = dream.spec;
      const spec: DraftSpec = {
        loadout: { ...base, fearRanks: { ...base.fearRanks, BoonSkipShrineUpgrade: 1 } },
        world: {
          godKeys: ['Poseidon', 'Zeus', 'Apollo', 'Hestia'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketByGiver: draftBasket([
          'PoseidonManaBoon',
          'FocusLightningBoon',
          'DoubleRewardBoon',
          'ZeusSpecialBoon',
          'ElementalDamageFloorBoon',
          'ElementalRallyBoon',
          'ApolloCastBoon',
          'ElementalHealthBoon',
        ]),
        rackKeepsakeKeys: [null, null, null],
      };
      const walk = startDraftWalk(dream.base, spec, 1);
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      // Air for Zeus's waiting Infusion, from the first Dream Shop.
      expect(shopBuys(walk.project)).toContain('H:AirBoost:');
    });
  });

  it.each([
    ['Underworld', underworld, 1],
    ['Underworld', underworld, 2],
    ['Surface', surface, 1],
    ['Dream', dream, 1],
  ] as const)(
    "installs the %s draft's own route, resource points included, seed %i",
    (_route, { base, spec }, seed) => {
      const result = draftProject(catalog, base, spec, seed);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      const applied = applyProjectCommand(base, catalog, result.command);
      expect(applied.route.resourcePlacements).toEqual(result.project.route.resourcePlacements);
      expect(applied.route.biomes).toEqual(result.project.route.biomes);
      expect(applied.route.loadout).toEqual(result.project.route.loadout);
      const evaluation = simulateProjectAssembly(catalog, applied).evaluation;
      expect(evaluation.status).toBe('valid');
      expect(evaluation.findings).toEqual([]);
    },
  );

  it('places resource points the drafted route keeps', () => {
    const result = draftProject(catalog, underworld.base, underworld.spec, 1);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    expect(
      Object.values(
        applyProjectCommand(underworld.base, catalog, result.command).route.resourcePlacements,
      ).some((placement) => placement !== null),
    ).toBe(true);
  });

  it('drafts Fresh File from its null loadout, with Apollo met', () => {
    const base = createProjectDocument(catalog, {
      projectId: 'f',
      routeKey: 'FreshFile',
      configuredBiomeCount: 2,
    });
    const { startingReward: _reward, ...freshLoadout } = base.route.loadout;
    void _reward;
    const spec: DraftSpec = {
      loadout: freshLoadout,
      world: {
        godKeys: ['Apollo', 'Poseidon', 'Hestia', 'Demeter'],
        storyNpcByBiome: {},
        fieldNpcsByBiome: {},
      },
      basketByGiver: draftBasket(['ApolloWeaponBoon', 'PoseidonCastBoon', 'HestiaSprintBoon']),
      rackKeepsakeKeys: [],
    };
    const result = draftProject(catalog, base, spec, 1);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    const assembly = simulateProjectAssembly(catalog, result.project);
    expect(latestRunState(assembly)?.godPool.acquiredSourceKeys).toContain('ApolloUpgrade');
  });
});
