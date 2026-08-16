import type {
  Catalog,
  EncounterRewardWheelAttachment,
  FieldsOptionalRewardDescriptor,
  LocalChildDescriptor,
  RoomDeclaration,
} from '../../catalog-schema';
import type { CountedRewardBinding, ShopRewardBinding } from '../../reward-kernel/bindings';
import { encounterEnvelopeSlots } from './encounters';
import { failProjectDocument } from '../validation';
import type { TraitOfferDefaultsContext } from '../traits';

export type RoomOccurrenceRole = 'ordinary' | 'prebossFreeReward' | 'prebossShop';

export interface RoomStateContext {
  readonly role: RoomOccurrenceRole;
  readonly resolvedStoreKey?: string;
  readonly entryActive: boolean;
  readonly loadout: TraitOfferDefaultsContext;
  /** Required only while constructing a Fields occurrence inside its selected batch. */
  readonly activeCageCount?: number;
  /**
   * An Anomaly replacement retains the offer domain of the normal G target it
   * displaced. This is decode context, not persisted duplicate state.
   */
  readonly rememberedCountedBinding?: CountedRewardBinding;
}

export function authoredTemplateKey(room: RoomDeclaration, path: string) {
  if (room.mode.kind !== 'authored') {
    failProjectDocument(path, `${room.gameName} is layout-derived and owns no authored room state`);
  }
  return room.mode.templateKey;
}

export function requireOrdinaryRole(
  role: RoomOccurrenceRole,
  room: RoomDeclaration,
  path: string,
): void {
  if (role !== 'ordinary') {
    failProjectDocument(
      path,
      `${authoredTemplateKey(room, path)} cannot use preboss offer role ${role}`,
    );
  }
}

export function requireCountedBinding(room: RoomDeclaration, path: string): CountedRewardBinding {
  if (room.incomingReward.kind !== 'countedChoice') {
    failProjectDocument(
      path,
      `${authoredTemplateKey(room, path)} requires a counted reward binding`,
    );
  }
  return room.incomingReward;
}

export function requireShopBinding(room: RoomDeclaration, path: string): ShopRewardBinding {
  if (room.incomingReward.kind !== 'shop') {
    failProjectDocument(path, `${authoredTemplateKey(room, path)} requires a shop binding`);
  }
  return room.incomingReward;
}

export function requireFieldsCages(
  room: RoomDeclaration,
  path: string,
): LocalChildDescriptor & {
  readonly kind: 'boundedRewardSlots';
} {
  const cages = room.localChildren.find((child) => child.key === 'cages');
  if (cages?.kind !== 'boundedRewardSlots') {
    failProjectDocument(path, 'FieldsCombat requires bounded cages');
  }
  return cages;
}

export function requireFieldsOptionalRewards(
  room: RoomDeclaration,
  path: string,
): FieldsOptionalRewardDescriptor {
  if (room.fieldsOptionalRewards === undefined) {
    failProjectDocument(path, 'FieldsCombat requires optional rewards');
  }
  return room.fieldsOptionalRewards;
}

export function requireShipCombatWheels(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): readonly EncounterRewardWheelAttachment[] {
  const wheels = encounterEnvelopeSlots(catalog, room, path).flatMap((slot) =>
    slot.rewardAttachment?.kind === 'rewardWheel' ? [slot.rewardAttachment] : [],
  );
  if (wheels.length !== 2 || wheels[0]?.key !== 'wheel1' || wheels[1]?.key !== 'wheel2') {
    failProjectDocument(path, 'ShipCombat requires wheel1 and wheel2 offer points');
  }
  return wheels;
}

export function requireEphyraSideRooms(
  room: RoomDeclaration,
  path: string,
): Extract<LocalChildDescriptor, { readonly kind: 'fixedRoomSlots' }> | undefined {
  const descriptor = room.localChildren[0];
  if (descriptor === undefined) {
    return undefined;
  }
  if (room.localChildren.length !== 1 || descriptor.kind !== 'fixedRoomSlots') {
    failProjectDocument(path, 'EphyraCombat requires at most one fixed-room side group');
  }
  return descriptor;
}
