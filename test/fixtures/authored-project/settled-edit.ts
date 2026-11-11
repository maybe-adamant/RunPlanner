import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createRoomActionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  hermesShrineDeliveryEntryKey,
  roomActionKey,
  semanticAddressKey,
  type HermesShrineGenerationKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type SemanticAddress,
  withRoomActionContent,
  biomePlanContentSource,
  roomActionContentMatches,
  roomActionItemContent,
  roomActionReferenceContent,
  ProjectCommandContractError,
} from '@run-planner/engine/authored-project';
import {
  collectRequiredItems,
  liveActionsForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { authorLegalTraitOffers } from './trait-offers';

const evaluate = (document: ProjectDocument) => simulateProjectAssembly(catalog, document);

/** One edit settled as the editor's history settles it, so a swapped room's doors follow it. */
export function settleTestEdit(project: ProjectDocument, command: ProjectCommand): ProjectDocument {
  return settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly
    .project;
}

const PLACEMENT_FINDINGS: ReadonlySet<string> = new Set([
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

/** The room an address lies in: the nearest occurrence it names, in its nearest biome. */
function occurrenceOfAddress(
  address: SemanticAddress | ProjectCommand,
): OccurrenceAddress | undefined {
  const queue: {
    readonly node: unknown;
    readonly route: string | undefined;
    readonly biome: string | undefined;
  }[] = [{ node: address, route: undefined, biome: undefined }];
  while (queue.length > 0) {
    const { node, ...context } = queue.shift()!;
    if (typeof node !== 'object' || node === null) continue;
    const fields = node as Readonly<Record<string, unknown>>;
    const route = typeof fields.routeKey === 'string' ? fields.routeKey : context.route;
    const biome = typeof fields.biomeKey === 'string' ? fields.biomeKey : context.biome;
    if (typeof fields.occurrenceId === 'string' && route !== undefined && biome !== undefined)
      return createOccurrenceAddress(
        createBiomeAddress(route, biome),
        createOccurrenceId(fields.occurrenceId),
      );
    for (const child of Object.values(fields)) queue.push({ node: child, route, biome });
  }
  return undefined;
}

/**
 * Collects every required item the plan leaves on the ground, as an owner
 * playing forward would: while the plan has a room's required placement
 * finding, Collect all required runs in the first such room that still
 * collects something.
 */
export function collectTestRequiredItems(project: ProjectDocument): ProjectDocument {
  let assembly = evaluate(project);
  // Rooms whose placement finding Collect all required leaves standing on this plan.
  const settled = new Set<string>();
  for (;;) {
    const room = assembly.evaluation.findings
      .filter((finding) => PLACEMENT_FINDINGS.has(finding.code))
      .map((finding) => occurrenceOfAddress(finding.origin))
      .find((candidate) => candidate !== undefined && !settled.has(semanticAddressKey(candidate)));
    if (room === undefined) return assembly.project;
    const collected = collectRequiredItems({
      catalog,
      before: assembly,
      occurrence: room,
      evaluate,
    });
    if (collected.fault !== undefined)
      throw new Error(`Collect all required faulted at ${collected.fault.key}`);
    if (collected.commands.length === 0) {
      settled.add(semanticAddressKey(room));
      continue;
    }
    settled.clear();
    assembly = collected.assembly;
  }
}

/**
 * Authors legal trait offers and collects required items in turn until
 * neither changes the plan, so a route reaches as far as both carry it.
 */
export function authorTestTraitsAndRequiredItems(project: ProjectDocument): ProjectDocument {
  let current = project;
  for (let pass = 0; pass < 64; pass += 1) {
    const next = collectTestRequiredItems(authorLegalTraitOffers(current));
    if (next === current) return current;
    current = next;
  }
  throw new Error('trait offers and required items did not settle');
}

/**
 * Picks up one live item in a reached room, as the owner would from the live
 * row: by the canonical placement the live product offers, otherwise at the
 * room's frontier.
 */
export function placeTestLivePickup(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  actionKey: string,
): ProjectDocument {
  const before = evaluate(project);
  const live = liveActionsForProjectEvaluationAssembly(catalog, before, occurrence);
  if (live === undefined) throw new Error(`${occurrence.occurrenceId} is not reached`);
  let canonical: ProjectCommand | undefined;
  let frontier: ProjectCommand | undefined;
  for (const gap of live.gaps)
    for (const item of gap.items)
      for (const action of item.actions) {
        if (action.kind !== 'place' || roomActionKey(action.reference) !== actionKey) continue;
        if (action.canonical === true) canonical = action.command;
        if (gap.index === live.frontier) frontier ??= action.command;
      }
  const command = canonical ?? frontier;
  if (command === undefined)
    throw new Error(`${actionKey} is not live in ${occurrence.occurrenceId}`);
  return settleProjectEdit({ catalog, before, command, evaluate }).assembly.project;
}

/**
 * Picks up, one at a time in live order, every item a source spawned in a
 * reached room, by its acquisition site.
 */
export function placeTestLivePickupsAtSite(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  siteKey: string,
): ProjectDocument {
  let current = project;
  const placed = new Set<string>();
  for (;;) {
    const live = liveActionsForProjectEvaluationAssembly(catalog, evaluate(current), occurrence);
    const next = live?.gaps
      .flatMap((gap) => gap.items)
      .find(
        (item) =>
          item.kind === 'pickup' &&
          item.reference.kind === 'interactAcquisitionEntry' &&
          item.reference.siteKey === siteKey &&
          !placed.has(roomActionKey(item.reference)) &&
          item.actions.some((action) => action.kind === 'place'),
      );
    if (next === undefined || next.kind !== 'pickup') return current;
    const key = roomActionKey(next.reference);
    placed.add(key);
    current = placeTestLivePickup(current, occurrence, key);
  }
}

function roomOrder(project: ProjectDocument, occurrence: OccurrenceAddress) {
  return (
    project.route.biomes
      .find((biome) => biome.biomeKey === occurrence.biomeKey)
      ?.topology?.occurrences.find((room) => room.occurrenceId === occurrence.occurrenceId)
      ?.roomActions.order ?? []
  );
}

/** The keys of the items the live row offers to pick up in a reached room. */
function livePlaceableKeys(project: ProjectDocument, occurrence: OccurrenceAddress): Set<string> {
  const live = liveActionsForProjectEvaluationAssembly(catalog, evaluate(project), occurrence);
  return new Set(
    (live?.gaps ?? []).flatMap((gap) =>
      gap.items.flatMap((item) =>
        item.actions.flatMap((action) =>
          action.kind === 'place' ? [roomActionKey(action.reference)] : [],
        ),
      ),
    ),
  );
}

/**
 * The keys of the room's rows the command replaces the item of: rows whose
 * recorded content their item no longer holds once the command applies.
 */
function rowsOnItemsReplacedBy(
  project: ProjectDocument,
  command: ProjectCommand,
  occurrence: OccurrenceAddress,
): ReadonlySet<string> {
  const applied = applyProjectCommand(project, catalog, command);
  const plan = applied.route.biomes.find((biome) => biome.biomeKey === occurrence.biomeKey);
  const room = plan?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
  );
  const source = plan === undefined ? undefined : biomePlanContentSource(catalog, applied, plan);
  if (room === undefined || source === undefined) return new Set();
  return new Set(
    room.roomActions.order.flatMap((row) =>
      roomActionReferenceContent(row) !== undefined &&
      !roomActionContentMatches(row, roomActionItemContent(source, room, row))
        ? [roomActionKey(row)]
        : [],
    ),
  );
}

/**
 * Replaces an item whose row is placed, as the owner would: the settled edit
 * removes the old item's row, then Collect all required and the live row pick
 * up the new item when the walk reaches its room. In a room the walk does not
 * reach, each row the swap replaced is placed again where it stood, if the room
 * still holds that row's item. The room is the one the command names unless
 * given.
 */
export function replaceTestPlacedItem(
  project: ProjectDocument,
  command: ProjectCommand,
  room?: OccurrenceAddress,
): ProjectDocument {
  const occurrence = room ?? occurrenceOfAddress(command);
  if (occurrence === undefined) throw new Error(`${command.kind} names no room`);
  const placed = roomOrder(project, occurrence);
  const settled = evaluate(settleTestEdit(project, command));
  const missing = (current: ProjectDocument) =>
    placed.flatMap((row, index) =>
      roomOrder(current, occurrence).some((kept) => roomActionKey(kept) === roomActionKey(row))
        ? []
        : [{ row, index }],
    );
  if (liveActionsForProjectEvaluationAssembly(catalog, settled, occurrence) !== undefined) {
    const collected = collectRequiredItems({ catalog, before: settled, occurrence, evaluate });
    if (collected.fault !== undefined)
      throw new Error(`Collect all required faulted at ${collected.fault.key}`);
    let current = collected.assembly.project;
    for (const { row } of missing(current)) {
      const actionKey = roomActionKey(row);
      if (livePlaceableKeys(current, occurrence).has(actionKey))
        current = placeTestLivePickup(current, occurrence, actionKey);
    }
    return current;
  }
  let current = settled.project;
  const replaced = rowsOnItemsReplacedBy(project, command, occurrence);
  for (const { row, index } of missing(current)) {
    if (!replaced.has(roomActionKey(row))) continue;
    try {
      current = applyProjectCommand(current, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(
          createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
          occurrence.occurrenceId,
          roomActionKey(row),
        ),
        reference: withRoomActionContent(row, null),
        index: Math.min(index, roomOrder(current, occurrence).length),
      });
    } catch (error) {
      // The command decides whether the room still holds the row's item
      // (an inactive room or another role holds none).
      if (
        !(error instanceof ProjectCommandContractError) ||
        error.detail !== 'room action is not active for this occurrence'
      )
        throw error;
    }
  }
  return current;
}

/** Picks up a rushed Shrine purchase's item in its own room. */
export function placeTestRushedShrinePickup(
  project: ProjectDocument,
  source: OccurrenceAddress,
  generationKey: HermesShrineGenerationKey,
): ProjectDocument {
  return placeTestLivePickup(
    project,
    source,
    roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: hermesShrineDeliveryEntryKey(source, generationKey),
    }),
  );
}
