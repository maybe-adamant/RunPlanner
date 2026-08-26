import type {
  CatalogCollection,
  EncounterEnvelope,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

import { fail } from './errors';

/** Validates one normalized room against its declaration-template contract. */
export function validateRoomTemplateContracts(
  room: RoomDeclaration,
  roomIndex: number,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
): void {
  const path = `rooms[${roomIndex}]`;
  if (room.mode.kind === 'authored' && room.mode.templateKey === 'Preboss') {
    if (
      room.prebossBatchPolicy?.kind === 'retainNormalPeers' &&
      room.caps.maxCreationsPerRoom !== 1
    ) {
      fail(`${path}.caps.maxCreationsPerRoom`, 'retainNormalPeers requires maxCreationsPerRoom: 1');
    }
  }
  if (room.mode.kind === 'authored' && room.mode.templateKey === 'FieldsCombat') {
    if (room.individualRewardStoreKey === undefined) {
      fail(`${path}.individualRewardStoreKey`, 'is required by FieldsCombat');
    }
    if (room.fieldsOptionalRewards === undefined) {
      fail(`${path}.fieldsOptionalRewards`, 'FieldsCombat requires optional reward capacity');
    }
    if (room.localChildren.length !== 1) {
      fail(`${path}.localChildren`, 'FieldsCombat requires exactly one cages descriptor');
    }
    const cages = room.localChildren[0];
    if (cages?.kind !== 'boundedRewardSlots' || cages.key !== 'cages') {
      fail(`${path}.localChildren[0]`, 'FieldsCombat requires boundedRewardSlots named cages');
    }
    if (
      cages.slotKeys.length !== 3 ||
      cages.slotKeys[0] !== 'cage1' ||
      cages.slotKeys[1] !== 'cage2' ||
      cages.slotKeys[2] !== 'cage3'
    ) {
      fail(`${path}.localChildren[0].slotKeys`, 'FieldsCombat requires cage1, cage2, cage3');
    }
    if (cages.fields.length !== 0) {
      fail(`${path}.localChildren[0].fields`, 'FieldsCombat cages do not own authored fields');
    }
    if (
      cages.reward.storeKeys.length !== 1 ||
      cages.reward.storeKeys[0] !== room.individualRewardStoreKey
    ) {
      fail(
        `${path}.localChildren[0].reward.storeKeys`,
        `must contain only the FieldsCombat individual store ${room.individualRewardStoreKey}`,
      );
    }
    const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
    const expectedSlots = ['Passive', 'Cage01', 'Cage02', 'Cage03'];
    if (
      envelope?.key !== 'FieldsEncounter' ||
      envelope.slots.length !== expectedSlots.length ||
      envelope.slots.some((slot, index) => slot.key !== expectedSlots[index]) ||
      envelope.slots[0]?.activation !== 'always' ||
      envelope.slots.slice(1).some((slot) => slot.activation !== 'templateControlled') ||
      envelope.slots[0]?.rewardAttachment !== undefined ||
      envelope.slots.slice(1).some((slot, index) => {
        const attachment = slot.rewardAttachment;
        return (
          attachment?.kind !== 'localReward' ||
          attachment.groupKey !== cages.key ||
          attachment.slotKey !== cages.slotKeys[index]
        );
      }) ||
      room.encounterSlotBindings.some((binding) => binding.kind !== 'set')
    ) {
      fail(
        `${path}.encounterEnvelopeKey`,
        'FieldsCombat requires FieldsEncounter Passive/Cage01/Cage02/Cage03 slot topology and local reward attachments',
      );
    }
  }
  if (
    (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') &&
    room.fieldsOptionalRewards !== undefined
  ) {
    fail(`${path}.fieldsOptionalRewards`, 'is only valid for FieldsCombat');
  }
  if (room.mode.kind === 'authored' && room.mode.templateKey === 'ShipCombat') {
    const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
    const intro = envelope?.slots[0];
    const combat1 = envelope?.slots[1];
    const combat2 = envelope?.slots[2];
    const wheel1 = combat1?.rewardAttachment;
    const wheel2 = combat2?.rewardAttachment;
    if (
      envelope?.key !== 'ShipEncounter' ||
      envelope.slots.length !== 3 ||
      intro?.key !== 'Intro' ||
      intro.activation !== 'always' ||
      intro.rewardAttachment !== undefined ||
      combat1?.key !== 'Combat1' ||
      combat1.activation !== 'always' ||
      wheel1?.kind !== 'rewardWheel' ||
      wheel1.key !== 'wheel1' ||
      wheel1.offerKeys.length !== 2 ||
      wheel1.offerKeys[0] !== 'offer1' ||
      wheel1.offerKeys[1] !== 'offer2' ||
      wheel1.offerCount.min !== 1 ||
      wheel1.offerCount.max !== 2 ||
      wheel1.offerCount.defaultValue !== 1 ||
      combat2?.key !== 'Combat2' ||
      combat2.activation !== 'templateControlled' ||
      wheel2?.kind !== 'rewardWheel' ||
      wheel2.key !== 'wheel2' ||
      wheel2.offerKeys.length !== 2 ||
      wheel2.offerKeys[0] !== 'offer1' ||
      wheel2.offerKeys[1] !== 'offer2' ||
      wheel2.offerCount.min !== 1 ||
      wheel2.offerCount.max !== 2 ||
      wheel2.offerCount.defaultValue !== 1 ||
      room.encounterSlotBindings.some((binding) => binding.kind !== 'set')
    ) {
      fail(
        `${path}.encounterEnvelopeKey`,
        'ShipCombat requires ShipEncounter Intro, Combat1/wheel1, and template-controlled Combat2/wheel2 slots',
      );
    }
    if (room.localChildren.length !== 0) {
      fail(`${path}.localChildren`, 'ShipCombat wheels belong to its encounter envelope');
    }
    if (room.enteredRewardStoreHistory.kind !== 'none') {
      fail(
        `${path}.enteredRewardStoreHistory`,
        'ShipCombat history is emitted by its active wheel offer points',
      );
    }
  }
  if (room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraCombat') {
    if (
      room.localChildren.length > 1 ||
      room.localChildren.some((child) => child.kind !== 'fixedRoomSlots')
    ) {
      fail(`${path}.localChildren`, 'EphyraCombat accepts at most one fixed-room side group');
    }
    if (room.requiredObjects?.length !== 1 || room.requiredObjects[0]?.key !== 'SoulPylon') {
      fail(`${path}.requiredObjects`, 'EphyraCombat requires one SoulPylon');
    }
  }
  if (room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraSideRoom') {
    if (room.localChildren.length !== 0) {
      fail(`${path}.localChildren`, 'EphyraSideRoom cannot own local children');
    }
    if (room.requiredObjects !== undefined) {
      fail(`${path}.requiredObjects`, 'EphyraSideRoom cannot require room objects');
    }
  }
}
