import type { Catalog } from '../../../catalog-schema';
import type {
  HermesShrineGenerationKey,
  OccurrenceId,
  RerollTarget,
  RoomActionContent,
  RoomActionReference,
  RoomActionState,
} from '../../model';
import { decodeRerollId } from './reward-acquisition-codec';

export { decodeRerollId };
import { decodeStygianWellGenerationKey } from './well-codec';
import { roomActionKey } from '../../room-actions/state';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../../validation';

function decodeRerollTarget(value: unknown, path: string): RerollTarget {
  const target = expectRecord(value, path);
  const kind = expectString(target.kind, `${path}.kind`);
  if (kind === 'door' || kind === 'cage') {
    // A cage press's slot is wherever its target holds its result.
    expectExactKeys(target, ['kind', 'exitKey', 'occurrenceId'], path);
    const exitKey = expectNonBlankString(target.exitKey, `${path}.exitKey`);
    const occurrenceId = expectNonBlankString(
      target.occurrenceId,
      `${path}.occurrenceId`,
    ) as OccurrenceId;
    return Object.freeze({ kind, exitKey, occurrenceId });
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

/** The item content a row recorded: a non-empty list of non-blank strings. */
function decodeRoomActionContent(value: unknown, path: string): RoomActionContent {
  const content = expectArray(value, path);
  if (content.length === 0) failProjectDocument(path, 'must name the item content');
  return Object.freeze(
    content.map((entry, index) => expectNonBlankString(entry, `${path}.${index}`)),
  );
}

/** The optional `content` key a row acting on an item may carry, and its decoded value. */
function contentField(reference: Record<string, unknown>, path: string) {
  const hasContent = Object.hasOwn(reference, 'content');
  return {
    keys: hasContent ? ['content'] : [],
    value: hasContent
      ? { content: decodeRoomActionContent(reference.content, `${path}.content`) }
      : {},
  };
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
    kind === 'interactChallengeSwitch'
  ) {
    expectExactKeys(reference, ['kind'], path);
    return Object.freeze({ kind });
  }
  const content = contentField(reference, path);
  if (kind === 'interactInfernalContractPedestal') {
    expectExactKeys(reference, ['kind', ...content.keys], path);
    return Object.freeze({ kind, ...content.value });
  }
  if (kind === 'completeFieldsCage' || kind === 'interactEncounter' || kind === 'interactGorgon') {
    expectExactKeys(reference, ['kind', 'phaseKey'], path);
    return Object.freeze({
      kind,
      phaseKey: expectNonBlankString(reference.phaseKey, `${path}.phaseKey`),
    });
  }
  if (kind === 'interactIncomingReward') {
    expectExactKeys(reference, ['kind', 'producerPoint', 'acquisitionRole', ...content.keys], path);
    return Object.freeze({
      kind,
      producerPoint: expectNonBlankString(reference.producerPoint, `${path}.producerPoint`),
      acquisitionRole: expectNonBlankString(reference.acquisitionRole, `${path}.acquisitionRole`),
      ...content.value,
    });
  }
  if (kind === 'interactLocalReward') {
    expectExactKeys(reference, ['kind', 'groupKey', 'slotKey', ...content.keys], path);
    return Object.freeze({
      kind,
      groupKey: expectNonBlankString(reference.groupKey, `${path}.groupKey`),
      slotKey: expectNonBlankString(reference.slotKey, `${path}.slotKey`),
      ...content.value,
    });
  }
  if (kind === 'chooseRewardWheel') {
    expectExactKeys(reference, ['kind', 'wheelKey'], path);
    return Object.freeze({
      kind,
      wheelKey: expectNonBlankString(reference.wheelKey, `${path}.wheelKey`),
    });
  }
  if (kind === 'interactWheelReward') {
    expectExactKeys(reference, ['kind', 'wheelKey', ...content.keys], path);
    return Object.freeze({
      kind,
      wheelKey: expectNonBlankString(reference.wheelKey, `${path}.wheelKey`),
      ...content.value,
    });
  }
  if (kind === 'interactShopOffer') {
    expectExactKeys(reference, ['kind', 'offerKey', ...content.keys], path);
    if (reference.offerKey === 'travelDealRefill')
      failProjectDocument(path, 'Travel Deal uses its roomExit acquisition entry participation');
    return Object.freeze({
      kind,
      offerKey: expectNonBlankString(reference.offerKey, `${path}.offerKey`),
      ...content.value,
    });
  }
  if (kind === 'purchaseStygianWellOffer') {
    expectExactKeys(reference, ['kind', 'generationKey', ...content.keys], path);
    return Object.freeze({
      kind,
      generationKey: decodeStygianWellGenerationKey(
        reference.generationKey,
        `${path}.generationKey`,
      ),
      ...content.value,
    });
  }
  if (kind === 'purchaseHermesShrineOffer' || kind === 'rushHermesShrineOffer') {
    expectExactKeys(reference, ['kind', 'generationKey', ...content.keys], path);
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
      ...content.value,
    });
  }
  if (kind === 'sellPurgingPoolTrait') {
    const hasRollKey = Object.hasOwn(reference, 'rollKey');
    expectExactKeys(
      reference,
      ['kind', 'slotKey', ...(hasRollKey ? ['rollKey'] : []), ...content.keys],
      path,
    );
    const slotKey = expectNonBlankString(reference.slotKey, `${path}.slotKey`);
    if (slotKey !== 'left' && slotKey !== 'middle' && slotKey !== 'right')
      failProjectDocument(`${path}.slotKey`, 'must be a declared Pool slot key');
    // The initial list is the absent roll key, never an explicit one.
    return Object.freeze({
      kind,
      slotKey,
      ...(hasRollKey ? { rollKey: decodeRerollId(reference.rollKey, `${path}.rollKey`) } : {}),
      ...content.value,
    });
  }
  if (kind === 'interactAcquisitionEntry') {
    expectExactKeys(reference, ['kind', 'siteKey', 'entryKey', ...content.keys], path);
    return Object.freeze({
      kind,
      siteKey: expectNonBlankString(reference.siteKey, `${path}.siteKey`),
      entryKey: expectNonBlankString(reference.entryKey, `${path}.entryKey`),
      ...content.value,
    });
  }
  if (kind === 'unlockExit') {
    expectExactKeys(reference, ['kind', 'exitKey'], path);
    return Object.freeze({
      kind,
      exitKey: expectNonBlankString(reference.exitKey, `${path}.exitKey`),
    });
  }
  if (kind === 'reroll') {
    expectExactKeys(reference, ['kind', 'rerollId', 'target'], path);
    return Object.freeze({
      kind,
      rerollId: decodeRerollId(reference.rerollId, `${path}.rerollId`),
      target: decodeRerollTarget(reference.target, `${path}.target`),
    });
  }
  if (kind === 'rerollStygianWell' || kind === 'rerollPurgingPool') {
    expectExactKeys(reference, ['kind', 'rerollId'], path);
    return Object.freeze({
      kind,
      rerollId: decodeRerollId(reference.rerollId, `${path}.rerollId`),
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
