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
export interface IncomingRewardAddress extends BiomeOwnedAddress {
  readonly kind: 'incomingReward';
  readonly occurrenceId: OccurrenceId;
}
export interface CompletionRoomAddress extends BiomeOwnedAddress {
  readonly kind: 'completionRoom';
  readonly role: 'boss' | 'postboss';
}

export type ExitDecisionSourceAddress =
  | { readonly kind: 'occurrence'; readonly occurrenceId: OccurrenceId }
  | { readonly kind: 'hubDecision'; readonly decisionKey: string };

export interface ExitDecisionAddress extends BiomeOwnedAddress {
  readonly kind: 'exitDecision';
  readonly source: ExitDecisionSourceAddress;
}

export interface ExitSelectionAddress extends BiomeOwnedAddress {
  readonly kind: 'exitSelection';
  readonly source: ExitDecisionSourceAddress;
}

export interface BatchRewardStoreAddress extends BiomeOwnedAddress {
  readonly kind: 'batchRewardStore';
  readonly source: ExitDecisionSourceAddress;
}

export interface TargetAddress extends BiomeOwnedAddress {
  readonly kind: 'target';
  readonly source: ExitDecisionSourceAddress;
  readonly exitKey: string;
}

/** A closed, first-class owner for one authored additional continuation. */
export interface AdditionalExitAddress extends BiomeOwnedAddress {
  readonly kind: 'additionalExit';
  readonly occurrenceId: OccurrenceId;
  readonly additionalExitKey: string;
}

export interface HubDecisionAddress extends BiomeOwnedAddress {
  readonly kind: 'hubDecision';
  readonly hubKey: string;
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
export type EncounterPhaseOwner =
  | { readonly kind: 'occurrence'; readonly occurrenceId: OccurrenceId }
  | {
      readonly kind: 'localChild';
      readonly occurrenceId: OccurrenceId;
      readonly groupKey: string;
      readonly slotKey: string;
    };
export interface EncounterPhaseAddress extends BiomeOwnedAddress {
  readonly kind: 'encounterPhase';
  readonly owner: EncounterPhaseOwner;
  readonly phaseKey: string;
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
  readonly hubKey: string;
  readonly hubSlotKey: string;
}
export interface HubOpenSetAddress extends BiomeOwnedAddress {
  readonly kind: 'hubOpenSet';
  readonly hubKey: string;
}
export interface HubRoomAddress extends BiomeOwnedAddress {
  readonly kind: 'hubRoom';
  readonly hubKey: string;
}
export interface HubVisitAddress extends BiomeOwnedAddress {
  readonly kind: 'hubVisit';
  readonly hubKey: string;
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
  | OccurrenceAddress
  | IncomingRewardAddress
  | CompletionRoomAddress
  | ExitDecisionAddress
  | ExitSelectionAddress
  | BatchRewardStoreAddress
  | TargetAddress
  | AdditionalExitAddress
  | HubDecisionAddress
  | LocalRewardAddress
  | LocalChildAddress
  | LocalChildGroupAddress
  | EncounterPhaseAddress
  | RewardWheelAddress
  | RewardWheelOfferAddress
  | HubSlotAddress
  | HubOpenSetAddress
  | HubRoomAddress
  | HubVisitAddress
  | ShopPurchaseAddress
  | ShopOfferAddress;

export class SemanticAddressContractError extends Error {
  constructor(
    readonly field: string,
    readonly detail: string,
  ) {
    super(`${field}: ${detail}`);
    this.name = 'SemanticAddressContractError';
  }
}

function nonBlank(value: string, field: string): string {
  if (value.trim().length === 0) throw new SemanticAddressContractError(field, 'must not be blank');
  return value;
}
function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0)
    throw new SemanticAddressContractError(field, 'must be a positive integer');
  return value;
}
function owner(biome: BiomeAddress): BiomeOwnedAddress {
  return { routeKey: biome.routeKey, biomeKey: biome.biomeKey };
}
function source(value: ExitDecisionSourceAddress): ExitDecisionSourceAddress {
  if (value.kind === 'occurrence')
    return Object.freeze({ kind: 'occurrence', occurrenceId: value.occurrenceId });
  if (value.kind === 'hubDecision')
    return Object.freeze({
      kind: 'hubDecision',
      decisionKey: nonBlank(value.decisionKey, 'decisionKey'),
    });
  throw new SemanticAddressContractError(
    'source.kind',
    `unknown exit decision source ${String((value as { kind?: unknown }).kind)}`,
  );
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
    ...owner(biome),
    fieldKey: nonBlank(fieldKey, 'fieldKey'),
  });
}
export function createOccurrenceAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): OccurrenceAddress {
  return Object.freeze({ kind: 'occurrence', ...owner(biome), occurrenceId });
}
export function createCompletionRoomAddress(
  biome: BiomeAddress,
  role: CompletionRoomAddress['role'],
): CompletionRoomAddress {
  return Object.freeze({ kind: 'completionRoom', ...owner(biome), role });
}
export function createExitDecisionAddress(
  biome: BiomeAddress,
  decisionSource: ExitDecisionSourceAddress,
): ExitDecisionAddress {
  return Object.freeze({ kind: 'exitDecision', ...owner(biome), source: source(decisionSource) });
}
export function createExitSelectionAddress(
  biome: BiomeAddress,
  decisionSource: ExitDecisionSourceAddress,
): ExitSelectionAddress {
  return Object.freeze({ kind: 'exitSelection', ...owner(biome), source: source(decisionSource) });
}
export function createBatchRewardStoreAddress(
  biome: BiomeAddress,
  decisionSource: ExitDecisionSourceAddress,
): BatchRewardStoreAddress {
  return Object.freeze({
    kind: 'batchRewardStore',
    ...owner(biome),
    source: source(decisionSource),
  });
}
export function createTargetAddress(
  biome: BiomeAddress,
  decisionSource: ExitDecisionSourceAddress,
  exitKey: string,
): TargetAddress {
  return Object.freeze({
    kind: 'target',
    ...owner(biome),
    source: source(decisionSource),
    exitKey: nonBlank(exitKey, 'exitKey'),
  });
}
export function createAdditionalExitAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  additionalExitKey: string,
): AdditionalExitAddress {
  return Object.freeze({
    kind: 'additionalExit',
    ...owner(biome),
    occurrenceId,
    additionalExitKey: nonBlank(additionalExitKey, 'additionalExitKey'),
  });
}
export function createHubDecisionAddress(biome: BiomeAddress, hubKey: string): HubDecisionAddress {
  return Object.freeze({
    kind: 'hubDecision',
    ...owner(biome),
    hubKey: nonBlank(hubKey, 'hubKey'),
  });
}
export function createIncomingRewardAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): IncomingRewardAddress {
  return Object.freeze({ kind: 'incomingReward', ...owner(biome), occurrenceId });
}
export function createLocalRewardAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  groupKey: string,
  slotKey: string,
): LocalRewardAddress {
  return Object.freeze({
    kind: 'localReward',
    ...owner(biome),
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
    ...owner(biome),
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
    ...owner(biome),
    occurrenceId,
    groupKey: nonBlank(groupKey, 'groupKey'),
  });
}
export function createEncounterPhaseAddress(
  biome: BiomeAddress,
  encounterOwner: EncounterPhaseOwner,
  phaseKey: string,
): EncounterPhaseAddress {
  const normalizedOwner =
    encounterOwner.kind === 'occurrence'
      ? Object.freeze({ kind: 'occurrence' as const, occurrenceId: encounterOwner.occurrenceId })
      : Object.freeze({
          kind: 'localChild' as const,
          occurrenceId: encounterOwner.occurrenceId,
          groupKey: nonBlank(encounterOwner.groupKey, 'groupKey'),
          slotKey: nonBlank(encounterOwner.slotKey, 'slotKey'),
        });
  return Object.freeze({
    kind: 'encounterPhase',
    ...owner(biome),
    owner: normalizedOwner,
    phaseKey: nonBlank(phaseKey, 'phaseKey'),
  });
}
export function createRewardWheelAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  wheelKey: string,
): RewardWheelAddress {
  return Object.freeze({
    kind: 'rewardWheel',
    ...owner(biome),
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
    ...owner(biome),
    occurrenceId,
    wheelKey: nonBlank(wheelKey, 'wheelKey'),
    offerKey: nonBlank(offerKey, 'offerKey'),
  });
}
export function createHubSlotAddress(
  biome: BiomeAddress,
  hubKey: string,
  hubSlotKey: string,
): HubSlotAddress {
  return Object.freeze({
    kind: 'hubSlot',
    ...owner(biome),
    hubKey: nonBlank(hubKey, 'hubKey'),
    hubSlotKey: nonBlank(hubSlotKey, 'hubSlotKey'),
  });
}
export function createHubOpenSetAddress(biome: BiomeAddress, hubKey: string): HubOpenSetAddress {
  return Object.freeze({ kind: 'hubOpenSet', ...owner(biome), hubKey: nonBlank(hubKey, 'hubKey') });
}
export function createHubRoomAddress(biome: BiomeAddress, hubKey: string): HubRoomAddress {
  return Object.freeze({ kind: 'hubRoom', ...owner(biome), hubKey: nonBlank(hubKey, 'hubKey') });
}
export function createHubVisitAddress(
  biome: BiomeAddress,
  hubKey: string,
  visitIndex: number,
): HubVisitAddress {
  return Object.freeze({
    kind: 'hubVisit',
    ...owner(biome),
    hubKey: nonBlank(hubKey, 'hubKey'),
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
    ...owner(biome),
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
    ...owner(biome),
    occurrenceId,
    offerKey: nonBlank(offerKey, 'offerKey'),
  });
}

export function semanticAddressKey(address: SemanticAddress): string {
  const base = [
    address.kind,
    'routeKey' in address ? address.routeKey : undefined,
    'biomeKey' in address ? address.biomeKey : undefined,
  ];
  switch (address.kind) {
    case 'project':
      return JSON.stringify([address.kind]);
    case 'route':
      return JSON.stringify([address.kind, address.routeKey]);
    case 'biome':
      return JSON.stringify(base);
    case 'biomeField':
      return JSON.stringify([...base, address.fieldKey]);
    case 'occurrence':
    case 'incomingReward':
      return JSON.stringify([...base, address.occurrenceId]);
    case 'completionRoom':
      return JSON.stringify([...base, address.role]);
    case 'exitDecision':
    case 'exitSelection':
    case 'batchRewardStore':
      return JSON.stringify([...base, address.source]);
    case 'target':
      return JSON.stringify([...base, address.source, address.exitKey]);
    case 'additionalExit':
      return JSON.stringify([...base, address.occurrenceId, address.additionalExitKey]);
    case 'hubDecision':
      return JSON.stringify([...base, address.hubKey]);
    case 'hubSlot':
      return JSON.stringify([...base, address.hubKey, address.hubSlotKey]);
    case 'hubOpenSet':
    case 'hubRoom':
      return JSON.stringify([...base, address.hubKey]);
    case 'hubVisit':
      return JSON.stringify([...base, address.hubKey, address.visitIndex]);
    case 'localReward':
    case 'localChild':
      return JSON.stringify([...base, address.occurrenceId, address.groupKey, address.slotKey]);
    case 'localChildGroup':
      return JSON.stringify([...base, address.occurrenceId, address.groupKey]);
    case 'encounterPhase':
      return JSON.stringify([...base, address.owner, address.phaseKey]);
    case 'rewardWheel':
      return JSON.stringify([...base, address.occurrenceId, address.wheelKey]);
    case 'rewardWheelOffer':
      return JSON.stringify([...base, address.occurrenceId, address.wheelKey, address.offerKey]);
    case 'shopOffer':
    case 'shopPurchase':
      return JSON.stringify([...base, address.occurrenceId, address.offerKey]);
  }
}
