import {
  INITIAL_ROLL_KEY,
  PURGING_POOL_REFRESH_ROLL_KEY,
  createRoomFeatureAddress,
  featureRerolls,
  purgingPoolRerollPins,
  purgingPoolRollTraitKey,
  semanticAddressKey,
  stygianWellGenerationItemKey,
  stygianWellGenerationKey,
  stygianWellRerollPins,
  type FeatureRerollAction,
  type OccurrenceAddress,
  type PurgingPoolSlotKey,
  type RollFeature,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  PurgingPoolCandidateCapability,
  StygianWellCandidateCapability,
} from '@run-planner/engine/simulation';

import type { WorkspaceFeatureRollSlot, WorkspacePurgingPoolSlot } from '../contracts/features';
import type {} from '../interactions/interaction-requirements';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';

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
    reroll.kind === 'rerollStygianWell'
      ? stygianWellRerollPins(occurrence.stygianWell, reroll.rerollId)
      : purgingPoolRerollPins(occurrence.purgingPool, reroll.rerollId);
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

const POOL_SLOT_KEYS = ['left', 'middle', 'right'] as const;

/**
 * One Pool list's slots as the Pool control shows them: the entry list's three,
 * or the slots the regenerated list shows or still stores.
 */
export function assemblePurgingPoolSlots(input: {
  readonly catalog: Catalog;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly owner: OccurrenceAddress;
  readonly list: 'entry' | 'refresh';
  readonly stored: Readonly<Partial<Record<PurgingPoolSlotKey, string | null>>>;
  /** The list's candidates where the walk reached it. */
  readonly candidatesBySlot: Readonly<Record<PurgingPoolSlotKey, readonly string[]>> | undefined;
  /** Every trait a Pool can list, while the list is unreached. */
  readonly declaredTraitKeys: readonly string[];
  readonly offeredSlotKeys?: readonly PurgingPoolSlotKey[];
}): readonly WorkspacePurgingPoolSlot[] {
  const labels = featureRollCatalog(input.catalog, 'purgingPool');
  const slotKeys =
    input.list === 'entry'
      ? POOL_SLOT_KEYS
      : POOL_SLOT_KEYS.filter(
          (slotKey) =>
            (input.offeredSlotKeys ?? []).includes(slotKey) ||
            (input.stored[slotKey] ?? null) !== null,
        );
  return Object.freeze(
    slotKeys.map((slotKey) => {
      const candidateTraitKeys = input.candidatesBySlot?.[slotKey] ?? input.declaredTraitKeys;
      const traitKey = input.stored[slotKey] ?? null;
      const address = createRoomFeatureAddress(input.owner, {
        kind: 'purgingPoolOffer',
        slotKey,
        ...(input.list === 'refresh' ? { rollKey: PURGING_POOL_REFRESH_ROLL_KEY } : {}),
      });
      return Object.freeze({
        address,
        marker: input.markerDestinations.marker(address),
        candidateTraitKeys,
        candidateTraits: Object.freeze(
          candidateTraitKeys.map((key) => Object.freeze({ key, label: labels.itemLabel(key) })),
        ),
        interactionKey:
          input.list === 'entry'
            ? `purgingPool:${semanticAddressKey(input.owner)}:${slotKey}`
            : `purgingPool:${semanticAddressKey(input.owner)}:refresh:${slotKey}`,
        key: slotKey,
        label: labels.slotLabel(slotKey),
        traitKey,
        ...(traitKey === null ? {} : { traitLabel: labels.itemLabel(traitKey) }),
      });
    }),
  );
}
