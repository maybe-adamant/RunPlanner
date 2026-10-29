import {
  INITIAL_ROLL_KEY,
  createBiomeAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  featureRerolls,
  parseStygianWellGenerationKey,
  purgingPoolRollTraitKey,
  roomActionKey,
  semanticAddressKey,
  stygianWellGenerationItemKey,
  stygianWellGenerationKey,
  type FeatureRerollAction,
  type OccurrenceAddress,
  type RollFeature,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  FeatureRerollOption,
  PurgingPoolCandidateCapability,
  RerollSpend,
  RerollSpendAllowance,
  StygianWellCandidateCapability,
} from '@run-planner/engine/simulation';

import type {
  WorkspaceFeatureRollActions,
  WorkspaceFeatureRollLock,
  WorkspaceFeatureRollOption,
  WorkspaceFeatureRollSlot,
} from '../contracts/features';
import type {
  WorkspaceFeatureRollActionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
} from '../interactions/interaction-requirements';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';

type RollActionsRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'featureRollActions' }
>;

/** What a Well or Pool's labels read from the catalog. */
export interface WorkspaceFeatureRollCatalog {
  readonly itemLabel: (itemKey: string) => string;
  readonly slotLabel: (slotKey: string) => string;
}

export function featureRollCatalog(
  catalog: Catalog,
  feature: RollFeature,
): WorkspaceFeatureRollCatalog {
  if (feature === 'purgingPool')
    return Object.freeze({
      itemLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
      slotLabel: (slotKey: string) =>
        slotKey === 'left' ? 'Offer 1' : slotKey === 'middle' ? 'Offer 2' : 'Offer 3',
    });
  const shop = catalog.rewards.shops.byKey.RoomShop;
  return Object.freeze({
    itemLabel: (itemKey: string) =>
      shop?.groups.values
        .flatMap((group) => group.options.values)
        .find((option) => option.key === itemKey)?.label ?? itemKey,
    slotLabel: (slotKey: string) => shop?.slots.byKey[slotKey]?.label ?? slotKey,
  });
}

/** A roll's number in its room: the initial stock is roll 1, each reroll the next. */
export function featureRollNumber(
  order: RoomOccurrence['roomActions']['order'],
  feature: RollFeature,
  rollKey: string,
): number | undefined {
  if (rollKey === INITIAL_ROLL_KEY) return 1;
  const index = featureRerolls(order, feature).findIndex((reroll) => reroll.rerollId === rollKey);
  return index < 0 ? undefined : index + 2;
}

function rerollLock(
  option: FeatureRerollOption,
  allowance: RerollSpendAllowance,
): WorkspaceFeatureRollLock | undefined {
  if (allowance.kind === 'unreached') return 'unreached';
  if (!option.enabled) return 'notEnabled';
  if (!option.available) return 'nothingLeft';
  if (allowance.allowed) return undefined;
  if (option.poolRemaining <= 0) return 'poolEmpty';
  return 'poolShort';
}

/**
 * The Interact picker of a Well or Pool: each slot on show where a new action
 * is appended, then the reroll with its cost. The reroll entry is hidden
 * without a held card unless the room already holds a reroll of the feature.
 */
export function assembleFeatureRollActions(input: {
  readonly catalog: Catalog;
  readonly feature: RollFeature;
  readonly owner: OccurrenceAddress;
  readonly occurrence: RoomOccurrence;
  readonly capability: StygianWellCandidateCapability | PurgingPoolCandidateCapability | undefined;
  readonly allowance: (spend: RerollSpend) => RerollSpendAllowance;
}): {
  readonly actions: WorkspaceFeatureRollActions;
  readonly requirement: RollActionsRequirement;
} {
  const { feature, occurrence, owner } = input;
  const labels = featureRollCatalog(input.catalog, feature);
  const interactionKey = `featureRollActions:${feature}:${semanticAddressKey(owner)}`;
  const order = occurrence.roomActions.order;
  const options: WorkspaceFeatureRollOption[] = [];
  const bound: WorkspaceFeatureRollActionRequirement[] = [];
  const interaction = input.capability?.interaction;
  const roomHoldsRerolls = featureRerolls(order, feature).length > 0;
  if (interaction !== undefined && feature === 'stygianWell') {
    const well = input.capability as StygianWellCandidateCapability;
    const wellInteraction = well.interaction!;
    for (const offer of wellInteraction.offers) {
      const key = `buy:${offer.generationKey}`;
      const refill = offer.generationKey === 'travelDealRefill';
      const roll = parseStygianWellGenerationKey(offer.generationKey);
      // A blank slot, the Travel Deal restock included, is bought with the item chosen then.
      const blank = offer.itemKey === null;
      const subject = blank
        ? refill
          ? 'Travel Deal'
          : labels.slotLabel(offer.slotKey)
        : `${labels.itemLabel(offer.itemKey!)}${refill ? ' · Travel Deal' : ''}`;
      options.push(
        Object.freeze({
          key,
          kind: 'offer' as const,
          label: `Buy ${subject}${blank ? '…' : ''}`,
          ...(blank ? { needsChoice: true as const } : {}),
        }),
      );
      const candidates = !blank
        ? []
        : refill
          ? (well.travelDealRefill?.candidateItemKeys ?? [])
          : roll === undefined
            ? []
            : roll.rollKey === INITIAL_ROLL_KEY
              ? well.candidateItemKeysBySlot[roll.slotKey]
              : (well.rolls[roll.rollKey]?.candidateItemKeysBySlot[roll.slotKey] ?? []);
      bound.push(
        Object.freeze({
          key,
          kind: 'wellPurchase' as const,
          generationKey: offer.generationKey,
          ...(blank
            ? {
                choices: Object.freeze(
                  candidates.map((itemKey) =>
                    Object.freeze({ key: itemKey, label: labels.itemLabel(itemKey) }),
                  ),
                ),
              }
            : {}),
        }),
      );
    }
  }
  if (interaction !== undefined && feature === 'purgingPool') {
    const pool = input.capability as PurgingPoolCandidateCapability;
    const poolInteraction = pool.interaction!;
    for (const offer of poolInteraction.offers) {
      const key = `sell:${roomActionKey(offer.sale)}`;
      // A blank slot is sold with the trait chosen then, pinned on its list.
      const blank = offer.traitKey === null;
      const rollKey = offer.sale.rollKey;
      options.push(
        Object.freeze({
          key,
          kind: 'offer' as const,
          label: `Sell ${
            offer.traitKey === null
              ? labels.slotLabel(offer.slotKey)
              : labels.itemLabel(offer.traitKey)
          }${blank ? '…' : ''}`,
          ...(blank ? { needsChoice: true as const } : {}),
        }),
      );
      const candidates = !blank
        ? []
        : rollKey === undefined
          ? pool.candidateTraitKeysBySlot[offer.slotKey]
          : (pool.rolls[rollKey]?.candidateTraitKeysBySlot[offer.slotKey] ?? []);
      bound.push(
        Object.freeze({
          key,
          kind: 'poolSale' as const,
          sale: offer.sale,
          action: createRoomActionAddress(
            createBiomeAddress(owner.routeKey, owner.biomeKey),
            owner.occurrenceId,
            roomActionKey(offer.sale),
          ),
          ...(blank
            ? {
                choices: Object.freeze(
                  candidates.map((traitKey) =>
                    Object.freeze({ key: traitKey, label: labels.itemLabel(traitKey) }),
                  ),
                ),
              }
            : {}),
        }),
      );
    }
  }
  if (interaction !== undefined && (interaction.reroll.enabled || roomHoldsRerolls)) {
    const locked = rerollLock(
      interaction.reroll,
      input.allowance({ kind: 'featureReroll', occurrence: owner, feature }),
    );
    options.push(
      Object.freeze({
        key: 'reroll',
        kind: 'reroll' as const,
        label: `Reroll · costs ${interaction.reroll.cost}`,
        ...(locked === undefined ? {} : { locked }),
      }),
    );
    bound.push(Object.freeze({ key: 'reroll', kind: 'reroll' as const }));
  }
  return Object.freeze({
    actions: Object.freeze({
      interactionKey,
      feature,
      options: Object.freeze(options),
      ...(interaction === undefined ? { locked: 'unreached' as const } : {}),
    }),
    requirement: Object.freeze({
      kind: 'featureRollActions' as const,
      owner,
      interactionKey,
      feature,
      appendIndex: order.length,
      options: Object.freeze(bound),
    }),
  });
}

/**
 * The restocked slots of one Well or Pool reroll, each pinned or left native
 * on the reroll's Timeline row.
 */
export function assembleFeatureRerollSlots(input: {
  readonly catalog: Catalog;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly owner: OccurrenceAddress;
  readonly occurrence: RoomOccurrence;
  readonly reroll: FeatureRerollAction;
  readonly wellCapability: StygianWellCandidateCapability | undefined;
  readonly poolCapability: PurgingPoolCandidateCapability | undefined;
}): { readonly feature: RollFeature; readonly slots: readonly WorkspaceFeatureRollSlot[] } {
  const { owner, occurrence, reroll } = input;
  const feature: RollFeature = reroll.kind === 'rerollStygianWell' ? 'stygianWell' : 'purgingPool';
  const labels = featureRollCatalog(input.catalog, feature);
  const pins: Readonly<Record<string, string>> =
    reroll.kind === 'rerollStygianWell' ? reroll.offerKeyBySlot : reroll.traitKeyBySlot;
  const roll =
    feature === 'stygianWell'
      ? input.wellCapability?.rolls[reroll.rerollId]
      : input.poolCapability?.rolls[reroll.rerollId];
  const candidatesBySlot: Readonly<Record<string, readonly string[]>> | undefined =
    roll === undefined
      ? undefined
      : 'candidateItemKeysBySlot' in roll
        ? roll.candidateItemKeysBySlot
        : roll.candidateTraitKeysBySlot;
  // An unreached roll keeps its pins editable; a reached one shows the slots it restocks.
  const slotKeys = [...new Set([...(roll?.offeredSlotKeys ?? []), ...Object.keys(pins)])];
  const ordered = (
    feature === 'stygianWell'
      ? ['healing', 'secondLeft', 'secondRight']
      : ['left', 'middle', 'right']
  ).filter((slotKey) => slotKeys.includes(slotKey));
  const slots = ordered.map((slotKey) => {
    const address = createRoomFeatureAddress(
      owner,
      feature === 'stygianWell'
        ? {
            kind: 'stygianWellOffer',
            generationKey: stygianWellGenerationKey(
              reroll.rerollId,
              slotKey as 'healing' | 'secondLeft' | 'secondRight',
            ),
          }
        : {
            kind: 'purgingPoolOffer',
            slotKey: slotKey as 'left' | 'middle' | 'right',
            rollKey: reroll.rerollId,
          },
    );
    const value =
      feature === 'stygianWell'
        ? (stygianWellGenerationItemKey(
            occurrence,
            stygianWellGenerationKey(reroll.rerollId, slotKey as 'healing'),
          ) ?? null)
        : (purgingPoolRollTraitKey(occurrence, reroll.rerollId, slotKey as 'left') ?? null);
    return Object.freeze({
      slotKey,
      label: labels.slotLabel(slotKey),
      address,
      marker: input.markerDestinations.marker(address),
      interactionKey: `featureRollSlot:${semanticAddressKey(address)}`,
      value,
      ...(value === null ? {} : { valueLabel: labels.itemLabel(value) }),
      candidates: Object.freeze(
        (candidatesBySlot?.[slotKey] ?? []).map((key) =>
          Object.freeze({ key, label: labels.itemLabel(key) }),
        ),
      ),
      assessed: candidatesBySlot !== undefined,
    });
  });
  return Object.freeze({ feature, slots: Object.freeze(slots) });
}
