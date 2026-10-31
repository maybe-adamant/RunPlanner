import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  acquisitionSiteStorageKey,
  createIncomingRewardAddress,
  createPostbossKeepsakeSelectionAddress,
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  NATIVE_RUN_MODIFIERS,
  createShopOfferAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  generatedEncounterSupportForProjectEvaluationAssembly,
  goldLedgerForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type GoldLedger,
} from '@run-planner/engine/simulation';
import {
  knownEncounterRoster,
  knownRosterPayout,
} from '../../src/simulation/commerce/gold/known-roster';
import {
  loadSurfaceNOPQCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfacePSteadyGrowthShrineFrontierCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadSurfaceNOPQProject,
  pBiome,
  pOccurrenceId,
  surfaceShrineDeliveriesProject,
} from '@run-planner/test-fixtures/surface';
import {
  loadNemesisFieldsCheckpoint,
  loadNemesisPomSeaStarCheckpoint,
  loadUnderworldFPoolCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
  underworldCheckpointArtifacts,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { editTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGIxionChaosProject,
  createGoldenFGHIProject,
  createGoldenFGHProject,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { createFreshFileFProject } from '@run-planner/test-fixtures/fresh-file';
import { executionFixtures } from '../execution-plan/support/execution-fixtures';

const f = createBiomeAddress('Underworld', 'F');
const ledger = (project: ProjectDocument): GoldLedger =>
  goldLedgerForProjectEvaluationAssembly(catalog, simulateProjectAssembly(catalog, project));
const gains = (gold: GoldLedger, room: ReturnType<typeof createOccurrenceAddress>) => {
  const result = gold.roomAt(room);
  if (result.availability !== 'available') throw new Error(`room is ${result.reason}`);
  return result.room.gains.map((gain) => [gain.kind, gain.amount?.mean]);
};
const fixture = (name: string) => {
  const found = executionFixtures.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`no ${name} fixture`);
  return found.project();
};

function narcissusProject(
  selected: string,
  entryKey: string,
): {
  readonly project: ProjectDocument;
  readonly room: ReturnType<typeof createOccurrenceAddress>;
  readonly site: ReturnType<typeof createAcquisitionSiteAddress>;
} {
  let project = createGoldenFGHIProject();
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')!
    .topology!.occurrences.find((candidate) => candidate.gameName === 'G_Story01')!;
  const room = createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Narcissus',
      options: [{ traitKey: selected }, { traitKey: 'NarcissusB' }, { traitKey: 'NarcissusD' }],
      selectedOptionKey: 'option1',
    },
  });
  const updated = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === occurrence.occurrenceId)!;
  const siteKey = Object.entries(updated.acquisitionSites ?? {}).find(([, site]) =>
    Object.hasOwn(site.pickupEntries ?? {}, entryKey),
  )![0];
  const site = createAcquisitionSiteAddress(room, siteKey);
  project = editTestRoomActionOrder(project, catalog, room, (order) => [
    ...order,
    {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: site.pointKey === 'roomExit' ? 'roomExit' : acquisitionSiteStorageKey(site),
      entryKey,
    },
  ]);
  return { project, room, site };
}

/** Every F room's gains before the Preboss shop's purchases, split into fixed and estimated gold. */
function fGainsBeforeShop(project: ProjectDocument, gold: GoldLedger) {
  const totals = { fixed: 0, estimated: 0, variance: 0 };
  for (const occurrence of project.route.biomes.find((biome) => biome.biomeKey === 'F')!.topology!
    .occurrences) {
    if (/^F_(Boss|PostBoss)/.test(occurrence.gameName)) continue;
    const result = gold.roomAt(createOccurrenceAddress(f, occurrence.occurrenceId));
    if (result.availability !== 'available') continue;
    for (const gain of result.room.gains) {
      const estimated = ['enemyGold', 'urnGold', 'medeaGold'].includes(gain.kind);
      if (estimated) totals.estimated += gain.amount!.mean;
      else totals.fixed += gain.amount!.mean;
      totals.variance += gain.amount!.variance;
    }
  }
  return totals;
}

describe('gold ledger walk', () => {
  it('pays room-reward money and enemy gold before a later shop purchase', () => {
    const project = loadUnderworldWorldShopTravelDealCheckpoint();
    const gold = ledger(project);
    const before = fGainsBeforeShop(project, gold);
    expect(before.fixed).toBe(100);
    const purchase = gold.purchaseAt(
      createShopOfferAddress(f, 'golden-f-preboss-shop' as never, 'MajorNonBoon'),
    );
    expect(purchase).toMatchObject({
      availability: 'available',
      purchase: { price: { mean: 106 } },
    });
    if (
      purchase.availability !== 'available' ||
      purchase.purchase.balanceBefore.availability !== 'available'
    )
      throw new Error('the shop purchase is unpriced');
    const { balance } = purchase.purchase.balanceBefore;
    expect(balance.mean).toBeCloseTo(100 + before.estimated, 9);
    expect(balance.variance).toBeCloseTo(before.variance, 9);
    // About 290 gold held for a 106 price: affordable with near certainty.
    expect(purchase.purchase.affordableProbability).toBeGreaterThan(0.999);
  });

  it('multiplies later money by a held Quick Buck', () => {
    const gold = ledger(loadSurfaceNQuickBuckCheckpoint());
    const room = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      'surface-n-combat02-sideDoor1' as never,
    );
    // A Tiny money drop at Common Quick Buck: round(20 x 1.2).
    expect(gains(gold, room)).toContainEqual(['moneyPickup', 24]);
  });

  it('starts the run with the Boatman’s gold', () => {
    const gold = ledger(underworldCheckpointArtifacts['underworld-f-trait-order-checks'].load());
    expect(gold.runStart()).toMatchObject({
      gains: [{ kind: 'startingGold', amount: { mean: 300 } }],
      balance: { availability: 'available', balance: { mean: 300 } },
    });
  });

  it('pays a Boatman Arcana activated after the boss', () => {
    const gold = ledger(fixture('underworld-f-rerolls'));
    expect(
      gains(gold, createOccurrenceAddress(f, 'golden-f-preboss-shop:boss' as never)),
    ).toContainEqual(['arcanaGold', 300]);
  });

  it('pays a Pool of Purging sale from the sold trait’s rarity and level', () => {
    const gold = ledger(loadUnderworldFPoolCheckpoint());
    const result = gold.roomAt(
      createOccurrenceAddress(f, 'golden-f-preboss-shop:postboss' as never),
    );
    // A level-2 Common: 30-50 floored to five, plus 20.
    if (result.availability !== 'available') throw new Error('the Postboss room is unpriced');
    expect(result.room.gains.find((gain) => gain.kind === 'poolSale')).toMatchObject({
      amount: { min: 50, max: 70 },
    });
  });

  it('takes a Nemesis trade’s cost and settles a Nemesis bet by its authored outcome', () => {
    // The checkpoint stops inside the trading room, so read its walk publication.
    const traded = simulateProjectAssembly(catalog, loadNemesisPomSeaStarCheckpoint());
    const trades = traded.evaluation.route.biomes.flatMap((biome) =>
      'rewards' in biome
        ? biome.rewards.goldEvents.flatMap((event) =>
            event.kind === 'gain' ? event.contexts.map((context) => context.gain) : [],
          )
        : [],
    );
    expect(trades).toContainEqual({ kind: 'nemesisTrade', min: 80, max: 105 });
    const project = fixture('fg-npc-shopping-protection');
    const g = createBiomeAddress('Underworld', 'G');
    const nemesisRoom = createOccurrenceAddress(g, 'golden-g-b4-e1' as never);
    const betWith = (value: 'win' | 'tie' | 'loss' | null) =>
      gains(
        ledger(
          applyProjectCommand(project, catalog, {
            kind: 'ReplaceNemesisBetOutcome',
            phase: createEncounterPhaseAddress(
              g,
              { kind: 'occurrence', occurrenceId: 'golden-g-b4-e1' as never },
              'Encounter',
            ),
            value,
          }),
        ),
        nemesisRoom,
      ).find(([kind]) => kind === 'nemesisBet')?.[1] as number;
    const unauthored = gains(ledger(project), nemesisRoom).find(([kind]) => kind === 'nemesisBet');
    expect(unauthored?.[1]).toBeGreaterThan(0);
    expect(betWith('win')).toBe(unauthored?.[1]);
    expect(betWith('tie')).toBe(0);
    expect(betWith('loss')).toBeLessThan(0);
    expect(betWith('loss')).toBeGreaterThanOrEqual(-100);
  });

  it('pays Narcissus’s Precious Metals and a Time Piece conversion', () => {
    const currency = narcissusProject('NarcissusC', 'currency');
    expect(gains(ledger(currency.project), currency.room)).toContainEqual(['currencyPickup', 100]);
    const { project, room, site } = narcissusProject('NarcissusH', 'lastStand');
    let converted = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    converted = applyProjectCommand(converted, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(
        createAcquisitionEntryAddress(site, 'lastStand'),
        'self',
      ),
      value: { kind: 'timePiece' },
    });
    // LastStandDrop's GoldifyValue.
    expect(gains(ledger(converted), room)).toContainEqual(['timePiece', 400]);
  });

  it('estimates an Erebus room’s kill gold from its store and its urns from the biome', () => {
    const start = createOccurrenceAddress(f, 'golden-f-start' as never);
    const withModifiers = (value: Partial<typeof NATIVE_RUN_MODIFIERS>) =>
      ledger(
        applyProjectCommand(loadUnderworldWorldShopTravelDealCheckpoint(), catalog, {
          kind: 'ReplaceRunModifiers',
          route: createRouteAddress('Underworld'),
          value: { ...NATIVE_RUN_MODIFIERS, ...value },
        }),
      );
    const native = ledger(loadUnderworldWorldShopTravelDealCheckpoint()).roomAt(start);
    if (native.availability !== 'available') throw new Error('the opening is unpriced');
    // Run depth 1: RandomInt(10, 15) + 0.5, rounded up to 11..16, plus Erebus's 1.9 overshoot.
    const kills = native.room.gains.find((gain) => gain.kind === 'enemyGold');
    const urns = native.room.gains.find((gain) => gain.kind === 'urnGold');
    expect(kills).toMatchObject({ kind: 'enemyGold' });
    expect(kills!.amount!.mean).toBeCloseTo(13.5 + 1.9, 9);
    expect(kills!.amount!.variance).toBeCloseTo(35 / 12 + 9, 9);
    expect(urns).toMatchObject({ kind: 'urnGold' });
    expect(urns!.amount!.mean).toBeCloseTo(4 * 0.7 * 0.44502, 3);
    expect(gains(withModifiers({ enemyGoldDropChance: 0 }), start)).toContainEqual([
      'enemyGold',
      0,
    ]);
    // The top of the range fixes the roll at 15: ceil(15.5) = 16.
    const fixed = withModifiers({ encounterGoldRange: 100 }).roomAt(start);
    if (fixed.availability !== 'available') throw new Error('the opening is unpriced');
    expect(fixed.room.gains.find((gain) => gain.kind === 'enemyGold')!.amount).toMatchObject({
      mean: 16 + 1.9,
      variance: 9,
    });
  });

  it('pays a Fields room its Passive store once, through its cages’ kills', () => {
    const gold = ledger(createGoldenFGHProject());
    const h = createBiomeAddress('Underworld', 'H');
    // Two cages, one store: RandomInt(10, 30) plus the crossing overshoot of 9; Fields has no urns.
    expect(gains(gold, createOccurrenceAddress(h, 'golden-h-combat02' as never))).toEqual([
      ['enemyGold', 20 + 9],
    ]);
  });

  it('pays a boss room its adds’ kill gold, uncapped', () => {
    const boss = gains(
      ledger(createGoldenFGHProject()),
      createOccurrenceAddress(f, 'golden-f-preboss-shop:boss' as never),
    ).find(([kind]) => kind === 'enemyGold');
    // Hecate's twelve LightRanged at 70%, 3..4 gold each.
    expect(boss?.[1]).toBeCloseTo(12 * 0.7 * 3.5, 9);
  });

  it('pays a Fields room whose Passive slot holds the Nemesis event its undrawn store of 25', () => {
    const gold = ledger(loadNemesisFieldsCheckpoint());
    const kills = gains(
      gold,
      createOccurrenceAddress(createBiomeAddress('Underworld', 'H'), 'golden-h-combat05' as never),
    ).filter(([kind]) => kind === 'enemyGold');
    // Paid once at the first cage: 25 plus the Fields overshoot of 9, no draw.
    expect(kills).toEqual([['enemyGold', 25 + 9]]);
  });

  it('swaps golden urns in every room of a mature run and none on a Fresh File', () => {
    const mature = ledger(createGoldenFGHProject());
    for (const occurrenceId of ['golden-f-start', 'golden-f-preboss-shop'])
      expect(gains(mature, createOccurrenceAddress(f, occurrenceId as never))).toContainEqual([
        'urnGold',
        4 * 0.7 * (0.01 * 15 + 0.99 * 0.02 * 10 + 0.99 * 0.98 * 0.02 * 5),
      ]);
    const fresh = createFreshFileFProject();
    const freshGold = ledger(fresh);
    const rooms = fresh.route.biomes.find((biome) => biome.biomeKey === 'F')!.topology!.occurrences;
    const kinds = rooms.flatMap((occurrence) => {
      const result = freshGold.roomAt(
        createOccurrenceAddress(
          createBiomeAddress(fresh.route.routeKey, 'F'),
          occurrence.occurrenceId,
        ),
      );
      return result.availability === 'available' ? result.room.gains.map((gain) => gain.kind) : [];
    });
    expect(kinds).toContain('enemyGold');
    expect(kinds).not.toContain('urnGold');
  });

  it('pays an authored composition from its roster in place of the biome policy', () => {
    const start = createOccurrenceAddress(f, 'golden-f-start' as never);
    const phase = createEncounterPhaseAddress(
      f,
      { kind: 'occurrence', occurrenceId: start.occurrenceId },
      'Encounter',
    );
    const native = loadUnderworldWorldShopTravelDealCheckpoint();
    const capability = generatedEncounterSupportForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, native),
      phase,
    )!;
    const value = capability.initialize()!;
    const operands = capability.assess(value).operands!;
    const project = applyProjectCommand(native, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: capability.decisionKey,
      value,
    });
    const kills = gains(ledger(project), start).find(([kind]) => kind === 'enemyGold');
    const roster = knownEncounterRoster(catalog, 'OpeningGeneratedF', operands)!;
    // Run depth 1: the opening's store is RandomInt(10, 15) + 0.5, rounded up.
    const expected = knownRosterPayout(catalog, roster, {
      moneyMultiplier: 1,
      stores: [11, 12, 13, 14, 15, 16],
    });
    expect(kills).toEqual(['enemyGold', expected.mean]);
    expect(expected.mean).not.toBeCloseTo(13.5 + 1.9, 1);
  });

  it('pays a Summit combat its biome’s fraction of the store', () => {
    const gold = ledger(loadSurfaceNOPQCheckpoint());
    const room = createOccurrenceAddress(
      createBiomeAddress('Surface', 'Q'),
      'surface-q-foyer' as never,
    );
    const kills = gains(gold, room).find(([kind]) => kind === 'enemyGold');
    expect(kills![1]).toBeCloseTo(0.73 * 72.5, 9);
  });

  it('pays Wealth from the Dead in the fights after Medea’s curse is taken', () => {
    let project = loadSurfacePSteadyGrowthShrineFrontierCheckpoint();
    const n = createBiomeAddress('Surface', 'N');
    const occurrences = project.route.biomes.find((biome) => biome.biomeKey === 'N')!.topology!
      .occurrences;
    const story = occurrences.find((occurrence) => occurrence.gameName === 'N_Story01')!;
    const offer = story.encounters.traitOffersByPhase?.Encounter?.Story_Medea_01;
    if (offer?.kind !== 'traits') throw new Error('the fixture offers no Medea curse');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          n,
          { kind: 'occurrence', occurrenceId: story.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: { ...offer, selectedOptionKey: 'option2' },
    });
    const gold = ledger(project);
    const kinds = (gameName: string) =>
      gains(
        gold,
        createOccurrenceAddress(
          n,
          occurrences.find((occurrence) => occurrence.gameName === gameName)!.occurrenceId,
        ),
      ).map(([kind]) => kind);
    expect(kinds('N_Opening01')).not.toContain('medeaGold');
    expect(kinds('N_Story01')).toEqual([]);
    const later = gains(
      gold,
      createOccurrenceAddress(
        n,
        occurrences.find((occurrence) => occurrence.gameName === 'N_Combat11')!.occurrenceId,
      ),
    );
    expect(later.find(([kind]) => kind === 'medeaGold')?.[1]).toBeGreaterThan(0);
  });

  it('opens a shop room’s doors before its purchases', () => {
    const project = loadUnderworldWorldShopTravelDealCheckpoint();
    const gold = ledger(project);
    const room = gold.roomAt(createOccurrenceAddress(f, 'golden-f-preboss-shop' as never));
    if (
      room.availability !== 'available' ||
      room.room.doorsOpenBalance.availability !== 'available'
    )
      throw new Error('the shop room is unpriced');
    const before = fGainsBeforeShop(project, gold);
    expect(room.room.doorsOpenBalance.balance.mean).toBeCloseTo(before.fixed + before.estimated, 9);
    expect(room.room.purchases.length).toBeGreaterThan(0);
  });

  it('opens the fourth biome’s Preboss doors after its flushed deliveries and earlier purchases', () => {
    const q = createBiomeAddress('Surface', 'Q');
    const prebossId = 'surface-q-preboss' as never;
    const room = createOccurrenceAddress(q, prebossId);
    let project = editTestRoomActionOrder(
      surfaceShrineDeliveriesProject(),
      catalog,
      room,
      (order) => [{ kind: 'interactShopOffer' as const, offerKey: 'Survival' }, ...order],
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(q, prebossId, 'travelDealRefill'),
      value: { rewardType: 'LastStandDrop' },
    });
    const gold = ledger(project);
    const purchase = gold.purchaseAt(createShopOfferAddress(q, prebossId, 'Survival'));
    if (
      purchase.availability !== 'available' ||
      purchase.purchase.balanceBefore.availability !== 'available'
    )
      throw new Error('the Preboss purchase is unpriced');
    // The flushed delivery is the required action the exit waits on, after the purchase.
    expect(gold.roomAt(room)).toMatchObject({
      availability: 'available',
      room: {
        doorsOpenBalance: {
          balance: {
            mean: purchase.purchase.balanceBefore.balance.mean - purchase.purchase.price.mean,
          },
        },
      },
    });
  });

  it('adds the boosted bonus to a reward Time Piece converts in a boosted-rarity room', () => {
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(
        createIncomingRewardAddress(f, 'golden-f-b6-e1' as never),
        'source',
      ),
      value: { kind: 'timePiece' },
    });
    // F_MiniBoss01's Hera boon: 400 + 150.
    expect(
      gains(ledger(project), createOccurrenceAddress(f, 'golden-f-b6-e1' as never)),
    ).toContainEqual(['timePiece', 550]);
  });

  it('pays no Time Piece, kill or urn gold while Pauper’s blocks gold', () => {
    const g = createBiomeAddress('Underworld', 'G');
    let project = applyProjectCommand(createCompleteFGIxionChaosProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(
        createIncomingRewardAddress(g, 'golden-g-b2-e1' as never),
        'self',
      ),
      value: { kind: 'timePiece' },
    });
    expect(gains(ledger(project), createOccurrenceAddress(g, 'golden-g-b2-e1' as never))).toEqual([
      ['urnGold', 0],
      ['enemyGold', 0],
      ['timePiece', 0],
    ]);
  });

  it('takes the balance into Personal Loan and pays it back at the next non-final boss', () => {
    const storyId = pOccurrenceId('P_Story01', 7, 1);
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          pBiome,
          { kind: 'occurrence', occurrenceId: storyId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Dionysus',
        options: [
          { traitKey: 'BankBoon', rarity: 'Common' },
          { traitKey: 'HiddenMaxHealthBoon', rarity: 'Epic' },
          { traitKey: 'FirstHangoverBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const gold = ledger(project);
    const [[, taken]] = gains(gold, createOccurrenceAddress(pBiome, storyId)).filter(
      ([kind]) => kind === 'loanTake',
    ) as [[string, number]];
    expect(
      gains(gold, createOccurrenceAddress(pBiome, 'surface-p-preboss-shop:boss' as never)),
    ).toContainEqual(['loanPayback', -taken + 300]);
  });

  it('pays a Gold Purse equipped at a Postboss rack', () => {
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(
        createOccurrenceAddress(f, 'golden-f-preboss-shop:postboss' as never),
      ),
      keepsakeKey: 'BonusMoneyKeepsake',
    });
    // Rank III Gold Purse.
    expect(
      gains(ledger(project), createOccurrenceAddress(f, 'golden-f-preboss-shop:postboss' as never)),
    ).toContainEqual(['keepsakeGold', 150]);
  });
});
