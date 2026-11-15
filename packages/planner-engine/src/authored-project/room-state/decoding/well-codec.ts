import type { Catalog } from '../../../catalog-schema';
import {
  INITIAL_ROLL_KEY,
  STYGIAN_WELL_SLOT_KEYS,
  parseStygianWellGenerationKey,
  purgingPoolRerolls,
  stygianWellRerolls,
} from '../../feature-rolls';
import type {
  PurgingPoolState,
  RoomActionState,
  StygianWellGenerationKey,
  StygianWellState,
} from '../../model';
import {
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  failProjectDocument,
} from '../../validation';

function roomShopItemKeys(catalog: Catalog): ReadonlySet<string> {
  return new Set(
    catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((group) =>
      group.options.values.map((option) => option.key),
    ) ?? [],
  );
}

/**
 * Pins by reroll id: each a non-empty record of known slots. Which rerolls
 * may hold pins is the occurrence's closure.
 */
export function decodeRerollPins(
  value: unknown,
  path: string,
  slotKeys: readonly string[],
  decodeValue: (entry: unknown, entryPath: string) => string,
): Readonly<Record<string, Readonly<Record<string, string>>>> {
  const byReroll = expectRecord(value, path);
  if (Object.keys(byReroll).length === 0) failProjectDocument(path, 'must not be empty');
  return Object.freeze(
    Object.fromEntries(
      Object.entries(byReroll).map(([rerollId, rawPins]) => {
        if (!/^r[1-9][0-9]*$/.test(rerollId))
          failProjectDocument(`${path}.${rerollId}`, 'must be keyed by a reroll id');
        const pins = expectRecord(rawPins, `${path}.${rerollId}`);
        if (Object.keys(pins).length === 0)
          failProjectDocument(`${path}.${rerollId}`, 'must pin at least one slot');
        for (const slotKey of Object.keys(pins))
          if (!slotKeys.includes(slotKey))
            failProjectDocument(`${path}.${rerollId}`, `contains unknown slot ${slotKey}`);
        return [
          rerollId,
          Object.freeze(
            Object.fromEntries(
              Object.entries(pins).map(([slotKey, entry]) => [
                slotKey,
                decodeValue(entry, `${path}.${rerollId}.${slotKey}`),
              ]),
            ),
          ),
        ];
      }),
    ),
  );
}

export function decodeStygianWellState(
  value: unknown,
  path: string,
  catalog: Catalog,
): StygianWellState {
  const raw = expectRecord(value, path);
  const hasRerollPins = Object.hasOwn(raw, 'rerollOfferKeyBySlot');
  const hasTwist = Object.hasOwn(raw, 'twistResultKeyByGeneration');
  const hasRefill = Object.hasOwn(raw, 'travelDealRefillKey');
  expectExactKeys(
    raw,
    [
      'offerKeyBySlot',
      ...(hasRerollPins ? ['rerollOfferKeyBySlot'] : []),
      ...(hasTwist ? ['twistResultKeyByGeneration'] : []),
      ...(hasRefill ? ['travelDealRefillKey'] : []),
    ],
    path,
  );
  const offers = expectRecord(raw.offerKeyBySlot, `${path}.offerKeyBySlot`);
  expectExactKeys(offers, [...STYGIAN_WELL_SLOT_KEYS], `${path}.offerKeyBySlot`);
  const knownItemKeys = roomShopItemKeys(catalog);
  const item = (entry: unknown, entryPath: string): string => {
    const itemKey = expectNonBlankString(entry, entryPath);
    if (!knownItemKeys.has(itemKey))
      failProjectDocument(entryPath, `unknown RoomShop item ${itemKey}`);
    return itemKey;
  };
  const itemOrNull = (entry: unknown, entryPath: string) =>
    entry === null ? null : item(entry, entryPath);
  const rerollOfferKeyBySlot = hasRerollPins
    ? decodeRerollPins(
        raw.rerollOfferKeyBySlot,
        `${path}.rerollOfferKeyBySlot`,
        STYGIAN_WELL_SLOT_KEYS,
        item,
      )
    : undefined;
  const twistResultKeyByGeneration = !hasTwist
    ? undefined
    : (() => {
        const twistPath = `${path}.twistResultKeyByGeneration`;
        const twist = expectRecord(raw.twistResultKeyByGeneration, twistPath);
        if (Object.keys(twist).length === 0) failProjectDocument(twistPath, 'must not be empty');
        return Object.freeze(
          Object.fromEntries(
            Object.entries(twist).map(([key, entry]) => [
              decodeStygianWellGenerationKey(key, `${twistPath}.${key}`),
              itemOrNull(entry, `${twistPath}.${key}`),
            ]),
          ),
        );
      })();
  return Object.freeze({
    offerKeyBySlot: Object.freeze({
      healing: itemOrNull(offers.healing, `${path}.offerKeyBySlot.healing`),
      secondLeft: itemOrNull(offers.secondLeft, `${path}.offerKeyBySlot.secondLeft`),
      secondRight: itemOrNull(offers.secondRight, `${path}.offerKeyBySlot.secondRight`),
    }),
    ...(rerollOfferKeyBySlot === undefined ? {} : { rerollOfferKeyBySlot }),
    ...(twistResultKeyByGeneration === undefined ? {} : { twistResultKeyByGeneration }),
    ...(hasRefill
      ? { travelDealRefillKey: itemOrNull(raw.travelDealRefillKey, `${path}.travelDealRefillKey`) }
      : {}),
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

/**
 * A Well's and a Pool's observations name only the rolls the room's actions
 * hold, and Well purchases need a present Well. The path is the occurrence's.
 */
export function assertFeatureRollClosure(
  well: StygianWellState | undefined,
  pool: PurgingPoolState | undefined,
  roomActions: RoomActionState,
  path: string,
): void {
  const purchases = roomActions.order
    .filter((reference) => reference.kind === 'purchaseStygianWellOffer')
    .map((reference) => reference.generationKey);
  if (purchases.length > 0 && well === undefined)
    failProjectDocument(`${path}.roomActions.order`, 'Well purchases require a present Well');
  const wellRolls = new Set(stygianWellRerolls(roomActions.order).map((r) => r.rerollId));
  for (const rerollId of Object.keys(well?.rerollOfferKeyBySlot ?? {}))
    if (!wellRolls.has(rerollId))
      failProjectDocument(
        `${path}.stygianWell.rerollOfferKeyBySlot.${rerollId}`,
        'pins a Well reroll the room does not hold',
      );
  for (const generationKey of Object.keys(well?.twistResultKeyByGeneration ?? {})) {
    const rollKey = parseStygianWellGenerationKey(generationKey)?.rollKey;
    if (rollKey !== undefined && rollKey !== INITIAL_ROLL_KEY && !wellRolls.has(rollKey))
      failProjectDocument(
        `${path}.stygianWell.twistResultKeyByGeneration.${generationKey}`,
        'names a Well reroll the room does not hold',
      );
  }
  const poolRolls = new Set(purgingPoolRerolls(roomActions.order).map((r) => r.rerollId));
  for (const rerollId of Object.keys(pool?.rerollTraitKeyBySlot ?? {}))
    if (!poolRolls.has(rerollId))
      failProjectDocument(
        `${path}.purgingPool.rerollTraitKeyBySlot.${rerollId}`,
        'pins a Pool reroll the room does not hold',
      );
}
