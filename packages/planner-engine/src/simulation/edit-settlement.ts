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
  semanticAddressKey,
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
import {
  biomeRerolledOwners,
  heldRerolledRecords,
  rerolledRecordOf,
  type RerolledRewardOwner,
} from '../authored-project/rerolls';
import {
  rerolledOutcomesUnauthored,
  resetRerolledRewardsOffTheirPress,
} from '../authored-project/commands/rerolls';
import { locateConfiguredBiome } from '../authored-project/commands/contract';
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

/** Judges rooms against the plan before the edit, reading each occurrence once per settlement. */
function roomEditedSince(before: ProjectDocument): RoomEdited {
  const previous = new Map<string, string | undefined>();
  const next = new WeakMap<RoomOccurrence, string | undefined>();
  return (after, owner) => {
    const old = occurrenceAt(before, owner);
    const now = occurrenceAt(after, owner);
    if (old === now) return false;
    const key = semanticAddressKey(owner);
    if (!previous.has(key)) previous.set(key, withoutRecordedContent(old));
    if (now === undefined) return previous.get(key) !== undefined;
    if (!next.has(now)) next.set(now, withoutRecordedContent(now));
    return previous.get(key) !== next.get(now);
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
  const removals: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
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

/** Each row on a replaced item, by room and action key. */
function replacedItemRowKeys(document: ProjectDocument, catalog: Catalog): ReadonlySet<string> {
  return new Set(
    roomActionsOnReplacedItems(document, catalog).map(
      ({ owner, reference }) => `${semanticAddressKey(owner)}|${roomActionKey(reference)}`,
    ),
  );
}

/**
 * Rows whose item the edit replaced, in every room of the plan, reached or
 * not: each one the edit left on a replaced item, and in each room the edit
 * changed, every one retained from before it (`prior`, read once from the
 * plan before the edit). An upgrade removes every one.
 */
function replacedItemRowsToRemove(
  catalog: Catalog,
  edited: RoomEdited,
  prior: ReadonlySet<string>,
  after: ProjectDocument,
) {
  return roomActionsOnReplacedItems(after, catalog).filter(
    ({ owner, reference }) =>
      !prior.has(`${semanticAddressKey(owner)}|${roomActionKey(reference)}`) ||
      edited(after, owner),
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
  const removals: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
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
) {
  const findingsAt = (evaluated: ProjectEvaluationAssembly, key: string) =>
    evaluated.evaluation.findings.filter(
      (finding) =>
        finding.origin.kind === 'roomAction' && semanticAddressKey(finding.origin) === key,
    );
  const reason = (finding: { readonly code: string; readonly evidence: unknown }) =>
    finding.code === 'rerollTargetUnavailable'
      ? (finding.evidence as { readonly reason?: unknown }).reason
      : undefined;
  const gone = (finding: { readonly code: string; readonly evidence: unknown }) =>
    reason(finding) === 'cageNotPlayed';
  const removals: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
  for (const finding of assembly.evaluation.findings) {
    if (!gone(finding) || finding.origin.kind !== 'roomAction') continue;
    const action = finding.origin;
    const owner = createOccurrenceAddress(
      createBiomeAddress(action.routeKey, action.biomeKey),
      action.occurrenceId,
    );
    const reference = occurrenceAt(assembly.project, owner)?.roomActions.order.find(
      (candidate) => roomActionKey(candidate) === action.actionKey,
    );
    if (reference?.kind !== 'reroll' || reference.target.kind !== 'cage') continue;
    // The saved plan cannot show that a press once found its cage: an upgrade keeps it.
    if (upgrade) continue;
    const key = semanticAddressKey(action);
    const prior = findingsAt(before, key);
    const foundCage =
      rerollSettlementForProjectEvaluationAssembly(before, action) !== undefined ||
      prior.some(
        (candidate) =>
          reason(candidate) === 'notRerollable' || candidate.code === 'rerollPoolExceeded',
      );
    if (!foundCage) continue;
    removals.push({ owner, reference });
  }
  return removals;
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
  const removals: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
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

/** The plan with one room's occurrence replaced. */
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
): { owner: OccurrenceAddress; entryKey: string }[] {
  const replaced: { owner: OccurrenceAddress; entryKey: string }[] = [];
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
        replaced.push({ owner, entryKey });
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
 * Why a delivery payload no longer belongs to the item its source produces, by
 * the plan alone: its Shrine slot now stocks another reward, or its source no
 * longer produces it (the purchase, or for one picked up in the Shrine's room
 * the rush, is gone with its Shrine room or feature or by itself).
 */
function deliveryPayloadsOffTheirSource(project: ProjectDocument): ReadonlySet<string> {
  const off = new Set<string>();
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
      if (!produced || restocked) off.add(`${semanticAddressKey(owner)}|${entryKey}`);
    }
  }
  return off;
}

/**
 * Delivery items an edit replaced: a payload whose source no longer produces
 * it or whose Shrine slot stocks another reward, judged in every room as a
 * row on a replaced item is (one the plan held so before the edit, `prior`,
 * goes only with an edit of its host, and an upgrade takes every one), and a
 * payload retained unplaced at a host while the walk has its delivery due at
 * another, judged only where the walk reaches (a placed one is the displaced
 * pass's).
 */
function replacedDeliveryPayloads(
  prior: ReadonlySet<string>,
  edited: RoomEdited,
  assembly: ProjectEvaluationAssembly,
  artifacts: CandidateArtifacts,
): { owner: OccurrenceAddress; entryKey: string }[] {
  const rooms = occurrences(assembly.project);
  const dueHosts = new Map<string, string>();
  for (const { owner } of rooms) {
    const site = createAcquisitionSiteAddress(owner, HERMES_SHRINE_DELIVERY_SITE_KEY);
    for (const { address, capability } of artifacts
      .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
      ?.derivedAcquisitionEntries.entriesAt(site) ?? [])
      if (capability.kind === 'hermesShrineDelivery')
        dueHosts.set(address.entryKey, semanticAddressKey(owner));
  }
  const offSource = deliveryPayloadsOffTheirSource(assembly.project);
  const replaced: { owner: OccurrenceAddress; entryKey: string }[] = [];
  for (const { owner, occurrence } of rooms) {
    const entries = occurrence.acquisitionSites?.[HERMES_SHRINE_DELIVERY_SITE_KEY]?.pickupEntries;
    for (const entryKey of Object.keys(entries ?? {})) {
      const key = `${semanticAddressKey(owner)}|${entryKey}`;
      if (offSource.has(key) && (!prior.has(key) || edited(assembly.project, owner))) {
        replaced.push({ owner, entryKey });
        continue;
      }
      const dueHost = dueHosts.get(entryKey);
      if (dueHost === undefined || dueHost === semanticAddressKey(owner)) continue;
      const placed = occurrence.roomActions.order.some(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY &&
          reference.entryKey === entryKey,
      );
      if (!placed) replaced.push({ owner, entryKey });
    }
  }
  return replaced;
}

/** Each rerolled record the plan holds, with its biome's located route position. */
function heldRecords(catalog: Catalog, project: ProjectDocument) {
  return project.route.biomes.flatMap((plan) => {
    if (plan.topology == null) return [];
    const biome = createBiomeAddress(project.route.routeKey, plan.biomeKey);
    const topology = plan.topology;
    const held = heldRerolledRecords(biome, topology);
    // Only a biome holding records needs its route position.
    const located =
      held.length === 0 ? undefined : locateConfiguredBiome(project, catalog, plan.biomeKey);
    if (located === undefined) return [];
    return held.map(({ owner, record }) => ({
      owner,
      record,
      biome,
      topology,
      routePosition: located.routePosition,
      occurrence: topology.occurrences.find(
        (candidate) => candidate.occurrenceId === owner.occurrenceId,
      )!,
    }));
  });
}

/**
 * Every rerolled record the plan holds off its press, by owner: its recorded
 * press is not its owner's effective one, or no press is effective while it
 * holds authored outcomes.
 */
function rerolledRewardsOffPress(
  catalog: Catalog,
  held: ReturnType<typeof heldRecords>,
): RerolledRewardOwner[] {
  const effective = new Map<string, ReturnType<typeof biomeRerolledOwners>>();
  return held.flatMap(({ owner, record, biome, topology, routePosition, occurrence }) => {
    let owners = effective.get(biome.biomeKey);
    if (owners === undefined) {
      owners = biomeRerolledOwners(biome, topology);
      effective.set(biome.biomeKey, owners);
    }
    const press = owners.get(semanticAddressKey(owner))?.rerolls.at(-1)?.rerollId;
    const off =
      press === undefined
        ? !rerolledOutcomesUnauthored(catalog, routePosition, occurrence, owner, record)
        : press !== record.pressId;
    return off ? [owner] : [];
  });
}

/**
 * The rerolled items whose authored outcomes the command itself replaced: its
 * recorded press went, that press's result changed in place, or no press of
 * its owner is effective any more, so the command reset or dropped them.
 */
function rerolledItemsTheCommandReplaced(
  catalog: Catalog,
  before: ReturnType<typeof heldRecords>,
  after: ProjectDocument,
): RerolledRewardOwner[] {
  return before.flatMap(({ owner, record, routePosition, occurrence }) => {
    const current = occurrenceAt(
      after,
      createOccurrenceAddress(
        createBiomeAddress(owner.routeKey, owner.biomeKey),
        owner.occurrenceId,
      ),
    );
    // A room the edit removed takes its outcomes with it, unannounced.
    if (current === undefined) return [];
    const next = rerolledRecordOf(current, owner);
    if (next === record) return [];
    const result = record.results[record.pressId];
    const nextResult = next?.results[record.pressId];
    const sameItem =
      next !== undefined &&
      next.acquisition !== undefined &&
      next.pressId === record.pressId &&
      result !== undefined &&
      nextResult !== undefined &&
      JSON.stringify(result) === JSON.stringify(nextResult);
    return sameItem || rerolledOutcomesUnauthored(catalog, routePosition, occurrence, owner, record)
      ? []
      : [owner];
  });
}

/**
 * Rerolled rewards an edit left off their press: the press each recorded is no
 * longer its owner's effective one, so its outcomes belong to a replaced item.
 * Judged in every room, as a row on a replaced item is: one the plan held off
 * its press before the edit (`prior`) goes only with an edit of its room.
 */
function rerolledRewardsReplaced(
  catalog: Catalog,
  prior: ReadonlySet<string>,
  edited: RoomEdited,
  after: ProjectDocument,
): RerolledRewardOwner[] {
  return rerolledRewardsOffPress(catalog, heldRecords(catalog, after)).filter(
    (owner) =>
      !prior.has(semanticAddressKey(owner)) ||
      edited(
        after,
        createOccurrenceAddress(
          createBiomeAddress(owner.routeKey, owner.biomeKey),
          owner.occurrenceId,
        ),
      ),
  );
}

/**
 * Such rows a structural command took out of the rooms that remain, and the
 * reroll presses it took with the item they redrew.
 */
function sourcedRowsTaken(before: ProjectDocument, after: ProjectDocument) {
  const taken: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
  for (const { owner, occurrence } of occurrences(before)) {
    const current = occurrenceAt(after, owner);
    if (current === undefined || current === occurrence) continue;
    const remaining = new Set(current.roomActions.order.map(roomActionKey));
    for (const reference of occurrence.roomActions.order)
      if (
        (reference.kind === 'reroll' || sourcedElsewhere(owner, reference)) &&
        !remaining.has(roomActionKey(reference))
      )
        taken.push({ owner, reference });
  }
  return taken;
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
  const taken: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
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
  const beforeRosters = enteredRosters(before);
  // What the plan already held replaced before the edit, read once: an upgrade takes every one.
  const priorReplaced = upgrade ? new Set<string>() : replacedItemRowKeys(before.project, catalog);
  const heldBefore = upgrade ? [] : heldRecords(catalog, before.project);
  const priorOffPress = new Set(
    upgrade ? [] : rerolledRewardsOffPress(catalog, heldBefore).map(semanticAddressKey),
  );
  const priorDeliveriesOffSource = upgrade
    ? new Set<string>()
    : deliveryPayloadsOffTheirSource(before.project);
  const edited = roomEditedSince(before.project);
  // A removal in the room the edit addresses shows on the Timeline being edited; any other is announced.
  const room = command === undefined ? undefined : addressedRoom(projectCommandAddress(command));
  const silentRoom = room === undefined ? undefined : semanticAddressKey(room);
  const removedStale: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
  // Sourced rows the command or a displaced placement took; a delivery placed elsewhere moved.
  const removedElsewhere: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
  // Items whose observations an edit discarded with them, by room.
  const discardedObservations: { owner: OccurrenceAddress; item: SemanticAddress }[] = [];
  if (!upgrade)
    for (const owner of rerolledItemsTheCommandReplaced(catalog, heldBefore, project))
      discardedObservations.push({
        owner: createOccurrenceAddress(
          createBiomeAddress(owner.routeKey, owner.biomeKey),
          owner.occurrenceId,
        ),
        item: owner,
      });
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
    const announced = [
      ...removedStale,
      // Only a delivery is placed elsewhere by the command itself, as a move.
      ...removedElsewhere.filter(
        ({ reference }) =>
          !(
            reference.kind === 'interactAcquisitionEntry' &&
            reference.siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY &&
            placed.has(roomActionKey(reference))
          ),
      ),
    ].filter(({ owner }) => semanticAddressKey(owner) !== silentRoom);
    const byRoom = new Map<string, RemovedStaleRoomActions>();
    for (const { owner, reference } of announced) {
      const key = semanticAddressKey(owner);
      const room = byRoom.get(key);
      if (room?.actions.some((action) => roomActionKey(action) === roomActionKey(reference)))
        continue;
      byRoom.set(key, {
        occurrence: owner,
        actions: Object.freeze([...(room?.actions ?? []), reference]),
      });
    }
    // Each room's rows in their order before the edit.
    for (const [key, room] of byRoom) {
      const former = (occurrenceAt(before.project, room.occurrence)?.roomActions.order ?? []).map(
        roomActionKey,
      );
      const rank = (reference: RoomActionReference) => {
        const index = former.indexOf(roomActionKey(reference));
        return index < 0 ? former.length : index;
      };
      byRoom.set(key, {
        ...room,
        actions: Object.freeze([...room.actions].sort((left, right) => rank(left) - rank(right))),
      });
    }
    for (const { owner, item } of discardedObservations) {
      const key = semanticAddressKey(owner);
      if (key === silentRoom) continue;
      const room = byRoom.get(key);
      if (
        room?.discarded?.some(
          (entry) => semanticAddressKey(entry.item) === semanticAddressKey(item),
        )
      )
        continue;
      byRoom.set(key, {
        ...room,
        occurrence: owner,
        actions: room?.actions ?? Object.freeze([]),
        discarded: Object.freeze([...(room?.discarded ?? []), Object.freeze({ item })]),
      });
    }
    for (const { owner, doors } of removedDoors) {
      if (semanticAddressKey(owner) === silentRoom) continue;
      const key = semanticAddressKey(owner);
      const room = byRoom.get(key);
      byRoom.set(key, {
        ...room,
        occurrence: owner,
        actions: room?.actions ?? Object.freeze([]),
        doors: Object.freeze([...(room?.doors ?? []), ...doors]),
      });
    }
    return Object.freeze({
      assembly,
      ...(fault === undefined ? {} : { fault }),
      ...(byRoom.size === 0
        ? {}
        : {
            removedStaleActions: Object.freeze(
              [...byRoom.values()].map((room) => Object.freeze(room)),
            ),
          }),
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
  // repeated repair means an inconsistent contact, not permission to replay
  // forever: settlement stops with the last evaluated assembly and the fault.
  const repaired = new Set<string>();
  const consume = (key: string, owner: SemanticAddress): SettlementFault | undefined => {
    if (repaired.has(key)) return Object.freeze({ key, owner });
    repaired.add(key);
    return undefined;
  };
  for (;;) {
    const displaced = placements(assembly).find(
      (placement) =>
        placement.assessment.kind === 'invalid' &&
        // A held trait whose drop now matures elsewhere keeps its row, with its finding.
        (placement.assessment.source.kind !== 'clockedTraitPickup' ||
          placement.assessment.reason === 'sourceInactive') &&
        beforePlacements.get(semanticAddressKey(placement.address))?.assessment.kind === 'valid',
    );
    if (displaced !== undefined && displaced.address.site.owner.kind === 'occurrence') {
      const owner = displaced.address.site.owner;
      const current = occurrenceAt(project, owner);
      const reference = current?.roomActions.order.find(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === displaced.address.site.pointKey &&
          reference.entryKey === displaced.address.entryKey,
      );
      if (reference !== undefined) {
        const fault = consume(
          `displaced:${semanticAddressKey(displaced.address)}`,
          displaced.address,
        );
        if (fault !== undefined) return settled(assembly, fault);
        removedElsewhere.push({ owner, reference });
        project = applyProjectCommand(project, catalog, {
          kind:
            displaced.address.site.pointKey === 'hermesShrineDelivery'
              ? 'UnplaceGeneratedDelivery'
              : 'RemoveRoomAction',
          action: createRoomActionAddress(
            createBiomeAddress(owner.routeKey, owner.biomeKey),
            owner.occurrenceId,
            roomActionKey(reference),
          ),
        });
        assembly = evaluate(project);
        continue;
      }
    }
    const artifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
    // An installed route keeps exactly the rows it was authored with.
    if (command?.kind === 'ReplaceRoute') return settled(assembly);
    const deliveries = replacedDeliveryPayloads(
      priorDeliveriesOffSource,
      edited,
      assembly,
      artifacts,
    );
    if (deliveries.length > 0) {
      for (const { owner, entryKey } of deliveries) {
        const address = createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(owner, HERMES_SHRINE_DELIVERY_SITE_KEY),
          entryKey,
        );
        const fault = consume(`delivery:${semanticAddressKey(address)}`, address);
        if (fault !== undefined) return settled(assembly, fault);
        const reference = occurrenceAt(project, owner)?.roomActions.order.find(
          (candidate) =>
            candidate.kind === 'interactAcquisitionEntry' &&
            candidate.siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY &&
            candidate.entryKey === entryKey,
        );
        const previous = project;
        try {
          if (reference !== undefined)
            project = applyProjectCommand(
              project,
              catalog,
              roomActionRemovalCommand(owner, reference),
            );
        } catch (error) {
          // The roster and the removal command disagree: an engine defect.
          if (error instanceof ProjectCommandContractError)
            return settled(
              assembly,
              Object.freeze({ key: `delivery:${entryKey}`, owner: address }),
            );
          throw error;
        }
        project = discardRetainedHermesShrineDelivery(catalog, project, entryKey, owner);
        removedStale.push(...rowsTaken(previous, project));
        discardedObservations.push({ owner, item: address });
      }
      assembly = evaluate(project);
      continue;
    }
    const replays = replacedEchoReplays(assembly, artifacts);
    if (replays.length > 0) {
      for (const { owner, entryKey } of replays) {
        const address = createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(owner, 'roomExit'),
          entryKey,
        );
        const fault = consume(`echoReplay:${semanticAddressKey(address)}`, address);
        if (fault !== undefined) return settled(assembly, fault);
        const occurrence = occurrenceAt(project, owner);
        if (occurrence === undefined) continue;
        // A pickup the edit itself placed takes the replay the walk has now.
        const placedByEdit =
          occurrence.roomActions.order.some(
            (reference) =>
              reference.kind === 'interactAcquisitionEntry' &&
              reference.siteKey === 'roomExit' &&
              reference.entryKey === entryKey,
          ) &&
          !(occurrenceAt(before.project, owner)?.roomActions.order ?? []).some(
            (reference) =>
              reference.kind === 'interactAcquisitionEntry' &&
              reference.siteKey === 'roomExit' &&
              reference.entryKey === entryKey,
          );
        const previous = project;
        project = withOccurrence(
          project,
          owner,
          withoutAcquisitionEntryObservation(
            createBiomeAddress(owner.routeKey, owner.biomeKey),
            occurrence,
            'roomExit',
            entryKey,
            placedByEdit,
          ),
        );
        removedStale.push(...rowsTaken(previous, project));
        discardedObservations.push({ owner, item: address });
      }
      assembly = evaluate(project);
      continue;
    }
    const offPress = rerolledRewardsReplaced(catalog, priorOffPress, edited, assembly.project);
    if (offPress.length > 0) {
      for (const owner of offPress) {
        const fault = consume(`rerolledReward:${semanticAddressKey(owner)}`, owner);
        if (fault !== undefined) return settled(assembly, fault);
        discardedObservations.push({
          owner: createOccurrenceAddress(
            createBiomeAddress(owner.routeKey, owner.biomeKey),
            owner.occurrenceId,
          ),
          item: owner,
        });
      }
      project = resetRerolledRewardsOffTheirPress(project, catalog, offPress);
      assembly = evaluate(project);
      continue;
    }
    // A row with no context or source has nothing to repair: the edit that orphans it removes it.
    const replaced = replacedItemRowsToRemove(catalog, edited, priorReplaced, assembly.project);
    const sourceGone = upgrade ? sourceGonePickups(catalog, assembly, evaluate) : [];
    const rowKey = (row: { owner: OccurrenceAddress; reference: RoomActionReference }) =>
      `${semanticAddressKey(row.owner)}|${roomActionKey(row.reference)}`;
    // The entry of a row on a replaced item holds the new item's observation: only the row
    // goes. A pickup whose source is gone takes its payload with it, whatever it recorded.
    const sourceGoneRows = new Set(sourceGone.map(rowKey));
    const replacedRows = new Set(replaced.map(rowKey).filter((key) => !sourceGoneRows.has(key)));
    const stale = [
      ...staleRowsToRemove(edited, beforeRosters, assembly, upgrade),
      ...replaced,
      ...sourceGoneShopRows(before, beforeArtifacts, artifacts, assembly, upgrade),
      ...cageGoneRerolls(before, assembly, upgrade),
      ...sourceGone,
    ];
    if (stale.length === 0) return settled(assembly);
    const pass: { owner: OccurrenceAddress; reference: RoomActionReference }[] = [];
    // Last first, each through its owning removal, as a reset removes rows.
    for (const { owner, reference } of stale.reverse()) {
      const key = roomActionKey(reference);
      const order = occurrenceAt(project, owner)?.roomActions.order ?? [];
      // A removal can take another row with it, such as a pickup with its purchase.
      if (!order.some((candidate) => roomActionKey(candidate) === key)) continue;
      const address = createRoomActionAddress(
        createBiomeAddress(owner.routeKey, owner.biomeKey),
        owner.occurrenceId,
        key,
      );
      const fault = consume(`stale:${semanticAddressKey(address)}`, address);
      if (fault !== undefined) return settled(assembly, fault);
      const payload =
        reference.kind === 'interactAcquisitionEntry' &&
        (sourcedShopRow(reference) || replacedRows.has(`${semanticAddressKey(owner)}|${key}`))
          ? occurrenceAt(project, owner)?.acquisitionSites?.[reference.siteKey]?.pickupEntries?.[
              reference.entryKey
            ]
          : undefined;
      const previous = project;
      try {
        project = applyProjectCommand(project, catalog, roomActionRemovalCommand(owner, reference));
        // A source-gone Shop row leaves its payload with the Shop, a replaced item's row with its item.
        if (payload !== undefined && reference.kind === 'interactAcquisitionEntry')
          project = withPickupPayload(project, owner, reference, payload);
      } catch (error) {
        // The roster and the removal command disagree: an engine defect.
        if (error instanceof ProjectCommandContractError)
          return settled(assembly, Object.freeze({ key: `stale:${key}`, owner: address }));
        throw error;
      }
      // A removal can take rows of other rooms too, such as a purchase its deliveries.
      pass.push(...rowsTaken(previous, project));
    }
    removedStale.push(...pass);
    assembly = evaluate(project);
    continue;
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
      const hubActions = (project: ProjectDocument) =>
        project.route.biomes
          .find((biome) => biome.biomeKey === command.hub.biomeKey)
          ?.topology?.decisions.find(
            (decision) => decision.kind === 'hub' && decision.hubKey === command.hub.hubKey,
          );
      const actionsOf = (project: ProjectDocument) => {
        const hub = hubActions(project);
        return hub?.kind === 'hub' ? hub.actions : [];
      };
      const known = new Set(
        actionsOf(before).flatMap((action) => (action.kind === 'reroll' ? [action.rerollId] : [])),
      );
      return new Set(
        actionsOf(after).flatMap((action) =>
          action.kind === 'reroll' && !known.has(action.rerollId)
            ? [
                semanticAddressKey(
                  createHubRerollAddress(
                    createBiomeAddress(command.hub.routeKey, command.hub.biomeKey),
                    command.hub.hubKey,
                    action.rerollId,
                  ),
                ),
              ]
            : [],
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
