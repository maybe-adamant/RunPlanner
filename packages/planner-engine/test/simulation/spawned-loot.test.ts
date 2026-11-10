import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createIncomingRewardAddress,
  createNemesisRandomEventAddress,
  createOccurrenceId,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createRouteAddress,
  createStartingRewardAddress,
  hermesShrineDeliveryEntryKey,
  roomActionKey,
  type AuthoredNemesisRandomEventOutcome,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  clockedTraitPickupPlacementForProjectEvaluationAssembly,
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
  encounterOutcomesForProjectEvaluationAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type RoomSpawnedLoot,
  type SpawnedLootItem,
} from '@run-planner/engine/simulation';
import {
  loadSurfaceNCheckpoint,
  loadSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNOPQCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfaceNShrineSideRoomDeliveryCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
  loadSurfaceShrineTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadNemesisPomSeaStarCheckpoint,
  loadUnderworldArachneCocoonsCheckpoint,
  loadUnderworldFGHCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
  underworldCheckpointArtifacts,
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
  createEchoGoldIAnvilDuplicateProject,
  createEchoTalentDropReplayProject,
  createFConversionFrontierProject,
  createCompleteFGProject,
  createGoldenFGHIProject,
  echoGoldIDuplicateAnvilResult,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  replaceNemesisRandomEventInteraction,
} from '@run-planner/test-fixtures/underworld';
import {
  createFreshFileRouteProject,
  newHFieldsRoomId,
  withNewHFieldsRoom,
} from '@run-planner/test-fixtures/fresh-file';
import {
  authorLegalPomResolutions,
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
  const lock = item.lockedUntil === undefined ? '' : ` locked:${item.lockedUntil}`;
  return `${source} ${item.participation} ${placement}${lock}`;
}

/** What each unlock frees, in spawn order. */
function unlocks(spawned: RoomSpawnedLoot) {
  return spawned.unlocks.map((unlock) => [unlock.key, unlock.items.map(describeItem)]);
}

/** What each moment's items spawn as. */
function momentRewards(spawned: RoomSpawnedLoot) {
  return spawned.moments.map((moment) => [moment.key, moment.items.map((item) => item.reward)]);
}

const offer = (rewardType: string) => ({ kind: 'offer', offer: { rewardType } });

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

  // A Supply Chain Pom Slice spawns once its boon is taken and the encounter that matures it
  // ends; the Pom it levels is the slice's own choice, which never holds the spawn back.
  it('spawns a Supply Chain Pom Slice before and after its Pom is chosen', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const { assembly, spawned } = loot(project, 'P', pCombat03);
    const drop = spawned.moments[0]!.items.at(-1)!;
    if (drop.placement.kind !== 'unplaced') throw new Error('the second drop is placed');
    const placed = settleProjectEdit({
      catalog,
      before: assembly,
      command: drop.placement.command!,
      evaluate,
    }).assembly;
    const room = createOccurrenceAddress(
      createBiomeAddress('Surface', 'P'),
      createOccurrenceId(pCombat03),
    );
    const p = placed.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
    // Placed, its Pom is unchosen and the walk stops at its pickup.
    expect(p?.coverage.kind === 'prefix' ? p.coverage.roomStop?.room : undefined).toEqual(room);
    const unchosen = spawnedLootForProjectEvaluationAssembly(catalog, placed, room)!;
    const chosen = spawnedLootForProjectEvaluationAssembly(
      catalog,
      evaluate(authorLegalPomResolutions(placed.project)),
      room,
    )!;
    for (const after of [unchosen, chosen])
      expect(moments(after)).toEqual([
        [
          'encounterEnd:Combat',
          [
            'roomReward required #1',
            'hermesShrineDelivery required #2',
            'trait:SupplyDropBoon optional #3',
            'trait:SupplyDropBoon optional #4',
          ],
        ],
      ]);
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
    // Its Pom Slice asks for its Pom once placed; nothing else in the moment does.
    const items = spawned.moments[0]!.items;
    expect(items.map((item) => item.needsChoice)).toEqual([
      ...items.slice(0, -1).map(() => undefined),
      'levelResolution',
    ]);
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
    expect(after.moments[0]!.items.at(-1)?.needsChoice).toBeUndefined();
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

  it('spawns Arachne’s reward as breaking its cocoon ends her fight', () => {
    // The cocoons stand from entry with the reward hidden: nothing spawns or locks before.
    const { assembly, spawned } = loot(
      loadUnderworldArachneCocoonsCheckpoint(),
      'F',
      'golden-f-b5-e1',
    );
    expect(moments(spawned)).toEqual([['encounterEnd:Encounter', ['roomReward required #1']]]);
    expect(unlocks(spawned)).toEqual([]);
    // An ordinary fight: nothing about how it ended is a choice, and the walk passes through.
    expect(encounterOutcomesForProjectEvaluationAssembly(catalog, assembly, spawned.owner)).toEqual(
      [],
    );
    const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
    const stop = f?.coverage.kind === 'prefix' ? f.coverage.roomStop : undefined;
    expect(stop?.room.occurrenceId).not.toBe('golden-f-b5-e1');
  });

  it('spawns an H miniboss reward caged at its encounter start, freed at its end', () => {
    const { spawned } = loot(loadUnderworldFGHCheckpoint(), 'H', 'golden-h-miniboss01');
    expect(moments(spawned)).toEqual([
      ['encounterStart:Encounter', ['roomReward required #1 locked:encounterEnd:Encounter']],
    ]);
    expect(unlocks(spawned)).toEqual([
      ['encounterEnd:Encounter', ['roomReward required #1 locked:encounterEnd:Encounter']],
    ]);
  });

  it('spawns Fields cage and optional rewards on entry, each cage locked until its fight ends', () => {
    const { spawned } = loot(loadUnderworldFGHCheckpoint(), 'H', 'golden-h-combat02');
    expect(moments(spawned)).toEqual([
      [
        'roomEntered',
        [
          'cage2@Cage02 required #2 locked:encounterEnd:Cage02',
          'cage1@Cage01 required #4 locked:encounterEnd:Cage01',
          'optional1 optional unplaced:InsertRoomAction',
          'optional2 optional unplaced:InsertRoomAction',
        ],
      ],
    ]);
    // In the order the cage fights run.
    expect(unlocks(spawned)).toEqual([
      ['encounterEnd:Cage02', ['cage2@Cage02 required #2 locked:encounterEnd:Cage02']],
      ['encounterEnd:Cage01', ['cage1@Cage01 required #4 locked:encounterEnd:Cage01']],
    ]);
  });

  it('spawns a Trial’s chosen boon on entry and its spurned boon at the fight’s end, unlocked', () => {
    const { spawned } = loot(
      loadSurfaceNOHermesShrineDeliveryCheckpoint(),
      'O',
      'surface-o-devotion',
    );
    expect(moments(spawned)).toEqual([
      ['roomEntered', ['roomReward required #1']],
      ['encounterEnd:Encounter', ['roomReward required #2', 'hermesShrineDelivery required #3']],
    ]);
    expect(unlocks(spawned)).toEqual([]);
  });

  it('publishes what each item spawns as', () => {
    // A room reward, a due delivery and Supply Chain's Pom Slices.
    expect(
      momentRewards(loot(loadSurfaceScheduledLifecycleCheckpoint(), 'P', pCombat03).spawned),
    ).toEqual([
      [
        'encounterEnd:Combat',
        [
          offer('MaxHealthDrop'),
          offer('MaxHealthDrop'),
          offer('StoreRewardRandomStack'),
          offer('StoreRewardRandomStack'),
        ],
      ],
    ]);
    // A Trial spawns each god's boon on its own.
    expect(
      momentRewards(
        loot(loadSurfaceNOHermesShrineDeliveryCheckpoint(), 'O', 'surface-o-devotion').spawned,
      ),
    ).toEqual([
      ['roomEntered', [{ kind: 'pickup', gameName: 'AresUpgrade' }]],
      [
        'encounterEnd:Encounter',
        [{ kind: 'pickup', gameName: 'HephaestusUpgrade' }, offer('MaxHealthDrop')],
      ],
    ]);
    // Fields cages and optional rewards.
    expect(
      momentRewards(loot(loadUnderworldFGHCheckpoint(), 'H', 'golden-h-combat02').spawned),
    ).toEqual([
      [
        'roomEntered',
        [
          offer('MaxManaDrop'),
          offer('MaxHealthDrop'),
          offer('MaxManaDropSmall'),
          offer('MaxManaDropSmall'),
        ],
      ],
    ]);
    // A Boss's forced drop.
    expect(
      momentRewards(loot(loadUnderworldFGHCheckpoint(), 'F', 'golden-f-preboss-shop:boss').spawned),
    ).toEqual([
      ['encounterEnd:Encounter', [{ kind: 'requiredDrop', consumableKey: 'MixerFBossDrop' }]],
    ]);
  });

  it('publishes a forfeited reward as the Red Onion it spawns as', () => {
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const { spawned } = loot(project, 'F', goldenFStartId);
    expect(momentRewards(spawned)[0]?.[1]).toEqual([
      { kind: 'pickup', gameName: 'RoomRewardConsolationPrize' },
    ]);
  });

  it('locks nothing in an ordinary reward room', () => {
    expect(unlocks(loot(loadSurfaceNCheckpoint(), 'N', nOccurrenceIds.opening).spawned)).toEqual(
      [],
    );
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

  it('publishes no moment past the room’s stop: a Fields room stopped at its Overview', () => {
    const project = withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'min');
    const { assembly, spawned } = loot(project, 'H', newHFieldsRoomId);
    const h = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'H');
    const stop = h?.coverage.kind === 'prefix' ? h.coverage.roomStop : undefined;
    expect(stop).toMatchObject({ kind: 'overview', at: 'before' });
    // Its cages spawn on entry, locked; the fights that free them are past the stop.
    expect(spawned.moments.map((moment) => moment.key)).toEqual(['roomEntered']);
    expect(spawned.moments[0]!.items.some((item) => item.lockedUntil !== undefined)).toBe(true);
    expect(spawned.unlocks).toEqual([]);
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

  /** Each source action's kind with what it spawned. */
  const actionSpawns = (spawned: RoomSpawnedLoot) =>
    spawned.actionSpawns.map((spawn) => [spawn.source.kind, spawn.items.map(describeItem)]);

  it('lists the Artificer’s replacement under the reward it transforms', () => {
    const project = underworldCheckpointArtifacts['underworld-f-trait-order-checks'].load();
    const { spawned } = loot(project, 'F', 'e9c1775e-a04b-4ed2-b749-7ef344614cbe');
    expect(actionSpawns(spawned)).toEqual([
      ['interactIncomingReward', [expect.stringMatching(/^artificer required #\d+$/)]],
    ]);
  });

  it('spawns nothing from an Artificer transform whose replacement is not chosen', () => {
    const source = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const project = applyProjectCommand(
      createFConversionFrontierProject('MetaCurrencyDrop').project,
      catalog,
      {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: createAcquisitionRoleAddress(source, 'self'),
        value: { kind: 'artificer' },
      },
    );
    const { spawned } = loot(project, 'F', goldenFOccurrenceId(1, 1));
    // The walk stops inside the transformed pickup: the reward it reached spawns, the replacement not.
    expect(moments(spawned)).toEqual([['encounterEnd:Encounter', ['roomReward required #1']]]);
    expect(spawned.actionSpawns).toEqual([]);
  });

  it('lists Sea Star’s copy under the pickup it copies once that pickup settles', () => {
    // The Nemesis Pom's own level is unset: the walk stops at its pickup, which copies nothing yet.
    const unresolved = loadNemesisPomSeaStarCheckpoint();
    expect(actionSpawns(loot(unresolved, 'F', 'golden-f-b5-e1').spawned)).toEqual([]);
    const { spawned } = loot(authorLegalPomResolutions(unresolved), 'F', 'golden-f-b5-e1');
    expect(actionSpawns(spawned)).toEqual([
      ['interactAcquisitionEntry', [expect.stringMatching(/^seaStar required #\d+$/)]],
    ]);
  });

  describe('a Nemesis event’s result', () => {
    const nemesisRoom = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: nemesisRoom },
      'Encounter',
    );
    const event = createNemesisRandomEventAddress(phase);
    /** Her event answered with an optional result, placed right after her interaction. */
    const answered = (value: AuthoredNemesisRandomEventOutcome, rewardType: string) => {
      const project = replaceNemesisRandomEventInteraction(
        applyProjectCommand(createGoldenFGHIProject(), catalog, {
          kind: 'SelectEncounter',
          phase,
          encounterKey: 'NemesisRandomEvent',
        }),
        event,
        value,
        { rewardType },
      );
      const reference = {
        kind: 'interactAcquisitionEntry' as const,
        siteKey: 'nemesisGenerated:Encounter',
        entryKey: 'result',
      };
      const order =
        project.route.biomes[0]?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === nemesisRoom,
        )?.roomActions.order ?? [];
      return applyProjectCommand(project, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(goldenFBiome, nemesisRoom, roomActionKey(reference)),
        reference,
        index:
          order.findIndex(
            (candidate) =>
              candidate.kind === 'interactEncounter' && candidate.phaseKey === 'Encounter',
          ) + 1,
      });
    };

    it('spawns at her outcome when the outcome decides it: an accepted trade', () => {
      const { spawned } = loot(loadNemesisPomSeaStarCheckpoint(), 'F', 'golden-f-b5-e1');
      expect(moments(spawned)).toEqual([
        ['encounterOutcome:Encounter', [expect.stringMatching(/^nemesisEvent required #\d+$/)]],
      ]);
      expect(spawned.actionSpawns).toEqual([]);
    });

    it('spawns at her outcome when the outcome decides it: a contest', () => {
      const { spawned } = loot(
        answered({ kind: 'damageContest', result: 'failure' }, 'RoomRewardConsolationPrize'),
        'F',
        nemesisRoom,
      );
      expect(moments(spawned)).toEqual([
        ['encounterOutcome:Encounter', [expect.stringMatching(/^nemesisEvent optional #\d+$/)]],
      ]);
      expect(spawned.actionSpawns).toEqual([]);
    });

    it('spawns the planned item from a won contest and Consolation from a lost one', () => {
      const won = loot(
        answered({ kind: 'damageContest', result: 'success' }, 'MaxHealthDrop'),
        'F',
        nemesisRoom,
      ).spawned;
      expect(momentRewards(won)).toEqual([
        ['encounterOutcome:Encounter', [offer('MaxHealthDrop')]],
      ]);
      // Losing keeps the planned item as the offer; Consolation is what spawns.
      const lost = loot(
        answered({ kind: 'damageContest', result: 'failure' }, 'MaxHealthDrop'),
        'F',
        nemesisRoom,
      );
      expect(momentRewards(lost.spawned)).toEqual([
        ['encounterOutcome:Encounter', [offer('RoomRewardConsolationPrize')]],
      ]);
      expect(lost.assembly.evaluation.findings).toEqual([]);
    });

    it('spawns Consolation from a lost contest with no success item planned', () => {
      const project = replaceNemesisRandomEventInteraction(
        applyProjectCommand(createGoldenFGHIProject(), catalog, {
          kind: 'SelectEncounter',
          phase,
          encounterKey: 'NemesisRandomEvent',
        }),
        event,
        { kind: 'damageContest', result: 'failure' },
        null,
      );
      const { assembly, spawned } = loot(project, 'F', nemesisRoom);
      expect(assembly.evaluation.findings).toEqual([]);
      expect(momentRewards(spawned)).toEqual([
        ['encounterOutcome:Encounter', [offer('RoomRewardConsolationPrize')]],
      ]);
    });

    it('spawns nothing from a declined trade', () => {
      const project = replaceNemesisRandomEventInteraction(
        applyProjectCommand(createGoldenFGHIProject(), catalog, {
          kind: 'SelectEncounter',
          phase,
          encounterKey: 'NemesisRandomEvent',
        }),
        event,
        { kind: 'goldTrade', response: 'decline' },
        { rewardType: 'MaxHealthDropBig' },
      );
      const { spawned } = loot(project, 'F', nemesisRoom);
      expect(spawned.moments).toEqual([]);
      expect(spawned.actionSpawns).toEqual([]);
    });

    it('spawns nothing her outcome decides while the walk is stopped at her row', () => {
      // A won contest with no item planned blocks her interaction.
      const project = replaceNemesisRandomEventInteraction(
        applyProjectCommand(createGoldenFGHIProject(), catalog, {
          kind: 'SelectEncounter',
          phase,
          encounterKey: 'NemesisRandomEvent',
        }),
        event,
        { kind: 'damageContest', result: 'success' },
        null,
      );
      const { assembly, spawned } = loot(project, 'F', nemesisRoom);
      const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
      const stop = f?.coverage.kind === 'prefix' ? f.coverage.roomStop : undefined;
      expect(assembly.evaluation.findings.map((finding) => finding.code)).toEqual([
        'nemesisOutcomeMissing',
      ]);
      expect(stop?.room.occurrenceId).toBe(nemesisRoom);
      expect(stop?.at).toBe('entry');
      expect(spawned.moments).toEqual([]);
      expect(spawned.actionSpawns).toEqual([]);
    });

    it('spawns under her interaction when given whatever happens: a free item', () => {
      const { spawned } = loot(answered({ kind: 'freeItem' }, 'HealDrop'), 'F', nemesisRoom);
      expect(moments(spawned)).toEqual([]);
      expect(actionSpawns(spawned)).toEqual([
        ['interactEncounter', [expect.stringMatching(/^nemesisEvent optional #\d+$/)]],
      ]);
    });
  });

  it('lists a rushed Shrine item under its purchase in the Shrine’s own room', () => {
    const { spawned } = loot(
      loadSurfaceShrineTravelDealCheckpoint(),
      'N',
      'surface-n-preboss:postboss',
    );
    expect(actionSpawns(spawned)).toEqual([
      [
        'purchaseHermesShrineOffer',
        [expect.stringMatching(/^hermesShrineDelivery optional #\d+$/)],
      ],
    ]);
    expect(spawned.moments).toEqual([]);
  });

  it('spawns nothing for a World Shop Travel Deal refill, which is a purchase', () => {
    const { spawned } = loot(
      loadUnderworldWorldShopTravelDealCheckpoint(),
      'F',
      'golden-f-preboss-shop',
    );
    expect(spawned.actionSpawns).toEqual([]);
  });

  it('spawns an O phase’s deliveries only once its wheel reward is collected', () => {
    // Wheel 1 offers a Boon whose trait offer is unset: the walk stops at its pickup.
    const project = applyProjectCommand(surfaceShrineDeliveriesProject(), catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    expect(moments(loot(project, 'O', oOccurrenceIds.combat04).spawned)).toEqual([
      ['encounterEnd:Combat1', ['rewardWheel required #2']],
    ]);
  });

  it('spawns Heracles’s bounty with the rest of an encounter end a due delivery blocks', () => {
    const combat09 = nOccurrenceId('combat09');
    const project = authorLegalTraitOffers(
      applyProjectCommand(loadSurfaceNShrineSideRoomDeliveryCheckpoint(), catalog, {
        kind: 'SelectEncounter',
        phase: createEncounterPhaseAddress(
          nBiome,
          { kind: 'occurrence', occurrenceId: combat09 },
          'Encounter',
        ),
        encounterKey: 'HeraclesCombatN',
      }),
    );
    const { assembly, spawned } = loot(project, 'N', combat09);
    const n = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'N');
    expect(n?.coverage.kind === 'prefix' ? n.coverage.roomStop : undefined).toMatchObject({
      room: { occurrenceId: combat09 },
      at: 'entry',
    });
    expect(moments(spawned)).toEqual([
      [
        'encounterEnd:Encounter',
        [
          'roomReward required #1',
          'hermesShrineDelivery required unplaced:PlaceHermesShrineDelivery',
          expect.stringMatching(/^heraclesBounty required #\d+$/),
        ],
      ],
    ]);
  });

  it('lists Echo’s last reward under its encounter while the copy’s own choice is unset', () => {
    const { spawned } = loot(createEchoTalentDropReplayProject(), 'H', 'golden-h-bridge01');
    expect(actionSpawns(spawned)).toEqual([
      ['interactEncounter', [expect.stringMatching(/^echo:lastReward /)]],
    ]);
  });

  it('lists Gold Gold Gold’s duplicate under its purchase, its own result set or not', () => {
    for (const project of [
      createEchoGoldIAnvilDuplicateProject(),
      createEchoGoldIAnvilDuplicateProject(echoGoldIDuplicateAnvilResult),
    ])
      expect(actionSpawns(loot(project, 'I', echoGoldIPrebossShopId).spawned)).toEqual([
        ['interactShopOffer', [expect.stringMatching(/^echo:doubleShop /)]],
      ]);
  });

  it('lists a rushed Shrine item only once the walk settles its purchase', () => {
    const combat02 = createOccurrenceId('surface-o-combat02');
    const shrine = createOccurrenceAddress(oBiome, combat02);
    let project = loadSurfaceNOPQCheckpoint();
    const place = roomObjectAnchorSlotsForProjectEvaluationAssembly(
      catalog,
      evaluate(project),
      shrine,
    )?.objects.find((object) => object.kind === 'hermesShrine')?.place;
    if (place === undefined) throw new Error('O Combat02 cannot place a Hermes Shrine');
    project = applyProjectCommand(project, catalog, place);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: shrine,
      slotKey: 'first',
      value: { rewardType: 'HealBigDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'PurchaseHermesShrineOffer',
      occurrence: shrine,
      generationKey: 'initial:first',
      rushed: true,
    });
    // Its other offers unset, the walk stops at the room's Overview, before the purchase.
    expect(loot(project, 'O', combat02).spawned.actionSpawns).toEqual([]);
    for (const [slotKey, rewardType] of [
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'BlindBoxLoot'],
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: shrine,
        slotKey,
        value: { rewardType },
      });
    expect(actionSpawns(loot(project, 'O', combat02).spawned)).toEqual([
      [
        'purchaseHermesShrineOffer',
        [expect.stringMatching(/^hermesShrineDelivery optional #\d+$/)],
      ],
    ]);
  });
});
