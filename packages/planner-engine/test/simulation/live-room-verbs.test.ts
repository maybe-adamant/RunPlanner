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
  createShopOfferAddress,
  roomActionKey,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
  type RoomOccurrence,
  type ShopState,
} from '@run-planner/engine/authored-project';
import { frontierAcquisitionConversionForProjectEvaluationAssembly } from '../../src/simulation/evaluation/project-evaluation-assembly';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  rerollPressForProjectEvaluationAssembly,
  rerollSurfaceForProjectEvaluationAssembly,
  roomObjectInteractionsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHICheckpoint,
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
  surfaceShrineTravelDealProject,
} from '@run-planner/test-fixtures/surface';
import {
  liveRoomForProjectEvaluationAssembly,
  type LiveItem,
  type LiveRoom,
  type LiveVerb,
} from '../../src/simulation/evaluation/live-room';
import {
  canonicalRoom,
  goldenCheckpoints,
  occurrenceOf,
  placementFindings,
  roomOrder,
  throughBiome,
  walkAccepts,
  withRoomOrder,
} from '../support/live-room';
import { supportedRerollRewards, withArcana, withJudgment } from '../support/rerolls';

const fBiome = createBiomeAddress('Underworld', 'F');
const worldShop = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop'));
const fWell = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:postboss'));
const fRoom = (id: string) => createOccurrenceAddress(fBiome, createOccurrenceId(id));

const travelDealRefillPurchase: RoomActionReference = {
  kind: 'interactAcquisitionEntry',
  siteKey: 'roomExit',
  entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
};

function withOccurrence(
  project: ProjectDocument,
  address: OccurrenceAddress,
  update: (occurrence: RoomOccurrence) => RoomOccurrence,
): ProjectDocument {
  return {
    ...project,
    route: {
      ...project.route,
      biomes: project.route.biomes.map((biome) =>
        biome.biomeKey !== address.biomeKey || biome.topology === null
          ? biome
          : {
              ...biome,
              topology: {
                ...biome.topology,
                occurrences: biome.topology.occurrences.map((occurrence) =>
                  occurrence.occurrenceId === address.occurrenceId
                    ? update(occurrence)
                    : occurrence,
                ),
              },
            },
      ),
    },
  };
}

function shopState(project: ProjectDocument): ShopState {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === worldShop.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === worldShop.occurrenceId);
  if (occurrence?.state.kind !== 'shop' || occurrence.state.shop === undefined)
    throw new Error('the World Shop has no inventory');
  return occurrence.state.shop;
}

/** The World Shop with its Travel Deal item blank and its purchase removed, as a saved plan holds it. */
function withShopRefill(
  project: ProjectDocument,
  refill: ShopState['travelDealRefill'],
): ProjectDocument {
  return withOccurrence(project, worldShop, (occurrence) => {
    if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) return occurrence;
    const { travelDealRefill: _dropped, ...shop } = occurrence.state.shop;
    void _dropped;
    return {
      ...occurrence,
      state: {
        ...occurrence.state,
        shop: refill === undefined ? shop : { ...shop, travelDealRefill: refill },
      },
      roomActions: {
        ...occurrence.roomActions,
        order: occurrence.roomActions.order.filter(
          (reference) => roomActionKey(reference) !== roomActionKey(travelDealRefillPurchase),
        ),
      },
    };
  });
}

/** The Shrine with its Travel Deal refill blank, as a saved plan holds it. */
function withShrineRefill(
  project: ProjectDocument,
  address: OccurrenceAddress,
  refill: undefined,
): ProjectDocument {
  return withOccurrence(project, address, (occurrence) => {
    if (occurrence.hermesShrine === undefined) return occurrence;
    const { travelDealRefill: _dropped, ...shrine } = occurrence.hermesShrine;
    void _dropped;
    return { ...occurrence, hermesShrine: refill ?? shrine };
  });
}

function objectInteractions(project: ProjectDocument, address: OccurrenceAddress) {
  return roomObjectInteractionsForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    address,
  );
}

function interactions(
  project: ProjectDocument,
  address: OccurrenceAddress,
  assembly: ProjectEvaluationAssembly = simulateProjectAssembly(catalog, project),
): LiveRoom {
  const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, address);
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
      const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, address);
      return live === undefined ? [] : [{ address, live }];
    }),
  );
}

/** Every verb of one room, with the gap it stands at and its item. */
function roomVerbs(live: LiveRoom) {
  return live.gaps.flatMap((gap) =>
    gap.items.flatMap((item) => item.verbs.map((verb) => ({ gap: gap.index, item, verb }))),
  );
}

/** Whether the walk passes the room: it reaches its end, stopping there at most in its exit. */
function walkPasses(
  project: ProjectDocument,
  assembly: ProjectEvaluationAssembly,
  address: OccurrenceAddress,
  live: LiveRoom,
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
function requiredLive(live: LiveRoom): boolean {
  return live.gaps[live.frontier]!.items.some((item) =>
    item.kind === 'pickup'
      ? item.participation === 'required'
      : item.verbs.some((verb) => verb.participation === 'required'),
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
    const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, address);
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

  it("offers an unplaced pickup's conversions at the frontier, each placing it in one edit", () => {
    const project = withTimePiece(throughBiome(loadUnderworldWorldShopTravelDealCheckpoint(), 'F'));
    const start = fRoom('golden-f-start');
    const reset = (document: ProjectDocument) =>
      applyProjectCommand(document, catalog, {
        kind: 'ResetRoomActionsAfter',
        occurrence: start,
        afterActionKey: null,
      });
    const rewardAt = (document: ProjectDocument) => {
      const live = interactions(document, start);
      return live.gaps[live.frontier]!.items.flatMap((item) =>
        item.kind === 'pickup' && item.reference.kind === 'interactIncomingReward'
          ? item.verbs
          : [],
      );
    };
    const summary = (verb: LiveVerb) => [verb.verb, verb.commands?.map((command) => command.kind)];
    const unplaced = reset(project);
    const offered = rewardAt(unplaced);
    expect(offered.map(summary)).toEqual([
      ['pickUp', ['InsertRoomAction']],
      ['goldify', ['InsertRoomAction', 'ReplaceAcquisitionDisposition']],
    ]);
    const live = interactions(unplaced, start);
    for (const verb of offered)
      expect(verbAccepted(unplaced, start, verb, live.frontier), verb.verb).toBe(true);

    // Goldified and taken back, it is placed goldified, or placed and picked up instead.
    let goldified = unplaced;
    for (const command of offered[1]!.commands!)
      goldified = applyProjectCommand(goldified, catalog, command);
    expect(rewardAt(reset(goldified)).map(summary)).toEqual([
      ['pickUp', ['InsertRoomAction', 'ReplaceAcquisitionDisposition']],
      ['goldify', ['InsertRoomAction']],
    ]);

    // A paid item is never converted, whatever the state its row would append to.
    const assembly = simulateProjectAssembly(catalog, unplaced);
    const conversion = (instanceProvenance: 'free' | 'paid') =>
      frontierAcquisitionConversionForProjectEvaluationAssembly(
        assembly,
        start,
        offered[0]!.acquisition!,
        {
          offer: canonicalRoom(assembly, start)!.incomingReward!.offer,
          producerLifecycleKey: canonicalRoom(assembly, start)!.incomingReward!
            .producerLifecycleKey,
          instanceProvenance,
        },
      );
    expect(conversion('free')?.timePieceAssessment.supported).toBe(true);
    expect(conversion('paid')?.timePieceAssessment.supported).toBe(false);
    // Once its row is placed it converts only from its own contact.
    expect(
      frontierAcquisitionConversionForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        start,
        offered[0]!.acquisition!,
        {
          offer: canonicalRoom(assembly, start)!.incomingReward!.offer,
          producerLifecycleKey: canonicalRoom(assembly, start)!.incomingReward!
            .producerLifecycleKey,
          instanceProvenance: 'free',
        },
      ),
    ).toBeUndefined();

    // Only the frontier converts an unplaced item: an earlier gap only places it.
    const failures: string[] = [];
    for (const { id, project: plan, assembly: evaluatedPlan } of evaluated)
      for (const { address, live: room } of reachedRooms(plan, evaluatedPlan))
        for (const { gap, item, verb } of roomVerbs(room))
          if (
            gap !== room.frontier &&
            item.kind === 'pickup' &&
            verb.commands !== undefined &&
            verb.commands.length > 1 &&
            verb.commands.some((command) => command.kind === 'ReplaceAcquisitionDisposition')
          )
            failures.push(`${id} ${address.occurrenceId} @${gap} ${verb.verb}`);
    expect(failures).toEqual([]);
  });

  it('converts no unplaced pickup in a room its Overview stops on anything else', () => {
    const start = fRoom('golden-f-start');
    const unplaced = applyProjectCommand(
      withTimePiece(throughBiome(loadUnderworldWorldShopTravelDealCheckpoint(), 'F')),
      catalog,
      { kind: 'ResetRoomActionsAfter', occurrence: start, afterActionKey: null },
    );
    // The run's first room never flips, so an authored flip stops it at its Overview.
    const stopped = applyProjectCommand(unplaced, catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: start,
      layout: { flipped: true },
    });
    const acquisition = interactions(unplaced, start)
      .gaps[0]!.items.flatMap((item) =>
        item.kind === 'pickup' && item.reference.kind === 'interactIncomingReward'
          ? item.verbs
          : [],
      )
      .find((verb) => verb.verb === 'goldify')!.acquisition!;
    const conversion = (document: ProjectDocument) => {
      const assembly = simulateProjectAssembly(catalog, document);
      const reward = canonicalRoom(assembly, start)!.incomingReward!;
      return frontierAcquisitionConversionForProjectEvaluationAssembly(
        assembly,
        start,
        acquisition,
        {
          offer: reward.offer,
          producerLifecycleKey: reward.producerLifecycleKey,
          instanceProvenance: 'free',
        },
      );
    };
    // Left unplaced, the pickup stops the room's Overview and converts where its Timeline starts.
    expect(conversion(unplaced)).toBeDefined();
    expect(
      simulateProjectAssembly(catalog, stopped).evaluation.findings.map(({ code }) => code),
    ).toContain('roomLayoutFlipUnavailable');
    expect(conversion(stopped)).toBeUndefined();
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
          // The press's row takes the room's next reroll id; the picker names its target.
          rerollId: 'r1',
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
    // Choosing a target places the press with its drawn result.
    const drawn = rerollPressForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, o),
      { kind: 'rewardWheel', wheel },
      { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
    );
    expect(drawn).toMatchObject({ kind: 'InsertReroll', occurrence: ship, index: press!.gap });
    const reroll = roomOrder(applyProjectCommand(o, catalog, drawn!), ship)[press!.gap]!;
    expect(reroll).toMatchObject({ kind: 'reroll', rerollId: press!.verb.rerollId });
    const picked: ProjectCommand[] = [drawn!];
    expect(verbAccepted(o, ship, press!.verb, press!.gap, picked)).toBe(true);
  });

  it('places a press with a stable legal draw, then opens its result on the row', () => {
    const doorRoom = fRoom('golden-f-b2-e1');
    const held = withArcana(throughBiome(loadUnderworldFGCheckpoint(), 'F'), ['DoorReroll']);
    const surface = { kind: 'doors' as const, occurrence: doorRoom };
    const assembly = simulateProjectAssembly(catalog, held);
    const target = rerollSurfaceForProjectEvaluationAssembly(assembly, surface)!.targets.find(
      (candidate) => candidate.unavailable === undefined,
    )!.target;
    const drawn = rerollPressForProjectEvaluationAssembly(catalog, assembly, surface, target);
    expect(drawn).toMatchObject({
      kind: 'InsertReroll',
      occurrence: doorRoom,
      target,
      index: roomOrder(held, doorRoom).length,
    });
    // The draw is the plan's own: evaluated again, it draws the same reward.
    expect(
      rerollPressForProjectEvaluationAssembly(
        catalog,
        simulateProjectAssembly(
          catalog,
          decodeProjectDocument(JSON.parse(encodeProjectDocument(held)), catalog),
        ),
        surface,
        target,
      ),
    ).toEqual(drawn);
    const [press] = roomVerbs(interactions(held, doorRoom)).filter(
      ({ verb }) => verb.choice?.picker === 'rerollPress',
    );
    expect(verbAccepted(held, doorRoom, press!.verb, press!.gap, [drawn!])).toBe(true);

    // Placed, the press stands with its result's picker, which overrides the draw.
    const placed = applyProjectCommand(held, catalog, drawn!);
    const reroll = roomOrder(placed, doorRoom)[press!.gap]!;
    const key = roomActionKey(reroll);
    const standing = roomVerbs(interactions(placed, doorRoom)).find(
      ({ verb }) =>
        verb.standing === true &&
        verb.reference !== undefined &&
        roomActionKey(verb.reference) === key,
    );
    expect(standing?.verb.choice).toEqual({ picker: 'rerollResult', timing: 'after' });
    const action = createRoomActionAddress(fBiome, doorRoom.occurrenceId, key);
    const other = supportedRerollRewards(placed, action, [
      'Boon',
      'RoomMoneyDrop',
      'MaxHealthDrop',
    ]).find((reward) => JSON.stringify(reward) !== JSON.stringify(drawn!.reward))!;
    expect(other).toBeDefined();
    const overridden = applyProjectCommand(placed, catalog, {
      kind: 'ReplaceRerollReward',
      action,
      reward: other,
    });
    expect(placementFindings(simulateProjectAssembly(catalog, overridden), doorRoom)).toEqual(
      placementFindings(simulateProjectAssembly(catalog, placed), doorRoom),
    );
    expect(rerollPressForProjectEvaluationAssembly(catalog, assembly, surface, target)).toEqual(
      drawn,
    );
  });

  it("places a wheel's choice with the offer it takes, one edit per offer", () => {
    const o = loadSurfaceNOCheckpoint();
    const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const empty = withRoomOrder(o, ship, []);
    const chooses = roomVerbs(interactions(empty, ship)).filter(
      ({ verb }) => verb.verb === 'choose',
    );
    expect(chooses.length).toBeGreaterThan(0);
    const { verb } = chooses[0]!;
    expect(verb.commands).toBeUndefined();
    const choice = verb.choice;
    if (choice?.picker !== 'rewardWheelPick') throw new Error('the choice lists no offers');
    const wheel = (document: ProjectDocument) => {
      const occurrence = document.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .find((candidate) => candidate.occurrenceId === ship.occurrenceId)!;
      return occurrence.state.kind === 'shipCombat'
        ? occurrence.state.wheels[choice.wheel.wheelKey]!
        : undefined;
    };
    expect(choice.values.map((value) => value.pickedOfferIndex)).toEqual(
      Array.from({ length: wheel(empty)!.offerCount }, (_, index) => index + 1),
    );
    for (const value of choice.values) {
      const picked = value.commands.reduce(
        (document, command) => applyProjectCommand(document, catalog, command),
        empty,
      );
      expect(roomOrder(picked, ship).map(roomActionKey)).toContain(roomActionKey(verb.reference!));
      expect(wheel(picked)!.pickedOfferIndex).toBe(value.pickedOfferIndex);
    }
    // A consumer placing only what a room requires places the choice as authored.
    const live = liveRoomForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, empty),
      ship,
      'placements',
    )!;
    const placement = live.gaps
      .flatMap((gap) => gap.items.flatMap((item) => item.verbs))
      .find((candidate) => candidate.verb === 'choose');
    expect(placement?.choice).toBeUndefined();
    expect(placement?.commands?.map((command) => command.kind)).toEqual(['InsertRoomAction']);
  });

  it('offers Well and Pool rerolls with their pickers and each stocked Pool slot for sale', () => {
    const well = withJudgment(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const objectVerbs = (document: ProjectDocument) =>
      roomVerbs(interactions(document, fWell)).filter(({ item }) => item.kind === 'object');
    const summary = ({ gap, item, verb }: { gap: number; item: LiveItem; verb: LiveVerb }) => [
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
    // A moved row keeps its outcome: the rack's move opens no picker.
    expect(choices.map(summary)).toEqual([
      [last, 'purgingPool', 'reroll', 'purgingPoolRoll', ['InsertPurgingPoolReroll']],
      [last, 'stygianWell', 'reroll', 'stygianWellRoll', ['InsertStygianWellReroll']],
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
      { kind: 'rerollPurgingPool', rerollId: 'r1' },
      { kind: 'rerollStygianWell', rerollId: 'r1' },
    ]);

    // Each stocked slot's sale is a roster row, offered from the fountain on.
    const sales = objectVerbs(well).filter(({ verb }) => verb.verb === 'sell');
    const perGap = sales.map(({ gap, verb }) => `${gap} ${roomActionKey(verb.reference!)}`);
    expect(new Set(perGap).size).toBe(perGap.length);
    const sale = sales.find(({ verb }) => verb.commands !== undefined && verb.standing !== true);
    expect(sale && summary(sale)).toEqual([
      1,
      'purgingPool',
      'sell',
      undefined,
      ['InsertRoomAction'],
    ]);
    expect(verbAccepted(well, fWell, sale!.verb, sale!.gap)).toBe(true);
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
    const pinned = apply(rerolled, {
      kind: 'ReplaceStygianWellRollOffer',
      action: createRoomActionAddress(
        fBiome,
        fWell.occurrenceId,
        roomActionKey({ kind: 'rerollStygianWell', rerollId: 'r1' }),
      ),
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    const bought = apply(pinned, {
      kind: 'SetStygianWellPurchase',
      occurrence: fWell,
      generationKey: 'r1:healing',
      purchased: true,
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
      frontierItems.some((item) => item.verbs.some((verb) => verb.verb === 'choose')) &&
        frontierItems.some((item) => item.kind === 'pickup' && item.participation === 'required'),
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
    const pickUp = untaken.gaps[untaken.frontier]!.items.flatMap((item) =>
      item.kind === 'pickup' ? item.verbs.filter((verb) => verb.verb === 'pickUp') : [],
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
            item.verbs.some((verb) => verb.standing === true) ||
            !live.gaps[live.frontier]!.items.includes(item)
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

  it('offers the purchase Travel Deal restocks with its refill picker after it', () => {
    const plan = throughBiome(loadUnderworldWorldShopTravelDealCheckpoint(), 'F');
    const shopVerbs = (document: ProjectDocument) =>
      interactions(document, worldShop)
        .gaps.at(-1)!
        .items.flatMap((item) =>
          item.kind === 'object' && item.object === 'worldShop'
            ? item.verbs.filter((verb) => verb.standing !== true)
            : [],
        );
    const summary = (verb: LiveVerb) => [
      roomActionKey(verb.reference!),
      verb.choice?.picker,
      verb.commands?.map((command) => command.kind),
    ];
    const refill = shopState(plan).travelDealRefill!;
    // Nothing bought yet: Travel Deal restocks whatever is bought first, and its item, even
    // one a saved plan still holds, cannot be bought before then.
    const stockedEarly = withRoomOrder(plan, worldShop, []);
    expect(
      shopVerbs(stockedEarly).filter(
        (verb) => roomActionKey(verb.reference!) === roomActionKey(travelDealRefillPurchase),
      ),
    ).toEqual([]);
    const unbought = withShopRefill(stockedEarly, undefined);
    const first = shopVerbs(unbought);
    expect(first.length).toBeGreaterThan(0);
    expect(new Set(first.map((verb) => verb.choice?.picker))).toEqual(
      new Set(['travelDealRefill']),
    );
    // The purchase stops the walk at its own row until the restocked item is chosen.
    // The plan's own first purchase, whose item needs no further choice.
    const trigger = first.find(
      (verb) =>
        verb.reference?.kind === 'interactShopOffer' && verb.reference.offerKey === 'MajorNonBoon',
    )!;
    const bought = applyProjectCommand(unbought, catalog, trigger.commands![0]!);
    const stopped = interactions(bought, worldShop);
    expect(stopped.frontier).toBe(0);
    expect(
      simulateProjectAssembly(catalog, bought).evaluation.findings.map((finding) => finding.code),
    ).toEqual(['rewardMissing']);
    // Chosen, the walk passes the purchase and the refill is an ordinary buy, offered once.
    const stocked = applyProjectCommand(bought, catalog, {
      kind: 'ReplaceShopOfferOption',
      offer: createShopOfferAddress(fBiome, worldShop.occurrenceId, TRAVEL_DEAL_REFILL_ENTRY_KEY),
      value: { optionKey: refill.optionKey!, offer: refill.reward!.offer },
    });
    expect(interactions(stocked, worldShop).frontier).toBe(1);
    const later = shopVerbs(stocked);
    // Past the restock each purchase keeps only its own item's outcome: a boon's offer.
    expect(later.map(summary)).toEqual([
      ...first
        .filter((verb) => verb !== trigger)
        .map((verb) => [
          roomActionKey(verb.reference!),
          verb.reference?.kind === 'interactShopOffer' && verb.reference.offerKey === 'Boon'
            ? 'traitOffer'
            : undefined,
          ['ReplaceShopPurchaseParticipation'],
        ]),
      [roomActionKey(travelDealRefillPurchase), undefined, ['PurchaseShopTravelDealRefill']],
    ]);
    const buyRefill = later.at(-1)!;
    expect(verbAccepted(stocked, worldShop, buyRefill, 1)).toBe(true);
  });

  it('offers the rush Travel Deal refills on with its refill picker after it', () => {
    const shrineAddress = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const shrineVerbs = (document: ProjectDocument) => {
      const live = interactions(document, shrineAddress);
      return live.gaps[live.frontier]!.items.flatMap((item) =>
        item.kind === 'object' && item.object === 'hermesShrine'
          ? item.verbs.filter((verb) => verb.standing !== true)
          : [],
      );
    };
    const summary = (verb: LiveVerb) => [
      verb.verb,
      roomActionKey(verb.reference!),
      verb.choice?.picker,
      verb.commands?.map((command) => command.kind),
    ];
    let plan = applyProjectCommand(surfaceShrineTravelDealProject(), catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: shrineAddress,
      generationKey: 'travelDealRefill',
      purchased: false,
    });
    plan = applyProjectCommand(plan, catalog, {
      kind: 'SetHermesShrineRush',
      occurrence: shrineAddress,
      generationKey: 'initial:first',
      rushed: false,
    });
    plan = withShrineRefill(plan, shrineAddress, undefined);
    const rush = shrineVerbs(plan).find((verb) => verb.verb === 'rush')!;
    expect(summary(rush)).toEqual([
      'rush',
      roomActionKey({ kind: 'rushHermesShrineOffer', generationKey: 'initial:first' }),
      'travelDealRefill',
      ['SetHermesShrineRush'],
    ]);
    // A blank refill is not bought: it stops the walk at the rush that refills it.
    expect(
      shrineVerbs(plan)
        .filter((verb) => roomActionKey(verb.reference!).includes('travelDeal'))
        .map(summary),
    ).toEqual([]);
    const rushed = applyProjectCommand(plan, catalog, rush.commands![0]!);
    expect(
      simulateProjectAssembly(catalog, rushed).evaluation.findings.map((finding) => finding.code),
    ).toContain('hermesShrineTravelDealRefillMissing');
    const stocked = applyProjectCommand(rushed, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: shrineAddress,
      value: {
        rewardType: objectInteractions(rushed, shrineAddress)!.hermesShrine!.travelDealRefill!
          .candidateRewardTypes[0]!,
      },
    });
    const refillBuy = shrineVerbs(stocked).find(
      (verb) =>
        verb.reference?.kind === 'purchaseHermesShrineOffer' &&
        verb.reference.generationKey === 'travelDealRefill',
    )!;
    expect(summary(refillBuy).slice(2)).toEqual([undefined, ['PurchaseHermesShrineOffer']]);
    // Once refilled, no later rush carries the picker.
    expect(shrineVerbs(stocked).filter((verb) => verb.choice !== undefined)).toEqual([]);
  });

  it('names the outcome each placed row settles, opened on the row its edit places', () => {
    // Each plan's rooms, taken back to their entry one at a time, show the row's placement
    // with the picker its outcome takes once it stands.
    const expected: readonly (readonly [string, string, LiveVerb['verb']])[] = [
      ['surface-n-entry-frontier', 'traitOffer', 'pickUp'],
      ['underworld-fg', 'traitOffer', 'talkTo'],
      ['underworld-gorgon-athena', 'traitOffer', 'talkTo'],
      ['surface-anvil', 'anvilResult', 'buy'],
      ['surface-ordinary-hex-path', 'hexActivation', 'pickUp'],
      ['nemesis-f-trait-trade', 'nemesisEvent', 'talkTo'],
      ['dream-mixed-handoff', 'stygianWellTwist', 'buy'],
      ['underworld-fg', 'fountainRarity', 'use'],
    ];
    const missing: string[] = [];
    for (const [id, picker, verbKind] of expected) {
      const project = checkpointRegistry.find(({ entry }) => entry.id === id)!.load();
      const found = project.route.biomes.some((biome) =>
        (biome.topology?.occurrences ?? []).some((occurrence) => {
          const address = createOccurrenceAddress(
            createBiomeAddress(project.route.routeKey, biome.biomeKey),
            occurrence.occurrenceId,
          );
          const reset =
            occurrence.roomActions.order.length === 0
              ? project
              : applyProjectCommand(project, catalog, {
                  kind: 'ResetRoomActionsAfter',
                  occurrence: address,
                  afterActionKey: null,
                });
          const live = liveRoomForProjectEvaluationAssembly(
            catalog,
            simulateProjectAssembly(catalog, reset),
            address,
          );
          const verb = live?.gaps[live.frontier]?.items
            .flatMap((item) => item.verbs)
            .find(
              (candidate) => candidate.choice?.picker === picker && candidate.verb === verbKind,
            );
          if (verb === undefined) return false;
          // The outcome follows the edit that places its row.
          expect(verb.choice?.timing).toBe('after');
          const placed = verb.commands!.reduce(
            (document, command) => applyProjectCommand(document, catalog, command),
            reset,
          );
          expect(roomOrder(placed, address).map(roomActionKey)).toContain(
            roomActionKey(verb.reference!),
          );
          return true;
        }),
      );
      if (!found) missing.push(`${id} ${picker}`);
    }
    expect(missing).toEqual([]);

    // A locked door's press opens its fight; a challenge switch's press its outcome.
    const fgh = loadUnderworldFGHICheckpoint();
    const gHost = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'G'),
      createOccurrenceId('golden-g-b1-e1'),
    );
    const locked = applyProjectCommand(fgh, catalog, {
      kind: 'ReplaceLockedExit',
      occurrence: gHost,
      exitKey: 'exit2',
      locked: true,
    });
    const frontierVerbs = (document: ProjectDocument, address: OccurrenceAddress) => {
      const live = interactions(document, address);
      return live.gaps[live.frontier]!.items.flatMap((item) => item.verbs);
    };
    expect(
      frontierVerbs(locked, gHost)
        .filter((verb) => verb.verb === 'unlock')
        .map((verb) => [verb.choice?.picker, verb.commands?.map((command) => command.kind)]),
    ).toEqual([['unlockExitFight', ['InsertRoomAction']]]);
    const switchRoom = fRoom('golden-f-b5-e1');
    const observed = applyProjectCommand(fgh, catalog, {
      kind: 'ReplaceChallengeSwitch',
      occurrence: switchRoom,
      variantKey: 'PerfectClearChallengeSwitch_Pom',
    });
    expect(
      frontierVerbs(observed, switchRoom)
        .filter((verb) => verb.verb === 'press')
        .map((verb) => [verb.choice?.picker, verb.commands?.map((command) => command.kind)]),
    ).toEqual([['challengeSwitchOutcome', ['InsertRoomAction']]]);
  });

  it('offers a caged pickup nothing to do until its cage unlocks', () => {
    let locked = 0;
    const failures: string[] = [];
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly))
        for (const gap of live.gaps)
          for (const item of gap.items) {
            if (item.kind !== 'pickup' || item.lockedUntil === undefined) continue;
            locked += 1;
            if (item.verbs.some((verb) => verb.standing !== true))
              failures.push(`${id} ${address.occurrenceId} @${gap.index}`);
          }
    expect(failures).toEqual([]);
    expect(locked).toBeGreaterThan(0);
  });
});
