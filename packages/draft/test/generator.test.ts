import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createRouteAddress,
  type ProjectDocument,
  createDefaultRouteLoadout,
  createProjectDocument,
  authoredShopOffer,
  createBiomeAddress,
  createShopOfferAddress,
  semanticAddressKey,
  type DraftSpending,
} from '@run-planner/engine/authored-project';
import { draftProject, type DraftSpec } from '../src';
import {
  goldLedgerForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { DEFAULT_DRAFT_BUDGET } from '../src/generator';
import { latestRunState } from '../src/report';
import { DRAFT_ILLEGAL_ECHO_TRAIT_KEYS } from '../src/basket';
import { draftBasketTraitKeys, draftLoadoutProject } from '../src/spec';
import { DRAFT_AFFORDABLE_FLOOR, DRAFT_SPENDING_STYLES, draftFillerKind } from '../src/steering';
import { startDraftWalk } from './support/draft-walk';
import { DRAFT_CORPUS_SPEC_COUNT, draftCorpusEntry } from './draft-corpus/corpus';
import { draftBasket } from './support/draft-basket';

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
/** Seeds whose filler walks witness each spending rule. */
const FILLER_SEED = 2;
/** A Greedy walk under the Vow of Debt that takes back filler. */
const TAKE_BACK_SEED = 9;
/** A seed whose Greedy walk buys a filler kind the ranking leaves out. */
const UNRANKED_FILLER_SEED = 5;

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

/** Every authored trait screen's rows, each with whether it is the selected row. */
function traitScreenRows(value: unknown): { traitKey: string; selected: boolean }[] {
  if (Array.isArray(value)) return value.flatMap(traitScreenRows);
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const options = record.options as readonly { readonly traitKey: string }[] | undefined;
  const selected = /^option(\d)$/.exec(String(record.selectedOptionKey))?.[1];
  const own =
    typeof record.giverKey === 'string' && Array.isArray(options) && selected !== undefined
      ? options.map((option, index) => ({
          traitKey: option.traitKey,
          selected: index === Number(selected) - 1,
        }))
      : [];
  return [...own, ...Object.values(record).flatMap(traitScreenRows)];
}

const deathDefianceDependent = (traitKey: string) =>
  catalog.traits.byKey[traitKey]?.offerDependsOnDeathDefiance === true;

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

  it('never fills a trait screen with a row whose offer needs a missing Death Defiance', () => {
    // Unruled, this seed selects Echo's Death Defiance refill and offers Hades' Death Defiance boon.
    const result = draftProject(catalog, underworld.base, underworld.spec, 1);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    const rows = traitScreenRows(result.project);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => deathDefianceDependent(row.traitKey))).toEqual([]);
  });

  it('still takes a basket trait whose offer needs a missing Death Defiance', () => {
    const spec: DraftSpec = {
      ...surface.spec,
      basketByGiver: draftBasket(['HeraCastBoon', 'DeathDefianceRefillBoon']),
    };
    const result = draftProject(catalog, planned('Surface', 3), spec, 1);
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    expect(result.report.targets).toContainEqual({
      kind: 'basketTrait',
      key: 'DeathDefianceRefillBoon',
      met: true,
    });
    expect(
      traitScreenRows(result.project).filter((row) => deathDefianceDependent(row.traitKey)),
    ).toEqual([{ traitKey: 'DeathDefianceRefillBoon', selected: true }]);
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
      const result = draftProject(catalog, planned('Underworld', 3), waiting, 9);
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

  it("takes Narcissus' Mixed Blessings and authors the Mystery boon's own screen", () => {
    const spec: DraftSpec = {
      ...underworld.spec,
      world: { ...underworld.spec.world, storyNpcByBiome: { F: 'Arachne', G: 'Narcissus' } },
      basketByGiver: draftBasket(['ZeusWeaponBoon', 'NarcissusI']),
      rackKeepsakeKeys: [null, null, null],
    };
    for (const seed of [1, 2, 4]) {
      const result = draftProject(catalog, planned('Underworld', 2), spec, seed);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind} at seed ${seed}`);
      expect(result.report.targets).toContainEqual({
        kind: 'basketTrait',
        key: 'NarcissusI',
        met: true,
      });
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
      const result = draftProject(catalog, planned('Underworld', 2), spec, 3);
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
    });

    /** Each Shop purchase's reward type and gold as the engine's ledger prices it, in plan order. */
    const shopOdds = (project: ProjectDocument) => {
      const ledger = goldLedgerForProjectEvaluationAssembly(
        catalog,
        simulateProjectAssembly(catalog, project),
      );
      return project.route.biomes.flatMap((biome) =>
        (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
          (occurrence.roomActions?.order ?? []).flatMap((action) => {
            if (action.kind !== 'interactShopOffer') return [];
            const offer = createShopOfferAddress(
              createBiomeAddress(project.route.routeKey, biome.biomeKey),
              occurrence.occurrenceId,
              action.offerKey,
            );
            const priced = ledger.purchaseAt(offer);
            return [
              {
                offer,
                rewardType: authoredShopOffer(occurrence, action.offerKey)!.reward!.offer
                  .rewardType,
                odds:
                  priced.availability === 'available'
                    ? priced.purchase.affordableProbability
                    : undefined,
                spare:
                  priced.availability === 'available' &&
                  priced.purchase.balanceBefore.availability === 'available'
                    ? priced.purchase.balanceBefore.balance.mean - priced.purchase.price.mean
                    : undefined,
                spent: priced.availability === 'available' ? priced.purchase.price.mean : 0,
              },
            ];
          }),
        ),
      );
    };
    const fillerSpec: DraftSpec = {
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
        'ZeusSpecialBoon',
        'ApolloSprintBoon',
      ]),
      rackKeepsakeKeys: [null, null, null],
      fillerPriority: [{ kind: 'pom' }, { kind: 'maxHealth' }, { kind: 'maxMagick' }],
    };
    /** A three-biome walk of the filler spec, so the commands it kept can be read. */
    const fillerWalk = (
      seed: number,
      spending?: DraftSpending,
      debt = 0,
      fillerPriority = fillerSpec.fillerPriority,
    ) => {
      const spec: DraftSpec = {
        ...fillerSpec,
        ...(fillerPriority === undefined ? {} : { fillerPriority }),
        ...(spending === undefined ? {} : { spending }),
        loadout: {
          ...loadout,
          fearRanks: { ...loadout.fearRanks, ShopPricesShrineUpgrade: debt },
        },
      };
      const walk = startDraftWalk(planned('Underworld', 3), spec, seed);
      for (const biomeIndex of [0, 1, 2])
        expect(walk.runBiome(biomeIndex, walk.steps + 600), walk.failure).toBe(true);
      return walk;
    };

    it('never buys filler under Careful', () => {
      for (const seed of [FILLER_SEED, TAKE_BACK_SEED])
        expect(
          shopOdds(fillerWalk(seed, 'careful').project).filter(
            (buy) => draftFillerKind(buy.rewardType) !== undefined,
          ),
        ).toEqual([]);
    });

    it('buys under Greedy an affordable filler kind the ranking leaves out, which Normal skips', () => {
      const pomOnly = [{ kind: 'pom' as const }];
      const unranked = (spending: DraftSpending) =>
        shopOdds(fillerWalk(UNRANKED_FILLER_SEED, spending, 0, pomOnly).project).filter((buy) => {
          const kind = draftFillerKind(buy.rewardType);
          return kind !== undefined && kind !== 'pom';
        });
      expect(unranked('normal')).toEqual([]);
      const greedy = unranked('greedy');
      expect(greedy.length).toBeGreaterThan(0);
      for (const buy of greedy) expect(clears(buy, 1, 'greedy')).toBe(true);
    });

    it('buys nothing when spending is none', () => {
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
        fillerPriority: [{ kind: 'pom' }, { kind: 'maxHealth' }],
      };
      const buys = (spending?: DraftSpending) => {
        const result = draftProject(
          catalog,
          planned('Underworld', 3),
          spending === undefined ? spec : { ...spec, spending },
          2,
        );
        if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
        return shopBuys(result.project);
      };
      expect(buys().length).toBeGreaterThan(0);
      expect(buys('none')).toEqual([]);
    });

    /** Whether a purchase's gold clears the floor and this share of a style's cushion. */
    const clears = (
      buy: { readonly odds: number | undefined; readonly spare: number | undefined },
      share: number,
      style: keyof typeof DRAFT_SPENDING_STYLES = 'normal',
    ) =>
      (buy.odds ?? 0) >= DRAFT_AFFORDABLE_FLOOR &&
      (buy.spare ?? -Infinity) >= DRAFT_SPENDING_STYLES[style].cushion * share;

    it('buys ranked filler only with the full cushion to spare', () => {
      const walk = fillerWalk(FILLER_SEED);
      const project = walk.project;
      const filler = shopOdds(project).filter(
        (buy) => draftFillerKind(buy.rewardType) !== undefined,
      );
      expect(filler.length).toBeGreaterThan(0);
      for (const buy of filler) {
        expect(['pom', 'maxHealth', 'maxMagick']).toContain(draftFillerKind(buy.rewardType));
        expect(clears(buy, 1)).toBe(true);
      }
      // Every ranked filler item left in a drafted Shop would break the floor or the cushion.
      let skipped = 0;
      for (const biome of project.route.biomes)
        for (const occurrence of biome.topology?.occurrences ?? []) {
          if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) continue;
          const bought = new Set(
            (occurrence.roomActions?.order ?? []).flatMap((action) =>
              action.kind === 'interactShopOffer' ? [action.offerKey] : [],
            ),
          );
          for (const offerKey of Object.keys(occurrence.state.shop.offers)) {
            const offer = authoredShopOffer(occurrence, offerKey)?.reward?.offer;
            const kind = offer === undefined ? undefined : draftFillerKind(offer.rewardType);
            if (bought.has(offerKey) || kind === undefined || kind === 'gold') continue;
            const address = createShopOfferAddress(
              createBiomeAddress(project.route.routeKey, biome.biomeKey),
              occurrence.occurrenceId,
              offerKey,
            );
            const withPurchase = applyProjectCommand(project, catalog, {
              kind: 'ReplaceShopPurchaseParticipation',
              offer: address,
              purchased: true,
            });
            const buy = shopOdds(withPurchase).find(
              (candidate) => semanticAddressKey(candidate.offer) === semanticAddressKey(address),
            )!;
            expect(clears(buy, 1)).toBe(false);
            skipped += 1;
          }
        }
      expect(skipped).toBeGreaterThan(0);
    });

    it('takes back earlier filler to afford a wanted item, leaving nothing of it behind', () => {
      const walk = fillerWalk(TAKE_BACK_SEED, 'greedy', 1);
      const commands = walk.appliedCommands;
      const at = commands.findIndex(
        (command) => command.kind === 'ReplaceShopPurchaseParticipation' && !command.purchased,
      );
      expect(at).toBeGreaterThan(0);
      // The wanted purchase is applied first, then the filler taken back for it.
      const [bought, takenBack] = [commands[at - 1]!, commands[at]!];
      if (
        bought.kind !== 'ReplaceShopPurchaseParticipation' ||
        takenBack.kind !== 'ReplaceShopPurchaseParticipation'
      )
        throw new Error('no take-back');
      const filler = takenBack.offer;
      const project = walk.project;
      expect(simulateProjectAssembly(catalog, project).evaluation.findings).toEqual([]);
      // The taken-back filler leaves no purchase, pickup or delivery behind.
      const shop = project.route.biomes
        .find((biome) => biome.biomeKey === filler.biomeKey)!
        .topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === filler.occurrenceId,
        )!;
      expect(shop.acquisitionSites?.roomExit?.pickupEntries ?? {}).not.toHaveProperty(
        filler.offerKey,
      );
      expect(JSON.stringify(shop.roomActions)).not.toContain(`"${filler.offerKey}"`);
      const wanted = (plan: ProjectDocument) =>
        shopOdds(plan).find(
          (buy) => semanticAddressKey(buy.offer) === semanticAddressKey(bought.offer),
        )!;
      expect(draftFillerKind(wanted(project).rewardType)).toBeUndefined();
      expect(clears(wanted(project), 0.5, 'greedy')).toBe(true);
      // With the filler bought back, the wanted item's gold falls short.
      const both = applyProjectCommand(project, catalog, { ...takenBack, purchased: true });
      expect(clears(wanted(both), 0.5, 'greedy')).toBe(false);
    });

    it('buys a wanted item with half the cushion to spare, which filler would not take', () => {
      // A corpus seed whose drafted run buys a boon with less than the full cushion to spare.
      const entry = draftCorpusEntry(
        Array.from({ length: DRAFT_CORPUS_SPEC_COUNT }, (_, index) => index).find(
          (index) => draftCorpusEntry(index).name === 'F3 heavy',
        )!,
      );
      const result = draftProject(catalog, entry.base, entry.spec, 1);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      const near = shopOdds(result.project).filter(
        (buy) => draftFillerKind(buy.rewardType) === undefined && !clears(buy, 1),
      );
      expect(near.length).toBeGreaterThan(0);
      for (const buy of near) expect(clears(buy, 0.5)).toBe(true);
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
      // A seed whose first Dream Shop stocks Air with the gold to buy it.
      const walk = startDraftWalk(dream.base, spec, 4);
      expect(walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome), walk.failure).toBe(true);
      // Air for Zeus's waiting Infusion, from the first Dream Shop.
      expect(shopBuys(walk.project)).toContain('H:AirBoost:');
    });
  });

  it.each([
    ['Underworld', 1, underworld],
    ['Underworld', 2, underworld],
    ['Surface', 1, surface],
    ['Dream', 1, dream],
  ] as const)(
    "installs the %s draft's own route, resource points included, seed %i",
    (_route, seed, { base, spec }) => {
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
