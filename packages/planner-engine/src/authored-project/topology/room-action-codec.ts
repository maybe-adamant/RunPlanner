import type { RoomActionReference, RoomActionState } from '../model';
import { roomActionKey } from '../room-actions';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';

function decodeRoomActionReference(value: unknown, path: string): RoomActionReference {
  const reference = expectRecord(value, path);
  const kind = expectString(reference.kind, `${path}.kind`);
  if (kind === 'useFountain' || kind === 'interactKeepsakeRack') {
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
    return Object.freeze({
      kind,
      offerKey: expectNonBlankString(reference.offerKey, `${path}.offerKey`),
    });
  }
  if (kind === 'purchaseHermesShrineOffer' || kind === 'purchaseStygianWellOffer') {
    expectExactKeys(reference, ['kind', 'generationKey'], path);
    const generationKey = expectNonBlankString(reference.generationKey, `${path}.generationKey`);
    const allowed =
      kind === 'purchaseHermesShrineOffer'
        ? ['initial:first', 'initial:secondLeft', 'initial:secondRight', 'travelDealRefill']
        : ['initial:healing', 'initial:secondLeft', 'initial:secondRight', 'travelDealRefill'];
    if (!allowed.includes(generationKey))
      failProjectDocument(
        `${path}.generationKey`,
        `must be a declared ${kind === 'purchaseHermesShrineOffer' ? 'Shrine' : 'Well'} generation key`,
      );
    return Object.freeze({ kind, generationKey } as RoomActionReference);
  }
  if (kind === 'sellPurgingPoolTrait') {
    expectExactKeys(reference, ['kind', 'slotKey'], path);
    const slotKey = expectNonBlankString(reference.slotKey, `${path}.slotKey`);
    if (slotKey !== 'left' && slotKey !== 'middle' && slotKey !== 'right')
      failProjectDocument(`${path}.slotKey`, 'must be a declared Pool slot key');
    return Object.freeze({ kind, slotKey });
  }
  if (kind === 'interactAcquisitionEntry') {
    expectExactKeys(reference, ['kind', 'siteKey', 'entryKey'], path);
    return Object.freeze({
      kind,
      siteKey: expectNonBlankString(reference.siteKey, `${path}.siteKey`),
      entryKey: expectNonBlankString(reference.entryKey, `${path}.entryKey`),
    });
  }
  failProjectDocument(`${path}.kind`, `unknown room action ${kind}`);
}

export function decodeRoomActionState(value: unknown, path: string): RoomActionState {
  const state = expectRecord(value, path);
  expectExactKeys(state, ['order'], path);
  const seen = new Set<string>();
  const order = expectArray(state.order, `${path}.order`).map((rawReference, index) => {
    const referencePath = `${path}.order[${index}]`;
    const reference = decodeRoomActionReference(rawReference, referencePath);
    const key = roomActionKey(reference);
    if (seen.has(key)) failProjectDocument(referencePath, `duplicates room action ${key}`);
    seen.add(key);
    return reference;
  });
  return Object.freeze({ order: Object.freeze(order) });
}
