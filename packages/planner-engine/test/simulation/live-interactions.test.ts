import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  purgingPoolCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { purchaseTestHermesShrineOffer } from '@run-planner/test-fixtures/shared';
import {
  oBiome,
  oOccurrenceIds,
  placeDueHermesShrineDeliveries,
  surfaceShrineDeliveriesProject,
  surfaceShrineDeliverySources,
} from '@run-planner/test-fixtures/surface';
import {
  liveInteractionsForProjectEvaluationAssembly,
  type LiveInteractionItem,
  type LiveVerb,
  type RoomLiveInteractions,
} from '../../src/simulation/evaluation/live-interactions';
import {
  canonicalRoom,
  goldenCheckpoints,
  occurrenceOf,
  placementFindings,
  roomOrder,
  throughBiome,
  walkAccepts,
  withRoomOrder,
} from '../support/live-actions';
import { firstSupportedReroll, withArcana, withJudgment } from '../support/rerolls';

const fBiome = createBiomeAddress('Underworld', 'F');
const worldShop = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop'));
const fWell = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:postboss'));
const fRoom = (id: string) => createOccurrenceAddress(fBiome, createOccurrenceId(id));

function interactions(
  project: ProjectDocument,
  address: OccurrenceAddress,
  assembly: ProjectEvaluationAssembly = simulateProjectAssembly(catalog, project),
): RoomLiveInteractions {
  const live = liveInteractionsForProjectEvaluationAssembly(catalog, assembly, address);
  if (live === undefined) throw new Error(`${address.occurrenceId} is not reached`);
  return live;
}

/** Every entered room the walk reaches, with its live interactions. */
function reachedRooms(project: ProjectDocument, assembly: ProjectEvaluationAssembly) {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).flatMap((occurrence) => {
      const address = createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        occurrence.occurrenceId,
      );
      const live = liveInteractionsForProjectEvaluationAssembly(catalog, assembly, address);
      return live === undefined ? [] : [{ address, live }];
    }),
  );
}

/** Every verb of one room, with the gap it stands at and its item. */
function roomVerbs(live: RoomLiveInteractions) {
  return live.gaps.flatMap((gap) =>
    gap.items.flatMap(({ item, verbs }) => verbs.map((verb) => ({ gap: gap.index, item, verb }))),
  );
}

/** Whether the walk passes the room: it reaches its end, stopping there at most in its exit. */
function walkPasses(
  project: ProjectDocument,
  assembly: ProjectEvaluationAssembly,
  address: OccurrenceAddress,
  live: RoomLiveInteractions,
): boolean {
  const stop = roomStop(assembly, address);
  return (
    live.frontier === roomOrder(project, address).length &&
    (stop === undefined || stop.kind === 'exit')
  );
}

function roomStop(assembly: ProjectEvaluationAssembly, address: OccurrenceAddress) {
  const biome = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === address.biomeKey,
  );
  const stop = biome?.coverage.kind === 'prefix' ? biome.coverage.roomStop : undefined;
  return stop !== undefined && semanticAddressKey(stop.room) === semanticAddressKey(address)
    ? stop
    : undefined;
}

/** Whether anything required is live at the frontier. */
function requiredLive(live: RoomLiveInteractions): boolean {
  return live.gaps[live.frontier]!.items.some(({ item, verbs }) =>
    item.kind === 'pickup'
      ? item.participation === 'required'
      : verbs.some((verb) => verb.participation === 'required'),
  );
}

/** Findings a conversion its reached state cannot make raises. */
const CONVERSION_FINDINGS: ReadonlySet<string> = new Set([
  'timePieceConversionUnavailable',
  'artificerConversionUnavailable',
]);

function conversionFindings(project: ProjectDocument, address?: OccurrenceAddress): number {
  return simulateProjectAssembly(catalog, project).evaluation.findings.filter(
    (finding) =>
      CONVERSION_FINDINGS.has(finding.code) &&
      (address === undefined || occurrenceOf(finding.origin) === address.occurrenceId),
  ).length;
}

/**
 * Whether the walk takes a verb at its gap: its commands (or the given ones
 * a picker supplies) apply, the walk reaches the row it stands as or creates
 * there, and no new placement or conversion finding arises.
 */
function verbAccepted(
  project: ProjectDocument,
  address: OccurrenceAddress,
  verb: LiveVerb,
  gap: number,
  commands: readonly ProjectCommand[] = verb.commands ?? [],
): boolean {
  const before = placementFindings(simulateProjectAssembly(catalog, project), address);
  let after = project;
  for (const command of commands) after = applyProjectCommand(after, catalog, command);
  const reference = verb.reference ?? roomOrder(after, address)[gap];
  return (
    reference !== undefined &&
    walkAccepts(project, before, address, commands, roomActionKey(reference)) &&
    conversionFindings(after, address) <= conversionFindings(project, address)
  );
}

const withTimePiece = (project: ProjectDocument) =>
  applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'GoldifyKeepsake',
  });

/** Each room reward's goldify verb in F, room by room. */
function goldifies(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  return (project.route.biomes[0]!.topology?.occurrences ?? []).flatMap((occurrence) => {
    const address = createOccurrenceAddress(fBiome, occurrence.occurrenceId);
    const live = liveInteractionsForProjectEvaluationAssembly(catalog, assembly, address);
    return (live === undefined ? [] : roomVerbs(live))
      .filter(({ verb }) => verb.verb === 'goldify')
      .map(({ gap, verb }) => ({ id: occurrence.occurrenceId as string, address, gap, verb }));
  });
}

describe('live interactions at a gap', () => {
  const evaluated = goldenCheckpoints.map(({ entry, load }) => {
    const project = load();
    return { id: entry.id, project, assembly: simulateProjectAssembly(catalog, project) };
  });

  it('stands every reached row as exactly one verb at its own gap', () => {
    const failures: string[] = [];
    let rows = 0;
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly)) {
        const order = roomOrder(project, address);
        const stale = new Set(
          canonicalRoom(assembly, address)?.roomActionRoster.rows.flatMap((row) =>
            row.stale ? [row.key] : [],
          ),
        );
        for (let index = 0; index <= live.frontier && index < order.length; index += 1) {
          const key = roomActionKey(order[index]!);
          if (stale.has(key)) continue;
          rows += 1;
          const standing = live.gaps[index]!.items.flatMap(({ verbs }) =>
            verbs.filter(
              (verb) =>
                verb.standing === true &&
                verb.reference !== undefined &&
                roomActionKey(verb.reference) === key,
            ),
          );
          if (standing.length !== 1)
            failures.push(`${id} ${address.occurrenceId} #${index} ${key}: ${standing.length}`);
        }
      }
    expect(failures).toEqual([]);
    expect(rows).toBeGreaterThan(1000);
  });

  it('offers through the frontier only conversions the walk takes', () => {
    // Golden plans with Time Piece or the Artificer; an action's own command is the live
    // actions' audit.
    const failures: string[] = [];
    const verbs = new Set<string>();
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly))
        for (const { gap, verb } of roomVerbs(live)) {
          if (verb.acquisition === undefined || verb.standing === true) continue;
          verbs.add(verb.verb);
          if (!verbAccepted(project, address, verb, gap))
            failures.push(`${id} ${address.occurrenceId} @${gap} ${verb.verb}`);
        }
    expect(failures).toEqual([]);
    expect([...verbs].sort()).toEqual(['goldify', 'pickUp', 'transform']);
  });

  it('lets Time Piece goldify a free pickup, never a paid Shop item', () => {
    const plain = throughBiome(loadUnderworldWorldShopTravelDealCheckpoint(), 'F');
    const project = withTimePiece(plain);
    const start = fRoom('golden-f-start');
    const reward = (document: ProjectDocument) =>
      roomVerbs(interactions(document, start)).filter(
        ({ item, verb }) =>
          item.kind === 'pickup' && verb.reference?.kind === 'interactIncomingReward',
      );
    // Without the keepsake the room reward is only picked up.
    expect(reward(plain).map(({ verb }) => [verb.verb, verb.standing])).toEqual([['pickUp', true]]);
    const held = reward(project);
    expect(held.map(({ verb }) => [verb.verb, verb.standing])).toEqual([
      ['pickUp', true],
      ['goldify', undefined],
    ]);
    const goldify = held[1]!;
    expect(goldify.verb.commands).toEqual([
      {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: goldify.verb.acquisition,
        value: { kind: 'timePiece' },
      },
    ]);
    expect(verbAccepted(project, start, goldify.verb, goldify.gap)).toBe(true);
    // Goldified, the pickup stands as goldify and picking it up undoes it.
    const goldified = applyProjectCommand(project, catalog, goldify.verb.commands![0]!);
    expect(reward(goldified).map(({ verb }) => [verb.verb, verb.standing])).toEqual([
      ['pickUp', undefined],
      ['goldify', true],
    ]);
    // The Shop's bought items are paid: bought, never goldified.
    const shopVerbs = roomVerbs(interactions(project, worldShop)).filter(
      ({ verb }) => verb.standing === true,
    );
    expect(shopVerbs.length).toBeGreaterThan(0);
    expect(new Set(shopVerbs.map(({ verb }) => verb.verb))).toEqual(new Set(['buy']));
  });

  it('withholds goldify without a Time Piece charge, and while Unfated', () => {
    // Epic Time Piece holds four charges: goldifying four later rewards, last first, leaves
    // the room after them none.
    let project = throughBiome(withTimePiece(loadUnderworldFGCheckpoint()), 'F');
    const last = 'golden-f-b9-e1';
    expect(goldifies(project).some(({ id }) => id === last)).toBe(true);
    for (const id of ['golden-f-b8-e1', 'golden-f-b7-e1', 'golden-f-b6-e1', 'golden-f-b5-e1']) {
      const offered = goldifies(project).find((entry) => entry.id === id && !entry.verb.standing);
      expect(offered, id).toBeDefined();
      project = applyProjectCommand(project, catalog, offered!.verb.commands![0]!);
    }
    expect(conversionFindings(project)).toBe(0);
    const spent = goldifies(project);
    expect(spent.some(({ id }) => id === last)).toBe(false);

    // Known limit: an earlier reward's offer reads its own contact, before the later
    // conversions spend the charges, so taking it starves a later standing goldify.
    const earlier = spent.find(({ id, verb }) => id === 'golden-f-b4-e1' && !verb.standing)!;
    expect(earlier).toBeDefined();
    const starved = applyProjectCommand(project, catalog, earlier.verb.commands![0]!);
    expect(conversionFindings(starved)).toBe(1);

    // The Door Reroll card is incompatible with Fated, which zeroes the charges.
    const unfated = withArcana(throughBiome(withTimePiece(loadUnderworldFGCheckpoint()), 'F'), [
      'DoorReroll',
    ]);
    expect(goldifies(unfated)).toEqual([]);
  });

  it('offers transform while the Artificer has a use left, and the walk takes it', () => {
    // The Dream H Artificer run: capacity 3 at Epic, two transforms standing, then one more
    // eligible pickup with the last use.
    const project = checkpointRegistry
      .find(({ entry }) => entry.id === 'dream-h-artificer-echo')!
      .load();
    const assembly = simulateProjectAssembly(catalog, project);
    const transforms = reachedRooms(project, assembly).flatMap(({ address, live }) =>
      roomVerbs(live)
        .filter(({ verb }) => verb.verb === 'transform')
        .map((entry) => ({ ...entry, address })),
    );
    expect(transforms.map(({ verb }) => verb.standing ?? false)).toEqual([true, true, false]);
    const third = transforms[2]!;
    expect(
      acquisitionConversionCandidateForProjectEvaluationAssembly(assembly, third.verb.acquisition!)
        ?.artificerAssessment?.evidence,
    ).toMatchObject({ artificerCapacity: 3, artificerSpent: 2, artificerRemaining: 1 });
    expect(verbAccepted(project, third.address, third.verb, third.gap)).toBe(true);
  });

  it('offers door and wheel reroll presses with their picker where a card enables them', () => {
    const doorRoom = fRoom('golden-f-b2-e1');
    const presses = (document: ProjectDocument, address: OccurrenceAddress) =>
      roomVerbs(interactions(document, address)).filter(
        ({ verb }) => verb.choice?.picker === 'rerollPress',
      );
    const fg = throughBiome(loadUnderworldFGCheckpoint(), 'F');
    expect(presses(fg, doorRoom)).toEqual([]);
    const held = withArcana(fg, ['DoorReroll']);
    expect(
      presses(held, doorRoom).map(({ gap, item, verb }) => [
        gap,
        item.kind === 'object' && item.object,
        verb,
      ]),
    ).toEqual([
      [
        roomOrder(held, doorRoom).length,
        'doorRerolls',
        {
          verb: 'reroll',
          participation: 'optional',
          choice: {
            picker: 'rerollPress',
            timing: 'before',
            surface: { kind: 'doors', occurrence: doorRoom },
          },
        },
      ],
    ]);

    // A wheel's press goes before its choice; the walk takes the one the picker makes.
    const o = withJudgment(
      withArcana(loadSurfaceNOCheckpoint(), ['DoorReroll']),
      'N',
      'surface-n-preboss:boss',
      ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
    );
    const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const choose = roomOrder(o, ship).findIndex(
      (reference) => reference.kind === 'chooseRewardWheel',
    );
    const [press] = presses(o, ship);
    expect(press && [press.gap, press.item.kind === 'object' && press.item.owner]).toEqual([
      choose,
      wheel,
    ]);
    const inserted = applyProjectCommand(o, catalog, {
      kind: 'InsertReroll',
      occurrence: ship,
      target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
      reward: { rewardType: 'MaxManaDrop' },
      index: press!.gap,
    });
    const reroll = roomOrder(inserted, ship)[press!.gap]!;
    const action = createRoomActionAddress(oBiome, oOccurrenceIds.combat04, roomActionKey(reroll));
    const picked: ProjectCommand[] = [
      {
        kind: 'InsertReroll',
        occurrence: ship,
        target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
        reward: { rewardType: 'MaxManaDrop' },
        index: press!.gap,
      },
      {
        kind: 'ReplaceRerollReward',
        action,
        reward: firstSupportedReroll(inserted, action, 'RunProgress'),
      },
    ];
    expect(verbAccepted(o, ship, press!.verb, press!.gap, picked)).toBe(true);
  });

  it('offers Well and Pool rerolls and Pool sales with their pickers', () => {
    const well = withJudgment(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const objectVerbs = (document: ProjectDocument) =>
      roomVerbs(interactions(document, fWell)).filter(({ item }) => item.kind === 'object');
    const summary = ({
      gap,
      item,
      verb,
    }: {
      gap: number;
      item: LiveInteractionItem['item'];
      verb: LiveVerb;
    }) => [
      gap,
      item.kind === 'object' ? item.object : 'pickup',
      verb.verb,
      verb.choice?.picker,
      verb.commands?.map((command) => command.kind),
    ];
    const last = roomOrder(well, fWell).length;
    const choices = objectVerbs(well).filter(
      ({ verb }) => verb.choice !== undefined && verb.standing !== true,
    );
    expect(choices.map(summary)).toEqual([
      [0, 'keepsakeRack', 'use', 'keepsake', ['MoveRoomAction']],
      [last, 'stygianWell', 'reroll', 'stygianWellRoll', ['InsertStygianWellReroll']],
      [last, 'purgingPool', 'reroll', 'purgingPoolRoll', ['InsertPurgingPoolReroll']],
      [last, 'purgingPool', 'sell', 'purgingPoolSale', undefined],
      [last, 'purgingPool', 'sell', 'purgingPoolSale', undefined],
      [last, 'purgingPool', 'sell', 'purgingPoolSale', undefined],
    ]);
    for (const { gap, verb } of choices.filter(({ verb }) => verb.verb === 'reroll'))
      expect(verbAccepted(well, fWell, verb, gap), verb.choice?.picker).toBe(true);
    // A Well or Pool reroll names the row its command creates.
    for (const { gap, verb } of choices.filter(({ verb }) => verb.verb === 'reroll')) {
      const rerolled = verb.commands!.reduce(
        (document, command) => applyProjectCommand(document, catalog, command),
        well,
      );
      expect(roomOrder(rerolled, fWell)[gap]).toEqual(verb.reference);
    }
    expect(
      choices.filter(({ verb }) => verb.verb === 'reroll').map(({ verb }) => verb.reference),
    ).toEqual([
      { kind: 'rerollStygianWell', rerollId: 'r1' },
      { kind: 'rerollPurgingPool', rerollId: 'r1' },
    ]);

    // Each unpinned sale lists traits to pick, and the walk takes the sale the picker makes.
    const sales = choices.filter(({ verb }) => verb.verb === 'sell');
    for (const { gap, verb } of sales) {
      if (verb.choice?.picker !== 'purgingPoolSale') throw new Error('not a sale picker');
      expect(verb.choice.traitKeys.length).toBeGreaterThan(0);
      const sale: ProjectCommand = {
        kind: 'SellPurgingPoolRollSlot',
        occurrence: fWell,
        rollKey: verb.choice.rollKey,
        slotKey: verb.choice.slotKey,
        traitKey: verb.choice.traitKeys[0]!,
        index: gap,
      };
      expect(verbAccepted(well, fWell, verb, gap, [sale]), verb.choice.slotKey).toBe(true);
    }

    // A pinned slot's sale is a roster row, offered from the fountain on.
    const pinned = applyProjectCommand(well, catalog, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: fWell,
      slotKey: 'left',
      traitKey: purgingPoolCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, well),
        fWell,
      )!.candidateTraitKeysBySlot.left[0]!,
    });
    const pinnedSales = objectVerbs(pinned).filter(({ verb }) => verb.verb === 'sell');
    expect(pinnedSales.filter(({ verb }) => verb.choice !== undefined)).toHaveLength(2);
    // One sale verb for each slot at a gap.
    const perGap = pinnedSales.map(({ gap, verb }) => `${gap} ${roomActionKey(verb.reference!)}`);
    expect(new Set(perGap).size).toBe(perGap.length);
    const sale = pinnedSales.find(
      ({ verb }) => verb.commands !== undefined && verb.standing !== true,
    );
    expect(sale && summary(sale)).toEqual([
      1,
      'purgingPool',
      'sell',
      undefined,
      ['InsertRoomAction'],
    ]);
    expect(verbAccepted(pinned, fWell, sale!.verb, sale!.gap)).toBe(true);
  });

  it("offers no Well reroll while a removed reroll's purchase blocks the room", () => {
    const well = withJudgment(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const apply = (document: ProjectDocument, command: ProjectCommand) =>
      applyProjectCommand(document, catalog, command);
    const rerolled = apply(well, {
      kind: 'InsertStygianWellReroll',
      occurrence: fWell,
      index: roomOrder(well, fWell).length,
    });
    const bought = apply(rerolled, {
      kind: 'SetStygianWellPurchase',
      occurrence: fWell,
      generationKey: 'r1:healing',
      purchased: true,
      itemKey: 'ArmorBoostStore',
    });
    // Removing the reroll takes its purchase with it; a saved plan may still hold one.
    const raw = JSON.parse(encodeProjectDocument(bought));
    for (const plan of raw.route.biomes)
      for (const candidate of plan.topology?.occurrences ?? [])
        if (candidate.occurrenceId === fWell.occurrenceId) {
          candidate.roomActions.order = candidate.roomActions.order.filter(
            (reference: { kind: string }) => reference.kind !== 'rerollStygianWell',
          );
          delete candidate.stygianWell.rerollOfferKeyBySlot;
        }
    const orphaned = decodeProjectDocument(raw, catalog);
    const live = interactions(orphaned, fWell);
    expect(live.frontier).toBe(roomOrder(orphaned, fWell).length - 1);
    expect(
      roomVerbs(live).some(
        ({ item, verb }) =>
          item.kind === 'object' && item.object === 'stygianWell' && verb.verb === 'reroll',
      ),
    ).toBe(false);
    // Once the orphan is repaired, the offered reroll is the row its command creates.
    const repaired = apply(orphaned, {
      kind: 'SetStygianWellPurchase',
      occurrence: fWell,
      generationKey: 'r1:healing',
      purchased: false,
    });
    const reroll = roomVerbs(interactions(repaired, fWell)).find(
      ({ item, verb }) =>
        item.kind === 'object' && item.object === 'stygianWell' && verb.verb === 'reroll',
    )!;
    const created = reroll.verb.commands!.reduce(apply, repaired);
    expect(roomOrder(created, fWell)[reroll.gap]).toEqual(reroll.verb.reference);
  });

  it('publishes progression exactly when nothing else required is live at the frontier', () => {
    const failures: string[] = [];
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly)) {
        const expected =
          !requiredLive(live) && walkPasses(project, assembly, address, live)
            ? 'leaveRoom'
            : undefined;
        if (live.progression?.kind !== expected)
          failures.push(`${id} ${address.occurrenceId}: ${live.progression?.kind}`);
      }
    expect(failures).toEqual([]);

    // A stop at the room's last gap with nothing required live: the room cannot be left.
    const hub = checkpointRegistry
      .find(({ entry }) => entry.id === 'surface-n-complete-hub-frontier')!
      .load();
    const nPreboss = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('N:preboss'),
    );
    const hubAssembly = simulateProjectAssembly(catalog, hub);
    const stopped = interactions(hub, nPreboss, hubAssembly);
    expect(stopped.frontier).toBe(roomOrder(hub, nPreboss).length);
    expect(requiredLive(stopped)).toBe(false);
    expect(roomStop(hubAssembly, nPreboss)?.kind).not.toBe('exit');
    expect(stopped.progression).toBeUndefined();
    expect(stopped.leftBehind).toBeUndefined();

    // An O wheel's choice taken back: choosing it is the room's way on.
    const project = loadSurfaceNOCheckpoint();
    const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const order = roomOrder(project, ship);
    const choose = order.findIndex((reference) => reference.kind === 'chooseRewardWheel');
    const live = interactions(withRoomOrder(project, ship, order.toSpliced(choose, 1)), ship);
    expect(live.progression).toEqual({
      kind: 'chooseWheel',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
    });
    expect(live.leftBehind).toBeUndefined();

    // A delivery left loose beside the next wheel's choice: neither is the way on alone.
    const { oShrine: shrine } = surfaceShrineDeliverySources;
    const combat02 = createOccurrenceAddress(oBiome, oOccurrenceIds.combat02);
    let placed = applyProjectCommand(surfaceShrineDeliveriesProject(), catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: shrine,
      slotKey: 'secondLeft',
      value: { rewardType: 'ShopHermesUpgrade' },
    });
    placed = placeDueHermesShrineDeliveries(
      purchaseTestHermesShrineOffer(placed, catalog, shrine, 'initial:secondLeft', {
        delay: 4,
        rushed: false,
      }),
    );
    const shipOrder = roomOrder(placed, combat02);
    const delivery = shipOrder.findIndex(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    );
    const loose = interactions(
      withRoomOrder(placed, combat02, shipOrder.toSpliced(delivery, 1)),
      combat02,
    );
    const frontierItems = loose.gaps[loose.frontier]!.items;
    expect(
      frontierItems.some(({ verbs }) => verbs.some((verb) => verb.verb === 'choose')) &&
        frontierItems.some(
          ({ item }) => item.kind === 'pickup' && item.participation === 'required',
        ),
    ).toBe(true);
    expect(loose.progression).toBeUndefined();

    // A room reward taken back: no progression until it is picked up again.
    const room = fRoom('golden-f-b2-e1');
    const fg = throughBiome(loadUnderworldFGCheckpoint(), 'F');
    const rewardIndex = roomOrder(fg, room).findIndex(
      (reference) => reference.kind === 'interactIncomingReward',
    );
    const taken = withRoomOrder(fg, room, roomOrder(fg, room).toSpliced(rewardIndex, 1));
    const untaken = interactions(taken, room);
    expect(untaken.progression).toBeUndefined();
    const pickUp = untaken.gaps[untaken.frontier]!.items.flatMap(({ item, verbs }) =>
      item.kind === 'pickup' ? verbs.filter((verb) => verb.verb === 'pickUp') : [],
    )[0]!;
    const restored = applyProjectCommand(taken, catalog, pickUp.commands![0]!);
    expect(interactions(restored, room).progression).toEqual({ kind: 'leaveRoom' });
  });

  it('lists the optional pickups left behind when the room is left', () => {
    const failures: string[] = [];
    let listed = 0;
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly)) {
        const passed = walkPasses(project, assembly, address, live);
        if (passed !== (live.leftBehind !== undefined))
          failures.push(`${id} ${address.occurrenceId}: left behind ${passed}`);
        for (const item of live.leftBehind ?? []) {
          listed += 1;
          if (
            item.participation !== 'optional' ||
            item.actions.some((action) => action.kind === 'placed') ||
            !live.gaps[live.frontier]!.items.some((entry) => entry.item === item)
          )
            failures.push(`${id} ${address.occurrenceId}: ${roomActionKey(item.reference)}`);
        }
      }
    expect(failures).toEqual([]);
    expect(listed).toBeGreaterThan(0);

    // An optional pickup taken back is left behind.
    const sample = evaluated
      .flatMap(({ project, assembly }) =>
        reachedRooms(project, assembly).map(({ address }) => ({ project, assembly, address })),
      )
      .flatMap(({ project, assembly, address }) => {
        const order = roomOrder(project, address);
        const loot = spawnedLootForProjectEvaluationAssembly(catalog, assembly, address)!;
        const optional = [
          ...loot.moments.flatMap((moment) => moment.items),
          ...loot.actionSpawns.flatMap((spawn) => spawn.items),
        ].find((item) => item.participation === 'optional' && item.placement.kind === 'placed');
        const index =
          optional === undefined
            ? -1
            : order.findIndex(
                (reference) => roomActionKey(reference) === roomActionKey(optional.reference),
              );
        return index < 0 ? [] : [{ project, address, order, index }];
      })[0]!;
    const live = interactions(
      withRoomOrder(sample.project, sample.address, sample.order.toSpliced(sample.index, 1)),
      sample.address,
    );
    expect(live.leftBehind?.map((item) => roomActionKey(item.reference))).toContain(
      roomActionKey(sample.order[sample.index]!),
    );
  });
});
