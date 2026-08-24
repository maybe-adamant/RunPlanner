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
/** The exact post-encounter Arcana draw owned by an automatic Boss occurrence. */
export interface JudgmentArcanaAddress extends BiomeOwnedAddress {
  readonly kind: 'judgmentArcana';
  readonly occurrenceId: OccurrenceId;
  readonly phaseKey: string;
}
/** A rack selection has exactly one start owner or one automatic Postboss owner. */
export type KeepsakeSelectionAddress =
  | {
      readonly kind: 'keepsakeSelection';
      readonly routeKey: string;
      readonly biomeKey: 'routeStart';
      readonly owner: 'routeStart';
    }
  | {
      readonly kind: 'keepsakeSelection';
      readonly routeKey: string;
      readonly biomeKey: string;
      readonly owner: OccurrenceAddress;
    };

/** Exact succeeding-biome start where Gift Gift Gift may replay its captured keepsake. */
export interface EchoKeepsakeReplayAddress extends BiomeOwnedAddress {
  readonly kind: 'echoKeepsakeReplay';
}

/** One closed immediate result beneath its exact selection, never a trait offer. */
export interface KeepsakeEquipResultAddress {
  readonly kind: 'keepsakeEquipResult';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly selection: KeepsakeSelectionAddress | EchoKeepsakeReplayAddress;
  readonly resultKind: 'jeweledPom' | 'experimentalHammer';
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
/** One exact persisted row in an occurrence's shared action chronology. */
export interface RoomActionAddress extends BiomeOwnedAddress {
  readonly kind: 'roomAction';
  readonly occurrenceId: OccurrenceId;
  readonly actionKey: string;
}
export type RoomActionSemanticAddress = RoomActionAddress;
export type RoomRunStateCheckpoint =
  | { readonly kind: 'roomEntered' }
  | { readonly kind: 'beforeEncounterStart'; readonly phaseKey: string }
  | { readonly kind: 'beforeRoomExit' };
/** Derived room-lifecycle diagnostic owner. It is never authored or persisted. */
export interface RoomRunStateCheckpointAddress extends BiomeOwnedAddress {
  readonly kind: 'roomRunStateCheckpoint';
  readonly occurrenceId: OccurrenceId;
  readonly checkpoint: RoomRunStateCheckpoint;
}
export interface LocalVisitDecisionAddress extends BiomeOwnedAddress {
  readonly kind: 'localVisitDecision';
  readonly sourceOccurrenceId: OccurrenceId;
  readonly groupKey: string;
}
export interface LocalVisitSlotAddress extends BiomeOwnedAddress {
  readonly kind: 'localVisitSlot';
  readonly sourceOccurrenceId: OccurrenceId;
  readonly groupKey: string;
  readonly slotKey: string;
}
export interface LocalVisitOrderAddress extends BiomeOwnedAddress {
  readonly kind: 'localVisitOrder';
  readonly sourceOccurrenceId: OccurrenceId;
  readonly groupKey: string;
}
export type EncounterPhaseOwner = {
  readonly kind: 'occurrence';
  readonly occurrenceId: OccurrenceId;
};
export interface EncounterPhaseAddress extends BiomeOwnedAddress {
  readonly kind: 'encounterPhase';
  readonly owner: EncounterPhaseOwner;
  readonly phaseKey: string;
}
/** Exact additive Gorgon child owned beneath one encounter phase. */
export interface GorgonPhaseAddress extends BiomeOwnedAddress {
  readonly kind: 'gorgonPhase';
  readonly encounter: EncounterPhaseAddress;
  /** Convenience narrowing for generic owner consumers. */
  readonly occurrenceId: OccurrenceId;
}
/** Exact phase-local child of the one selected Nemesis random-event identity. */
export interface NemesisRandomEventAddress extends BiomeOwnedAddress {
  readonly kind: 'nemesisRandomEvent';
  readonly encounter: EncounterPhaseAddress;
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
export interface ShopOfferAddress extends BiomeOwnedAddress {
  readonly kind: 'shopOffer';
  readonly occurrenceId: OccurrenceId;
  readonly offerKey: string;
}

/** One exact reached acquisition checkpoint. The source remains the offer owner. */
export type AcquisitionSiteOwnerAddress =
  | OccurrenceAddress
  | LocalRewardAddress
  | RewardWheelAddress
  | HubVisitAddress
  | EchoLastRewardAddress;
export interface AcquisitionSiteAddress extends BiomeOwnedAddress {
  readonly kind: 'acquisitionSite';
  readonly owner: AcquisitionSiteOwnerAddress;
  readonly pointKey: string;
}
/** One atomic, chronologically addressable acquisition at a settlement site. */
export interface AcquisitionEntryAddress extends BiomeOwnedAddress {
  readonly kind: 'acquisitionEntry';
  readonly site: AcquisitionSiteAddress;
  readonly entryKey: string;
}

export type TraitOfferOwnerAddress =
  | IncomingRewardAddress
  | LocalRewardAddress
  | RewardWheelOfferAddress
  | ShopOfferAddress
  | EncounterPhaseAddress
  | GorgonPhaseAddress
  | GorgonPhaseAddress
  | AcquisitionEntryAddress;

export interface TraitOfferAddress extends BiomeOwnedAddress {
  readonly kind: 'traitOffer';
  readonly owner: TraitOfferOwnerAddress;
  readonly acquisitionRole: string;
}
/** Exact reward acquisition role; unlike a trait offer it exists for every concrete role. */
export interface AcquisitionRoleAddress extends BiomeOwnedAddress {
  readonly kind: 'acquisitionRole';
  readonly owner: TraitOfferOwnerAddress;
  readonly acquisitionRole: string;
}
/** One selected Circe option's exact Arcana/Fear outcome beneath its offer. */
export interface CirceResolutionAddress extends BiomeOwnedAddress {
  readonly kind: 'circeResolution';
  readonly trait: TraitOfferAddress;
  readonly optionKey: 'option1' | 'option2' | 'option3';
}
/** One selected targeted acquisition's exact post-outer outcome. */
export interface TraitAcquisitionTargetAddress extends BiomeOwnedAddress {
  readonly kind: 'traitAcquisitionTarget';
  readonly trait: TraitOfferAddress;
  readonly optionKey: 'option1' | 'option2' | 'option3';
}
/** Echo Pom's selected target/no-target child beneath the selected outer row. */
export interface EchoPomTargetAddress extends BiomeOwnedAddress {
  readonly kind: 'echoPomTarget';
  readonly trait: TraitOfferAddress;
  readonly optionKey: 'option1' | 'option2' | 'option3';
}
/** Natural Selection's single ordered successful-increment result. */
export interface NaturalSelectionResultAddress extends BiomeOwnedAddress {
  readonly kind: 'naturalSelectionResult';
  readonly trait: TraitOfferAddress;
  readonly optionKey: 'option1' | 'option2' | 'option3';
}
/** One automatic end-effects rarity outcome, owned by an ordinary or automatic Boss phase. */
export interface SteadyGrowthOutcomeAddress extends BiomeOwnedAddress {
  readonly kind: 'steadyGrowthOutcome';
  /**
   * The ordinary occurrence or automatic Boss that emitted the end-effects
   * checkpoint. `phaseKey` below is the sole phase identity; keeping an
   * EncounterPhaseAddress here would permit contradictory double phase keys.
   */
  readonly owner: OccurrenceAddress;
  readonly phaseKey: string;
}
/** Echo Boon Boon Boon's complete mixed-provider child beneath the selected outer row. */
export interface EchoLastRunBoonAddress extends BiomeOwnedAddress {
  readonly kind: 'echoLastRunBoon';
  readonly trait: TraitOfferAddress;
  readonly optionKey: 'option1' | 'option2' | 'option3';
}
/** Echo Reward's derived recreation owner beneath the selected outer row. */
export interface EchoLastRewardAddress extends BiomeOwnedAddress {
  readonly kind: 'echoLastReward';
  readonly trait: TraitOfferAddress;
  readonly optionKey: 'option1' | 'option2' | 'option3';
}
/** One exact source-set result beneath an All Together option. */
export interface AllTogetherSetAddress extends BiomeOwnedAddress {
  readonly kind: 'allTogetherSet';
  readonly trait: TraitOfferAddress;
  readonly optionKey: 'option1' | 'option2' | 'option3';
  readonly setKey: import('../catalog-schema').DirectTraitSetKey;
}
export interface LevelResolutionAddress extends BiomeOwnedAddress {
  readonly kind: 'levelResolution';
  readonly owner: TraitOfferOwnerAddress;
  readonly acquisitionRole: string;
}

export type SemanticAddress =
  | ProjectAddress
  | RouteAddress
  | BiomeAddress
  | BiomeFieldAddress
  | OccurrenceAddress
  | IncomingRewardAddress
  | JudgmentArcanaAddress
  | KeepsakeSelectionAddress
  | EchoKeepsakeReplayAddress
  | KeepsakeEquipResultAddress
  | ExitDecisionAddress
  | ExitSelectionAddress
  | BatchRewardStoreAddress
  | TargetAddress
  | AdditionalExitAddress
  | HubDecisionAddress
  | LocalRewardAddress
  | RoomActionAddress
  | RoomRunStateCheckpointAddress
  | LocalVisitDecisionAddress
  | LocalVisitSlotAddress
  | LocalVisitOrderAddress
  | EncounterPhaseAddress
  | GorgonPhaseAddress
  | NemesisRandomEventAddress
  | RewardWheelAddress
  | RewardWheelOfferAddress
  | HubSlotAddress
  | HubOpenSetAddress
  | HubRoomAddress
  | HubVisitAddress
  | ShopOfferAddress
  | AcquisitionSiteAddress
  | AcquisitionEntryAddress
  | TraitOfferAddress
  | AcquisitionRoleAddress
  | TraitAcquisitionTargetAddress
  | NaturalSelectionResultAddress
  | SteadyGrowthOutcomeAddress
  | CirceResolutionAddress
  | EchoPomTargetAddress
  | EchoLastRunBoonAddress
  | EchoLastRewardAddress
  | AllTogetherSetAddress
  | LevelResolutionAddress;

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
export function createJudgmentArcanaAddress(
  occurrence: OccurrenceAddress,
  phaseKey: string,
): JudgmentArcanaAddress {
  return Object.freeze({
    kind: 'judgmentArcana',
    routeKey: occurrence.routeKey,
    biomeKey: occurrence.biomeKey,
    occurrenceId: occurrence.occurrenceId,
    phaseKey: nonBlank(phaseKey, 'phaseKey'),
  });
}
export function createRouteStartKeepsakeSelectionAddress(
  routeKey: string,
): Extract<KeepsakeSelectionAddress, { readonly owner: 'routeStart' }> {
  return Object.freeze({
    kind: 'keepsakeSelection',
    routeKey: nonBlank(routeKey, 'routeKey'),
    biomeKey: 'routeStart' as const,
    owner: 'routeStart',
  });
}
export function createPostbossKeepsakeSelectionAddress(
  occurrence: OccurrenceAddress,
): Extract<KeepsakeSelectionAddress, { readonly owner: OccurrenceAddress }> {
  return Object.freeze({
    kind: 'keepsakeSelection',
    routeKey: occurrence.routeKey,
    biomeKey: occurrence.biomeKey,
    owner: occurrence,
  });
}
export function createKeepsakeEquipResultAddress<
  ResultKind extends KeepsakeEquipResultAddress['resultKind'],
>(
  selection: KeepsakeSelectionAddress | EchoKeepsakeReplayAddress,
  resultKind: ResultKind,
): KeepsakeEquipResultAddress & { readonly resultKind: ResultKind } {
  return Object.freeze({
    kind: 'keepsakeEquipResult',
    routeKey: selection.routeKey,
    biomeKey: selection.biomeKey,
    selection,
    resultKind,
  });
}
export function createEchoKeepsakeReplayAddress(biome: BiomeAddress): EchoKeepsakeReplayAddress {
  return Object.freeze({ kind: 'echoKeepsakeReplay', ...owner(biome) });
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
export function createRoomActionAddress(
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  actionKey: string,
): RoomActionAddress {
  return Object.freeze({
    kind: 'roomAction',
    ...owner(biome),
    occurrenceId,
    actionKey: nonBlank(actionKey, 'actionKey'),
  });
}
export function createRoomRunStateCheckpointAddress(
  occurrence: OccurrenceAddress,
  checkpoint: RoomRunStateCheckpoint,
): RoomRunStateCheckpointAddress {
  return Object.freeze({
    kind: 'roomRunStateCheckpoint',
    routeKey: occurrence.routeKey,
    biomeKey: occurrence.biomeKey,
    occurrenceId: occurrence.occurrenceId,
    checkpoint:
      checkpoint.kind === 'beforeEncounterStart'
        ? Object.freeze({
            kind: checkpoint.kind,
            phaseKey: nonBlank(checkpoint.phaseKey, 'phaseKey'),
          })
        : Object.freeze({ kind: checkpoint.kind }),
  });
}
export function createLocalVisitDecisionAddress(
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  groupKey: string,
): LocalVisitDecisionAddress {
  return Object.freeze({
    kind: 'localVisitDecision',
    ...owner(biome),
    sourceOccurrenceId,
    groupKey: nonBlank(groupKey, 'groupKey'),
  });
}
export function createLocalVisitSlotAddress(
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  groupKey: string,
  slotKey: string,
): LocalVisitSlotAddress {
  return Object.freeze({
    kind: 'localVisitSlot',
    ...owner(biome),
    sourceOccurrenceId,
    groupKey: nonBlank(groupKey, 'groupKey'),
    slotKey: nonBlank(slotKey, 'slotKey'),
  });
}
export function createLocalVisitOrderAddress(
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  groupKey: string,
): LocalVisitOrderAddress {
  return Object.freeze({
    kind: 'localVisitOrder',
    ...owner(biome),
    sourceOccurrenceId,
    groupKey: nonBlank(groupKey, 'groupKey'),
  });
}
export function createEncounterPhaseAddress(
  biome: BiomeAddress,
  encounterOwner: EncounterPhaseOwner,
  phaseKey: string,
): EncounterPhaseAddress {
  const normalizedOwner = Object.freeze({
    kind: 'occurrence' as const,
    occurrenceId: encounterOwner.occurrenceId,
  });
  return Object.freeze({
    kind: 'encounterPhase',
    ...owner(biome),
    owner: normalizedOwner,
    phaseKey: nonBlank(phaseKey, 'phaseKey'),
  });
}
export function createGorgonPhaseAddress(encounter: EncounterPhaseAddress): GorgonPhaseAddress {
  const address = {
    kind: 'gorgonPhase',
    routeKey: encounter.routeKey,
    biomeKey: encounter.biomeKey,
    encounter,
  } as GorgonPhaseAddress;
  Object.defineProperty(address, 'occurrenceId', {
    configurable: false,
    enumerable: false,
    value: encounter.owner.occurrenceId,
    writable: false,
  });
  return Object.freeze(address);
}
export function createNemesisRandomEventAddress(
  encounter: EncounterPhaseAddress,
): NemesisRandomEventAddress {
  return Object.freeze({
    kind: 'nemesisRandomEvent',
    routeKey: encounter.routeKey,
    biomeKey: encounter.biomeKey,
    encounter,
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

export function createAcquisitionSiteAddress(
  ownerAddress: AcquisitionSiteOwnerAddress,
  pointKey: string,
): AcquisitionSiteAddress {
  return Object.freeze({
    kind: 'acquisitionSite',
    routeKey: ownerAddress.routeKey,
    biomeKey: ownerAddress.biomeKey,
    owner: ownerAddress,
    pointKey: nonBlank(pointKey, 'pointKey'),
  });
}

export function createAcquisitionEntryAddress(
  site: AcquisitionSiteAddress,
  entryKey: string,
): AcquisitionEntryAddress {
  return Object.freeze({
    kind: 'acquisitionEntry',
    routeKey: site.routeKey,
    biomeKey: site.biomeKey,
    site,
    entryKey: nonBlank(entryKey, 'entryKey'),
  });
}

export function createTraitOfferAddress(
  ownerAddress: TraitOfferOwnerAddress,
  acquisitionRole: string,
): TraitOfferAddress {
  return Object.freeze({
    kind: 'traitOffer',
    routeKey: ownerAddress.routeKey,
    biomeKey: ownerAddress.biomeKey,
    owner: ownerAddress,
    acquisitionRole: nonBlank(acquisitionRole, 'acquisitionRole'),
  });
}
export function createAcquisitionRoleAddress(
  ownerAddress: TraitOfferOwnerAddress,
  acquisitionRole: string,
): AcquisitionRoleAddress {
  return Object.freeze({
    kind: 'acquisitionRole',
    routeKey: ownerAddress.routeKey,
    biomeKey: ownerAddress.biomeKey,
    owner: ownerAddress,
    acquisitionRole: nonBlank(acquisitionRole, 'acquisitionRole'),
  });
}
export function createCirceResolutionAddress(
  trait: TraitOfferAddress,
  optionKey: CirceResolutionAddress['optionKey'],
): CirceResolutionAddress {
  return Object.freeze({
    kind: 'circeResolution',
    routeKey: trait.routeKey,
    biomeKey: trait.biomeKey,
    trait,
    optionKey,
  });
}
export function createTraitAcquisitionTargetAddress(
  trait: TraitOfferAddress,
  optionKey: TraitAcquisitionTargetAddress['optionKey'],
): TraitAcquisitionTargetAddress {
  return Object.freeze({
    kind: 'traitAcquisitionTarget',
    routeKey: trait.routeKey,
    biomeKey: trait.biomeKey,
    trait,
    optionKey,
  });
}
export function createEchoPomTargetAddress(
  trait: TraitOfferAddress,
  optionKey: EchoPomTargetAddress['optionKey'],
): EchoPomTargetAddress {
  return Object.freeze({
    kind: 'echoPomTarget',
    routeKey: trait.routeKey,
    biomeKey: trait.biomeKey,
    trait,
    optionKey,
  });
}
export function createNaturalSelectionResultAddress(
  trait: TraitOfferAddress,
  optionKey: NaturalSelectionResultAddress['optionKey'],
): NaturalSelectionResultAddress {
  return Object.freeze({
    kind: 'naturalSelectionResult',
    routeKey: trait.routeKey,
    biomeKey: trait.biomeKey,
    trait,
    optionKey,
  });
}
export function createSteadyGrowthOutcomeAddress(
  owner: SteadyGrowthOutcomeAddress['owner'],
  phaseKey: string,
): SteadyGrowthOutcomeAddress {
  return Object.freeze({
    kind: 'steadyGrowthOutcome',
    routeKey: owner.routeKey,
    biomeKey: owner.biomeKey,
    owner,
    phaseKey: nonBlank(phaseKey, 'phaseKey'),
  });
}
export function createEchoLastRunBoonAddress(
  trait: TraitOfferAddress,
  optionKey: EchoLastRunBoonAddress['optionKey'],
): EchoLastRunBoonAddress {
  return Object.freeze({
    kind: 'echoLastRunBoon',
    routeKey: trait.routeKey,
    biomeKey: trait.biomeKey,
    trait,
    optionKey,
  });
}
export function createEchoLastRewardAddress(
  trait: TraitOfferAddress,
  optionKey: EchoLastRewardAddress['optionKey'],
): EchoLastRewardAddress {
  return Object.freeze({
    kind: 'echoLastReward',
    routeKey: trait.routeKey,
    biomeKey: trait.biomeKey,
    trait,
    optionKey,
  });
}
export function createAllTogetherSetAddress(
  trait: TraitOfferAddress,
  optionKey: AllTogetherSetAddress['optionKey'],
  setKey: AllTogetherSetAddress['setKey'],
): AllTogetherSetAddress {
  return Object.freeze({
    kind: 'allTogetherSet',
    routeKey: trait.routeKey,
    biomeKey: trait.biomeKey,
    trait,
    optionKey,
    setKey,
  });
}
export function createLevelResolutionAddress(
  ownerAddress: TraitOfferOwnerAddress,
  acquisitionRole: string,
): LevelResolutionAddress {
  return Object.freeze({
    kind: 'levelResolution',
    routeKey: ownerAddress.routeKey,
    biomeKey: ownerAddress.biomeKey,
    owner: ownerAddress,
    acquisitionRole: nonBlank(acquisitionRole, 'acquisitionRole'),
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
    case 'echoKeepsakeReplay':
      return JSON.stringify(base);
    case 'biomeField':
      return JSON.stringify([...base, address.fieldKey]);
    case 'keepsakeEquipResult':
      return JSON.stringify([...base, semanticAddressKey(address.selection), address.resultKind]);
    case 'occurrence':
    case 'incomingReward':
      return JSON.stringify([...base, address.occurrenceId]);
    case 'judgmentArcana':
      return JSON.stringify([...base, address.occurrenceId, address.phaseKey]);
    case 'keepsakeSelection':
      return JSON.stringify([
        address.kind,
        address.routeKey,
        address.owner === 'routeStart' ? address.owner : semanticAddressKey(address.owner),
      ]);
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
      return JSON.stringify([...base, address.occurrenceId, address.groupKey, address.slotKey]);
    case 'roomAction':
      return JSON.stringify([...base, address.occurrenceId, address.actionKey]);
    case 'roomRunStateCheckpoint':
      return JSON.stringify([
        ...base,
        address.occurrenceId,
        address.checkpoint.kind,
        ...(address.checkpoint.kind === 'beforeEncounterStart'
          ? [address.checkpoint.phaseKey]
          : []),
      ]);
    case 'localVisitDecision':
    case 'localVisitOrder':
      return JSON.stringify([...base, address.sourceOccurrenceId, address.groupKey]);
    case 'localVisitSlot':
      return JSON.stringify([
        ...base,
        address.sourceOccurrenceId,
        address.groupKey,
        address.slotKey,
      ]);
    case 'encounterPhase':
      return JSON.stringify([...base, address.owner, address.phaseKey]);
    case 'gorgonPhase':
      return JSON.stringify([...base, semanticAddressKey(address.encounter)]);
    case 'nemesisRandomEvent':
      return JSON.stringify([...base, semanticAddressKey(address.encounter)]);
    case 'rewardWheel':
      return JSON.stringify([...base, address.occurrenceId, address.wheelKey]);
    case 'rewardWheelOffer':
      return JSON.stringify([...base, address.occurrenceId, address.wheelKey, address.offerKey]);
    case 'shopOffer':
      return JSON.stringify([...base, address.occurrenceId, address.offerKey]);
    case 'acquisitionSite':
      return JSON.stringify([...base, semanticAddressKey(address.owner), address.pointKey]);
    case 'acquisitionEntry':
      return JSON.stringify([...base, semanticAddressKey(address.site), address.entryKey]);
    case 'traitOffer':
    case 'acquisitionRole':
      return JSON.stringify([...base, semanticAddressKey(address.owner), address.acquisitionRole]);
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'naturalSelectionResult':
    case 'echoLastRunBoon':
    case 'echoLastReward':
      return JSON.stringify([...base, semanticAddressKey(address.trait), address.optionKey]);
    case 'steadyGrowthOutcome':
      return JSON.stringify([...base, semanticAddressKey(address.owner), address.phaseKey]);
    case 'allTogetherSet':
      return JSON.stringify([
        ...base,
        semanticAddressKey(address.trait),
        address.optionKey,
        address.setKey,
      ]);
    case 'levelResolution':
      return JSON.stringify([...base, semanticAddressKey(address.owner), address.acquisitionRole]);
  }
}
