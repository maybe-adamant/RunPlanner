import {
  withoutAcquisitionEntryObservation,
  withoutDormantArtificerReplacementsInProject,
} from '../authored-project/acquisition/derived-items';
import { sameRewardOffer } from '../reward-kernel';
import type { Catalog } from '../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createHubDecisionAddress,
  createHubRerollAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  createShopOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type HubDecisionAddress,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import {
  ProjectCommandContractError,
  projectCommandAddress,
  type CommandContractSubject,
} from '../authored-project/commands/contract';
import { applyProjectCommand } from '../authored-project/commands/dispatch';
import {
  exitCapacityDrifts,
  settleExitCapacity,
} from '../authored-project/commands/topology-reconciliation';
import { roomActionRemovalCommand } from '../authored-project/commands/room-action-reset';
import { authoredLevelResolutionAt } from '../authored-project/commands/level-resolution';
import { authoredTraitOfferAt } from '../authored-project/commands/trait-offer';
import type { ProjectCommand } from '../authored-project/commands/types';
import type {
  HubDecision,
  HubRerollAction,
  OccurrenceId,
  ProjectDocument,
  RoomActionReference,
  RoomOccurrence,
} from '../authored-project/model';
import { roomActionKey } from '../authored-project/room-actions/state';
import { roomActionsOnReplacedItems } from '../authored-project/room-actions/replaced-items';
import { rerolledScreenCount } from '../authored-project/screen-rerolls';
import type { RerolledRewardOwner } from '../authored-project/rerolls';
import {
  rerolledItemsReplacedBetween,
  rerolledRewardsOffTheirPress,
  resetRerolledRewardOffItsPress,
} from '../authored-project/commands/rerolls';
import {
  discardRetainedHermesShrineDelivery,
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  hermesShrineDeliverySourceAddress,
  hermesShrineRushAction,
  isSameRoomDelivery,
  offerFor,
  parseHermesShrineDeliveryEntryKey,
  purchasedOfferFor,
} from '../authored-project/hermes-shrine-delivery';
import {
  parseClockedTraitGeneratedPickupEntryKey,
  parseEchoLastRewardPickupEntryKey,
} from '../authored-project/acquisition/pickup-producers';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../authored-project/shop';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  attestClockedTraitPickupPlacementForProjectEvaluationAssembly,
  rerollSettlementForProjectEvaluationAssembly,
} from './evaluation/project-evaluation-assembly';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';
import { candidateBiome, candidateBiomeRooms } from './candidates/evaluated-biome';
import { positionFills } from './position-fill';
import { currentPoolListValues, stockFills, type PoolValuesBefore } from './stock-fill';

function occurrences(project: ProjectDocument) {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).map((occurrence) => ({
      occurrence,
      owner: createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        occurrence.occurrenceId,
      ),
    })),
  );
}
function occurrenceAt(
  project: ProjectDocument,
  owner: OccurrenceAddress,
): RoomOccurrence | undefined {
  return project.route.biomes
    .find((biome) => biome.biomeKey === owner.biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === owner.occurrenceId);
}
function placements(assembly: ProjectEvaluationAssembly) {
  return assembly.evaluation.route.biomes.flatMap((biome) =>
    'rewards' in biome ? (biome.rewards.generatedPickupPlacements ?? []) : [],
  );
}
/** An engine contract failure beside the settled assembly: a repair the settlement refused to repeat. */
export interface SettlementFault {
  readonly key: string;
  readonly owner: SemanticAddress;
}

/** A door an edit took from a room because the room no longer has it, with the room behind it. */
export interface RemovedRoomDoor {
  readonly exitKey: string;
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
}

/**
 * An item whose observations an edit discarded because the item was replaced:
 * a Hermes delivery whose host or Shrine stock changed, a rerolled reward whose
 * press is no longer its effective one, or an Echo replay of another reward.
 */
export interface DiscardedRoomObservation {
  readonly item: SemanticAddress;
}

/**
 * The stale and source-gone actions one room lost to an edit, in their former
 * order, the doors it lost with the room having fewer, in door order, and the
 * observations it lost with their replaced items.
 */
export interface RemovedStaleRoomActions {
  readonly occurrence: OccurrenceAddress;
  readonly actions: readonly RoomActionReference[];
  readonly doors?: readonly RemovedRoomDoor[];
  readonly discarded?: readonly DiscardedRoomObservation[];
}

/** The board-door presses one Hub lost to an edit with their slot's door, in their former order. */
export interface RemovedHubRerolls {
  readonly hub: HubDecisionAddress;
  readonly rerolls: readonly HubRerollAction[];
}

export interface ProjectEditSettlement {
  readonly assembly: ProjectEvaluationAssembly;
  readonly fault?: SettlementFault;
  /**
   * Rows the edit left with no context or source, removed by the same edit,
   * in every room but the one it addresses; absent when none.
   */
  readonly removedStaleActions?: readonly RemovedStaleRoomActions[];
  /** Hub presses the edit removed with their slot's door; absent when none. */
  readonly removedHubRerolls?: readonly RemovedHubRerolls[];
}

interface RosterRow {
  readonly reference: RoomActionReference;
  readonly stale: boolean;
}

/**
 * Each room the run enters, with its roster rows by key. A room no longer
 * entered keeps its rows untouched: they return with its door.
 */
function enteredRosters(assembly: ProjectEvaluationAssembly) {
  const rosters = new Map<
    string,
    { readonly owner: OccurrenceAddress; readonly rows: ReadonlyMap<string, RosterRow> }
  >();
  const routeKey = assembly.project.route.routeKey;
  for (const plan of assembly.project.route.biomes) {
    const biome = candidateBiome(assembly.evaluation, routeKey, plan.biomeKey);
    if (biome === undefined) continue;
    for (const room of candidateBiomeRooms(biome)) {
      if (room.origin.kind !== 'occurrence' || !room.entered) continue;
      const key = semanticAddressKey(room.origin);
      if (rosters.has(key)) continue;
      rosters.set(
        key,
        Object.freeze({
          owner: room.origin,
          rows: new Map(room.roomActionRoster.rows.map((row) => [row.key, row])),
        }),
      );
    }
  }
  return rosters;
}

/** The occurrence as authored, without the item content its rows record. */
function withoutRecordedContent(occurrence: RoomOccurrence | undefined): string | undefined {
  return JSON.stringify(occurrence, (key, value: unknown) =>
    key === 'content' ? undefined : value,
  );
}

/** Whether the edit changed the room's authored occurrence; stamping content alone does not. */
type RoomEdited = (after: ProjectDocument, owner: OccurrenceAddress) => boolean;

/**
 * Judges rooms against the plan before the edit, with the positions the
 * settlement filled since: filling a blank position is not an edit of its
 * room. Each occurrence is read once per settlement.
 */
function roomEditedSince(baseline: () => ProjectDocument): RoomEdited {
  const read = new WeakMap<RoomOccurrence, string | undefined>();
  const text = (occurrence: RoomOccurrence | undefined) => {
    if (occurrence === undefined) return undefined;
    if (!read.has(occurrence)) read.set(occurrence, withoutRecordedContent(occurrence));
    return read.get(occurrence);
  };
  return (after, owner) => {
    const old = occurrenceAt(baseline(), owner);
    const now = occurrenceAt(after, owner);
    return old !== now && text(old) !== text(now);
  };
}

/**
 * The room an address belongs to: the occurrence it names or nests. Route,
 * biome and Hub owners belong to no single room.
 */
function addressedRoom(
  value: unknown,
  routeKey?: string,
  biomeKey?: string,
): OccurrenceAddress | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const fields = value as Record<string, unknown>;
  const route = typeof fields.routeKey === 'string' ? fields.routeKey : routeKey;
  const biome = typeof fields.biomeKey === 'string' ? fields.biomeKey : biomeKey;
  if (route === undefined || biome === undefined) return undefined;
  const occurrenceId = fields.occurrenceId ?? fields.sourceOccurrenceId;
  if (typeof occurrenceId === 'string')
    return createOccurrenceAddress(createBiomeAddress(route, biome), occurrenceId as OccurrenceId);
  for (const nested of Object.values(fields)) {
    const room = addressedRoom(nested, route, biome);
    if (room !== undefined) return room;
  }
  return undefined;
}

/**
 * The stale rows an edit removes in the rooms the run enters: every row the
 * edit left with no context, and in each room the edit changed, every stale
 * row retained from before it. An upgrade removes every stale row. Rooms the
 * evaluation does not reach keep their rows until it does.
 */
function staleRowsToRemove(
  edited: RoomEdited,
  beforeRosters: ReturnType<typeof enteredRosters>,
  assembly: ProjectEvaluationAssembly,
  upgrade: boolean,
) {
  const removals: TakenRow[] = [];
  for (const [roomKey, { owner, rows }] of enteredRosters(assembly)) {
    const current = occurrenceAt(assembly.project, owner);
    if (current === undefined) continue;
    const prior = beforeRosters.get(roomKey)?.rows;
    let changed: boolean | undefined = upgrade || undefined;
    for (const reference of current.roomActions.order) {
      const key = roomActionKey(reference);
      if (rows.get(key)?.stale !== true || reference.kind === 'interactKeepsakeRack') continue;
      const orphaned = prior?.get(key)?.stale === false;
      if (!orphaned && (changed ??= edited(assembly.project, owner)) === false) continue;
      removals.push({ owner, reference });
    }
  }
  return removals;
}

/** A row an edit takes, in its room. */
interface TakenRow {
  readonly owner: OccurrenceAddress;
  readonly reference: RoomActionReference;
}

/**
 * A row an edit removes, with its pickup payload's fate: a replaced item's row
 * leaves the new item's observation and a source-gone Shop row leaves its
 * payload with the Shop, while any other removal takes what its command takes.
 */
interface RowRemoval extends TakenRow {
  readonly payload: 'kept' | 'taken';
}

/** An item an edit replaced: its observation and its chain go with it. */
type ReplacedItem =
  | {
      readonly kind: 'delivery' | 'echoReplay';
      readonly room: OccurrenceAddress;
      readonly entryKey: string;
    }
  | {
      readonly kind: 'rerolledReward';
      readonly room: OccurrenceAddress;
      readonly owner: RerolledRewardOwner;
    }
  | {
      /** A Travel Deal restock whose triggering purchase changed: a new item. */
      readonly kind: 'travelDealRefill';
      readonly room: OccurrenceAddress;
      readonly stock: 'stygianWell' | 'hermesShrine' | 'worldShop';
    };

/** The replaced item's own address: its pickup entry or its rerolled owner. */
function replacedItemAddress(item: ReplacedItem): SemanticAddress {
  if (item.kind === 'rerolledReward') return item.owner;
  if (item.kind === 'travelDealRefill' && item.stock === 'worldShop')
    return createShopOfferAddress(
      createBiomeAddress(item.room.routeKey, item.room.biomeKey),
      item.room.occurrenceId,
      TRAVEL_DEAL_REFILL_ENTRY_KEY,
    );
  if (item.kind === 'travelDealRefill')
    return createRoomFeatureAddress(item.room, {
      kind: item.stock === 'stygianWell' ? 'stygianWellOffer' : 'hermesShrineOffer',
      generationKey: 'travelDealRefill',
    });
  const siteKey = item.kind === 'delivery' ? HERMES_SHRINE_DELIVERY_SITE_KEY : 'roomExit';
  return createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(item.room, siteKey),
    item.entryKey,
  );
}

/** A replaced item's key, or a row's on one, which also names its repair. */
function itemKey(item: ReplacedItem | TakenRow): string {
  return 'reference' in item
    ? `row:${semanticAddressKey(item.owner)}|${roomActionKey(item.reference)}`
    : `${item.kind}:${semanticAddressKey(replacedItemAddress(item))}`;
}

function rerolledItems(owners: readonly RerolledRewardOwner[]): ReplacedItem[] {
  return owners.map((owner) => ({
    kind: 'rerolledReward',
    room: createOccurrenceAddress(
      createBiomeAddress(owner.routeKey, owner.biomeKey),
      owner.occurrenceId,
    ),
    owner,
  }));
}

/** Whether the edit replaced this item, or this row's item, now. */
type ReplacedNow = (after: ProjectDocument, item: ReplacedItem | TakenRow) => boolean;

/**
 * Judges replaced items against the plan before the edit: one the plan held
 * replaced already, read once for every kind, goes only with an edit of its
 * room. An upgrade, with no plan before it, holds none.
 */
function replacedSince(
  catalog: Catalog,
  before: ProjectDocument | undefined,
  edited: RoomEdited,
): ReplacedNow {
  const prior = new Set(
    before === undefined
      ? []
      : [
          ...roomActionsOnReplacedItems(before, catalog),
          ...deliveriesOffTheirSource(before),
          ...rerolledItems(rerolledRewardsOffTheirPress(catalog, before)),
        ].map(itemKey),
  );
  return (after, item) =>
    !prior.has(itemKey(item)) || edited(after, 'reference' in item ? item.owner : item.room);
}

/** The row taking one pickup entry in a room, when one is placed. */
function placedEntry(occurrence: RoomOccurrence | undefined, siteKey: string, entryKey: string) {
  return occurrence?.roomActions.order.find(
    (reference): reference is Extract<RoomActionReference, { kind: 'interactAcquisitionEntry' }> =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.siteKey === siteKey &&
      reference.entryKey === entryKey,
  );
}

type CandidateArtifacts = ReturnType<typeof candidateArtifactsForProjectEvaluationAssembly>;

/**
 * Shop rows that exist only as a source's product, by what each is: Travel
 * Deal's refill is the owner's purchase relying on Travel Deal, Gold Gold
 * Gold's duplicate an automatic product of the boon.
 */
const SOURCED_SHOP_ROWS: ReadonlyMap<string, 'decision' | 'product'> = new Map([
  [ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY, 'product'],
  [TRAVEL_DEAL_REFILL_ENTRY_KEY, 'decision'],
]);
/** The walk reached such a row and found nothing for it to take. */
const SOURCED_SHOP_ENTRY_UNAVAILABLE: ReadonlySet<unknown> = new Set([
  'echoShopDuplicateUnavailable',
  'travelDealRefillUnavailable',
]);

/** The room action that buys a Shop offer: its inventory purchase or the Travel Deal refill. */
function shopPurchaseRowKey(offerKey: string): string {
  return roomActionKey(
    offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: offerKey }
      : { kind: 'interactShopOffer', offerKey },
  );
}

/** Whether a Shop purchase stands before the row: the trigger a sourced row needs. */
function purchaseBefore(occurrence: RoomOccurrence | undefined, rowKey: string): boolean {
  const order = occurrence?.roomActions.order ?? [];
  const index = order.findIndex((candidate) => roomActionKey(candidate) === rowKey);
  return order
    .slice(0, Math.max(index, 0))
    .some(
      (candidate) =>
        candidate.kind === 'interactShopOffer' ||
        roomActionKey(candidate) === shopPurchaseRowKey(TRAVEL_DEAL_REFILL_ENTRY_KEY),
    );
}

/**
 * Shop rows whose source the edit took away: the walk reaches the row and no
 * source produces it any more. When one produced it before the edit, its
 * trigger is the purchase that produced it; when that purchase is still in the
 * room, what went is the enabler (the held boon), and an owner's purchase
 * relying on it stays with its finding while an automatic product goes. A row
 * no source produced before the edit either (its enabler went earlier, or it
 * was placed before its source existed) stays with its finding until the edit
 * takes every purchase before it, its trigger among them. A row whose source
 * still produces it with other terms stays with its finding. An upgrade, with no
 * walk before it, removes only an automatic product that a purchase stands before.
 */
function sourceGoneShopRows(
  before: ProjectEvaluationAssembly,
  beforeArtifacts: CandidateArtifacts,
  artifacts: CandidateArtifacts,
  assembly: ProjectEvaluationAssembly,
  upgrade: boolean,
) {
  const unavailable = new Set(
    assembly.evaluation.findings.flatMap((finding) =>
      finding.code === 'shopPurchaseUnavailable' &&
      SOURCED_SHOP_ENTRY_UNAVAILABLE.has(finding.evidence.kind)
        ? [semanticAddressKey(finding.origin)]
        : [],
    ),
  );
  const removals: TakenRow[] = [];
  if (unavailable.size === 0) return removals;
  for (const { owner, occurrence } of occurrences(assembly.project)) {
    if (occurrence.state.kind !== 'shop') continue;
    const biome = createBiomeAddress(owner.routeKey, owner.biomeKey);
    for (const reference of occurrence.roomActions.order) {
      if (reference.kind !== 'interactAcquisitionEntry' || !sourcedShopRow(reference)) continue;
      const address = createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(owner, reference.siteKey),
        reference.entryKey,
      );
      const key = semanticAddressKey(address);
      if (!unavailable.has(key)) continue;
      // A refill's capability is filed under its inventory, so read the site's entries.
      const derived = (candidates: CandidateArtifacts) =>
        candidates
          .biomeAt(biome)
          ?.derivedAcquisitionEntries.entriesAt(address.site)
          .find((entry) => semanticAddressKey(entry.address) === key)?.capability;
      if (derived(artifacts) !== undefined) continue;
      const prior = derived(beforeArtifacts);
      if (prior?.kind === 'echoDoubleShopReward' || prior?.kind === 'travelDealRefill') {
        const triggerGone =
          prior.sourceOfferKey !== undefined &&
          !occurrence.roomActions.order.some(
            (candidate) => roomActionKey(candidate) === shopPurchaseRowKey(prior.sourceOfferKey!),
          );
        // Enabler gone: the owner's purchase stays, invalid, for the owner to remove or restore.
        if (!triggerGone && SOURCED_SHOP_ROWS.get(reference.entryKey) === 'decision') continue;
      } else if (upgrade) {
        // A purchase before an automatic product proves its trigger stands, so its enabler went.
        // An owner's purchase, or a product with no purchase before it, may have been placed
        // before its source existed: it stays with its finding.
        if (
          SOURCED_SHOP_ROWS.get(reference.entryKey) !== 'product' ||
          !purchaseBefore(occurrence, roomActionKey(reference))
        )
          continue;
      } else {
        const rowKey = roomActionKey(reference);
        if (!purchaseBefore(occurrenceAt(before.project, owner), rowKey)) continue;
        if (purchaseBefore(occurrence, rowKey)) continue;
      }
      removals.push({ owner, reference });
    }
  }
  return removals;
}

/**
 * Cage rerolls whose cage the edit stopped playing: the walk reaches the press
 * and its door's room no longer plays the cage, where before the edit the
 * press found it (it settled, or failed for a reason other than its target).
 * A press that never found its cage, one whose door is unavailable, and every
 * Hub reroll stay with their findings, and an upgrade removes none.
 */
function cageGoneRerolls(
  before: ProjectEvaluationAssembly,
  assembly: ProjectEvaluationAssembly,
  upgrade: boolean,
): TakenRow[] {
  // The saved plan cannot show that a press once found its cage: an upgrade keeps it.
  if (upgrade) return [];
  const reason = (finding: { readonly code: string; readonly evidence: unknown }) =>
    finding.code === 'rerollTargetUnavailable'
      ? (finding.evidence as { readonly reason?: unknown }).reason
      : undefined;
  return assembly.evaluation.findings.flatMap((finding) => {
    const action = finding.origin;
    if (reason(finding) !== 'cageNotPlayed' || action.kind !== 'roomAction') return [];
    const owner = createOccurrenceAddress(
      createBiomeAddress(action.routeKey, action.biomeKey),
      action.occurrenceId,
    );
    const reference = occurrenceAt(assembly.project, owner)?.roomActions.order.find(
      (candidate) => roomActionKey(candidate) === action.actionKey,
    );
    if (reference?.kind !== 'reroll' || reference.target.kind !== 'cage') return [];
    const key = semanticAddressKey(action);
    const foundCage =
      rerollSettlementForProjectEvaluationAssembly(before, action) !== undefined ||
      before.evaluation.findings.some(
        (candidate) =>
          candidate.origin.kind === 'roomAction' &&
          semanticAddressKey(candidate.origin) === key &&
          (reason(candidate) === 'notRerollable' || candidate.code === 'rerollPoolExceeded'),
      );
    return foundCage ? [{ owner, reference }] : [];
  });
}

/** The acquisitions whose trait produces timed drops at some checkpoint the walk reached. */
function heldDropProducers(assembly: ProjectEvaluationAssembly): ReadonlySet<string> {
  return new Set(
    assembly.evaluation.route.biomes.flatMap((biome) =>
      'rewards' in biome
        ? biome.rewards.runStateSnapshots.flatMap((snapshot) =>
            Object.values(snapshot.traits.equippedTraits).flatMap((trait) =>
              trait.acquisitionIdentity === undefined || trait.pickupProducerInterval === undefined
                ? []
                : [trait.acquisitionIdentity],
            ),
          )
        : [],
    ),
  );
}

/**
 * Pickups an upgrade finds with their source gone in the rooms the run enters:
 * a countdown delivery whose Shrine purchase is gone (its trigger), and a
 * matured trait drop whose producing trait the run never holds (an automatic
 * product of a gone enabler). A drop stands where its producer is not held, so
 * the walk stops at it: the drops are judged by the walk without them, which
 * must reach the plan's end holding none of their producers. A drop whose
 * producer that walk holds, before or after it, or that a walk stopping short
 * of the end may still hold, stays with its finding.
 */
function sourceGonePickups(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly,
) {
  const project = assembly.project;
  const removals: TakenRow[] = [];
  const drops: {
    owner: OccurrenceAddress;
    reference: RoomActionReference;
    acquisitionIdentity: string;
  }[] = [];
  const unheld = new Map(
    placements(assembly).flatMap(({ address, assessment }) =>
      assessment.kind === 'invalid' &&
      assessment.source.kind === 'clockedTraitPickup' &&
      assessment.reason === 'sourceInactive'
        ? [[semanticAddressKey(address), assessment.source.acquisitionIdentity] as const]
        : [],
    ),
  );
  for (const { owner } of enteredRosters(assembly).values()) {
    for (const reference of occurrenceAt(project, owner)?.roomActions.order ?? []) {
      if (reference.kind !== 'interactAcquisitionEntry') continue;
      const delivery =
        reference.siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY
          ? parseHermesShrineDeliveryEntryKey(reference.entryKey)
          : undefined;
      if (delivery !== undefined) {
        const shrine = hermesShrineDeliverySourceAddress(delivery);
        if (isSameRoomDelivery(shrine, owner)) continue;
        const source = occurrenceAt(project, shrine);
        if (
          source !== undefined &&
          purchasedOfferFor(
            source.hermesShrine,
            source.roomActions.order,
            delivery.generationKey,
          ) !== undefined
        )
          continue;
        removals.push({ owner, reference });
        continue;
      }
      const acquisitionIdentity = unheld.get(
        semanticAddressKey(
          createAcquisitionEntryAddress(
            createAcquisitionSiteAddress(owner, reference.siteKey),
            reference.entryKey,
          ),
        ),
      );
      if (acquisitionIdentity !== undefined) drops.push({ owner, reference, acquisitionIdentity });
    }
  }
  if (drops.length === 0) return removals;
  let without = project;
  try {
    for (const { owner, reference } of drops)
      without = applyProjectCommand(without, catalog, roomActionRemovalCommand(owner, reference));
  } catch (error) {
    // A drop its removal command refuses cannot be judged; it stays with its finding.
    if (error instanceof ProjectCommandContractError) return removals;
    throw error;
  }
  const probe = evaluate(without);
  if (probe.evaluation.issue !== undefined) return removals;
  const held = heldDropProducers(probe);
  for (const { owner, reference, acquisitionIdentity } of drops)
    if (!held.has(acquisitionIdentity)) removals.push({ owner, reference });
  return removals;
}

/** Whether a Shop row exists only as a source's product. */
function sourcedShopRow(reference: RoomActionReference): boolean {
  return (
    reference.kind === 'interactAcquisitionEntry' &&
    reference.siteKey === 'roomExit' &&
    SOURCED_SHOP_ROWS.has(reference.entryKey)
  );
}

/**
 * Puts back a pickup's own payload its removal pruned, so restoring the source
 * restores the row's choices.
 */
function withPickupPayload(
  project: ProjectDocument,
  owner: OccurrenceAddress,
  reference: Extract<RoomActionReference, { readonly kind: 'interactAcquisitionEntry' }>,
  payload: NonNullable<
    NonNullable<RoomOccurrence['acquisitionSites']>[string]['pickupEntries']
  >[string],
): ProjectDocument {
  const occurrence = occurrenceAt(project, owner);
  const site = occurrence?.acquisitionSites?.[reference.siteKey];
  if (occurrence === undefined || site?.pickupEntries?.[reference.entryKey] !== undefined)
    return project;
  const restored: RoomOccurrence = Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...occurrence.acquisitionSites,
      [reference.siteKey]: Object.freeze({
        ...site,
        pickupEntries: Object.freeze({ ...site?.pickupEntries, [reference.entryKey]: payload }),
      }),
    }),
  });
  return withOccurrence(project, owner, restored);
}

/** The plan without one row, through its owning removal, its payload as its fate says. */
function withoutRow(catalog: Catalog, project: ProjectDocument, row: RowRemoval) {
  const { owner, reference } = row;
  const payload =
    row.payload === 'kept' && reference.kind === 'interactAcquisitionEntry'
      ? occurrenceAt(project, owner)?.acquisitionSites?.[reference.siteKey]?.pickupEntries?.[
          reference.entryKey
        ]
      : undefined;
  const removed = applyProjectCommand(project, catalog, roomActionRemovalCommand(owner, reference));
  return payload === undefined || reference.kind !== 'interactAcquisitionEntry'
    ? removed
    : withPickupPayload(removed, owner, reference, payload);
}

/**
 * The plan without a replaced item and its chain: a delivery's row and
 * retained item, an Echo replay's observation with the items derived from it
 * and its row (kept when the edit itself placed it), or a rerolled reward's
 * outcomes.
 */
function withoutReplacedItem(
  catalog: Catalog,
  before: ProjectDocument,
  project: ProjectDocument,
  item: ReplacedItem,
): ProjectDocument {
  switch (item.kind) {
    case 'delivery': {
      const site = HERMES_SHRINE_DELIVERY_SITE_KEY;
      const reference = placedEntry(occurrenceAt(project, item.room), site, item.entryKey);
      const removed =
        reference === undefined
          ? project
          : withoutRow(catalog, project, { owner: item.room, reference, payload: 'taken' });
      return discardRetainedHermesShrineDelivery(catalog, removed, item.entryKey, item.room);
    }
    case 'echoReplay': {
      const occurrence = occurrenceAt(project, item.room);
      if (occurrence === undefined) return project;
      // A pickup the edit itself placed takes the replay the walk has now.
      const placedByEdit =
        placedEntry(occurrence, 'roomExit', item.entryKey) !== undefined &&
        placedEntry(occurrenceAt(before, item.room), 'roomExit', item.entryKey) === undefined;
      return withOccurrence(
        project,
        item.room,
        withoutAcquisitionEntryObservation(
          createBiomeAddress(item.room.routeKey, item.room.biomeKey),
          occurrence,
          'roomExit',
          item.entryKey,
          placedByEdit,
        ),
      );
    }
    case 'rerolledReward':
      return resetRerolledRewardOffItsPress(project, catalog, item.owner);
    case 'travelDealRefill': {
      if (item.stock === 'worldShop') {
        const reference = placedEntry(
          occurrenceAt(project, item.room),
          'roomExit',
          TRAVEL_DEAL_REFILL_ENTRY_KEY,
        );
        const removed =
          reference === undefined
            ? project
            : withoutRow(catalog, project, { owner: item.room, reference, payload: 'taken' });
        const occurrence = occurrenceAt(removed, item.room);
        if (occurrence?.state.kind !== 'shop' || occurrence.state.shop == null) return removed;
        const { travelDealRefill: _replaced, ...shop } = occurrence.state.shop;
        void _replaced;
        return withOccurrence(
          removed,
          item.room,
          Object.freeze({
            ...occurrence,
            state: Object.freeze({ ...occurrence.state, shop: Object.freeze(shop) }),
          }),
        );
      }
      const purchase =
        item.stock === 'stygianWell' ? 'purchaseStygianWellOffer' : 'purchaseHermesShrineOffer';
      const reference = occurrenceAt(project, item.room)?.roomActions.order.find(
        (candidate) =>
          candidate.kind === purchase && candidate.generationKey === 'travelDealRefill',
      );
      const removed =
        reference === undefined
          ? project
          : withoutRow(catalog, project, { owner: item.room, reference, payload: 'taken' });
      if (item.stock === 'stygianWell')
        return applyProjectCommand(removed, catalog, {
          kind: 'ReplaceStygianWellTravelDealRefill',
          occurrence: item.room,
          itemKey: null,
        });
      const occurrence = occurrenceAt(removed, item.room);
      if (occurrence?.hermesShrine === undefined) return removed;
      const { travelDealRefill: _replaced, ...shrine } = occurrence.hermesShrine;
      void _replaced;
      return withOccurrence(
        removed,
        item.room,
        Object.freeze({ ...occurrence, hermesShrine: Object.freeze(shrine) }),
      );
    }
  }
}

/**
 * Travel Deal restocks whose triggering purchase the edit changed: the walk
 * before the edit restocked after one purchase and now restocks after
 * another, while the stored item is the one the plan held before. The old
 * item and its purchase go, and the new one is stocked on first reach.
 */
function replacedTravelDealRefills(
  before: ProjectEvaluationAssembly,
  beforeArtifacts: CandidateArtifacts,
  assembly: ProjectEvaluationAssembly,
  artifacts: CandidateArtifacts,
): ReplacedItem[] {
  const replaced: ReplacedItem[] = [];
  const stocks = {
    stygianWell: {
      stored: (occurrence: RoomOccurrence | undefined) =>
        occurrence?.stygianWell?.travelDealRefillKey ?? undefined,
      source: (candidates: CandidateArtifacts, biome: BiomeAddress, owner: OccurrenceAddress) =>
        candidates.biomeAt(biome)?.stygianWells.at(owner)?.travelDealRefill?.sourceGenerationKey,
    },
    hermesShrine: {
      stored: (occurrence: RoomOccurrence | undefined) =>
        occurrence?.hermesShrine?.travelDealRefill?.offer?.rewardType,
      source: (candidates: CandidateArtifacts, biome: BiomeAddress, owner: OccurrenceAddress) =>
        candidates.biomeAt(biome)?.hermesShrines.at(owner)?.travelDealRefill?.sourceGenerationKey,
    },
    worldShop: {
      stored: (occurrence: RoomOccurrence | undefined) => {
        const reward =
          occurrence?.state.kind === 'shop'
            ? occurrence.state.shop?.travelDealRefill?.reward
            : undefined;
        return reward == null ? undefined : JSON.stringify(reward.offer);
      },
      source: (candidates: CandidateArtifacts, biome: BiomeAddress, owner: OccurrenceAddress) =>
        candidates
          .biomeAt(biome)
          ?.derivedAcquisitionEntries.entriesAt(createAcquisitionSiteAddress(owner, 'roomExit'))
          .find((entry) => entry.address.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY)?.capability
          .sourceOfferKey,
    },
  } as const;
  for (const { owner, occurrence } of occurrences(assembly.project)) {
    const biome = createBiomeAddress(owner.routeKey, owner.biomeKey);
    for (const stock of ['stygianWell', 'hermesShrine', 'worldShop'] as const) {
      const { stored, source } = stocks[stock];
      const item = stored(occurrence);
      if (item === undefined || stored(occurrenceAt(before.project, owner)) !== item) continue;
      const prior = source(beforeArtifacts, biome, owner);
      const now = source(artifacts, biome, owner);
      if (prior !== undefined && now !== undefined && prior !== now)
        replaced.push({ kind: 'travelDealRefill', room: owner, stock });
    }
  }
  return replaced;
}

/** The plan with one room's occurrence replaced. */ /** The plan with one room's occurrence replaced. */
function withOccurrence(
  project: ProjectDocument,
  owner: OccurrenceAddress,
  next: RoomOccurrence,
): ProjectDocument {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(
        project.route.biomes.map((plan) =>
          plan.biomeKey !== owner.biomeKey || plan.topology == null
            ? plan
            : Object.freeze({
                ...plan,
                topology: Object.freeze({
                  ...plan.topology,
                  occurrences: Object.freeze(
                    plan.topology.occurrences.map((candidate) =>
                      candidate.occurrenceId === owner.occurrenceId ? next : candidate,
                    ),
                  ),
                }),
              }),
        ),
      ),
    }),
  });
}

/**
 * Echo replays the walk reached holding another reward than the walk's last
 * reward there: the replay is a replaced item. One whose reward was never
 * authored is not judged, nor one in a room the walk does not reach.
 */
function replacedEchoReplays(
  assembly: ProjectEvaluationAssembly,
  artifacts: CandidateArtifacts,
): ReplacedItem[] {
  const replaced: ReplacedItem[] = [];
  for (const { owner, occurrence } of occurrences(assembly.project)) {
    const entries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
    if (entries === undefined) continue;
    const reached = artifacts
      .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
      ?.derivedAcquisitionEntries.entriesAt(createAcquisitionSiteAddress(owner, 'roomExit'));
    for (const [entryKey, payload] of Object.entries(entries)) {
      if (payload == null || parseEchoLastRewardPickupEntryKey(entryKey) === undefined) continue;
      const capability = reached?.find((entry) => entry.address.entryKey === entryKey)?.capability;
      if (capability?.kind !== 'echoLastReward' || capability.fixedReward === undefined) continue;
      if (!sameRewardOffer(payload.offer, capability.fixedReward.offer))
        replaced.push({ kind: 'echoReplay', room: owner, entryKey });
    }
  }
  return replaced;
}

/**
 * Whether a row exists only as the product of a source in another room or
 * acquisition: a countdown Hermes delivery or a matured trait drop.
 */
function sourcedElsewhere(owner: OccurrenceAddress, reference: RoomActionReference): boolean {
  if (reference.kind !== 'interactAcquisitionEntry') return false;
  if (reference.siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY) {
    const source = parseHermesShrineDeliveryEntryKey(reference.entryKey);
    return (
      source !== undefined && !isSameRoomDelivery(hermesShrineDeliverySourceAddress(source), owner)
    );
  }
  return (
    reference.siteKey === 'roomExit' &&
    parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) !== undefined
  );
}

/**
 * Delivery payloads that no longer belong to the item their source produces,
 * by the plan alone: the Shrine slot now stocks another reward, or the source
 * no longer produces it (the purchase, or for one picked up in the Shrine's
 * room the rush, is gone with its Shrine room or feature or by itself).
 */
function deliveriesOffTheirSource(project: ProjectDocument): ReplacedItem[] {
  const off: ReplacedItem[] = [];
  for (const { owner, occurrence } of occurrences(project)) {
    const entries = occurrence.acquisitionSites?.[HERMES_SHRINE_DELIVERY_SITE_KEY]?.pickupEntries;
    for (const [entryKey, payload] of Object.entries(entries ?? {})) {
      const source = parseHermesShrineDeliveryEntryKey(entryKey);
      if (payload == null || source === undefined) continue;
      const shrineAddress = hermesShrineDeliverySourceAddress(source);
      const shrine = occurrenceAt(project, shrineAddress);
      const order = shrine?.roomActions.order ?? [];
      const produced = isSameRoomDelivery(shrineAddress, owner)
        ? hermesShrineRushAction(order, source.generationKey) !== undefined
        : purchasedOfferFor(shrine?.hermesShrine, order, source.generationKey) !== undefined;
      const stock = offerFor(shrine?.hermesShrine, source.generationKey);
      // An empty or unobserved slot names no item to tell it from.
      const restocked = stock != null && stock.rewardType !== payload.offer.rewardType;
      if (!produced || restocked) off.push({ kind: 'delivery', room: owner, entryKey });
    }
  }
  return off;
}

/**
 * Delivery items an edit replaced: a payload off its source, judged in every
 * room through the prior-held gate, and a payload retained unplaced at a host
 * while the walk has its delivery due at another, judged only where the walk
 * reaches (a placed one is the displaced pass's).
 */
function replacedDeliveries(
  now: ReplacedNow,
  assembly: ProjectEvaluationAssembly,
  artifacts: CandidateArtifacts,
): ReplacedItem[] {
  const project = assembly.project;
  const rooms = occurrences(project);
  const dueHosts = new Map<string, string>();
  for (const { owner } of rooms) {
    const site = createAcquisitionSiteAddress(owner, HERMES_SHRINE_DELIVERY_SITE_KEY);
    for (const { address, capability } of artifacts
      .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
      ?.derivedAcquisitionEntries.entriesAt(site) ?? [])
      if (capability.kind === 'hermesShrineDelivery')
        dueHosts.set(address.entryKey, semanticAddressKey(owner));
  }
  const offSource = new Set(deliveriesOffTheirSource(project).map(itemKey));
  const replaced: ReplacedItem[] = [];
  for (const { owner, occurrence } of rooms) {
    const entries = occurrence.acquisitionSites?.[HERMES_SHRINE_DELIVERY_SITE_KEY]?.pickupEntries;
    for (const entryKey of Object.keys(entries ?? {})) {
      const item: ReplacedItem = { kind: 'delivery', room: owner, entryKey };
      const dueHost = dueHosts.get(entryKey);
      if (
        (offSource.has(itemKey(item)) && now(project, item)) ||
        (dueHost !== undefined &&
          dueHost !== semanticAddressKey(owner) &&
          placedEntry(occurrence, HERMES_SHRINE_DELIVERY_SITE_KEY, entryKey) === undefined)
      )
        replaced.push(item);
    }
  }
  return replaced;
}

/**
 * Such rows a structural command took out of the rooms that remain, and the
 * reroll presses it took with the item they redrew.
 */
function sourcedRowsTaken(before: ProjectDocument, after: ProjectDocument) {
  return rowsTaken(before, after).filter(
    ({ owner, reference }) =>
      occurrenceAt(after, owner) !== undefined &&
      (reference.kind === 'reroll' || sourcedElsewhere(owner, reference)),
  );
}

/** The board-door presses an edit took with their slot's door from each Hub that remains. */
function hubRerollsTakenWithTheirSlot(
  before: ProjectDocument,
  after: ProjectDocument,
): RemovedHubRerolls[] {
  const taken: RemovedHubRerolls[] = [];
  for (const plan of before.route.biomes)
    for (const hub of plan.topology?.decisions ?? []) {
      if (hub.kind !== 'hub') continue;
      const current = after.route.biomes
        .find((candidate) => candidate.biomeKey === plan.biomeKey)
        ?.topology?.decisions.find(
          (decision): decision is HubDecision =>
            decision.kind === 'hub' && decision.hubKey === hub.hubKey,
        );
      if (current === undefined || current === hub) continue;
      const open = new Set(current.openTargets.map((target) => target.hubSlotKey));
      const remaining = new Set(
        current.actions.flatMap((action) => (action.kind === 'reroll' ? [action.rerollId] : [])),
      );
      const rerolls = hub.actions.filter(
        (action): action is HubRerollAction =>
          action.kind === 'reroll' &&
          !remaining.has(action.rerollId) &&
          !open.has(action.hubSlotKey),
      );
      if (rerolls.length > 0)
        taken.push(
          Object.freeze({
            hub: createHubDecisionAddress(
              createBiomeAddress(before.route.routeKey, plan.biomeKey),
              hub.hubKey,
            ),
            rerolls: Object.freeze(rerolls),
          }),
        );
    }
  return taken;
}

/** Every row a removal took, in any room, in each room's former order. */
function rowsTaken(previous: ProjectDocument, next: ProjectDocument) {
  const taken: TakenRow[] = [];
  for (const { owner, occurrence } of occurrences(previous)) {
    const current = occurrenceAt(next, owner);
    if (current === occurrence) continue;
    const remaining = new Set((current?.roomActions.order ?? []).map(roomActionKey));
    for (const reference of occurrence.roomActions.order)
      if (!remaining.has(roomActionKey(reference))) taken.push({ owner, reference });
  }
  return taken;
}

/** The fixed reroll pool refusing a new spend; known only once the edit is evaluated. */
export class RerollPoolRefusal extends ProjectCommandContractError {}

interface ProjectEditSettlementOptions {
  readonly catalog: Catalog;
  readonly before: ProjectEvaluationAssembly;
  readonly command: ProjectCommand;
  readonly evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly;
}

/** Checks that each evaluation matches the snapshot it was asked for. */
function exactEvaluation(
  evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly,
): (project: ProjectDocument) => ProjectEvaluationAssembly {
  return (project) => {
    const result = evaluate(project);
    candidateArtifactsForProjectEvaluationAssembly(result);
    if (result.project !== project)
      throw new Error('Edit evaluation does not match its authored snapshot');
    return result;
  };
}

/**
 * Settle one semantic edit above structural commands and exact evaluation.
 * Preparation and Undo/Redo never call this operation. The result is total:
 * a repeated repair stops settlement and is reported as a fault beside the
 * last evaluated assembly.
 */
export function settleProjectEdit(options: ProjectEditSettlementOptions): ProjectEditSettlement {
  const { catalog, before, command } = options;
  if (
    command.kind === 'PlaceClockedTraitPickup' &&
    !attestClockedTraitPickupPlacementForProjectEvaluationAssembly(before, command)
  )
    return Object.freeze({ assembly: before });
  const project = applyProjectCommand(before.project, catalog, command);
  if (project === before.project) return Object.freeze({ assembly: before });
  return settleProject({
    catalog,
    before,
    project,
    command,
    evaluate: exactEvaluation(options.evaluate),
  });
}

interface ProjectUpgradeSettlementOptions {
  readonly catalog: Catalog;
  /** The plan as a file saved under an earlier schema holds it, read under the current one. */
  readonly project: ProjectDocument;
  readonly evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly;
}

/**
 * Settle a plan saved before the current settlement rules, once, as they would
 * have left it: the policy for rows whose context or source is gone applies
 * to every row the walk reaches, as though each had just lost it, and every
 * batch settles its doors. Rows that policy keeps invalid stay with their
 * findings, and rows the walk does not reach stay untouched; an Artificer
 * replacement whose source does not convert with the Artificer goes with its
 * pickup. Run only by the schema 102 -> 103 migration. Total like an edit's settlement.
 */
export function settleProjectUpgrade(
  options: ProjectUpgradeSettlementOptions,
): ProjectEditSettlement {
  const evaluate = exactEvaluation(options.evaluate);
  // An earlier schema kept an Artificer replacement dormant once its source left the Artificer.
  const project = withoutDormantArtificerReplacementsInProject(options.project, options.catalog);
  const before = evaluate(project);
  return settleProject({
    catalog: options.catalog,
    before,
    project,
    command: undefined,
    evaluate,
  });
}

/**
 * Every blank the evaluated walk reached, with the command filling it: each
 * position the walk drew, then each stock slot by its stable legal draw.
 */
function reachedFills(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  artifacts: CandidateArtifacts,
  poolValuesBefore: PoolValuesBefore,
) {
  const positions = positionFills(catalog, assembly);
  return {
    positions,
    fills: [...positions, ...stockFills(catalog, assembly.project, artifacts, poolValuesBefore)],
  };
}

/**
 * Fill every blank position and stock slot a saved plan's walk reaches, as
 * the edit that first reached it would have, and nothing else. A schema
 * transform for plans saved while a blank position or stock slot meant the
 * game's own roll: a stale Pool list keeps its values and findings, unless the
 * plan was built by commands that would each have settled it. Total like an
 * edit's settlement: a blank filled twice is a fault beside the last assembly.
 */
export function settleProjectFills(
  options: ProjectUpgradeSettlementOptions & { readonly redrawStalePoolLists?: boolean },
): ProjectEditSettlement {
  const evaluate = exactEvaluation(options.evaluate);
  let assembly = evaluate(options.project);
  const poolValuesBefore: PoolValuesBefore = () => options.redrawStalePoolLists === true;
  const stocked = new Set<string>();
  for (;;) {
    const { fills } = reachedFills(
      options.catalog,
      assembly,
      candidateArtifactsForProjectEvaluationAssembly(assembly),
      poolValuesBefore,
    );
    if (fills.length === 0) return Object.freeze({ assembly });
    let project = assembly.project;
    for (const fill of fills) {
      if (stocked.has(fill.key))
        return Object.freeze({
          assembly,
          fault: Object.freeze({ key: `fill:${fill.key}`, owner: fill.owner }),
        });
      stocked.add(fill.key);
      project = applyProjectCommand(project, options.catalog, fill.command);
    }
    assembly = evaluate(project);
  }
}

/**
 * The settlement after an edit's structural command, or of an upgraded plan
 * when there is no command: its removals are all announced, and every row the
 * walk reaches is judged as though it had just lost what it lacks.
 */
function settleProject(options: {
  readonly catalog: Catalog;
  readonly before: ProjectEvaluationAssembly;
  readonly project: ProjectDocument;
  readonly command: ProjectCommand | undefined;
  readonly evaluate: (project: ProjectDocument) => ProjectEvaluationAssembly;
}): ProjectEditSettlement {
  const { catalog, before, command, evaluate } = options;
  const upgrade = command === undefined;
  let project = options.project;
  const beforeArtifacts = candidateArtifactsForProjectEvaluationAssembly(before);
  // Only a Pool list value the edit made stale is redrawn; an upgrade only stocks blanks.
  const poolValuesBefore: PoolValuesBefore = upgrade
    ? () => false
    : currentPoolListValues(before.project, beforeArtifacts);
  const beforeRosters = enteredRosters(before);
  // The plan before the edit with each position the settlement filled.
  let filledBefore = before.project;
  const edited = roomEditedSince(() => filledBefore);
  const replacedNow = replacedSince(catalog, upgrade ? undefined : before.project, edited);
  // A removal in the room the edit addresses shows on the Timeline being edited; any other is announced.
  const room = command === undefined ? undefined : addressedRoom(projectCommandAddress(command));
  const silentRoom = room === undefined ? undefined : semanticAddressKey(room);
  const removedStale: TakenRow[] = [];
  // Sourced rows the command or a displaced placement took; a delivery placed elsewhere moved.
  const removedElsewhere: TakenRow[] = [];
  // Items whose observations an edit discarded with them, by room.
  const discardedObservations: { owner: OccurrenceAddress; item: SemanticAddress }[] = [];
  if (!upgrade)
    for (const item of rerolledItems(
      rerolledItemsReplacedBetween(catalog, before.project, project),
    ))
      discardedObservations.push({ owner: item.room, item: replacedItemAddress(item) });
  // Hub presses the command took with their slot's door.
  const removedHubRerolls =
    upgrade || command.kind === 'ReplaceRoute'
      ? []
      : hubRerollsTakenWithTheirSlot(before.project, project);
  // Doors an edit left on no exit of their room, by room.
  const removedDoors: { owner: OccurrenceAddress; doors: readonly RemovedRoomDoor[] }[] = [];
  // A door settlement that failed stops only that pass; the edit's other passes still settle.
  let exitCapacityFault: SettlementFault | undefined;
  const settled = (
    assembly: ProjectEvaluationAssembly,
    passFault?: SettlementFault,
  ): ProjectEditSettlement => {
    const fault = exitCapacityFault ?? passFault;
    const placed = new Set(
      occurrences(assembly.project).flatMap(({ occurrence }) =>
        occurrence.roomActions.order.map(roomActionKey),
      ),
    );
    const rooms = new Map<
      string,
      {
        readonly occurrence: OccurrenceAddress;
        readonly actions: RoomActionReference[];
        readonly doors: RemovedRoomDoor[];
        readonly discarded: DiscardedRoomObservation[];
      }
    >();
    const noticeAt = (owner: OccurrenceAddress) => {
      const key = semanticAddressKey(owner);
      if (key === silentRoom) return undefined;
      let notice = rooms.get(key);
      if (notice === undefined)
        rooms.set(key, (notice = { occurrence: owner, actions: [], doors: [], discarded: [] }));
      return notice;
    };
    // Only a delivery is placed elsewhere by the command itself, as a move.
    const moved = ({ reference }: TakenRow) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY &&
      placed.has(roomActionKey(reference));
    for (const { owner, reference } of [
      ...removedStale,
      ...removedElsewhere.filter((row) => !moved(row)),
    ]) {
      const notice = noticeAt(owner);
      const key = roomActionKey(reference);
      if (notice?.actions.some((action) => roomActionKey(action) === key) === false)
        notice.actions.push(reference);
    }
    for (const { owner, item } of discardedObservations) {
      const notice = noticeAt(owner);
      const key = semanticAddressKey(item);
      if (notice?.discarded.some((entry) => semanticAddressKey(entry.item) === key) === false)
        notice.discarded.push(Object.freeze({ item }));
    }
    for (const { owner, doors } of removedDoors) noticeAt(owner)?.doors.push(...doors);
    const notices = [...rooms.values()].map(({ occurrence, actions, doors, discarded }) => {
      // Each room's rows in their order before the edit.
      const former = (occurrenceAt(before.project, occurrence)?.roomActions.order ?? []).map(
        roomActionKey,
      );
      const rank = (reference: RoomActionReference) => {
        const index = former.indexOf(roomActionKey(reference));
        return index < 0 ? former.length : index;
      };
      return Object.freeze({
        occurrence,
        actions: Object.freeze(actions.sort((left, right) => rank(left) - rank(right))),
        ...(doors.length === 0 ? {} : { doors: Object.freeze(doors) }),
        ...(discarded.length === 0 ? {} : { discarded: Object.freeze(discarded) }),
      });
    });
    return Object.freeze({
      assembly,
      ...(fault === undefined ? {} : { fault }),
      ...(notices.length === 0 ? {} : { removedStaleActions: Object.freeze(notices) }),
      ...(removedHubRerolls.length === 0
        ? {}
        : { removedHubRerolls: Object.freeze(removedHubRerolls) }),
    });
  };
  const beforePlacements = new Map(
    placements(before).map((placement) => [semanticAddressKey(placement.address), placement]),
  );
  // An installed route keeps exactly the doors and rows it was authored with.
  if (command?.kind !== 'ReplaceRoute') {
    // A door its room no longer has is context gone: an unselected one goes,
    // and a takeover batch fills the doors its Preboss takes over.
    const settledDecisions = new Set<string>();
    for (;;) {
      const drift = exitCapacityDrifts(project, catalog)[0];
      if (drift === undefined) break;
      const decisionKey = semanticAddressKey(drift.decision);
      const fault = Object.freeze({ key: `exitCapacity:${decisionKey}`, owner: drift.decision });
      // A batch that drifts again after settling is an engine defect, never replayed.
      if (settledDecisions.has(decisionKey)) {
        exitCapacityFault = fault;
        break;
      }
      settledDecisions.add(decisionKey);
      const biome = createBiomeAddress(drift.decision.routeKey, drift.decision.biomeKey);
      const doors = drift.undeclared.map(({ exitKey, occurrenceId }) =>
        Object.freeze({
          exitKey,
          occurrenceId,
          gameName: occurrenceAt(project, createOccurrenceAddress(biome, occurrenceId))!.gameName,
        }),
      );
      try {
        const subject: CommandContractSubject = command ?? {
          kind: 'SettleUpgradedExitCapacity',
          decision: drift.decision,
        };
        project = settleExitCapacity(project, catalog, drift.decision, subject);
      } catch (error) {
        // The topology and its reconciliation disagree: an engine defect.
        if (!(error instanceof ProjectCommandContractError)) throw error;
        exitCapacityFault = fault;
        break;
      }
      if (doors.length > 0 && drift.decision.source.kind === 'occurrence')
        removedDoors.push({
          owner: createOccurrenceAddress(biome, drift.decision.source.occurrenceId),
          doors,
        });
    }
    removedElsewhere.push(...sourcedRowsTaken(before.project, project));
  }
  let assembly = project === before.project ? before : evaluate(project);
  // The reroll pool is a fixed budget at each spend's own point: a new spend
  // past it is refused. An earlier spend takes precedence, so an edit that
  // leaves later spends short keeps them with their findings.
  const spendOwners =
    command === undefined
      ? new Set<string>()
      : addedRerollSpendOwners(catalog, before.project, project, command);
  if (command !== undefined && spendOwners.size > 0) {
    // Each over-spending owner and how far past the pool it goes.
    const overspent = (evaluated: ProjectEvaluationAssembly) =>
      new Map(
        evaluated.evaluation.findings
          .filter((finding) => finding.code === 'rerollPoolExceeded')
          .map((finding) => [
            semanticAddressKey(finding.origin),
            Number(finding.evidence.cost) - Number(finding.evidence.remaining),
          ]),
      );
    const prior = overspent(before);
    if (
      [...overspent(assembly)].some(
        ([owner, excess]) => spendOwners.has(owner) && excess > (prior.get(owner) ?? 0),
      )
    )
      throw new RerollPoolRefusal(
        command.kind,
        projectCommandAddress(command),
        'the reroll pool has nothing left for this spend',
      );
  }
  // Each repair consumes one exact displaced owner or required obligation. A
  // repeated repair, or one its removal command refuses, means an inconsistent
  // contact, not permission to replay forever: settlement stops with the last
  // evaluated assembly and the fault.
  const repaired = new Set<string>();
  // The rows this pass took, announced once the pass settles.
  let taken: TakenRow[] = [];
  const repair = (
    key: string,
    owner: SemanticAddress,
    edit: (plan: ProjectDocument) => ProjectDocument,
  ): SettlementFault | undefined => {
    if (repaired.has(key)) return Object.freeze({ key, owner });
    repaired.add(key);
    const previous = project;
    try {
      project = edit(project);
    } catch (error) {
      if (error instanceof ProjectCommandContractError) return Object.freeze({ key, owner });
      throw error;
    }
    // A removal can take rows of other rooms too, such as a purchase its deliveries.
    taken.push(...rowsTaken(previous, project));
    return undefined;
  };
  // Travel Deal restocks already replaced by this settlement.
  const restocked = new Set<string>();
  const fated =
    (payload: RowRemoval['payload']) =>
    (row: TakenRow): RowRemoval => ({ ...row, payload });
  for (; ; assembly = evaluate(project)) {
    taken = [];
    const discarded: { owner: OccurrenceAddress; item: SemanticAddress }[] = [];
    const displaced = placements(assembly).find(
      (placement) =>
        placement.assessment.kind === 'invalid' &&
        // A held trait whose drop now matures elsewhere keeps its row, with its finding.
        (placement.assessment.source.kind !== 'clockedTraitPickup' ||
          placement.assessment.reason === 'sourceInactive') &&
        beforePlacements.get(semanticAddressKey(placement.address))?.assessment.kind === 'valid',
    );
    const host = displaced?.address.site.owner;
    const reference =
      displaced === undefined || host?.kind !== 'occurrence'
        ? undefined
        : placedEntry(
            occurrenceAt(project, host),
            displaced.address.site.pointKey,
            displaced.address.entryKey,
          );
    if (displaced !== undefined && host?.kind === 'occurrence' && reference !== undefined) {
      const fault = repair(
        `displaced:${semanticAddressKey(displaced.address)}`,
        displaced.address,
        (plan) => withoutRow(catalog, plan, { owner: host, reference, payload: 'taken' }),
      );
      if (fault !== undefined) return settled(assembly, fault);
      removedElsewhere.push(...taken);
      continue;
    }
    // An installed route keeps exactly the rows it was authored with.
    if (command?.kind === 'ReplaceRoute') return settled(assembly);
    const artifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
    // Replaced items, by kind in turn, each kind evaluated before the next is judged.
    let items = replacedDeliveries(replacedNow, assembly, artifacts);
    if (items.length === 0) items = replacedEchoReplays(assembly, artifacts);
    if (items.length === 0)
      items = rerolledItems(rerolledRewardsOffTheirPress(catalog, assembly.project)).filter(
        (item) => replacedNow(assembly.project, item),
      );
    // A restock is judged once: its new item may draw the old value again.
    if (items.length === 0 && !upgrade)
      items = replacedTravelDealRefills(before, beforeArtifacts, assembly, artifacts).filter(
        (item) => !restocked.has(itemKey(item)),
      );
    for (const item of items) if (item.kind === 'travelDealRefill') restocked.add(itemKey(item));
    for (const item of items) {
      const address = replacedItemAddress(item);
      const fault = repair(itemKey(item), address, (plan) =>
        withoutReplacedItem(catalog, before.project, plan, item),
      );
      if (fault !== undefined) return settled(assembly, fault);
      discarded.push({ owner: item.room, item: address });
    }
    // A row with no context or source has nothing to repair: the edit that orphans it removes it.
    const removals: RowRemoval[] =
      items.length > 0
        ? []
        : [
            ...staleRowsToRemove(edited, beforeRosters, assembly, upgrade).map((row) =>
              fated(sourcedShopRow(row.reference) ? 'kept' : 'taken')(row),
            ),
            ...roomActionsOnReplacedItems(assembly.project, catalog)
              .filter((row) => replacedNow(assembly.project, row))
              .map(fated('kept')),
            ...sourceGoneShopRows(before, beforeArtifacts, artifacts, assembly, upgrade).map(
              fated('kept'),
            ),
            ...cageGoneRerolls(before, assembly, upgrade).map(fated('taken')),
            ...(upgrade ? sourceGonePickups(catalog, assembly, evaluate) : []).map(fated('taken')),
          ];
    if (items.length === 0 && removals.length === 0) {
      // Once nothing else is repaired, the edit fills every blank the walk reached.
      const { positions, fills } = reachedFills(catalog, assembly, artifacts, poolValuesBefore);
      if (fills.length === 0) return settled(assembly);
      for (const fill of fills) {
        const fault = repair(`fill:${fill.key}`, fill.owner, (plan) =>
          applyProjectCommand(plan, catalog, fill.command),
        );
        if (fault !== undefined) return settled(assembly, fault);
      }
      for (const fill of positions)
        try {
          filledBefore = applyProjectCommand(filledBefore, catalog, fill.command);
        } catch (error) {
          // A room the plan before the edit held otherwise is edited either way.
          if (!(error instanceof ProjectCommandContractError)) throw error;
        }
      continue;
    }
    // Last first, each through its owning removal, as a reset removes rows.
    for (const removal of removals.reverse()) {
      const { owner } = removal;
      const key = roomActionKey(removal.reference);
      // A removal can take another row with it, such as a pickup with its purchase.
      if (
        !(occurrenceAt(project, owner)?.roomActions.order ?? []).some(
          (candidate) => roomActionKey(candidate) === key,
        )
      )
        continue;
      const address = createRoomActionAddress(
        createBiomeAddress(owner.routeKey, owner.biomeKey),
        owner.occurrenceId,
        key,
      );
      const fault = repair(`stale:${semanticAddressKey(address)}`, address, (plan) =>
        withoutRow(catalog, plan, removal),
      );
      if (fault !== undefined) return settled(assembly, fault);
    }
    removedStale.push(...taken);
    discardedObservations.push(...discarded);
  }
}

/** The earlier-screen count of the trait offer or Pom choice a screen command addresses. */
function addressedScreenRerollCount(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<
    ProjectCommand,
    {
      readonly kind:
        | 'ReplaceTraitOffer'
        | 'ReplaceLevelResolution'
        | 'InsertTraitScreenReroll'
        | 'InsertLevelScreenReroll';
    }
  >,
): number {
  const screens =
    command.kind === 'ReplaceTraitOffer' || command.kind === 'InsertTraitScreenReroll'
      ? authoredTraitOfferAt(document, catalog, command.trait)
      : authoredLevelResolutionAt(document, catalog, command.levelResolution);
  return screens === null || screens === undefined || screens.kind === 'random'
    ? 0
    : rerolledScreenCount(screens);
}

const ROOM_REROLL_KINDS = new Set(['reroll', 'rerollStygianWell', 'rerollPurgingPool']);

/**
 * The owners of the spends a command adds: a new room or Hub press, a new Well
 * or Pool reroll, or a raised screen count. Empty when it adds none.
 */
function addedRerollSpendOwners(
  catalog: Catalog,
  before: ProjectDocument,
  after: ProjectDocument,
  command: ProjectCommand,
): ReadonlySet<string> {
  switch (command.kind) {
    case 'InsertReroll':
    case 'InsertStygianWellReroll':
    case 'InsertPurgingPoolReroll': {
      const known = new Set(
        (occurrenceAt(before, command.occurrence)?.roomActions.order ?? []).map(roomActionKey),
      );
      return new Set(
        (occurrenceAt(after, command.occurrence)?.roomActions.order ?? []).flatMap((reference) =>
          ROOM_REROLL_KINDS.has(reference.kind) && !known.has(roomActionKey(reference))
            ? [
                semanticAddressKey(
                  createRoomActionAddress(
                    createBiomeAddress(command.occurrence.routeKey, command.occurrence.biomeKey),
                    command.occurrence.occurrenceId,
                    roomActionKey(reference),
                  ),
                ),
              ]
            : [],
        ),
      );
    }
    case 'InsertHubReroll': {
      const pressIds = (project: ProjectDocument) =>
        project.route.biomes
          .find((biome) => biome.biomeKey === command.hub.biomeKey)
          ?.topology?.decisions.flatMap((decision) =>
            decision.kind === 'hub' && decision.hubKey === command.hub.hubKey
              ? decision.actions.flatMap((action) =>
                  action.kind === 'reroll' ? [action.rerollId] : [],
                )
              : [],
          ) ?? [];
      const known = new Set(pressIds(before));
      return new Set(
        pressIds(after).flatMap((rerollId) =>
          known.has(rerollId)
            ? []
            : [
                semanticAddressKey(
                  createHubRerollAddress(
                    createBiomeAddress(command.hub.routeKey, command.hub.biomeKey),
                    command.hub.hubKey,
                    rerollId,
                  ),
                ),
              ],
        ),
      );
    }
    case 'ReplaceTraitOffer':
    case 'ReplaceLevelResolution':
    case 'InsertTraitScreenReroll':
    case 'InsertLevelScreenReroll':
      return addressedScreenRerollCount(after, catalog, command) >
        addressedScreenRerollCount(before, catalog, command)
        ? new Set([semanticAddressKey(projectCommandAddress(command) as SemanticAddress)])
        : new Set();
    default:
      return new Set();
  }
}
