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
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  goldLedgerForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type GoldLedger,
} from '@run-planner/engine/simulation';
import { loadSurfaceNQuickBuckCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadSurfaceNOPQProject,
  pBiome,
  pOccurrenceId,
  surfaceShrineDeliveriesProject,
} from '@run-planner/test-fixtures/surface';
import {
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

describe('gold ledger walk', () => {
  it('pays room-reward money before a later shop purchase', () => {
    const gold = ledger(loadUnderworldWorldShopTravelDealCheckpoint());
    expect(
      gold.purchaseAt(createShopOfferAddress(f, 'golden-f-preboss-shop' as never, 'MajorNonBoon')),
    ).toMatchObject({
      availability: 'available',
      purchase: {
        price: { mean: 106 },
        balanceBefore: { availability: 'available', balance: { mean: 100, variance: 0 } },
      },
    });
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
    expect(result).toMatchObject({
      availability: 'available',
      room: { gains: [{ kind: 'poolSale', amount: { min: 50, max: 70 } }] },
    });
  });

  it('takes a Nemesis trade’s cost and assumes a won Nemesis bet', () => {
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
    const bet = gains(
      ledger(fixture('fg-npc-shopping-protection')),
      createOccurrenceAddress(createBiomeAddress('Underworld', 'G'), 'golden-g-b4-e1' as never),
    ).find(([kind]) => kind === 'nemesisBet');
    expect(bet?.[1]).toBeGreaterThan(0);
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

  it('opens a shop room’s doors before its purchases', () => {
    const gold = ledger(loadUnderworldWorldShopTravelDealCheckpoint());
    expect(gold.roomAt(createOccurrenceAddress(f, 'golden-f-preboss-shop' as never))).toMatchObject(
      {
        availability: 'available',
        room: { doorsOpenBalance: { availability: 'available', balance: { mean: 100 } } },
      },
    );
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

  it('pays no Time Piece gold while Pauper’s blocks gold', () => {
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
