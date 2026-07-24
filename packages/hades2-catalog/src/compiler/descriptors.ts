import type {
  AuthoredFieldDescriptor,
  AuthoredFieldInitialization,
  LocalChildDescriptor,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding } from '@run-planner/engine/reward-kernel';

import type { RawCountedRewardBinding, RawLocalChildDescriptor } from '../declarations';

import {
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

function normalizeInitialization<T>(
  value: unknown,
  path: string,
  normalizeValue: (value: unknown, path: string) => T,
): AuthoredFieldInitialization<T> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an authored-field initialization');
  }
  const initialization = value as { readonly kind?: unknown; readonly value?: unknown };
  if (initialization.kind === 'required') {
    return Object.freeze({ kind: 'required' });
  }
  if (initialization.kind === 'defaulted') {
    return Object.freeze({
      kind: 'defaulted',
      value: normalizeValue(initialization.value, `${path}.value`),
    });
  }
  fail(`${path}.kind`, `unknown initialization ${String(initialization.kind)}`);
}

export function normalizeAuthoredFields(
  rawFields: readonly AuthoredFieldDescriptor[],
  path: string,
): readonly AuthoredFieldDescriptor[] {
  const keys = freezeUniqueStrings(
    rawFields.map((field) => field.key),
    `${path}.keys`,
  );
  return Object.freeze(
    rawFields.map((field, index): AuthoredFieldDescriptor => {
      const fieldPath = `${path}[${index}]`;
      const key = keys[index] as string;
      const receivedKind: unknown = (field as { readonly kind?: unknown }).kind;
      if (field.kind === 'boolean') {
        const initialization = normalizeInitialization(
          field.initialization,
          `${fieldPath}.initialization`,
          (value, path) => {
            if (typeof value !== 'boolean') {
              fail(path, 'must be boolean');
            }
            return value;
          },
        );
        return Object.freeze({ key, kind: 'boolean', initialization });
      }
      if (field.kind === 'boundedInteger') {
        const min = requireNonNegativeInteger(field.min, `${fieldPath}.min`);
        const max = requireNonNegativeInteger(field.max, `${fieldPath}.max`);
        if (max < min) {
          fail(`${fieldPath}.max`, 'must be greater than or equal to min');
        }
        const initialization = normalizeInitialization(
          field.initialization,
          `${fieldPath}.initialization`,
          (value, path) => requireNonNegativeInteger(value as number, path),
        );
        if (
          initialization.kind === 'defaulted' &&
          (initialization.value < min || initialization.value > max)
        ) {
          fail(`${fieldPath}.initialization.value`, 'must be inside the declared bounds');
        }
        return Object.freeze({ key, kind: 'boundedInteger', min, max, initialization });
      }
      if (field.kind === 'enum') {
        const values = freezeUniqueStrings(field.values, `${fieldPath}.values`);
        if (values.length === 0) {
          fail(`${fieldPath}.values`, 'must not be empty');
        }
        const initialization = normalizeInitialization(
          field.initialization,
          `${fieldPath}.initialization`,
          (value, path) => requireNonEmpty(value as string, path),
        );
        if (initialization.kind === 'defaulted' && !values.includes(initialization.value)) {
          fail(`${fieldPath}.initialization.value`, 'must belong to values');
        }
        return Object.freeze({ key, kind: 'enum', values, initialization });
      }
      fail(`${fieldPath}.kind`, `unknown authored field kind ${String(receivedKind)}`);
    }),
  );
}

export function normalizeLocalChildren(
  rawChildren: readonly RawLocalChildDescriptor[],
  path: string,
  normalizeCountedReward: (raw: RawCountedRewardBinding, path: string) => CountedRewardBinding,
): readonly LocalChildDescriptor[] {
  const keys = freezeUniqueStrings(
    rawChildren.map((child) => child.key),
    `${path}.keys`,
  );
  return Object.freeze(
    rawChildren.map((child, index): LocalChildDescriptor => {
      const childPath = `${path}[${index}]`;
      const receivedKind: unknown = (child as { readonly kind?: unknown }).kind;
      if (child.kind === 'boundedRewardSlots') {
        const slotKeys = freezeUniqueStrings(child.slotKeys, `${childPath}.slotKeys`);
        if (slotKeys.length === 0) {
          fail(`${childPath}.slotKeys`, 'must not be empty');
        }
        const rawCapacity = requirePositiveInteger(child.rawCapacity, `${childPath}.rawCapacity`);
        const maxActiveSlots = requirePositiveInteger(
          child.maxActiveSlots,
          `${childPath}.maxActiveSlots`,
        );
        if (maxActiveSlots !== Math.min(rawCapacity, slotKeys.length)) {
          fail(
            `${childPath}.maxActiveSlots`,
            'must equal raw capacity clamped to the physical slot count',
          );
        }
        return Object.freeze({
          key: keys[index] as string,
          kind: 'boundedRewardSlots',
          slotKeys,
          rawCapacity,
          maxActiveSlots,
          reward: normalizeCountedReward(child.reward, `${childPath}.reward`),
          fields: normalizeAuthoredFields(child.fields, `${childPath}.fields`),
        });
      }
      if (child.kind === 'fixedRoomSlots') {
        const slotKeys = freezeUniqueStrings(
          child.slots.map((slot) => slot.slotKey),
          `${childPath}.slots.slotKeys`,
        );
        if (slotKeys.length === 0) {
          fail(`${childPath}.slots`, 'must not be empty');
        }
        const ranks = new Set<number>();
        const physicalDoorIds = new Set<number>();
        const slots = child.slots.map((slot, slotIndex) => {
          const slotPath = `${childPath}.slots[${slotIndex}]`;
          const physicalDoorId = requirePositiveInteger(
            slot.physicalDoorId,
            `${slotPath}.physicalDoorId`,
          );
          if (physicalDoorIds.has(physicalDoorId)) {
            fail(`${slotPath}.physicalDoorId`, `duplicates ${physicalDoorId}`);
          }
          physicalDoorIds.add(physicalDoorId);
          const availabilityRank = requirePositiveInteger(
            slot.availabilityRank,
            `${slotPath}.availabilityRank`,
          );
          if (ranks.has(availabilityRank)) {
            fail(`${slotPath}.availabilityRank`, `duplicates ${availabilityRank}`);
          }
          ranks.add(availabilityRank);
          return Object.freeze({
            slotKey: slotKeys[slotIndex] as string,
            roomGameName: requireNonEmpty(slot.roomGameName, `${slotPath}.roomGameName`),
            physicalDoorId,
            availabilityRank,
          });
        });
        for (let rank = 1; rank <= slots.length; rank += 1) {
          if (!ranks.has(rank)) {
            fail(`${childPath}.slots.availabilityRanks`, `must contain contiguous rank ${rank}`);
          }
        }
        if (child.rewardGeneration !== 'jointUnordered') {
          fail(
            `${childPath}.rewardGeneration`,
            `unknown fixed-room reward generation ${String(child.rewardGeneration)}`,
          );
        }
        return Object.freeze({
          key: keys[index] as string,
          kind: 'fixedRoomSlots',
          slots: Object.freeze(slots),
          rewardGeneration: 'jointUnordered',
          fields: normalizeAuthoredFields(child.fields, `${childPath}.fields`),
        });
      }
      fail(`${childPath}.kind`, `unknown local-child kind ${String(receivedKind)}`);
    }),
  );
}
