import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createInfernalContractPedestalAddress,
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  type OccurrenceAddress,
} from '../addresses';
import {
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  hermesShrineDeliverySourceAddress,
  isSameRoomDelivery,
  parseHermesShrineDeliveryEntryKey,
} from '../hermes-shrine-delivery';
import type { ProjectDocument, RoomActionReference } from '../model';
import {
  roomActionDomainForOccurrence,
  structurallyActiveOccurrenceIds,
} from '../room-actions/defaults';
import { roomActionKey } from '../room-actions/state';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import type { ProjectCommand, RoomActionCommand } from './types';

type ResetCommand = Extract<RoomActionCommand, { readonly kind: 'ResetRoomActionsAfter' }>;

/**
 * What a reset after `afterActionKey` takes back: the rows it removes, last
 * first (every row after it except those that cannot leave the order: an
 * active required row, which automatic placement keeps, and the Postboss
 * keepsake rack), and whether it clears a chosen keepsake on a rack after the
 * point.
 */
export interface RoomActionResetPlan {
  readonly removals: readonly RoomActionReference[];
  readonly clearsKeepsake: boolean;
}

/** A reset's plan; undefined when the anchor is not an ordered action. */
export function roomActionResetPlan(
  document: ProjectDocument,
  catalog: Catalog,
  occurrence: OccurrenceAddress,
  afterActionKey: string | null,
): RoomActionResetPlan | undefined {
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const located = roomActionDomainForOccurrence(document, catalog, biome, occurrence.occurrenceId);
  if (located === undefined) return undefined;
  const order = located.occurrence.roomActions.order;
  const anchor =
    afterActionKey === null
      ? -1
      : order.findIndex((reference) => roomActionKey(reference) === afterActionKey);
  if (anchor < 0 && afterActionKey !== null) return undefined;
  const plan = document.route.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  const active =
    plan?.topology !== null &&
    plan?.topology !== undefined &&
    structurallyActiveOccurrenceIds(plan.topology).has(occurrence.occurrenceId);
  const required = new Set(
    active
      ? located.domain.contributions.flatMap((entry) =>
          entry.kind === 'action' && entry.participation === 'required'
            ? [roomActionKey(entry.reference)]
            : [],
        )
      : [],
  );
  const after = order.slice(anchor + 1);
  return Object.freeze({
    removals: Object.freeze(
      after
        .filter(
          (reference) =>
            reference.kind !== 'interactKeepsakeRack' && !required.has(roomActionKey(reference)),
        )
        .reverse(),
    ),
    clearsKeepsake:
      (located.occurrence.keepsakeRack?.keepsakeKey ?? null) !== null &&
      after.some((reference) => reference.kind === 'interactKeepsakeRack'),
  });
}

/** Whether a reset plan changes anything. */
export function roomActionResetApplies(plan: RoomActionResetPlan | undefined): boolean {
  return plan !== undefined && (plan.removals.length > 0 || plan.clearsKeepsake);
}

/** The semantic command that takes one row out of the room's actions with its own state. */
export function roomActionRemovalCommand(
  occurrence: OccurrenceAddress,
  reference: RoomActionReference,
): ProjectCommand {
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const action = createRoomActionAddress(biome, occurrence.occurrenceId, roomActionKey(reference));
  switch (reference.kind) {
    case 'interactShopOffer':
      return {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(biome, occurrence.occurrenceId, reference.offerKey),
        purchased: false,
      };
    case 'purchaseHermesShrineOffer':
      return {
        kind: 'SetHermesShrinePurchase',
        occurrence,
        generationKey: reference.generationKey,
        purchased: false,
      };
    case 'purchaseStygianWellOffer':
      return {
        kind: 'SetStygianWellPurchase',
        occurrence,
        generationKey: reference.generationKey,
        purchased: false,
      };
    case 'interactInfernalContractPedestal':
      return {
        kind: 'SetInfernalContractPedestalCollected',
        pedestal: createInfernalContractPedestalAddress(biome, occurrence.occurrenceId),
        collected: false,
      };
    case 'interactAcquisitionEntry': {
      // A delivery from another room returns to its due obligation; a rushed one is a pickup.
      const source =
        reference.siteKey === HERMES_SHRINE_DELIVERY_SITE_KEY
          ? parseHermesShrineDeliveryEntryKey(reference.entryKey)
          : undefined;
      return source !== undefined &&
        !isSameRoomDelivery(hermesShrineDeliverySourceAddress(source), occurrence)
        ? { kind: 'UnplaceGeneratedDelivery', action }
        : { kind: 'RemoveRoomAction', action };
    }
    default:
      return { kind: 'RemoveRoomAction', action };
  }
}

/**
 * Removes the occurrence's actions after one of them, or all of them, each by
 * its own removal command, as one edit; rows that cannot leave stay in order,
 * and a rack after the point drops its keepsake choice.
 */
export function applyRoomActionReset(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: ResetCommand,
  apply: (document: ProjectDocument, command: ProjectCommand) => ProjectDocument,
): ProjectDocument {
  requireTopology(located.plan, command);
  requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
  const occurrence = createOccurrenceAddress(
    createBiomeAddress(command.occurrence.routeKey, command.occurrence.biomeKey),
    command.occurrence.occurrenceId,
  );
  const plan = roomActionResetPlan(document, catalog, occurrence, command.afterActionKey);
  if (plan === undefined) failCommand(command, 'afterActionKey is not an ordered room action');
  const removed = plan.removals.reduce((current, reference) => {
    // A removal can take a later row with it, such as a rushed pickup with its purchase.
    const order =
      current.route.biomes
        .find((plan) => plan.biomeKey === occurrence.biomeKey)
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )?.roomActions.order ?? [];
    const key = roomActionKey(reference);
    return order.some((candidate) => roomActionKey(candidate) === key)
      ? apply(current, roomActionRemovalCommand(occurrence, reference))
      : current;
  }, document);
  // A rack after the point returns to its default: the held keepsake stays.
  return plan.clearsKeepsake
    ? apply(removed, {
        kind: 'ReplacePostbossKeepsake',
        selection: createPostbossKeepsakeSelectionAddress(occurrence),
        keepsakeKey: null,
      })
    : removed;
}
