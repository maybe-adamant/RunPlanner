import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createProjectHistory,
  createShopOfferAddress,
  decodeProjectDocument,
  roomActionKey,
  undoProjectHistory,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  roomActionResetsForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createGoldenFGHProject,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOProject,
  nBiome as surfaceNBiome,
  oBiome,
  oOccurrenceIds,
  surfaceShrineDeliveriesProject,
  surfaceShrineTravelDealProject,
} from '@run-planner/test-fixtures/surface';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';

const fPostboss = createOccurrenceAddress(
  goldenFBiome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);
const fields = createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat02'));
const invented: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'invented' };

function order(project: ProjectDocument, room: OccurrenceAddress): readonly string[] {
  const occurrence = project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId);
  if (occurrence === undefined) throw new Error(`${room.occurrenceId} is missing`);
  return occurrence.roomActions.order.map(roomActionKey);
}

const reset = (occurrence: OccurrenceAddress, after: RoomActionReference | null) =>
  ({
    kind: 'ResetRoomActionsAfter',
    occurrence,
    afterActionKey: after === null ? null : roomActionKey(after),
  }) as const;

/** The room's order rewritten by `edit`, as a loaded document retains it. */
function withOrder(
  project: ProjectDocument,
  room: OccurrenceAddress,
  edit: (order: readonly RoomActionReference[]) => readonly RoomActionReference[],
): ProjectDocument {
  return decodeProjectDocument(
    {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((plan) =>
          plan.biomeKey !== room.biomeKey || plan.topology === null
            ? plan
            : {
                ...plan,
                topology: {
                  ...plan.topology,
                  occurrences: plan.topology.occurrences.map((candidate) =>
                    candidate.occurrenceId !== room.occurrenceId
                      ? candidate
                      : {
                          ...candidate,
                          roomActions: { order: edit(candidate.roomActions.order) },
                        },
                  ),
                },
              },
        ),
      },
    },
    catalog,
  );
}

const withAppended = (
  project: ProjectDocument,
  room: OccurrenceAddress,
  extra: readonly RoomActionReference[],
) => withOrder(project, room, (current) => [...current, ...extra]);

describe('ResetRoomActionsAfter', () => {
  const fountain: RoomActionReference = { kind: 'useFountain' };
  const rack: RoomActionReference = { kind: 'interactKeepsakeRack' };

  it('removes every later row through its own removal; the rack and required rows stay', () => {
    const project = createUnderworldFWellCheckpoint();
    expect(order(project, fPostboss)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
      roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondLeft' }),
      roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondRight' }),
      roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey: 'travelDealRefill' }),
    ]);
    const after = applyProjectCommand(project, catalog, reset(fPostboss, fountain));
    // The Well purchases leave as un-purchases; the permanent rack keeps its place.
    expect(order(after, fPostboss)).toEqual([roomActionKey(fountain), roomActionKey(rack)]);
    // From the room's entry the required fountain stays too.
    expect(order(applyProjectCommand(project, catalog, reset(fPostboss, null)), fPostboss)).toEqual(
      [roomActionKey(fountain), roomActionKey(rack)],
    );
  });

  it('is one Undo step', () => {
    const initial = createProjectHistory(createUnderworldFWellCheckpoint());
    const edited = applyProjectHistoryCommand(initial, catalog, reset(fPostboss, fountain));
    expect(edited.past).toHaveLength(initial.past.length + 1);
    expect(undoProjectHistory(edited).present).toBe(initial.present);
  });

  it('leaves the document unchanged when nothing it can remove follows', () => {
    const project = createUnderworldFWellCheckpoint();
    const last = { kind: 'purchaseStygianWellOffer', generationKey: 'travelDealRefill' } as const;
    expect(applyProjectCommand(project, catalog, reset(fPostboss, last))).toBe(project);
    // Every row of a Fields room is a required cage contact: nothing leaves.
    const authored = createGoldenFGHProject();
    expect(applyProjectCommand(authored, catalog, reset(fields, null))).toBe(authored);
  });

  it('refuses an anchor that is not an ordered action of the room', () => {
    const project = createUnderworldFWellCheckpoint();
    expect(() => applyProjectCommand(project, catalog, reset(fPostboss, invented))).toThrow(
      'afterActionKey is not an ordered room action',
    );
  });

  it('removes optional and stale rows after the point', () => {
    const optional: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'optionalRewards',
      slotKey: 'optional1',
    };
    const authored = createGoldenFGHProject();
    const original = order(authored, fields);
    const retained = withAppended(authored, fields, [optional, invented]);
    const cage1: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'cages',
      slotKey: 'cage1',
    };
    expect(order(applyProjectCommand(retained, catalog, reset(fields, cage1)), fields)).toEqual(
      original,
    );
  });

  it('removes rows in later Ship phases after a point inside an earlier one', () => {
    const combat07 = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const authored = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: combat07,
      encounterCount: 3,
    });
    const original = order(authored, combat07);
    const wheel1: RoomActionReference = { kind: 'interactWheelReward', wheelKey: 'wheel1' };
    // Phase 2's wheel rows are required and stay; the stale row after them goes.
    expect(original.indexOf(roomActionKey(wheel1))).toBeLessThan(original.length - 1);
    const retained = withAppended(authored, combat07, [invented]);
    expect(
      order(applyProjectCommand(retained, catalog, reset(combat07, wheel1)), combat07),
    ).toEqual(original);
  });

  it('keeps a due delivery and its required wheel rows, and settles a reset without a fault', () => {
    const combat04 = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = surfaceShrineDeliveriesProject();
    // Wheel choice, its pickup and the due delivery are all automatic required placements.
    expect(applyProjectCommand(project, catalog, reset(combat04, null))).toBe(project);
    const evaluate = (document: ProjectDocument) => simulateProjectAssembly(catalog, document);
    const settled = settleProjectEdit({
      catalog,
      before: evaluate(createUnderworldFWellCheckpoint()),
      command: reset(fPostboss, null),
      evaluate,
    });
    expect(settled.fault).toBeUndefined();
    expect(order(settled.assembly.project, fPostboss)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
    ]);
  });

  it('removes a Shop purchase with the Travel Deal refill it stocked', () => {
    const shop = createOccurrenceAddress(nBiome, createOccurrenceId('round-trip-n-preboss'));
    const project = createCompleteNProject();
    const room = project.route.biomes
      .find((plan) => plan.biomeKey === 'N')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === shop.occurrenceId)!;
    const option = catalog.rewards.shops.byKey[
      room.state.kind === 'shop' ? (room.state.shop?.profileKey ?? '') : ''
    ]?.groups.values
      .flatMap((group) => group.options.values)
      .find((candidate) => candidate.rewardType === 'BlindBoxLoot');
    if (option === undefined) throw new Error('expected a Mystery Shop option');
    const before = order(project, shop);
    const boon: RoomActionReference = { kind: 'interactShopOffer', offerKey: 'Boon' };
    const bought = applyProjectCommand(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(nBiome, shop.occurrenceId, 'Boon'),
        purchased: true,
      }),
      catalog,
      {
        kind: 'PurchaseShopTravelDealRefill',
        occurrence: shop,
        value: { optionKey: option.key, offer: { rewardType: 'BlindBoxLoot' } },
      },
    );
    const refill = roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'travelDealRefill',
    });
    expect(order(bought, shop)).toEqual([...before, roomActionKey(boon), refill]);
    // The refill after the purchase goes; the purchase stays.
    expect(order(applyProjectCommand(bought, catalog, reset(shop, boon)), shop)).toEqual([
      ...before,
      roomActionKey(boon),
    ]);
    const anchor =
      before.length === 0
        ? null
        : bought.route.biomes
            .find((plan) => plan.biomeKey === 'N')!
            .topology!.occurrences.find(
              (candidate) => candidate.occurrenceId === shop.occurrenceId,
            )!.roomActions.order[before.length - 1]!;
    const cleared = applyProjectCommand(bought, catalog, reset(shop, anchor));
    expect(order(cleared, shop)).toEqual(before);
    const clearedRoom = cleared.route.biomes
      .find((plan) => plan.biomeKey === 'N')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === shop.occurrenceId)!;
    expect(clearedRoom.acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toBeUndefined();
  });

  it('removes a rushed Shrine purchase with its pickup and the refill it triggered', () => {
    const shrine = createOccurrenceAddress(
      surfaceNBiome,
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const project = surfaceShrineTravelDealProject();
    const rushed: RoomActionReference = {
      kind: 'purchaseHermesShrineOffer',
      generationKey: 'initial:first',
      rushed: true,
    };
    expect(order(project, shrine).slice(0, 3)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
      roomActionKey(rushed),
    ]);
    expect(order(project, shrine)).toHaveLength(5);
    expect(order(applyProjectCommand(project, catalog, reset(shrine, rack)), shrine)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
    ]);
  });

  it('removes a Shrine purchase whose offer no longer resolves', () => {
    const shrine = createOccurrenceAddress(
      surfaceNBiome,
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const project = surfaceShrineTravelDealProject();
    // A document the codec would refuse: the purchased slot lost its offer.
    const unresolved: ProjectDocument = {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((plan) =>
          plan.biomeKey !== shrine.biomeKey || plan.topology === null
            ? plan
            : {
                ...plan,
                topology: {
                  ...plan.topology,
                  occurrences: plan.topology.occurrences.map((candidate) =>
                    candidate.occurrenceId !== shrine.occurrenceId ||
                    candidate.hermesShrine === undefined
                      ? candidate
                      : {
                          ...candidate,
                          hermesShrine: {
                            ...candidate.hermesShrine,
                            offerBySlot: { ...candidate.hermesShrine.offerBySlot, first: null },
                          },
                        },
                  ),
                },
              },
        ),
      },
    };
    expect(order(applyProjectCommand(unresolved, catalog, reset(shrine, rack)), shrine)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
    ]);
  });

  it('removes a stale row between the last ranked row and a banner', () => {
    const project = withOrder(createUnderworldFWellCheckpoint(), fPostboss, (current) => [
      current[0]!,
      invented,
      ...current.slice(1),
    ]);
    const assembly = simulateProjectAssembly(catalog, project);
    const resets = roomActionResetsForProjectEvaluationAssembly(catalog, assembly, fPostboss)!;
    // The doors-open banner follows the fountain; its reset takes the stale row after it.
    const fromFountain = resets.filter(
      (entry) => entry !== undefined && entry.afterActionKey === roomActionKey(fountain),
    );
    // The fountain's own entry and the banner after it.
    expect(fromFountain).toHaveLength(2);
    expect(order(applyProjectCommand(project, catalog, fromFountain[1]!), fPostboss)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
    ]);
  });

  it('leaves an Ephyra room’s side visit order untouched', () => {
    const combatId = createOccurrenceId('round-trip-n-combat02');
    const sideDoor1 = createOccurrenceId('round-trip-n-combat02-sideDoor1');
    const sideDoor2 = createOccurrenceId('round-trip-n-combat02-sideDoor2');
    let project = createCompleteNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'])
      project = applyProjectCommand(project, catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: createLocalVisitSlotAddress(nBiome, combatId, 'sideRooms', slotKey),
        generation: 'generated',
      });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, combatId, 'sideRooms'),
      occurrenceIds: [sideDoor2, sideDoor1],
    });
    const combat = createOccurrenceAddress(nBiome, combatId);
    const original = order(project, combat);
    const retained = withAppended(project, combat, [invented]);
    const after = applyProjectCommand(retained, catalog, reset(combat, null));
    expect(order(after, combat)).toEqual(original);
    const decisions = (document: ProjectDocument) =>
      document.route.biomes.find((plan) => plan.biomeKey === 'N')!.topology!.decisions;
    expect(decisions(after)).toEqual(decisions(retained));
  });

  it('clears a chosen keepsake on a rack after the point; the held keepsake stays', () => {
    const chosen = applyProjectCommand(createUnderworldFWellCheckpoint(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(fPostboss),
      keepsakeKey: 'BossPreDamageKeepsake',
    });
    const keepsake = (project: ProjectDocument) =>
      project.route.biomes
        .find((plan) => plan.biomeKey === fPostboss.biomeKey)!
        .topology!.occurrences.find(
          (candidate) => candidate.occurrenceId === fPostboss.occurrenceId,
        )!.keepsakeRack?.keepsakeKey;
    expect(keepsake(chosen)).toBe('BossPreDamageKeepsake');
    const history = applyProjectHistoryCommand(
      createProjectHistory(chosen),
      catalog,
      reset(fPostboss, fountain),
    );
    expect(keepsake(history.present)).toBeNull();
    expect(order(history.present, fPostboss)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
    ]);
    expect(undoProjectHistory(history).present).toBe(chosen);
    // A reset after the rack leaves its choice alone.
    const afterRack = applyProjectCommand(chosen, catalog, reset(fPostboss, rack));
    expect(keepsake(afterRack)).toBe('BossPreDamageKeepsake');
    expect(order(afterRack, fPostboss)).toEqual([roomActionKey(fountain), roomActionKey(rack)]);
    // With no row left to remove, clearing the choice is still a change.
    const cleared = applyProjectCommand(afterRack, catalog, reset(fPostboss, fountain));
    expect(keepsake(cleared)).toBeNull();
    expect(applyProjectCommand(cleared, catalog, reset(fPostboss, fountain))).toBe(cleared);
  });
});
