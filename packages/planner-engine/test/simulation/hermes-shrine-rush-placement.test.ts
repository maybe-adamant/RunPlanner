import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createRoomActionAddress,
  hermesShrineDeliveryEntryKey,
  positionedCommandInsertionIndexes,
  roomActionKey,
  undoProjectHistory,
  type HermesShrineGenerationKey,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  goldLedgerForProjectEvaluationAssembly,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { withItemContents } from '@run-planner/test-fixtures/shared';
import { surfaceShrineTravelDealProject } from '@run-planner/test-fixtures/surface';

const n = createBiomeAddress('Surface', 'N');
const shrine = createOccurrenceAddress(n, createOccurrenceId('surface-n-preboss:postboss'));
const purchase = (generationKey: HermesShrineGenerationKey) => ({
  kind: 'purchaseHermesShrineOffer' as const,
  generationKey,
});
const rushOf = (generationKey: HermesShrineGenerationKey) => ({
  kind: 'rushHermesShrineOffer' as const,
  generationKey,
});
const pickup = (generationKey: HermesShrineGenerationKey) => ({
  kind: 'interactAcquisitionEntry' as const,
  siteKey: 'hermesShrineDelivery',
  entryKey: hermesShrineDeliveryEntryKey(shrine, generationKey),
});
const fountain = { kind: 'useFountain' as const };
const rack = { kind: 'interactKeepsakeRack' as const };

const order = (project: ProjectDocument) =>
  project.route.biomes
    .find((biome) => biome.biomeKey === 'N')!
    .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === shrine.occurrenceId)!
    .roomActions.order;
const at = (project: ProjectDocument, reference: RoomActionReference) =>
  order(project).findIndex((candidate) => roomActionKey(candidate) === roomActionKey(reference));
const action = (reference: RoomActionReference) =>
  createRoomActionAddress(n, shrine.occurrenceId, roomActionKey(reference));
const move = (project: ProjectDocument, reference: RoomActionReference, toIndex: number) =>
  applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: action(reference),
    toIndex,
  });
const findings = (project: ProjectDocument) =>
  simulateProjectAssembly(catalog, project).evaluation.findings.map((finding) => finding.code);
const rushCommand = (generationKey: HermesShrineGenerationKey, index?: number) => ({
  kind: 'SetHermesShrineRush' as const,
  occurrence: shrine,
  generationKey,
  rushed: true,
  ...(index === undefined ? {} : { index }),
});

/** The Travel Deal Shrine with its first item bought and rushed, nothing else: [fountain, rack, buy first, rush first]. */
function firstRushedOnly(): ProjectDocument {
  let project = applyProjectCommand(surfaceShrineTravelDealProject(), catalog, {
    kind: 'SetHermesShrinePurchase',
    occurrence: shrine,
    generationKey: 'travelDealRefill',
    purchased: false,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'RemoveRoomAction',
    action: action(pickup('initial:first')),
  });
  expect(order(project)).toEqual(
    withItemContents(project, shrine, [
      fountain,
      rack,
      purchase('initial:first'),
      rushOf('initial:first'),
    ]),
  );
  return project;
}

/** Buys the second-left item at the end of the room. */
const buySecondLeft = (project: ProjectDocument) =>
  applyProjectCommand(project, catalog, {
    kind: 'PurchaseHermesShrineOffer',
    occurrence: shrine,
    generationKey: 'initial:secondLeft',
  });

function shrineHistory(project: ProjectDocument) {
  const biome = simulateProjectAssembly(catalog, project).evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === 'N',
  );
  if (biome === undefined || !('history' in biome)) throw new Error('N was not evaluated');
  return biome.history.events.filter(
    (event) =>
      'origin' in event &&
      event.origin.kind === 'occurrence' &&
      event.origin.occurrenceId === shrine.occurrenceId,
  );
}

describe('Hermes Shrine rush placement', () => {
  it('settles a rush placed later, with rows between, at its own row', () => {
    // [fountain, rack, buy first, buy second left, rush first]
    const adjacent = buySecondLeft(firstRushedOnly());
    const project = move(adjacent, rushOf('initial:first'), 4);
    expect(order(project).slice(2)).toEqual(
      withItemContents(project, shrine, [
        purchase('initial:first'),
        purchase('initial:secondLeft'),
        rushOf('initial:first'),
      ]),
    );
    // Only the delayed second-left delivery is left to place, as with the rush adjacent.
    expect(findings(project)).toEqual(findings(adjacent));
    expect(findings(project)).not.toContain('roomActionOrderUnavailable');
    const kinds = shrineHistory(project).flatMap((event) =>
      event.kind === 'hermesShrinePurchaseReached' || event.kind === 'hermesShrineRushReached'
        ? [`${event.kind}:${event.generationKey}`]
        : [],
    );
    expect(kinds).toEqual([
      'hermesShrinePurchaseReached:initial:first',
      'hermesShrinePurchaseReached:initial:secondLeft',
      'hermesShrineRushReached:initial:first',
    ]);
    // The rushed item spawns under its rush, for its owner to pick up after it.
    const spawned = spawnedLootForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, project),
      shrine,
    );
    expect(
      spawned?.actionSpawns.map((spawn) => [
        roomActionKey(spawn.source),
        spawn.items.map((item) => item.placement.kind),
      ]),
    ).toEqual([[roomActionKey(rushOf('initial:first')), ['unplaced']]]);
    const placeAt = (index: number) =>
      applyProjectCommand(project, catalog, {
        kind: 'InsertRoomAction',
        action: action(pickup('initial:first')),
        reference: pickup('initial:first'),
        index,
      });
    expect(findings(placeAt(5))).toEqual(findings(adjacent));
    // Before its rush the item does not exist yet.
    expect(findings(placeAt(4))).toContain('roomActionOrderUnavailable');
  });

  it('rushes at a chosen later gap, refuses a gap before the purchase, and undoes in one step', () => {
    const bought = createProjectHistory(buySecondLeft(firstRushedOnly()));
    // [fountain, rack, buy first, rush first, buy second left]: the rush stands only after its purchase.
    expect(
      positionedCommandInsertionIndexes(bought.present, catalog, rushCommand('initial:secondLeft')),
    ).toEqual([5]);
    const reordered = createProjectHistory(move(bought.present, purchase('initial:secondLeft'), 2));
    expect(
      positionedCommandInsertionIndexes(
        reordered.present,
        catalog,
        rushCommand('initial:secondLeft'),
      ),
    ).toEqual([3, 4, 5]);
    expect(() =>
      applyProjectCommand(reordered.present, catalog, rushCommand('initial:secondLeft', 2)),
    ).toThrow(/index 2 is not a legal position .* must follow/);
    const rushed = applyProjectHistoryCommand(
      reordered,
      catalog,
      rushCommand('initial:secondLeft', 5),
    );
    expect(order(rushed.present).slice(2)).toEqual(
      withItemContents(rushed.present, shrine, [
        purchase('initial:secondLeft'),
        purchase('initial:first'),
        rushOf('initial:first'),
        rushOf('initial:secondLeft'),
      ]),
    );
    expect(findings(rushed.present)).toEqual([]);
    expect(undoProjectHistory(rushed).present).toBe(reordered.present);
    // A moved rush undoes in one step too.
    const moved = applyProjectHistoryCommand(rushed, catalog, {
      kind: 'MoveRoomAction',
      action: action(rushOf('initial:first')),
      toIndex: 5,
    });
    expect(at(moved.present, rushOf('initial:first'))).toBe(5);
    expect(undoProjectHistory(moved).present).toBe(rushed.present);
  });

  it('moves a purchase without its rush', () => {
    // [fountain, rack, buy first, rush first, buy second left, rush second left]
    const project = applyProjectCommand(
      buySecondLeft(firstRushedOnly()),
      catalog,
      rushCommand('initial:secondLeft'),
    );
    const moved = move(project, purchase('initial:secondLeft'), 2);
    expect(order(moved).slice(2)).toEqual(
      withItemContents(moved, shrine, [
        purchase('initial:secondLeft'),
        purchase('initial:first'),
        rushOf('initial:first'),
        rushOf('initial:secondLeft'),
      ]),
    );
    expect(findings(moved)).toEqual([]);
    // Moved past its rush, the purchase leaves the rush with its ordering finding.
    expect(findings(move(project, purchase('initial:first'), 5))).toContain(
      'roomActionOrderUnavailable',
    );
  });

  it('realizes the Travel Deal refill at the earliest initial rush, so the refill follows that row', () => {
    // [fountain, rack, buy second left, buy first, rush first, rush second left]: the
    // first item's rush is made first, though the second-left item was bought first.
    let project = applyProjectCommand(firstRushedOnly(), catalog, {
      kind: 'PurchaseHermesShrineOffer',
      occurrence: shrine,
      generationKey: 'initial:secondLeft',
      index: 2,
    });
    project = applyProjectCommand(project, catalog, rushCommand('initial:secondLeft', 5));
    expect(order(project).slice(2)).toEqual(
      withItemContents(project, shrine, [
        purchase('initial:secondLeft'),
        purchase('initial:first'),
        rushOf('initial:first'),
        rushOf('initial:secondLeft'),
      ]),
    );
    const buyRefill = {
      kind: 'PurchaseHermesShrineOffer' as const,
      occurrence: shrine,
      generationKey: 'travelDealRefill' as const,
    };
    expect(positionedCommandInsertionIndexes(project, catalog, buyRefill)).toEqual([5, 6]);
    const refilled = applyProjectCommand(project, catalog, { ...buyRefill, index: 5 });
    // Only the refill's delayed delivery is left to place.
    expect(findings(refilled)).toEqual(['hermesShrineDeliveryPlacementRequired']);
    const events = shrineHistory(refilled);
    const sequenceOf = (kind: string, generationKey: HermesShrineGenerationKey) =>
      events.find(
        (event) =>
          event.kind === kind && 'generationKey' in event && event.generationKey === generationKey,
      )?.sequence ?? -1;
    expect(sequenceOf('hermesShrineRushReached', 'initial:first')).toBeLessThan(
      sequenceOf('hermesShrinePurchaseReached', 'travelDealRefill'),
    );
    expect(sequenceOf('hermesShrinePurchaseReached', 'travelDealRefill')).toBeLessThan(
      sequenceOf('hermesShrineRushReached', 'initial:secondLeft'),
    );
    // With every rush after it, the refill's purchase stands before its earliest rush.
    const late = move(refilled, rushOf('initial:first'), 6);
    expect(at(late, rushOf('initial:first'))).toBeGreaterThan(
      at(late, purchase('travelDealRefill')),
    );
    expect(findings(late)).toContain('roomActionOrderUnavailable');
  });

  it('prices a rush the same wherever it stands', () => {
    const adjacent = buySecondLeft(firstRushedOnly());
    const later = move(adjacent, rushOf('initial:first'), 4);
    const prices = (project: ProjectDocument) => {
      const gold = goldLedgerForProjectEvaluationAssembly(
        catalog,
        simulateProjectAssembly(catalog, project),
      );
      return [
        purchase('initial:first'),
        purchase('initial:secondLeft'),
        rushOf('initial:first'),
      ].map((reference) => {
        const availability = gold.purchaseAt(action(reference));
        return availability.availability === 'available'
          ? availability.purchase.price.mean
          : availability;
      });
    };
    // Order round(round(76.5) x 1.2) = 92 and rush round(135) - round(90 x 1.2) = 27, as adjacent.
    expect(prices(adjacent)).toEqual(prices(later));
    expect(prices(later)[2]).toBe(27);
  });
});
