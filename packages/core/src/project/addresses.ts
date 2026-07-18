import type { OccurrenceId } from './model';

interface BiomeOwnedAddress {
  readonly routeKey: string;
  readonly biomeStepKey: string;
}

export interface BiomeAddress extends BiomeOwnedAddress {
  readonly kind: 'biome';
}

export interface OccurrenceAddress extends BiomeOwnedAddress {
  readonly kind: 'occurrence';
  readonly occurrenceId: OccurrenceId;
}

export interface ContinuationAddress extends BiomeOwnedAddress {
  readonly kind: 'continuation';
  readonly parentOccurrenceId: OccurrenceId;
}

export interface TargetAddress extends BiomeOwnedAddress {
  readonly kind: 'target';
  readonly parentOccurrenceId: OccurrenceId;
  readonly exitIndex: number;
}

export interface PickedAddress extends BiomeOwnedAddress {
  readonly kind: 'picked';
  readonly parentOccurrenceId: OccurrenceId;
}

export interface IncomingRewardAddress extends BiomeOwnedAddress {
  readonly kind: 'incomingReward';
  readonly occurrenceId: OccurrenceId;
}

export interface ShopPurchaseAddress extends BiomeOwnedAddress {
  readonly kind: 'shopPurchase';
  readonly occurrenceId: OccurrenceId;
  readonly offerKey: string;
}

export type SemanticAddress =
  | BiomeAddress
  | ContinuationAddress
  | IncomingRewardAddress
  | OccurrenceAddress
  | PickedAddress
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
  return { routeKey: address.routeKey, biomeStepKey: address.biomeStepKey };
}

export function createOccurrenceId(value: string): OccurrenceId {
  return nonBlank(value, 'occurrenceId') as OccurrenceId;
}

export function createBiomeAddress(routeKey: string, biomeStepKey: string): BiomeAddress {
  return Object.freeze({
    kind: 'biome',
    routeKey: nonBlank(routeKey, 'routeKey'),
    biomeStepKey: nonBlank(biomeStepKey, 'biomeStepKey'),
  });
}

export function createOccurrenceAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): OccurrenceAddress {
  return Object.freeze({ kind: 'occurrence', ...biomeOwner(biome), occurrenceId });
}

export function createContinuationAddress(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId,
): ContinuationAddress {
  return Object.freeze({ kind: 'continuation', ...biomeOwner(biome), parentOccurrenceId });
}

export function createTargetAddress(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId,
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
  parentOccurrenceId: OccurrenceId,
): PickedAddress {
  return Object.freeze({ kind: 'picked', ...biomeOwner(biome), parentOccurrenceId });
}

export function createIncomingRewardAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): IncomingRewardAddress {
  return Object.freeze({ kind: 'incomingReward', ...biomeOwner(biome), occurrenceId });
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

export function semanticAddressKey(address: SemanticAddress): string {
  switch (address.kind) {
    case 'biome':
      return JSON.stringify([address.kind, address.routeKey, address.biomeStepKey]);
    case 'occurrence':
    case 'incomingReward':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeStepKey,
        address.occurrenceId,
      ]);
    case 'continuation':
    case 'picked':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeStepKey,
        address.parentOccurrenceId,
      ]);
    case 'target':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeStepKey,
        address.parentOccurrenceId,
        address.exitIndex,
      ]);
    case 'shopPurchase':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.biomeStepKey,
        address.occurrenceId,
        address.offerKey,
      ]);
  }
}
