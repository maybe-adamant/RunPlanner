import type { OccurrenceId } from './model';

interface BiomeOwnedAddress {
  readonly routeKey: string;
  readonly biomeKey: string;
}

export interface ProjectAddress {
  readonly kind: 'project';
}

export interface RouteAddress {
  readonly kind: 'route';
  readonly routeKey: string;
}

export interface BiomeAddress extends BiomeOwnedAddress {
  readonly kind: 'biome';
}

export interface BiomeFieldAddress extends BiomeOwnedAddress {
  readonly kind: 'biomeField';
  readonly fieldKey: string;
}

export interface OccurrenceAddress extends BiomeOwnedAddress {
  readonly kind: 'occurrence';
  readonly occurrenceId: OccurrenceId;
}

export interface CompletionRoomAddress extends BiomeOwnedAddress {
  readonly kind: 'completionRoom';
  readonly role: 'boss' | 'postboss';
}

export interface FixedEntryRoomAddress extends BiomeOwnedAddress {
  readonly kind: 'fixedEntryRoom';
  readonly role: string;
}

export interface FixedEntryRewardAddress extends BiomeOwnedAddress {
  readonly kind: 'fixedEntryReward';
  readonly role: string;
}

export interface FixedEntryTargetAddress extends BiomeOwnedAddress {
  readonly kind: 'fixedEntryTarget';
  readonly role: string;
}

export interface ContinuationAddress extends BiomeOwnedAddress {
  readonly kind: 'continuation';
  readonly parentOccurrenceId: OccurrenceId | null;
}

export interface BatchRewardStoreAddress extends BiomeOwnedAddress {
  readonly kind: 'batchRewardStore';
  readonly parentOccurrenceId: OccurrenceId | null;
}

export interface TargetAddress extends BiomeOwnedAddress {
  readonly kind: 'target';
  readonly parentOccurrenceId: OccurrenceId | null;
  readonly exitIndex: number;
}

export interface PickedAddress extends BiomeOwnedAddress {
  readonly kind: 'picked';
  readonly parentOccurrenceId: OccurrenceId | null;
}

export interface IncomingRewardAddress extends BiomeOwnedAddress {
  readonly kind: 'incomingReward';
  readonly occurrenceId: OccurrenceId;
}

export interface LocalRewardAddress extends BiomeOwnedAddress {
  readonly kind: 'localReward';
  readonly occurrenceId: OccurrenceId;
  readonly groupKey: string;
  readonly slotKey: string;
}

export interface LocalChildAddress extends BiomeOwnedAddress {
  readonly kind: 'localChild';
  readonly occurrenceId: OccurrenceId;
  readonly groupKey: string;
  readonly slotKey: string;
}

export interface LocalChildGroupAddress extends BiomeOwnedAddress {
  readonly kind: 'localChildGroup';
  readonly occurrenceId: OccurrenceId;
  readonly groupKey: string;
}

export interface RewardWheelAddress extends BiomeOwnedAddress {
  readonly kind: 'rewardWheel';
  readonly occurrenceId: OccurrenceId;
  readonly wheelKey: string;
}

export interface RewardWheelOfferAddress extends BiomeOwnedAddress {
  readonly kind: 'rewardWheelOffer';
  readonly occurrenceId: OccurrenceId;
  readonly wheelKey: string;
  readonly offerKey: string;
}

export interface HubSlotAddress extends BiomeOwnedAddress {
  readonly kind: 'hubSlot';
  readonly hubSlotKey: string;
}

export interface HubOpenSetAddress extends BiomeOwnedAddress {
  readonly kind: 'hubOpenSet';
}

export interface HubRoomAddress extends BiomeOwnedAddress {
  readonly kind: 'hubRoom';
}

export interface HubVisitAddress extends BiomeOwnedAddress {
  readonly kind: 'hubVisit';
  readonly visitIndex: number;
}

export interface ShopPurchaseAddress extends BiomeOwnedAddress {
  readonly kind: 'shopPurchase';
  readonly occurrenceId: OccurrenceId;
  readonly offerKey: string;
}

export interface ShopOfferAddress extends BiomeOwnedAddress {
  readonly kind: 'shopOffer';
  readonly occurrenceId: OccurrenceId;
  readonly offerKey: string;
}

export type SemanticAddress =
  | ProjectAddress
  | RouteAddress
  | BiomeAddress
  | BiomeFieldAddress
  | BatchRewardStoreAddress
  | CompletionRoomAddress
  | ContinuationAddress
  | FixedEntryRewardAddress
  | FixedEntryRoomAddress
  | FixedEntryTargetAddress
  | IncomingRewardAddress
  | HubSlotAddress
  | HubOpenSetAddress
  | HubRoomAddress
  | HubVisitAddress
  | LocalChildAddress
  | LocalChildGroupAddress
  | LocalRewardAddress
  | OccurrenceAddress
  | PickedAddress
  | RewardWheelAddress
  | RewardWheelOfferAddress
  | ShopOfferAddress
  | ShopPurchaseAddress
  | TargetAddress;

export class SemanticAddressContractError extends Error {
  readonly field: string;
  readonly detail: string;

  constructor(field: string, detail: string) {
    super(`${field}: ${detail}`);
    this.name = 'SemanticAddressContractError';
    this.field = field;
    this.detail = detail;
  }
}

function nonBlank(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new SemanticAddressContractError(field, 'must not be blank');
  }
  return value;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SemanticAddressContractError(field, 'must be a positive integer');
  }
  return value;
}

function biomeOwner(address: BiomeAddress): BiomeOwnedAddress {
  return { routeKey: address.routeKey, biomeKey: address.biomeKey };
}

export function createOccurrenceId(value: string): OccurrenceId {
  return nonBlank(value, 'occurrenceId') as OccurrenceId;
}

export function createProjectAddress(): ProjectAddress {
  return Object.freeze({ kind: 'project' });
}

export function createRouteAddress(routeKey: string): RouteAddress {
  return Object.freeze({ kind: 'route', routeKey: nonBlank(routeKey, 'routeKey') });
}

export function createBiomeAddress(routeKey: string, biomeKey: string): BiomeAddress {
  return Object.freeze({
    kind: 'biome',
    routeKey: nonBlank(routeKey, 'routeKey'),
    biomeKey: nonBlank(biomeKey, 'biomeKey'),
  });
}

export function createBiomeFieldAddress(biome: BiomeAddress, fieldKey: string): BiomeFieldAddress {
  return Object.freeze({
    kind: 'biomeField',
    ...biomeOwner(biome),
    fieldKey: nonBlank(fieldKey, 'fieldKey'),
  });
}

export function createOccurrenceAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): OccurrenceAddress {
  return Object.freeze({ kind: 'occurrence', ...biomeOwner(biome), occurrenceId });
}

export function createCompletionRoomAddress(
  biome: BiomeAddress,
  role: CompletionRoomAddress['role'],
): CompletionRoomAddress {
  if (role !== 'boss' && role !== 'postboss') {
    throw new SemanticAddressContractError('role', `unknown completion role ${String(role)}`);
  }
  return Object.freeze({ kind: 'completionRoom', ...biomeOwner(biome), role });
}

export function createFixedEntryRoomAddress(
  biome: BiomeAddress,
  role: string,
): FixedEntryRoomAddress {
  return Object.freeze({
    kind: 'fixedEntryRoom',
    ...biomeOwner(biome),
    role: nonBlank(role, 'role'),
  });
}

export function createFixedEntryRewardAddress(
  biome: BiomeAddress,
  role: string,
): FixedEntryRewardAddress {
  return Object.freeze({
    kind: 'fixedEntryReward',
    ...biomeOwner(biome),
    role: nonBlank(role, 'role'),
  });
}

export function createFixedEntryTargetAddress(
  biome: BiomeAddress,
  role: string,
): FixedEntryTargetAddress {
  return Object.freeze({
    kind: 'fixedEntryTarget',
    ...biomeOwner(biome),
    role: nonBlank(role, 'role'),
  });
}

export function createContinuationAddress(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId | null,
): ContinuationAddress {
  return Object.freeze({ kind: 'continuation', ...biomeOwner(biome), parentOccurrenceId });
}

export function createBatchRewardStoreAddress(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId | null,
): BatchRewardStoreAddress {
  return Object.freeze({ kind: 'batchRewardStore', ...biomeOwner(biome), parentOccurrenceId });
}

export function createTargetAddress(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId | null,
  exitIndex: number,
): TargetAddress {
  return Object.freeze({
    kind: 'target',
    ...biomeOwner(biome),
    parentOccurrenceId,
    exitIndex: positiveInteger(exitIndex, 'exitIndex'),
  });
}

export function createPickedAddress(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId | null,
): PickedAddress {
  return Object.freeze({ kind: 'picked', ...biomeOwner(biome), parentOccurrenceId });
}

export function createIncomingRewardAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): IncomingRewardAddress {
  return Object.freeze({ kind: 'incomingReward', ...biomeOwner(biome), occurrenceId });
}

export function createLocalRewardAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  groupKey: string,
  slotKey: string,
): LocalRewardAddress {
  return Object.freeze({
    kind: 'localReward',
    ...biomeOwner(biome),
    occurrenceId,
    groupKey: nonBlank(groupKey, 'groupKey'),
    slotKey: nonBlank(slotKey, 'slotKey'),
  });
}

export function createLocalChildAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  groupKey: string,
  slotKey: string,
): LocalChildAddress {
  return Object.freeze({
    kind: 'localChild',
    ...biomeOwner(biome),
    occurrenceId,
    groupKey: nonBlank(groupKey, 'groupKey'),
    slotKey: nonBlank(slotKey, 'slotKey'),
  });
}

export function createLocalChildGroupAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  groupKey: string,
): LocalChildGroupAddress {
  return Object.freeze({
    kind: 'localChildGroup',
    ...biomeOwner(biome),
    occurrenceId,
    groupKey: nonBlank(groupKey, 'groupKey'),
  });
}

export function createRewardWheelAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  wheelKey: string,
): RewardWheelAddress {
  return Object.freeze({
    kind: 'rewardWheel',
    ...biomeOwner(biome),
    occurrenceId,
    wheelKey: nonBlank(wheelKey, 'wheelKey'),
  });
}

export function createRewardWheelOfferAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  wheelKey: string,
  offerKey: string,
): RewardWheelOfferAddress {
  return Object.freeze({
    kind: 'rewardWheelOffer',
    ...biomeOwner(biome),
    occurrenceId,
    wheelKey: nonBlank(wheelKey, 'wheelKey'),
    offerKey: nonBlank(offerKey, 'offerKey'),
  });
}

export function createHubSlotAddress(biome: BiomeAddress, hubSlotKey: string): HubSlotAddress {
  return Object.freeze({
    kind: 'hubSlot',
    ...biomeOwner(biome),
    hubSlotKey: nonBlank(hubSlotKey, 'hubSlotKey'),
  });
}

export function createHubOpenSetAddress(biome: BiomeAddress): HubOpenSetAddress {
  return Object.freeze({ kind: 'hubOpenSet', ...biomeOwner(biome) });
}

export function createHubRoomAddress(biome: BiomeAddress): HubRoomAddress {
  return Object.freeze({ kind: 'hubRoom', ...biomeOwner(biome) });
}

export function createHubVisitAddress(biome: BiomeAddress, visitIndex: number): HubVisitAddress {
  return Object.freeze({
    kind: 'hubVisit',
    ...biomeOwner(biome),
    visitIndex: positiveInteger(visitIndex, 'visitIndex'),
  });
}

export function createShopPurchaseAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  offerKey: string,
): ShopPurchaseAddress {
  return Object.freeze({
    kind: 'shopPurchase',
    ...biomeOwner(biome),
    occurrenceId,
    offerKey: nonBlank(offerKey, 'offerKey'),
  });
}

export function createShopOfferAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  offerKey: string,
): ShopOfferAddress {
  return Object.freeze({
    kind: 'shopOffer',
    ...biomeOwner(biome),
    occurrenceId,
    offerKey: nonBlank(offerKey, 'offerKey'),
  });
}

export function semanticAddressKey(address: SemanticAddress): string {
  switch (address.kind) {
    case 'project':
      return JSON.stringify([address.kind]);
    case 'route':
      return JSON.stringify([address.kind, address.routeKey]);
    case 'biome':
      return JSON.stringify([address.kind, address.routeKey, address.biomeKey]);
    case 'biomeField':
      return JSON.stringify([address.kind, address.routeKey, address.biomeKey, address.fieldKey]);
    case 'occurrence':
    case 'incomingReward':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.occurrenceId,
      ]);
    case 'localReward':
    case 'localChild':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.occurrenceId,
        address.groupKey,
        address.slotKey,
      ]);
    case 'localChildGroup':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.occurrenceId,
        address.groupKey,
      ]);
    case 'rewardWheel':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.occurrenceId,
        address.wheelKey,
      ]);
    case 'rewardWheelOffer':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.occurrenceId,
        address.wheelKey,
        address.offerKey,
      ]);
    case 'hubSlot':
      return JSON.stringify([address.kind, address.routeKey, address.biomeKey, address.hubSlotKey]);
    case 'hubOpenSet':
    case 'hubRoom':
      return JSON.stringify([address.kind, address.routeKey, address.biomeKey]);
    case 'hubVisit':
      return JSON.stringify([address.kind, address.routeKey, address.biomeKey, address.visitIndex]);
    case 'completionRoom':
      return JSON.stringify([address.kind, address.routeKey, address.biomeKey, address.role]);
    case 'fixedEntryRoom':
    case 'fixedEntryReward':
    case 'fixedEntryTarget':
      return JSON.stringify([address.kind, address.routeKey, address.biomeKey, address.role]);
    case 'continuation':
    case 'batchRewardStore':
    case 'picked':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.parentOccurrenceId,
      ]);
    case 'target':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.parentOccurrenceId,
        address.exitIndex,
      ]);
    case 'shopOffer':
    case 'shopPurchase':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeKey,
        address.occurrenceId,
        address.offerKey,
      ]);
  }
}
