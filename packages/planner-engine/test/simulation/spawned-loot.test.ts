import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  hermesShrineDeliveryEntryKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  clockedTraitPickupPlacementForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type RoomSpawnedLoot,
  type SpawnedLootItem,
} from '@run-planner/engine/simulation';
import {
  loadSurfaceNCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfaceNShrineSideRoomDeliveryCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadUnderworldArachneCocoonsCheckpoint,
  loadUnderworldFGHCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  qBiome,
  qOccurrenceIds,
  surfaceShrineDeliveriesProject,
  surfaceShrineDeliverySources,
} from '@run-planner/test-fixtures/surface';
import {
  authorLegalTraitOffers,
  editTestRoomActionOrder,
  purchaseTestHermesShrineOffer,
} from '@run-planner/test-fixtures/shared';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

function loot(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const assembly = evaluate(project);
  const room = createOccurrenceAddress(
    createBiomeAddress(project.route.routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
  const spawned = spawnedLootForProjectEvaluationAssembly(catalog, assembly, room);
  if (spawned === undefined) throw new Error(`${occurrenceId} is not an entered assessed room`);
  return { assembly, spawned };
}

/** What each moment spawned, in spawn order. */
function moments(spawned: RoomSpawnedLoot) {
  return spawned.moments.map((moment) => [moment.key, moment.items.map(describeItem)]);
}

function describeItem(item: SpawnedLootItem): string {
  const source =
    item.source.kind === 'generated'
      ? item.source.family.kind === 'trait'
        ? `trait:${item.source.family.traitKey}`
        : item.source.family.kind === 'echo'
          ? `echo:${item.source.family.effect}`
          : item.source.family.kind
      : item.source.kind === 'fieldsReward'
        ? `${item.source.slotKey}${item.source.cagePhaseKey === undefined ? '' : `@${item.source.cagePhaseKey}`}`
        : item.source.kind;
  const placement =
    item.placement.kind === 'placed'
      ? `#${item.placement.rank}`
      : `unplaced${item.placement.command === undefined ? '' : `:${item.placement.command.kind}`}`;
  return `${source} ${item.participation} ${placement}`;
}

const pCombat03 = 'surface-p-1-1-p_combat03';
const oPostboss = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:postboss'));

describe('spawned loot', () => {
  it('spawns an ordinary reward, then deliveries in purchase order, then Supply Chain drops', () => {
    // A second O Postboss Shrine item, bought before the existing one, falls due beside it.
    let project = purchaseTestHermesShrineOffer(
      loadSurfaceScheduledLifecycleCheckpoint(),
      catalog,
      oPostboss,
      'initial:secondRight',
      { delay: 2, rushed: false },
    );
    project = editTestRoomActionOrder(project, catalog, oPostboss, (order) => {
      const purchase = (generationKey: string) =>
        order.find(
          (reference) =>
            reference.kind === 'purchaseHermesShrineOffer' &&
            reference.generationKey === generationKey,
        )!;
      const bought = purchase('initial:secondRight');
      const rest = order.filter((reference) => reference !== bought);
      const before = rest.indexOf(purchase('initial:secondLeft'));
      return [...rest.slice(0, before), bought, ...rest.slice(before)];
    });
    const { spawned } = loot(project, 'P', pCombat03);
    expect(moments(spawned)).toEqual([
      [
        'encounterEnd:Combat',
        [
          'roomReward required #1',
          'hermesShrineDelivery required unplaced:PlaceHermesShrineDelivery',
          'hermesShrineDelivery required #2',
          'trait:SupplyDropBoon optional #3',
          'trait:SupplyDropBoon optional unplaced:PlaceClockedTraitPickup',
        ],
      ],
    ]);
    const deliveries = spawned.moments[0]!.items.slice(1, 3).map((item) =>
      item.owner.kind === 'acquisitionEntry' ? item.owner.entryKey : undefined,
    );
    expect(deliveries).toEqual([
      hermesShrineDeliveryEntryKey(oPostboss, 'initial:secondRight'),
      hermesShrineDeliveryEntryKey(oPostboss, 'initial:secondLeft'),
    ]);
    expect(spawned.actionSpawns).toEqual([]);
  });

  it('places an unplaced optional Supply Chain drop with its attested command', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const { assembly, spawned } = loot(project, 'P', pCombat03);
    const drop = spawned.moments[0]!.items.at(-1)!;
    expect(drop.participation).toBe('optional');
    if (drop.placement.kind !== 'unplaced' || drop.owner.kind !== 'acquisitionEntry')
      throw new Error('the second drop is placed');
    expect(drop.placement.command).toEqual(
      clockedTraitPickupPlacementForProjectEvaluationAssembly(assembly, drop.owner),
    );
    const placed = settleProjectEdit({
      catalog,
      before: assembly,
      command: drop.placement.command!,
      evaluate,
    }).assembly;
    const after = spawnedLootForProjectEvaluationAssembly(
      catalog,
      placed,
      createOccurrenceAddress(createBiomeAddress('Surface', 'P'), createOccurrenceId(pCombat03)),
    )!;
    expect(after.moments[0]!.items.at(-1)).toMatchObject({
      owner: drop.owner,
      participation: 'optional',
      placement: { kind: 'placed', rank: 4 },
    });
  });

  it('spawns an O phase’s deliveries after its wheel reward, and an Intro’s at its end', () => {
    const project = surfaceShrineDeliveriesProject();
    expect(moments(loot(project, 'O', oOccurrenceIds.combat04).spawned)).toEqual([
      ['encounterEnd:Combat1', ['rewardWheel required #2']],
      ['afterEncounterReward:Combat1', ['hermesShrineDelivery required #3']],
    ]);
    expect(moments(loot(project, 'O', oOccurrenceIds.combat01).spawned)).toEqual([
      ['encounterEnd:Intro', ['hermesShrineDelivery required #1']],
      ['encounterEnd:Combat1', ['rewardWheel required #3']],
      ['afterEncounterReward:Combat1', ['hermesShrineDelivery required #4']],
    ]);
  });

  it('flushes the fourth-biome delivery at Preboss entry', () => {
    const { spawned } = loot(surfaceShrineDeliveriesProject(), 'Q', qOccurrenceIds.preboss);
    expect(moments(spawned)).toEqual([['deliveryFlush', ['hermesShrineDelivery required #1']]]);
    expect(spawned.moments[0]!.items[0]!.owner).toMatchObject({
      entryKey: hermesShrineDeliveryEntryKey(
        surfaceShrineDeliverySources.pPostboss,
        'initial:secondRight',
      ),
    });
    expect(spawned.owner).toEqual(createOccurrenceAddress(qBiome, qOccurrenceIds.preboss));
  });

  it('spawns an Opening reward on entry', () => {
    expect(moments(loot(loadSurfaceNCheckpoint(), 'N', nOccurrenceIds.opening).spawned)).toEqual([
      ['roomEntered', ['roomReward required #1']],
    ]);
  });

  it('spawns Arachne’s reward during her cocoon fight', () => {
    expect(
      moments(loot(loadUnderworldArachneCocoonsCheckpoint(), 'F', 'golden-f-b5-e1').spawned),
    ).toEqual([['duringEncounter:Encounter', ['roomReward required #1']]]);
  });

  it('spawns an H miniboss reward at its encounter start', () => {
    expect(
      moments(loot(loadUnderworldFGHCheckpoint(), 'H', 'golden-h-miniboss01').spawned),
    ).toEqual([['encounterStart:Encounter', ['roomReward required #1']]]);
  });

  it('spawns Fields cage and optional rewards on entry, each cage marked', () => {
    expect(moments(loot(loadUnderworldFGHCheckpoint(), 'H', 'golden-h-combat02').spawned)).toEqual([
      [
        'roomEntered',
        [
          'cage2@Cage02 required #2',
          'cage1@Cage01 required #4',
          'optional1 optional unplaced:InsertRoomAction',
          'optional2 optional unplaced:InsertRoomAction',
        ],
      ],
    ]);
  });

  it('spawns nothing but its reward in an N side room while a delivery is pending', () => {
    const project = loadSurfaceNShrineSideRoomDeliveryCheckpoint();
    const sideRooms = project.route.biomes
      .find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.filter((occurrence) => occurrence.gameName.startsWith('N_Sub'));
    expect(sideRooms.length).toBeGreaterThan(0);
    for (const room of sideRooms) {
      const assembly = evaluate(project);
      const spawned = spawnedLootForProjectEvaluationAssembly(
        catalog,
        assembly,
        createOccurrenceAddress(nBiome, room.occurrenceId),
      );
      if (spawned === undefined) continue;
      for (const moment of spawned.moments)
        expect(moment.items.map((item) => item.source.kind)).toEqual(['roomReward']);
    }
    // The pending delivery falls due at a later main room's encounter end.
    expect(moments(loot(project, 'N', nOccurrenceId('combat09')).spawned)).toEqual([
      [
        'encounterEnd:Encounter',
        [
          'roomReward required #1',
          'hermesShrineDelivery required unplaced:PlaceHermesShrineDelivery',
        ],
      ],
    ]);
  });

  it('drops Heracles’s bounty after the encounter end’s own spawns', () => {
    const combat05 = nOccurrenceId('combat05');
    const project = authorLegalTraitOffers(
      applyProjectCommand(loadSurfaceNCheckpoint(), catalog, {
        kind: 'SelectEncounter',
        phase: createEncounterPhaseAddress(
          nBiome,
          { kind: 'occurrence', occurrenceId: combat05 },
          'Encounter',
        ),
        encounterKey: 'HeraclesCombatN',
      }),
    );
    expect(moments(loot(project, 'N', combat05).spawned)).toEqual([
      ['encounterEnd:Encounter', ['roomReward required #1', 'heraclesBounty required #2']],
    ]);
  });

  it('lists Quick Buck’s gold under the reward pickup that grants the boon', () => {
    const { spawned } = loot(loadSurfaceNQuickBuckCheckpoint(), 'N', nOccurrenceIds.opening);
    expect(
      spawned.actionSpawns.map((spawn) => [spawn.source, spawn.items.map(describeItem)]),
    ).toEqual([
      [
        {
          kind: 'interactIncomingReward',
          producerPoint: 'roomRewardPickup',
          acquisitionRole: 'self',
        },
        [expect.stringMatching(/^trait:MoneyMultiplierBoon optional #\d+$/)],
      ],
    ]);
    expect(spawned.actionSpawns[0]!.items[0]!.owner).toMatchObject({
      kind: 'acquisitionEntry',
      entryKey: 'quickBuckGold',
    });
  });
});
