import type { Catalog } from '../../../catalog-schema';
import type {
  HermesShrineGenerationKey,
  OccurrenceId,
  RerollTarget,
  RoomActionReference,
  RoomActionState,
} from '../../model';
import { decodeResolvedRewardOffer } from './reward-acquisition-codec';
import { decodeStygianWellGenerationKey } from './well-codec';
import { PURGING_POOL_SLOT_KEYS, STYGIAN_WELL_SLOT_KEYS } from '../../feature-rolls';
import { roomActionKey } from '../../room-actions/state';
import {
  expectArray,
  expectBoolean,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../../validation';

/** A persisted reroll instance identity: `r` and a positive integer. */
export function decodeRerollId(value: unknown, path: string): string {
  const rerollId = expectNonBlankString(value, path);
  if (!/^r[1-9][0-9]*$/.test(rerollId)) failProjectDocument(path, 'must be a reroll id');
  return rerollId;
}

function decodeRerollTarget(value: unknown, path: string): RerollTarget {
  const target = expectRecord(value, path);
  const kind = expectString(target.kind, `${path}.kind`);
  if (kind === 'door' || kind === 'cage') {
    expectExactKeys(
      target,
      ['kind', 'exitKey', 'occurrenceId', ...(kind === 'cage' ? ['slotKey'] : [])],
      path,
    );
    const exitKey = expectNonBlankString(target.exitKey, `${path}.exitKey`);
    const occurrenceId = expectNonBlankString(
      target.occurrenceId,
      `${path}.occurrenceId`,
    ) as OccurrenceId;
    return kind === 'door'
      ? Object.freeze({ kind, exitKey, occurrenceId })
      : Object.freeze({
          kind,
          exitKey,
          occurrenceId,
          slotKey: expectNonBlankString(target.slotKey, `${path}.slotKey`),
        });
  }
  if (kind === 'wheelOffer') {
    expectExactKeys(target, ['kind', 'wheelKey', 'offerKey'], path);
    return Object.freeze({
      kind,
      wheelKey: expectNonBlankString(target.wheelKey, `${path}.wheelKey`),
      offerKey: expectNonBlankString(target.offerKey, `${path}.offerKey`),
    });
  }
  failProjectDocument(`${path}.kind`, `unknown reroll target ${kind}`);
}

function decodeRoomActionReference(
  value: unknown,
  catalog: Catalog,
  path: string,
): RoomActionReference {
  const reference = expectRecord(value, path);
  const kind = expectString(reference.kind, `${path}.kind`);
  if (
    kind === 'collectRequiredReward' ||
    kind === 'useFountain' ||
    kind === 'interactKeepsakeRack' ||
    kind === 'interactEris' ||
    kind === 'interactInfernalContractPedestal'
  ) {
    expectExactKeys(reference, ['kind'], path);
    return Object.freeze({ kind });
  }
  if (kind === 'completeFieldsCage' || kind === 'interactEncounter' || kind === 'interactGorgon') {
    expectExactKeys(reference, ['kind', 'phaseKey'], path);
    return Object.freeze({
      kind,
      phaseKey: expectNonBlankString(reference.phaseKey, `${path}.phaseKey`),
    });
  }
  if (kind === 'interactIncomingReward') {
    expectExactKeys(reference, ['kind', 'producerPoint', 'acquisitionRole'], path);
    return Object.freeze({
      kind,
      producerPoint: expectNonBlankString(reference.producerPoint, `${path}.producerPoint`),
      acquisitionRole: expectNonBlankString(reference.acquisitionRole, `${path}.acquisitionRole`),
    });
  }
  if (kind === 'interactLocalReward') {
    expectExactKeys(reference, ['kind', 'groupKey', 'slotKey'], path);
    return Object.freeze({
      kind,
      groupKey: expectNonBlankString(reference.groupKey, `${path}.groupKey`),
      slotKey: expectNonBlankString(reference.slotKey, `${path}.slotKey`),
    });
  }
  if (kind === 'chooseRewardWheel' || kind === 'interactWheelReward') {
    expectExactKeys(reference, ['kind', 'wheelKey'], path);
    return Object.freeze({
      kind,
      wheelKey: expectNonBlankString(reference.wheelKey, `${path}.wheelKey`),
    });
  }
  if (kind === 'interactShopOffer') {
    expectExactKeys(reference, ['kind', 'offerKey'], path);
    if (reference.offerKey === 'travelDealRefill')
      failProjectDocument(path, 'Travel Deal uses its roomExit acquisition entry participation');
    return Object.freeze({
      kind,
      offerKey: expectNonBlankString(reference.offerKey, `${path}.offerKey`),
    });
  }
  if (kind === 'purchaseStygianWellOffer') {
    expectExactKeys(reference, ['kind', 'generationKey'], path);
    return Object.freeze({
      kind,
      generationKey: decodeStygianWellGenerationKey(
        reference.generationKey,
        `${path}.generationKey`,
      ),
    });
  }
  if (kind === 'purchaseHermesShrineOffer') {
    expectExactKeys(reference, ['kind', 'generationKey', 'rushed'], path);
    const generationKey = expectNonBlankString(reference.generationKey, `${path}.generationKey`);
    if (
      !['initial:first', 'initial:secondLeft', 'initial:secondRight', 'travelDealRefill'].includes(
        generationKey,
      )
    )
      failProjectDocument(`${path}.generationKey`, 'must be a declared Shrine generation key');
    return Object.freeze({
      kind,
      generationKey: generationKey as HermesShrineGenerationKey,
      rushed: expectBoolean(reference.rushed, `${path}.rushed`),
    });
  }
  if (kind === 'sellPurgingPoolTrait') {
    const hasRollKey = Object.hasOwn(reference, 'rollKey');
    expectExactKeys(reference, ['kind', 'slotKey', ...(hasRollKey ? ['rollKey'] : [])], path);
    const slotKey = expectNonBlankString(reference.slotKey, `${path}.slotKey`);
    if (slotKey !== 'left' && slotKey !== 'middle' && slotKey !== 'right')
      failProjectDocument(`${path}.slotKey`, 'must be a declared Pool slot key');
    // The initial list is the absent roll key, never an explicit one.
    return Object.freeze({
      kind,
      slotKey,
      ...(hasRollKey ? { rollKey: decodeRerollId(reference.rollKey, `${path}.rollKey`) } : {}),
    });
  }
  if (kind === 'interactAcquisitionEntry') {
    const hasEncounterPhaseKey = Object.hasOwn(reference, 'encounterPhaseKey');
    expectExactKeys(
      reference,
      ['kind', 'siteKey', 'entryKey', ...(hasEncounterPhaseKey ? ['encounterPhaseKey'] : [])],
      path,
    );
    return Object.freeze({
      kind,
      siteKey: expectNonBlankString(reference.siteKey, `${path}.siteKey`),
      entryKey: expectNonBlankString(reference.entryKey, `${path}.entryKey`),
      ...(hasEncounterPhaseKey
        ? {
            encounterPhaseKey: expectNonBlankString(
              reference.encounterPhaseKey,
              `${path}.encounterPhaseKey`,
            ),
          }
        : {}),
    });
  }
  if (kind === 'reroll') {
    expectExactKeys(reference, ['kind', 'rerollId', 'target', 'reward'], path);
    return Object.freeze({
      kind,
      rerollId: decodeRerollId(reference.rerollId, `${path}.rerollId`),
      target: decodeRerollTarget(reference.target, `${path}.target`),
      reward: decodeResolvedRewardOffer(reference.reward, catalog, `${path}.reward`),
    });
  }
  if (kind === 'rerollStygianWell') {
    const hasTwist = Object.hasOwn(reference, 'twistResultKeyBySlot');
    expectExactKeys(
      reference,
      ['kind', 'rerollId', 'offerKeyBySlot', ...(hasTwist ? ['twistResultKeyBySlot'] : [])],
      path,
    );
    const known = new Set(
      catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((group) =>
        group.options.values.map((option) => option.key),
      ) ?? [],
    );
    const item = (entry: unknown, entryPath: string): string => {
      const itemKey = expectNonBlankString(entry, entryPath);
      if (!known.has(itemKey)) failProjectDocument(entryPath, `unknown RoomShop item ${itemKey}`);
      return itemKey;
    };
    const slots = (field: string, decode: (entry: unknown, entryPath: string) => unknown) => {
      const record = expectRecord(reference[field], `${path}.${field}`);
      for (const key of Object.keys(record))
        if (!(STYGIAN_WELL_SLOT_KEYS as readonly string[]).includes(key))
          failProjectDocument(`${path}.${field}`, `contains unknown Well slot ${key}`);
      return Object.freeze(
        Object.fromEntries(
          Object.entries(record).map(([key, entry]) => [
            key,
            decode(entry, `${path}.${field}.${key}`),
          ]),
        ),
      );
    };
    return Object.freeze({
      kind,
      rerollId: decodeRerollId(reference.rerollId, `${path}.rerollId`),
      offerKeyBySlot: slots('offerKeyBySlot', item) as Record<string, string>,
      ...(hasTwist
        ? {
            twistResultKeyBySlot: slots('twistResultKeyBySlot', (entry, entryPath) =>
              entry === null ? null : item(entry, entryPath),
            ) as Record<string, string | null>,
          }
        : {}),
    });
  }
  if (kind === 'rerollPurgingPool') {
    expectExactKeys(reference, ['kind', 'rerollId', 'traitKeyBySlot'], path);
    const traits = expectRecord(reference.traitKeyBySlot, `${path}.traitKeyBySlot`);
    for (const key of Object.keys(traits))
      if (!(PURGING_POOL_SLOT_KEYS as readonly string[]).includes(key))
        failProjectDocument(`${path}.traitKeyBySlot`, `contains unknown Pool slot ${key}`);
    return Object.freeze({
      kind,
      rerollId: decodeRerollId(reference.rerollId, `${path}.rerollId`),
      traitKeyBySlot: Object.freeze(
        Object.fromEntries(
          Object.entries(traits).map(([key, entry]) => {
            const traitKey = expectNonBlankString(entry, `${path}.traitKeyBySlot.${key}`);
            if (catalog.traits.byKey[traitKey] === undefined)
              failProjectDocument(`${path}.traitKeyBySlot.${key}`, 'unknown trait');
            return [key, traitKey];
          }),
        ),
      ),
    });
  }
  failProjectDocument(`${path}.kind`, `unknown room action ${kind}`);
}

export function decodeRoomActionState(
  value: unknown,
  catalog: Catalog,
  path: string,
): RoomActionState {
  const state = expectRecord(value, path);
  expectExactKeys(state, ['order'], path);
  const seen = new Set<string>();
  const order = expectArray(state.order, `${path}.order`).map((rawReference, index) => {
    const referencePath = `${path}.order[${index}]`;
    const reference = decodeRoomActionReference(rawReference, catalog, referencePath);
    const key = roomActionKey(reference);
    if (seen.has(key)) failProjectDocument(referencePath, `duplicates room action ${key}`);
    seen.add(key);
    return reference;
  });
  return Object.freeze({ order: Object.freeze(order) });
}
