import type { Catalog } from '../../../catalog-schema';
import { INITIAL_ROLL_KEY, parseStygianWellGenerationKey } from '../../feature-rolls';
import type { RoomActionState, StygianWellGenerationKey, StygianWellState } from '../../model';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  failProjectDocument,
} from '../../validation';

export function decodeStygianWellState(
  value: unknown,
  path: string,
  catalog: Catalog,
): StygianWellState {
  const raw = expectRecord(value, path);
  const hasTwist = Object.hasOwn(raw, 'twistResultKeyBySlot');
  const hasPurchased = Object.hasOwn(raw, 'purchasedGenerationKeys');
  const hasRefill = Object.hasOwn(raw, 'travelDealRefillKey');
  expectExactKeys(
    raw,
    [
      'offerKeyBySlot',
      ...(hasTwist ? ['twistResultKeyBySlot'] : []),
      ...(hasPurchased ? ['purchasedGenerationKeys'] : []),
      ...(hasRefill ? ['travelDealRefillKey'] : []),
    ],
    path,
  );
  const offers = expectRecord(raw.offerKeyBySlot, `${path}.offerKeyBySlot`);
  expectExactKeys(offers, ['healing', 'secondLeft', 'secondRight'], `${path}.offerKeyBySlot`);
  const knownItemKeys = new Set(
    catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((group) =>
      group.options.values.map((option) => option.key),
    ) ?? [],
  );
  const itemOrNull = (entry: unknown, entryPath: string) => {
    const itemKey = entry === null ? null : expectNonBlankString(entry, entryPath);
    if (itemKey !== null && !knownItemKeys.has(itemKey))
      failProjectDocument(entryPath, `unknown RoomShop item ${itemKey}`);
    return itemKey;
  };
  const twistResultKeyBySlot = !hasTwist
    ? undefined
    : (() => {
        const twist = expectRecord(raw.twistResultKeyBySlot, `${path}.twistResultKeyBySlot`);
        for (const key of Object.keys(twist))
          if (!['healing', 'secondLeft', 'secondRight', 'travelDealRefill'].includes(key))
            failProjectDocument(
              `${path}.twistResultKeyBySlot`,
              `contains unknown generation ${key}`,
            );
        return Object.freeze(
          Object.fromEntries(
            Object.entries(twist).map(([key, entry]) => [
              key,
              itemOrNull(entry, `${path}.twistResultKeyBySlot.${key}`),
            ]),
          ),
        );
      })();
  const purchasedGenerationKeys = !hasPurchased
    ? undefined
    : expectArray(raw.purchasedGenerationKeys, `${path}.purchasedGenerationKeys`).map(
        (entry, index) => {
          return decodeStygianWellGenerationKey(entry, `${path}.purchasedGenerationKeys[${index}]`);
        },
      );
  if (
    purchasedGenerationKeys !== undefined &&
    new Set(purchasedGenerationKeys).size !== purchasedGenerationKeys.length
  )
    failProjectDocument(`${path}.purchasedGenerationKeys`, 'must not contain duplicates');
  return Object.freeze({
    offerKeyBySlot: Object.freeze({
      healing: itemOrNull(offers.healing, `${path}.offerKeyBySlot.healing`),
      secondLeft: itemOrNull(offers.secondLeft, `${path}.offerKeyBySlot.secondLeft`),
      secondRight: itemOrNull(offers.secondRight, `${path}.offerKeyBySlot.secondRight`),
    }),
    ...(hasRefill
      ? { travelDealRefillKey: itemOrNull(raw.travelDealRefillKey, `${path}.travelDealRefillKey`) }
      : {}),
    ...(twistResultKeyBySlot === undefined ? {} : { twistResultKeyBySlot }),
    ...(purchasedGenerationKeys === undefined
      ? {}
      : { purchasedGenerationKeys: Object.freeze(purchasedGenerationKeys) }),
  });
}

/** The initial roll's slots, a Well reroll's slots by its id, or the Travel Deal refill. */
export function decodeStygianWellGenerationKey(
  value: unknown,
  path: string,
): StygianWellGenerationKey {
  const key = expectNonBlankString(value, path);
  if (key === 'travelDealRefill') return key;
  const parsed = parseStygianWellGenerationKey(key);
  if (
    parsed === undefined ||
    (parsed.rollKey !== INITIAL_ROLL_KEY && !/^r[1-9][0-9]*$/.test(parsed.rollKey))
  )
    failProjectDocument(path, 'must be a Well generation key');
  return key as StygianWellGenerationKey;
}

export function assertStygianWellPurchaseActionClosure(
  well: StygianWellState | undefined,
  roomActions: RoomActionState,
  path: string,
): void {
  const purchases = new Set(well?.purchasedGenerationKeys ?? []);
  const actions = roomActions.order
    .filter((reference) => reference.kind === 'purchaseStygianWellOffer')
    .map((reference) => reference.generationKey);
  if (
    actions.length !== new Set(actions).size ||
    actions.length !== purchases.size ||
    actions.some((key) => !purchases.has(key))
  )
    failProjectDocument(
      path,
      'Well purchase generations must exactly match purchaseStygianWellOffer actions',
    );
  if (well === undefined && purchases.size > 0)
    failProjectDocument(path, 'Well purchases require a present Well');
}
