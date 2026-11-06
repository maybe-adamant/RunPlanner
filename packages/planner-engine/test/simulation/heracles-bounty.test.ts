import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  HERACLES_BOUNTY_ENTRY_KEY,
  heraclesBountySiteKey,
  roomActionKey,
  selectedPickupProducers,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  goldLedgerForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type GoldRoomSpending,
} from '@run-planner/engine/simulation';
import {
  loadSurfaceNCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome, nOccurrenceId } from '@run-planner/test-fixtures/surface';
import {
  authorLegalTraitOffers,
  editTestRoomActionOrder,
  supportedTraitOffer,
} from '@run-planner/test-fixtures/shared';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import { settlePickupAcquisitionSite } from '../../src/simulation/rewards/acquisition/site-settlement';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits/state';
import { factsWithHistory } from '@run-planner/engine/reward-kernel';
import { initializeTestRewardBranch } from '../support/arcana-fear';
import { baseFacts } from './shop-trait-purchase-support';

const combat05 = nOccurrenceId('combat05');
const room = createOccurrenceAddress(nBiome, combat05);
const phase = createEncounterPhaseAddress(
  nBiome,
  { kind: 'occurrence', occurrenceId: combat05 },
  'Encounter',
);
const bountySite = createAcquisitionSiteAddress(room, heraclesBountySiteKey('Encounter'));
const bountySource = createAcquisitionRoleAddress(
  createAcquisitionEntryAddress(bountySite, HERACLES_BOUNTY_ENTRY_KEY),
  'self',
);
const bountyRow: RoomActionReference = Object.freeze({
  kind: 'interactAcquisitionEntry',
  siteKey: heraclesBountySiteKey('Encounter'),
  entryKey: HERACLES_BOUNTY_ENTRY_KEY,
});
const rewardRow: RoomActionReference = Object.freeze({
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'self',
});

function withHeracles(project: ProjectDocument): ProjectDocument {
  return authorLegalTraitOffers(
    applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'HeraclesCombatN',
    }),
  );
}

/** Replaces one N room's reward trait offer with a supported offer selecting `traitKey`. */
function withTrait(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof nOccurrenceId>,
  role: string,
  giverKey: string,
  traitKey: string,
): ProjectDocument {
  const trait = createTraitOfferAddress(createIncomingRewardAddress(nBiome, occurrenceId), role);
  const value = supportedTraitOffer(project, trait, giverKey, traitKey);
  if (value === undefined) throw new Error(`no supported ${traitKey} offer`);
  return applyProjectCommand(project, catalog, { kind: 'ReplaceTraitOffer', trait, value });
}

/** Sea Star from the pre-Hub's Poseidon boon; Poseidon also takes the room Aphrodite held. */
function withSeaStar(project: ProjectDocument): ProjectDocument {
  const boon = (occurrenceId: ReturnType<typeof nOccurrenceId>): ProjectCommand => ({
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, occurrenceId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });
  let current = applyProjectCommand(project, catalog, boon(nOccurrenceId('prehub')));
  current = applyProjectCommand(current, catalog, boon(nOccurrenceId('combat10')));
  return withTrait(current, nOccurrenceId('prehub'), 'source', 'Poseidon', 'DoubleRewardBoon');
}

function spending(project: ProjectDocument): GoldRoomSpending {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.findings).toEqual([]);
  const result = goldLedgerForProjectEvaluationAssembly(catalog, assembly).roomAt(room);
  if (result.availability !== 'available') throw new Error(`room is ${result.reason}`);
  return result.room;
}

const order = (project: ProjectDocument) =>
  project.route.biomes
    .find((biome) => biome.biomeKey === 'N')!
    .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === combat05)!.roomActions
    .order;

const bountyGains = (room: GoldRoomSpending) =>
  room.gains.filter(
    (gain) =>
      gain.owner?.kind === 'acquisitionEntry' &&
      (gain.owner.site.pointKey === bountySite.pointKey ||
        gain.owner.site.pointKey.startsWith('seaStarDuplicate:')),
  );

describe('Heracles’s bounty', () => {
  it('drops one required bounty pickup after his fight, which pays the bounty', () => {
    const project = withHeracles(loadSurfaceNCheckpoint());
    expect(order(project)).toEqual([rewardRow, bountyRow]);
    const gold = spending(project);
    const [bounty] = bountyGains(gold);
    expect(bounty).toMatchObject({ kind: 'moneyPickup', amount: { mean: 100, variance: 0 } });
    expect(bounty!.roomAction?.actionKey).toBe(roomActionKey(bountyRow));
    // The bounty belongs to its pickup row, not to his fight.
    expect(gold.fights.map((fight) => fight.breakdown.map((line) => line.source))).toEqual([
      ['enemies'],
    ]);
    expect(gold.fights[0]!.fight).toEqual(phase);
  });

  it('publishes the bounty pickup as an acquisition of its own producer', () => {
    const assembly = simulateProjectAssembly(catalog, withHeracles(loadSurfaceNCheckpoint()));
    expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    const found: string[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (record.kind === 'acquisition' && record.producerLifecycleKey === 'HeraclesBountyPickup')
          found.push((record.reward as { rewardType: string }).rewardType);
        Object.values(record).forEach(visit);
      }
    };
    visit(plan);
    expect(found).toEqual(['RoomMoneyDrop']);
  });

  it('owns its pickup from his phase’s end and leaves with his encounter or a Fig Leaf skip', () => {
    const project = withHeracles(loadSurfaceNCheckpoint());
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === combat05)!;
    const declaration = catalog.rooms.byKey[occurrence.gameName]!;
    const [producer] = selectedPickupProducers(catalog, nBiome, occurrence, declaration, 1).filter(
      (candidate) => candidate.siteKey === bountySite.pointKey,
    );
    expect(producer).toMatchObject({
      producerLifecycleKey: 'HeraclesBountyPickup',
      source: phase,
      pickups: [{ key: HERACLES_BOUNTY_ENTRY_KEY, rewardType: 'RoomMoneyDrop', required: true }],
    });
    expect(producer!.sourceAction).toBeUndefined();
    // A Fig Leaf skip fights nothing, so Heracles drops no bounty.
    const skipped = Object.freeze({
      ...occurrence,
      encounters: Object.freeze({
        ...occurrence.encounters,
        figLeafSkipByPhase: Object.freeze({ Encounter: true }),
      }),
    });
    expect(
      selectedPickupProducers(catalog, nBiome, skipped, declaration, 1).map(
        (candidate) => candidate.siteKey,
      ),
    ).not.toContain(bountySite.pointKey);
    const replaced = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedN',
    });
    expect(order(replaced)).not.toContainEqual(bountyRow);
    const remaining = replaced.route.biomes
      .find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === combat05)!;
    expect(remaining.acquisitionSites?.[bountySite.pointKey]).toBeUndefined();
  });

  it('pays its base unmultiplied, re-multiplied only by a money multiplier taken while it lies', () => {
    const quickBuck = withTrait(
      withHeracles(loadSurfaceNCheckpoint()),
      combat05,
      'self',
      'Hermes',
      'MoneyMultiplierBoon',
    );
    const state = quickBuck.route.biomes
      .find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === combat05)!.state;
    const offer =
      state.kind === 'ephyraCombat' ? state.reward?.traitOffersByAcquisitionRole.self : null;
    if (offer?.kind !== 'traits') throw new Error('combat05 offers no Quick Buck');
    const gold = catalog.traits.byKey.MoneyMultiplierBoon?.gold;
    if (gold?.kind !== 'moneyMultiplier') throw new Error('Quick Buck declares no multiplier');
    const value = gold.byRarity[offer.options[0].rarity as keyof typeof gold.byRarity]!;
    // Taken in the room before the bounty is collected: the bounty is re-multiplied.
    const keys = order(quickBuck).map(roomActionKey);
    expect(keys.indexOf(roomActionKey(rewardRow))).toBeLessThan(
      keys.indexOf(roomActionKey(bountyRow)),
    );
    expect(bountyGains(spending(quickBuck))[0]!.amount!.mean).toBe(Math.round(100 * value));
    // Collected first: the bounty pays its base.
    const collectedFirst = editTestRoomActionOrder(quickBuck, catalog, room, (current) => [
      bountyRow,
      ...current.filter((reference) => roomActionKey(reference) !== roomActionKey(bountyRow)),
    ]);
    expect(bountyGains(spending(collectedFirst))[0]!.amount!.mean).toBe(100);
  });

  it('pays its base when the multiplier was held before his fight', () => {
    // The checkpoint's opening Hermes boon is Quick Buck, held before combat05.
    const held = withHeracles(loadSurfaceNQuickBuckCheckpoint());
    expect(bountyGains(spending(held))[0]!.amount!.mean).toBe(100);
  });

  it('pays again for a Sea Star duplicate', () => {
    const project = withHeracles(withSeaStar(loadSurfaceNCheckpoint()));
    const duplicated = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition: bountySource,
      procced: true,
    });
    const gold = spending(duplicated);
    const paid = bountyGains(gold);
    expect(paid.map((gain) => [gain.kind, gain.amount?.mean])).toEqual([
      ['moneyPickup', 100],
      ['moneyPickup', 100],
    ]);
    // Each pickup row carries its own summary.
    expect(
      gold.rows
        .filter((row) =>
          paid.some((gain) => gain.roomAction?.actionKey === row.roomAction.actionKey),
        )
        .map((row) => [row.mean, row.exact]),
    ).toEqual([
      [100, true],
      [100, true],
    ]);
  });

  it('writes the last reward, so Echo’s copy recreates the bounty', () => {
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('bounty-last-reward'),
    );
    const site = createAcquisitionSiteAddress(occurrence, heraclesBountySiteKey('Encounter'));
    const settled = settlePickupAcquisitionSite(catalog, initializeTestRewardBranch(), {
      siteOwner: occurrence,
      site,
      entries: Object.freeze({
        [HERACLES_BOUNTY_ENTRY_KEY]: createUnresolvedAcquisitionRewardState(
          catalog,
          { rewardType: 'RoomMoneyDrop' },
          { kind: 'producerLifecycle', key: 'HeraclesBountyPickup' },
          'Surface',
        ),
      }),
      order: Object.freeze([HERACLES_BOUNTY_ENTRY_KEY]),
      requiredEntryKeys: new Set([HERACLES_BOUNTY_ENTRY_KEY]),
      producerLifecycleKey: 'HeraclesBountyPickup',
      presentsMaterializedScreen: false,
      historySequence: 1,
      facts: (state) => factsWithHistory(baseFacts(), state.rewardHistory, new Set()),
    });
    const recreation = settled.branch?.state.rewardHistory.lastRewardRecreation;
    expect(recreation?.offer).toEqual({ rewardType: 'RoomMoneyDrop' });
    // Echo's Reward Reward Reward replays that descriptor as its own pickup.
    expect(
      catalog.rewards.producerLifecycles.byKey.EchoLastReward?.rewardTypes.byKey[
        recreation!.offer.rewardType
      ],
    ).toBeDefined();
    expect(semanticAddressKey(site)).toContain('heraclesBounty');
  });
});
