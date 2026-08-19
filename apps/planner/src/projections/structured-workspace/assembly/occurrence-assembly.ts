import {
  createAcquisitionSiteAddress,
  createAdditionalExitAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRoomActionAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createTraitOfferAddress,
  createGorgonPhaseAddress,
  materializeGorgonAthenaOffer,
  createCirceResolutionAddress,
  createTraitAcquisitionTargetAddress,
  createEchoPomTargetAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createAllTogetherSetAddress,
  createLevelResolutionAddress,
  createAcquisitionRoleAddress,
  traitOfferOption,
  traitGiverUsesOfferContext,
  semanticAddressKey,
  type BiomeAddress,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type EncounterPhaseAddress,
  type RoomOccurrence,
  type SemanticAddress,
  type AuthoredRewardState,
  type LevelResolutionAddress,
  roomActionKey,
  acquisitionSiteFromStorageKey,
  parseArtificerReplacementEntryKey,
  selectedPickupProducer,
  echoLastRewardPickupEntryKey,
  echoLastRewardPickupEntryKeys,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '@run-planner/engine/authored-project';
import { traitGiverForAcquisitionRole } from '@run-planner/engine/authored-project';
import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  CanonicalAuthoredRoom,
  EncounterPhaseSequenceStatus,
  FigLeafPhaseCandidateSupport,
  GorgonPhaseCandidateSupport,
  FieldsBatchFacts,
  SelectedLevelResolutionAssessment,
} from '@run-planner/engine/simulation';
import {
  encounterPhaseAuthoringDomainForRoom,
  type EncounterPhaseAuthoringRoomOptions,
} from '@run-planner/engine/simulation';

import type {
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '@planner/projections/candidateProjection';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';

import {
  requireWorkspaceRoom as requireRoom,
  resolveWorkspaceFixedRewardOffer,
} from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceEncounterPhase,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceRewardControl,
  type WorkspaceExplicitRewardControl,
  type WorkspaceShopConditionControl,
  type WorkspaceShopPurchaseDescriptor,
  type WorkspaceTraitOfferControl,
  type WorkspaceAcquisitionConversionControl,
  type WorkspaceLevelResolutionControl,
  type WorkspaceRoomLocal,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
  type WorkspaceRoomActions,
  type WorkspaceRoomActionRow,
  type WorkspaceRoomFeature,
  type WorkspaceRoomWorkbenchPresentation,
  type WorkspaceShipPhasePresentation,
  type WorkspaceShipStructurePhase,
  type WorkspaceShopSupplementalDescriptor,
} from '../contract';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';
import {
  workspaceLocalDetailMarkers,
  workspaceOccurrenceOwnedMarkers,
} from '../navigation/marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { workspaceRewardStoreLabel } from './reward-labels';

/**
 * The occurrence assembler consumes only the lifecycle facts needed to project
 * this occurrence. Expected-owner enumeration remains intentionally elsewhere.
 */
export interface WorkspaceOccurrenceProjectionFacts {
  readonly authoredAdditionalExitKeys: readonly string[];
  readonly detailsActive: boolean;
}

type WorkspaceDerivedAcquisitionEntry = {
  readonly address: AcquisitionEntryAddress;
  readonly kind:
    | 'echoDoubleShopPlaceholder'
    | 'echoDoubleShopReward'
    | 'echoLastReward'
    | 'infernalContractReward'
    | 'travelDealPlaceholder'
    | 'travelDealRefill';
  readonly sourceOfferKey?: string;
  readonly slotIndex?: number;
  readonly rewardTypes?: readonly string[];
  readonly fixedReward?: AuthoredRewardState;
  readonly retainedSourceMismatch?: boolean;
  readonly eligibleSourceOfferKeys?: readonly string[];
};

/** Exact authored/evaluated inputs for one room-local workspace product. */
export interface WorkspaceOccurrenceAssemblyInput {
  /** Closed declaration-owned map domain for an Anomaly replacement in this biome. */
  readonly anomalyReplacementRoomGameNames?: readonly string[];
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly encounterPhaseStatus: (
    phase: EncounterPhaseAddress,
  ) => EncounterPhaseSequenceStatus | undefined;
  readonly figLeafSupport?: (
    phase: EncounterPhaseAddress,
  ) => FigLeafPhaseCandidateSupport | undefined;
  readonly gorgonSupport?: (
    phase: EncounterPhaseAddress,
  ) => GorgonPhaseCandidateSupport | undefined;
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
  /** Shared decision-owned Fields derivation for this target occurrence. */
  readonly fieldsBatchFacts?: FieldsBatchFacts;
  readonly facts: WorkspaceOccurrenceProjectionFacts;
  readonly levelResolutionAssessment: (
    owner: LevelResolutionAddress,
  ) => SelectedLevelResolutionAssessment | undefined;
  readonly derivedAcquisitionEntries?: (
    site: AcquisitionSiteAddress,
  ) => readonly WorkspaceDerivedAcquisitionEntry[];
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly ordinaryRewardForfeited: (owner: RewardCandidateOwner) => boolean;
  readonly occurrence: RoomOccurrence;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

/** Immutable occurrence-owned workspace products consumed by decision and Hub assembly. */
export interface WorkspaceOccurrenceAssembly {
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  readonly occurrenceInteractionRequirements: readonly WorkspaceOccurrenceInteractionRequirement[];
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
}

/**
 * A family can request one authored occurrence product without gaining access
 * to the biome-local lifecycle facts or marker registration builder.
 */
export interface WorkspaceOccurrenceAssemblyRequest {
  readonly anomalyReplacementRoomGameNames?: readonly string[];
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
  /** Present only when this occurrence belongs to a configured Fields batch. */
  readonly fieldsBatchFacts?: FieldsBatchFacts;
  readonly occurrence: RoomOccurrence;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

export type WorkspaceOccurrenceAssembler = (
  input: WorkspaceOccurrenceAssemblyRequest,
) => WorkspaceOccurrenceAssembly;

export function workspaceAcquisitionRoleLabel(acquisitionRole: string): string {
  switch (acquisitionRole) {
    case 'self':
      return 'Reward';
    case 'source':
      return 'Boon';
    case 'hiddenSource':
      return 'Mystery Boon';
    case 'box':
      return 'Blind Box';
    case 'chosenSource':
      return 'Chosen God';
    case 'spurnedSource':
      return 'Spurned God';
    default:
      return acquisitionRole
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toUpperCase());
  }
}

function traitOfferControls(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RewardCandidateOwner,
  reward: AuthoredRewardState,
): readonly WorkspaceTraitOfferControl[] {
  if (!input.facts.detailsActive) return Object.freeze([]);
  const controls: WorkspaceTraitOfferControl[] = [];
  for (const [acquisitionRole, offer] of Object.entries(reward.traitOffersByAcquisitionRole)) {
    const giverKey = traitGiverForAcquisitionRole(input.catalog, reward.offer, acquisitionRole);
    if (giverKey === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner.address)} has trait role ${acquisitionRole} without an in-scope giver`,
      );
    }
    const giver = input.catalog.traitGivers.byKey[giverKey];
    if (giver === undefined) continue;
    const address = createTraitOfferAddress(owner.address, acquisitionRole);
    if (offer === null) {
      controls.push(
        Object.freeze({
          acquisitionRoleLabel: workspaceAcquisitionRoleLabel(acquisitionRole),
          address,
          giver,
          marker: input.markerDestinations.marker(address),
          offer: null,
          rewardOwner: owner.address,
        }),
      );
      continue;
    }
    if (giverKey !== offer.giverKey) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner.address)} trait role ${acquisitionRole} has giver ${offer.giverKey}, expected ${giverKey}`,
      );
    }
    const selected =
      offer.kind === 'traits' ? traitOfferOption(offer, offer.selectedOptionKey) : undefined;
    const selectedDisposition =
      selected === undefined
        ? undefined
        : input.catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
    const traitAcquisitionTarget =
      offer.kind !== 'traits' ||
      selected === undefined ||
      input.catalog.traits.byKey[selected.traitKey]?.targetedAcquisition === undefined
        ? undefined
        : (() => {
            const targetAddress = createTraitAcquisitionTargetAddress(
              address,
              offer.selectedOptionKey,
            );
            return Object.freeze({
              address: targetAddress,
              marker: input.markerDestinations.marker(targetAddress),
              optionKey: offer.selectedOptionKey,
              ...(selected.targetTraitKey === undefined ? {} : { value: selected.targetTraitKey }),
            });
          })();
    const circeResolution =
      offer.kind !== 'traits' || selectedDisposition?.kind !== 'circe'
        ? undefined
        : Object.freeze({
            address: createCirceResolutionAddress(address, offer.selectedOptionKey),
            marker: input.markerDestinations.marker(
              createCirceResolutionAddress(address, offer.selectedOptionKey),
            ),
            optionKey: offer.selectedOptionKey,
            ...(selected?.circeResolution === undefined ? {} : { value: selected.circeResolution }),
          });
    const allTogetherSets =
      offer.kind !== 'traits' || selectedDisposition?.kind !== 'directTraitSets'
        ? undefined
        : Object.freeze(
            selectedDisposition.sets.map((set) => {
              const setAddress = createAllTogetherSetAddress(
                address,
                offer.selectedOptionKey,
                set.key,
              );
              return Object.freeze({
                address: setAddress,
                marker: input.markerDestinations.marker(setAddress),
                optionKey: offer.selectedOptionKey,
                setKey: set.key,
                ...(selected?.allTogetherResult === undefined
                  ? {}
                  : { value: selected.allTogetherResult[set.key] }),
              });
            }),
          );
    controls.push(
      Object.freeze({
        acquisitionRoleLabel: workspaceAcquisitionRoleLabel(acquisitionRole),
        address,
        giver,
        marker: input.markerDestinations.marker(address),
        offer,
        rewardOwner: owner.address,
        ...(traitAcquisitionTarget === undefined ? {} : { traitAcquisitionTarget }),
        ...(circeResolution === undefined ? {} : { circeResolution }),
        ...(allTogetherSets === undefined ? {} : { allTogetherSets }),
        ...(offer.kind === 'traits' &&
        traitGiverUsesOfferContext(input.catalog, giver.key, 'deathDefianceConditionMet')
          ? {
              deathDefianceCondition: {
                value: offer.deathDefianceConditionMet ?? false,
              },
            }
          : {}),
      }),
    );
  }
  return Object.freeze(controls);
}

function levelResolutionControls(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RewardCandidateOwner,
  reward: AuthoredRewardState,
): readonly WorkspaceLevelResolutionControl[] {
  if (reward.levelResolutionsByAcquisitionRole === undefined) return Object.freeze([]);
  return Object.freeze(
    Object.entries(reward.levelResolutionsByAcquisitionRole).flatMap(([acquisitionRole, value]) => {
      const address = createLevelResolutionAddress(owner.address, acquisitionRole);
      const assessment = input.levelResolutionAssessment(address);
      if (assessment === undefined) return [];
      const levelCount = assessment.branches[0]?.levelCount;
      if (levelCount === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(address)} has a reached Pom assessment without a level count`,
        );
      }
      return [
        Object.freeze({
          acquisitionRoleLabel: workspaceAcquisitionRoleLabel(acquisitionRole),
          address,
          levelCount,
          settledEmptyNoOp:
            value.kind === 'random' &&
            value.targetTraitKey === null &&
            assessment.branches.some(
              (branch) =>
                branch.emptyTargetAllowed &&
                branch.eligibleTargetCount === 0 &&
                branch.findings.length === 0,
            ),
          marker: input.markerDestinations.marker(address),
          rewardOwner: owner.address,
          value,
        }),
      ];
    }),
  );
}

function conversionControls(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RewardCandidateOwner,
  reward: AuthoredRewardState,
): readonly WorkspaceAcquisitionConversionControl[] {
  if (!input.facts.detailsActive) return Object.freeze([]);
  const declaration = input.catalog.rewards.rewardTypes.byKey[reward.offer.rewardType];
  if (declaration === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner.address)} has unknown reward type ${reward.offer.rewardType}`,
    );
  }
  return Object.freeze(
    declaration.acquisitionRoles.values.map((role) => {
      const address = createAcquisitionRoleAddress(owner.address, role.key);
      const value = reward.dispositionByAcquisitionRole[role.key];
      if (value === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(owner.address)} lacks acquisition disposition for ${role.key}`,
        );
      }
      return Object.freeze({
        acquisitionRoleLabel: workspaceAcquisitionRoleLabel(role.key),
        address,
        marker: input.markerDestinations.marker(address),
        rewardOwner: owner.address,
        value,
      });
    }),
  );
}

function rewardControl(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RewardCandidateOwner,
  binding: CountedRewardBinding | undefined,
  offer: ResolvedRewardOffer | null,
  authoredReward: AuthoredRewardState | null,
  explicitRewardTypes: readonly string[] = Object.freeze(offer === null ? [] : [offer.rewardType]),
  derivedShopEntryEdit?: WorkspaceRewardControl['derivedShopEntryEdit'],
  retainedSourceMismatch = false,
): WorkspaceRewardControl {
  const fixedRewardType =
    offer === null && explicitRewardTypes.length === 1 ? explicitRewardTypes[0] : undefined;
  const fixedPayloadDomain =
    fixedRewardType === undefined
      ? undefined
      : input.catalog.rewards.rewardTypes.byKey[fixedRewardType]?.payloadDomain;
  const fixedPayloadDeclaration =
    fixedPayloadDomain === undefined
      ? undefined
      : input.catalog.rewards.payloadDomains.byKey[fixedPayloadDomain];
  const authoringStartStep =
    fixedPayloadDeclaration?.kind === 'oneOf'
      ? ('source' as const)
      : fixedPayloadDeclaration?.kind === 'distinctPair'
        ? ('chosen' as const)
        : undefined;
  const authoringSeed =
    authoringStartStep === undefined || fixedRewardType === undefined
      ? undefined
      : Object.freeze({ rewardType: fixedRewardType });
  const acquisitionOutcome = input.ordinaryRewardForfeited(owner)
    ? ('forfeitedByVow' as const)
    : undefined;
  const offerEditStartStep = retainedSourceMismatch
    ? ('type' as const)
    : offer?.payload?.kind === 'BoonSource'
      ? ('source' as const)
      : offer?.payload?.kind === 'DevotionPair'
        ? ('chosen' as const)
        : authoringStartStep;
  return binding === undefined
    ? Object.freeze({
        kind: 'explicitReward' as const,
        ...(acquisitionOutcome === undefined ? {} : { acquisitionOutcome }),
        ...(authoringStartStep === undefined ? {} : { authoringStartStep }),
        ...(authoringSeed === undefined ? {} : { authoringSeed }),
        marker: input.markerDestinations.marker(owner.address),
        offer,
        ...(offerEditStartStep === undefined ? {} : { offerEditStartStep }),
        offerEditVisibility:
          offer === null || offer.payload !== undefined || retainedSourceMismatch
            ? ('visible' as const)
            : ('hidden' as const),
        owner,
        retainedSourceMismatch,
        traitOffers:
          authoredReward === null
            ? Object.freeze([])
            : traitOfferControls(input, owner, authoredReward),
        levelResolutions:
          authoredReward === null
            ? Object.freeze([])
            : levelResolutionControls(input, owner, authoredReward),
        conversions:
          authoredReward === null
            ? Object.freeze([])
            : conversionControls(input, owner, authoredReward),
        rewardTypes: Object.freeze([...explicitRewardTypes]),
        ...(derivedShopEntryEdit === undefined ? {} : { derivedShopEntryEdit }),
      })
    : Object.freeze({
        kind: 'countedReward' as const,
        ...(acquisitionOutcome === undefined ? {} : { acquisitionOutcome }),
        binding,
        marker: input.markerDestinations.marker(owner.address),
        offer,
        ...(offerEditStartStep === undefined ? {} : { offerEditStartStep }),
        offerEditVisibility:
          offer === null || offer.payload !== undefined || retainedSourceMismatch
            ? ('visible' as const)
            : ('hidden' as const),
        owner: owner as CountedRewardCandidateOwner,
        retainedSourceMismatch,
        traitOffers:
          authoredReward === null
            ? Object.freeze([])
            : traitOfferControls(input, owner, authoredReward),
        levelResolutions:
          authoredReward === null
            ? Object.freeze([])
            : levelResolutionControls(input, owner, authoredReward),
        conversions:
          authoredReward === null
            ? Object.freeze([])
            : conversionControls(input, owner, authoredReward),
        ...(derivedShopEntryEdit === undefined ? {} : { derivedShopEntryEdit }),
      });
}

function incomingRewardBinding(
  room: RoomDeclaration,
  state: Extract<
    RoomOccurrence['state'],
    { readonly kind: 'anomaly' | 'counted' | 'ephyraCombat' | 'freeReward' }
  >,
): CountedRewardBinding {
  if (state.kind === 'freeReward') {
    const policy = room.prebossBatchPolicy;
    if (policy?.kind !== 'takeOverNormalDoors' || policy.remainingOffers.kind !== 'counted') {
      throw new StructuredWorkspaceProjectionContractError(
        `${room.gameName} free Preboss reward has no declared counted binding`,
      );
    }
    return policy.remainingOffers.reward;
  }
  if (room.incomingReward.kind !== 'countedChoice') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} counted incoming reward has no declared binding`,
    );
  }
  return room.incomingReward;
}

function controlsForOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
): readonly WorkspaceRewardControl[] {
  const { occurrence } = input;
  const controls: WorkspaceRewardControl[] = [];
  const incoming = createIncomingRewardAddress(input.biome, occurrence.occurrenceId);
  const addIncoming = (
    state: Extract<
      RoomOccurrence['state'],
      { readonly kind: 'anomaly' | 'counted' | 'ephyraCombat' | 'freeReward' }
    >,
  ) => {
    controls.push(
      rewardControl(
        input,
        { kind: 'incomingReward', address: incoming },
        incomingRewardBinding(room, state),
        state.reward?.offer ?? null,
        state.reward,
      ),
    );
  };
  switch (occurrence.state.kind) {
    case 'anomaly':
    case 'counted':
    case 'freeReward':
      addIncoming(occurrence.state);
      break;
    case 'ephyraCombat': {
      addIncoming(occurrence.state);
      break;
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') break;
      const activeSlotKeys = new Set(
        group.slotKeys.slice(0, input.fieldsBatchFacts?.doorCageRewardCount ?? 0),
      );
      for (const [slotKey, offer] of Object.entries(occurrence.state.cages)) {
        if (!activeSlotKeys.has(slotKey)) continue;
        const address = createLocalRewardAddress(
          input.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        controls.push(
          rewardControl(
            input,
            { kind: 'localReward', address },
            group.reward,
            offer?.offer ?? null,
            offer,
          ),
        );
      }
      const optionalDescriptor = room.fieldsOptionalRewards;
      if (optionalDescriptor === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no optional reward declaration`,
        );
      }
      for (const slotKey of optionalDescriptor.slotKeys.slice(
        0,
        occurrence.state.optionalRewardCount,
      )) {
        const reward = occurrence.state.optionalRewards[slotKey];
        if (reward === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Fields state is missing ${slotKey}`,
          );
        }
        const address = createLocalRewardAddress(
          input.biome,
          occurrence.occurrenceId,
          optionalDescriptor.key,
          slotKey,
        );
        controls.push(
          rewardControl(
            input,
            { kind: 'localReward', address },
            optionalDescriptor.reward,
            reward?.offer ?? null,
            reward,
          ),
        );
      }
      break;
    }
    case 'shipCombat': {
      const envelope = requireEncounterEnvelope(input.catalog, room);
      for (const slot of envelope.slots) {
        const declaration = slot.rewardAttachment;
        if (declaration?.kind !== 'rewardWheel') continue;
        const wheel = occurrence.state.wheels[declaration.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${declaration.key}`,
          );
        }
        for (const [offerKey, offer] of Object.entries(wheel.offers)) {
          const address = createRewardWheelOfferAddress(
            input.biome,
            occurrence.occurrenceId,
            declaration.key,
            offerKey,
          );
          controls.push(
            rewardControl(
              input,
              { kind: 'rewardWheelOffer', address },
              declaration.reward,
              offer?.offer ?? null,
              offer,
            ),
          );
        }
      }
      break;
    }
    case 'shop': {
      // Selecting a Shop target creates its declaration-owned inventory. A
      // retained, selected Shop stays editable before evaluation reaches it;
      // an unpicked Shop remains a dormant structural leaf.
      if (!input.facts.detailsActive || occurrence.state.shop === undefined) break;
      const profile = input.catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${occurrence.state.shop.profileKey} is missing`,
        );
      }
      for (const [offerKey, shopOffer] of Object.entries(occurrence.state.shop.offers)) {
        const slot = profile.slots.byKey[offerKey];
        const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
        if (group === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop offer ${offerKey} has no declared reward domain`,
          );
        }
        const address = createShopOfferAddress(input.biome, occurrence.occurrenceId, offerKey);
        controls.push(
          rewardControl(
            input,
            { kind: 'shopOffer', address },
            undefined,
            shopOffer.reward?.offer ?? null,
            shopOffer.reward,
            group.rewardTypes,
          ),
        );
      }
      break;
    }
    case 'fixed': {
      const offer = resolveWorkspaceFixedRewardOffer(room, occurrence.state);
      const fixedRewardType =
        room.incomingReward.kind === 'fixed' ? room.incomingReward.rewardType : undefined;
      const rewardType =
        fixedRewardType === undefined
          ? undefined
          : input.catalog.rewards.rewardTypes.byKey[fixedRewardType];
      if (rewardType?.payloadDomain !== undefined) {
        controls.push(
          rewardControl(
            input,
            { kind: 'incomingReward', address: incoming },
            undefined,
            offer,
            occurrence.state.reward,
            Object.freeze([fixedRewardType!]),
          ),
        );
      }
      break;
    }
    case 'none':
      break;
  }
  return Object.freeze(controls);
}

function requireProjectedRewardControl<TKind extends WorkspaceRewardControl['kind']>(
  controls: readonly WorkspaceRewardControl[],
  address: SemanticAddress,
  kind: TKind,
): Extract<WorkspaceRewardControl, { readonly kind: TKind }> {
  const control = controls.find(
    (candidate) => semanticAddressKey(candidate.owner.address) === semanticAddressKey(address),
  );
  if (control?.kind !== kind) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(address)} has no ${kind} room-local control`,
    );
  }
  return control as Extract<WorkspaceRewardControl, { readonly kind: TKind }>;
}

function requireEncounterEnvelope(catalog: Catalog, room: RoomDeclaration) {
  const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  if (envelope === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} has no encounter envelope ${room.encounterEnvelopeKey}`,
    );
  }
  return envelope;
}

function requireRewardWheelAttachment(
  catalog: Catalog,
  room: RoomDeclaration,
  wheelKey: string,
): EncounterRewardWheelAttachment {
  const attachment = requireEncounterEnvelope(catalog, room).slots.find(
    (slot) =>
      slot.rewardAttachment?.kind === 'rewardWheel' && slot.rewardAttachment.key === wheelKey,
  )?.rewardAttachment;
  if (attachment?.kind !== 'rewardWheel') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} has no reward-wheel attachment ${wheelKey}`,
    );
  }
  return attachment;
}

/**
 * Maps a declaration-owned pool into one renderable phase from the authored
 * encounter domain. Candidate eligibility remains a lazy interaction product;
 * it never controls whether the authored phase exists in the workspace.
 */
function activeEncounterPhasesForOwner(
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
  owner: EncounterPhaseAddress['owner'],
  encounters: RoomOccurrence['encounters'],
  options: EncounterPhaseAuthoringRoomOptions = {},
): readonly WorkspaceEncounterPhase[] {
  const phases: WorkspaceEncounterPhase[] = [];
  for (const domain of encounterPhaseAuthoringDomainForRoom(
    input.catalog,
    input.biome,
    room,
    owner,
    encounters,
    { ...options, includeFixedPhases: true },
  )) {
    const address = domain.origin;
    if (input.encounterPhaseStatus(address)?.kind === 'dormantSuffix') continue;
    const figLeafSupport = input.figLeafSupport?.(address);
    const gorgonSupport = input.gorgonSupport?.(address);
    const gorgonSupported = gorgonSupport?.supported === true;
    const authoredFigLeafSkip = encounters.figLeafSkipByPhase?.[domain.slotKey] === true;
    const authoredGorgonResult = encounters.gorgonResultByPhase?.[domain.slotKey];
    const gorgonResult =
      authoredGorgonResult === undefined && gorgonSupported
        ? { deathDefianceConditionMet: false as const }
        : authoredGorgonResult;
    const retainedGorgon =
      gorgonResult?.deathDefianceConditionMet === true || gorgonResult?.athenaOffer !== undefined;
    const fixedPhase = domain.declaredEncounterKeys.length === 1;
    const fixedHasTraitOffer =
      fixedPhase &&
      input.catalog.encounterDefinitions.byKey[domain.selectedEncounterKey]?.traitOfferProducer !==
        undefined;
    if (
      fixedPhase &&
      figLeafSupport === undefined &&
      !authoredFigLeafSkip &&
      !fixedHasTraitOffer &&
      !gorgonSupported &&
      !retainedGorgon
    )
      continue;
    const candidateChoices = Object.freeze(
      domain.declaredEncounterKeys.map((encounterKey) => {
        const definition = input.catalog.encounterDefinitions.byKey[encounterKey];
        if (definition === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(address)} has no encounter definition ${encounterKey}`,
          );
        }
        return Object.freeze({ label: definition.label, value: definition.key });
      }),
    );
    const selectedDefinition =
      input.catalog.encounterDefinitions.byKey[domain.selectedEncounterKey];
    if (selectedDefinition === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} has no selected encounter definition ${domain.selectedEncounterKey}`,
      );
    }
    const producer = selectedDefinition.traitOfferProducer;
    const authoredTraitOffer =
      input.facts.detailsActive && producer !== undefined
        ? encounters.traitOffersByPhase?.[domain.slotKey]?.[selectedDefinition.key]
        : undefined;
    const gorgonPhaseAddress = createGorgonPhaseAddress(address);
    const gorgonAthenaOffer =
      input.facts.detailsActive && gorgonResult?.deathDefianceConditionMet === true
        ? gorgonResult.athenaOffer == null
          ? undefined
          : materializeGorgonAthenaOffer(
              input.catalog,
              gorgonResult.athenaOffer,
              gorgonSupport?.rarity,
            )
        : undefined;
    const gorgonEffect = input.catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
    )?.effect;
    const gorgonGiver =
      gorgonEffect?.kind === 'gorgonAmulet'
        ? input.catalog.traitGivers.byKey[gorgonEffect.providerKey]
        : undefined;
    const gorgonAthena =
      input.facts.detailsActive &&
      gorgonResult?.deathDefianceConditionMet === true &&
      gorgonResult.athenaOffer !== undefined &&
      gorgonGiver !== undefined
        ? Object.freeze({
            acquisitionRoleLabel: 'Gorgon Athena',
            address: createTraitOfferAddress(gorgonPhaseAddress, 'gorgonAthena'),
            giver: gorgonGiver,
            marker: input.markerDestinations.marker(
              createTraitOfferAddress(gorgonPhaseAddress, 'gorgonAthena'),
            ),
            offer: gorgonResult.athenaOffer === null ? null : gorgonAthenaOffer!,
            rarityEditable: false,
            rewardOwner: gorgonPhaseAddress,
          })
        : undefined;
    const giver =
      producer === undefined ? undefined : input.catalog.traitGivers.byKey[producer.giverKey];
    const traitOffer =
      authoredTraitOffer !== undefined && producer !== undefined && giver !== undefined
        ? (() => {
            const traitAddress = createTraitOfferAddress(address, 'selection');
            if (authoredTraitOffer === null)
              return Object.freeze({
                acquisitionRoleLabel: 'Selection',
                address: traitAddress,
                giver,
                marker: input.markerDestinations.marker(traitAddress),
                offer: null,
                rewardOwner: address,
              });
            const selected =
              authoredTraitOffer.kind === 'traits'
                ? traitOfferOption(authoredTraitOffer, authoredTraitOffer.selectedOptionKey)
                : undefined;
            const selectedDisposition =
              selected === undefined
                ? undefined
                : input.catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
            const traitAcquisitionTarget =
              authoredTraitOffer.kind !== 'traits' ||
              selected === undefined ||
              input.catalog.traits.byKey[selected.traitKey]?.targetedAcquisition === undefined
                ? undefined
                : (() => {
                    const targetAddress = createTraitAcquisitionTargetAddress(
                      traitAddress,
                      authoredTraitOffer.selectedOptionKey,
                    );
                    return Object.freeze({
                      address: targetAddress,
                      marker: input.markerDestinations.marker(targetAddress),
                      optionKey: authoredTraitOffer.selectedOptionKey,
                      ...(selected.targetTraitKey === undefined
                        ? {}
                        : { value: selected.targetTraitKey }),
                    });
                  })();
            const circeResolution =
              authoredTraitOffer.kind !== 'traits' || selectedDisposition?.kind !== 'circe'
                ? undefined
                : Object.freeze({
                    address: createCirceResolutionAddress(
                      traitAddress,
                      authoredTraitOffer.selectedOptionKey,
                    ),
                    marker: input.markerDestinations.marker(
                      createCirceResolutionAddress(
                        traitAddress,
                        authoredTraitOffer.selectedOptionKey,
                      ),
                    ),
                    optionKey: authoredTraitOffer.selectedOptionKey,
                    ...(selected?.circeResolution === undefined
                      ? {}
                      : { value: selected.circeResolution }),
                  });
            const echoPomTarget =
              authoredTraitOffer.kind !== 'traits' ||
              selectedDisposition?.kind !== 'echo' ||
              selectedDisposition.effect !== 'doubleLevel'
                ? undefined
                : Object.freeze({
                    address: createEchoPomTargetAddress(
                      traitAddress,
                      authoredTraitOffer.selectedOptionKey,
                    ),
                    marker: input.markerDestinations.marker(
                      createEchoPomTargetAddress(
                        traitAddress,
                        authoredTraitOffer.selectedOptionKey,
                      ),
                    ),
                    optionKey: authoredTraitOffer.selectedOptionKey,
                    ...(selected === undefined || !('echoPomTarget' in selected)
                      ? {}
                      : { value: selected.echoPomTarget }),
                  });
            const echoLastRunBoon =
              authoredTraitOffer.kind !== 'traits' ||
              selectedDisposition?.kind !== 'echo' ||
              selectedDisposition.effect !== 'lastRunBoon'
                ? undefined
                : Object.freeze({
                    address: createEchoLastRunBoonAddress(
                      traitAddress,
                      authoredTraitOffer.selectedOptionKey,
                    ),
                    marker: input.markerDestinations.marker(
                      createEchoLastRunBoonAddress(
                        traitAddress,
                        authoredTraitOffer.selectedOptionKey,
                      ),
                    ),
                    optionKey: authoredTraitOffer.selectedOptionKey,
                    ...(selected?.echoLastRunBoon === undefined
                      ? {}
                      : { value: selected.echoLastRunBoon }),
                  });
            const echoLastReward =
              authoredTraitOffer.kind !== 'traits' ||
              selectedDisposition?.kind !== 'echo' ||
              selectedDisposition.effect !== 'lastReward'
                ? undefined
                : (() => {
                    if (address.owner.kind !== 'occurrence')
                      throw new StructuredWorkspaceProjectionContractError(
                        `${semanticAddressKey(traitAddress)} Echo replay is not occurrence-owned`,
                      );
                    const replayAddress = createEchoLastRewardAddress(
                      traitAddress,
                      authoredTraitOffer.selectedOptionKey,
                    );
                    const site = createAcquisitionSiteAddress(
                      createOccurrenceAddress(input.biome, address.owner.occurrenceId),
                      'roomExit',
                    );
                    const acquisitionEntry = createAcquisitionEntryAddress(
                      site,
                      echoLastRewardPickupEntryKey(
                        domain.slotKey,
                        selectedDefinition.key,
                        authoredTraitOffer.selectedOptionKey,
                      ),
                    );
                    const capability = input
                      .derivedAcquisitionEntries?.(site)
                      .find(
                        (entry) =>
                          entry.kind === 'echoLastReward' &&
                          entry.address.entryKey === acquisitionEntry.entryKey,
                      );
                    return Object.freeze({
                      address: replayAddress,
                      acquisitionEntry,
                      marker: input.markerDestinations.marker(replayAddress),
                      optionKey: authoredTraitOffer.selectedOptionKey,
                      ...(capability?.fixedReward === undefined
                        ? {}
                        : {
                            spawnLabel: summarizeRewardOffer(
                              input.catalog,
                              capability.fixedReward.offer,
                            ),
                          }),
                    });
                  })();
            return Object.freeze({
              acquisitionRoleLabel: 'Selection',
              address: traitAddress,
              giver,
              marker: input.markerDestinations.marker(traitAddress),
              offer: authoredTraitOffer,
              rewardOwner: address,
              ...(traitAcquisitionTarget === undefined ? {} : { traitAcquisitionTarget }),
              ...(circeResolution === undefined ? {} : { circeResolution }),
              ...(echoPomTarget === undefined ? {} : { echoPomTarget }),
              ...(echoLastRunBoon === undefined ? {} : { echoLastRunBoon }),
              ...(echoLastReward === undefined ? {} : { echoLastReward }),
              ...(authoredTraitOffer.kind === 'traits' &&
              traitGiverUsesOfferContext(input.catalog, giver.key, 'deathDefianceConditionMet')
                ? {
                    deathDefianceCondition: {
                      value: authoredTraitOffer.deathDefianceConditionMet ?? false,
                    },
                  }
                : {}),
            });
          })()
        : undefined;
    phases.push(
      Object.freeze({
        address,
        candidateChoices,
        customizable: domain.declaredEncounterKeys.length > 1,
        label: domain.slotKey,
        marker: input.markerDestinations.marker(address),
        ...(figLeafSupport !== undefined || authoredFigLeafSkip
          ? {
              figLeaf: Object.freeze({
                interactionKey: semanticAddressKey(address),
                selected: authoredFigLeafSkip,
                supported: figLeafSupport?.supported === true,
              }),
            }
          : {}),
        ...(traitOffer === undefined ? {} : { traitOffer }),
        ...(gorgonResult === undefined || (!gorgonSupported && !retainedGorgon)
          ? {}
          : {
              gorgonCondition: Object.freeze({
                interactionKey: semanticAddressKey(address),
                selected: gorgonResult.deathDefianceConditionMet,
                supported: gorgonSupported,
              }),
            }),
        ...(gorgonAthena === undefined ? {} : { gorgonAthena }),
        resettable: domain.selectedEncounterKey !== domain.defaultEncounterKey,
        selectedEncounter: Object.freeze({
          key: selectedDefinition.key,
          label: selectedDefinition.label,
        }),
      }),
    );
  }
  return Object.freeze(phases);
}

interface ShopSupplementalAssemblyContext {
  readonly selectedActionKeys: readonly string[];
  readonly acquisitionSite: AcquisitionSiteAddress;
  readonly input: WorkspaceOccurrenceAssemblyInput;
  readonly offers: readonly { readonly key: string; readonly label: string }[];
  readonly pickupEntries: Readonly<Record<string, AuthoredRewardState | null>>;
  readonly roomGameName: string;
}

function supplementalPurchase(
  context: ShopSupplementalAssemblyContext,
  entryKey: string,
): WorkspaceShopPurchaseDescriptor {
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  return Object.freeze({
    address,
    marker: context.input.markerDestinations.marker(address),
  });
}

function derivedRewardSupplementalOffer(
  family: 'travel' | 'gold',
  capability: WorkspaceDerivedAcquisitionEntry | undefined,
  context: ShopSupplementalAssemblyContext,
): WorkspaceShopSupplementalDescriptor | undefined {
  const gold = family === 'gold';
  const entryKey = gold ? ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY : TRAVEL_DEAL_REFILL_ENTRY_KEY;
  const activeKind = gold ? 'echoDoubleShopReward' : 'travelDealRefill';
  const placeholderKind = gold ? 'echoDoubleShopPlaceholder' : 'travelDealPlaceholder';
  const selected = context.selectedActionKeys.includes(entryKey);

  if (selected && capability?.kind !== activeKind) {
    const purchase = supplementalPurchase(context, entryKey);
    return gold
      ? Object.freeze({
          kind: 'echoDoubleShopInvalid' as const,
          key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          label: 'Gold Gold Gold duplicate',
          explanation:
            'This selected duplicate has no active eligible paid source. Remove its Room Action to repair the Shop.',
          purchase,
        })
      : Object.freeze({
          kind: 'travelDealInvalid' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation:
            'This selected refill has no active triggering purchase. Remove its Room Action to repair the Shop.',
          purchase,
        });
  }
  if (capability === undefined) return undefined;
  if (capability.kind === placeholderKind) {
    return gold
      ? Object.freeze({
          kind: 'echoDoubleShopPlaceholder' as const,
          key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          label: 'Gold Gold Gold duplicate',
          explanation:
            'A prior paid non-Spell Shop action is required before this duplicate can be edited.',
        })
      : Object.freeze({
          kind: 'travelDealPlaceholder' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation: 'A prior paid Shop action is required before this refill can be edited.',
        });
  }
  if (capability.kind !== activeKind || capability.sourceOfferKey === undefined) {
    return undefined;
  }
  if (capability.rewardTypes === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} ${gold ? 'Gold duplicate' : 'Travel refill'} has no attested reward domain`,
    );
  }
  const eligibleSourceOfferKeys = capability.eligibleSourceOfferKeys;
  const sourceOfferLabel =
    context.offers.find((offer) => offer.key === capability.sourceOfferKey)?.label ??
    (gold && capability.sourceOfferKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? 'Travel Deal refill'
      : capability.sourceOfferKey);
  const authored = context.pickupEntries[entryKey] ?? capability.fixedReward ?? null;
  const materialized = Object.hasOwn(context.pickupEntries, entryKey);
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  const projectedReward = rewardControl(
    context.input,
    { kind: 'acquisitionEntry' as const, address },
    undefined,
    authored?.offer ?? null,
    authored,
    capability.rewardTypes,
    materialized
      ? undefined
      : Object.freeze({
          site: context.acquisitionSite,
          entryKey,
          sourceOfferKey: capability.sourceOfferKey,
        }),
  ) as WorkspaceExplicitRewardControl;
  const purchase = supplementalPurchase(context, entryKey);

  if (gold) {
    if (eligibleSourceOfferKeys === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${context.roomGameName} Gold duplicate has no attested source domain`,
      );
    }
    return Object.freeze({
      kind: 'echoDoubleShopReward' as const,
      key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      label: `Gold Gold Gold duplicate of ${sourceOfferLabel}`,
      sourceOfferKey: capability.sourceOfferKey,
      eligibleSourceOfferKeys,
      materialized,
      purchase,
      rewardControl: projectedReward,
    });
  }
  return Object.freeze({
    kind: 'travelDealRefill' as const,
    key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
    label: `Travel Deal refill after ${sourceOfferLabel}`,
    sourceOfferKey: capability.sourceOfferKey,
    materialized,
    purchase,
    rewardControl: projectedReward,
  });
}

function contractSupplementalOffer(
  capability: WorkspaceDerivedAcquisitionEntry | undefined,
  context: ShopSupplementalAssemblyContext,
): WorkspaceShopSupplementalDescriptor | undefined {
  const selected = context.selectedActionKeys.includes(INFERNAL_CONTRACT_ENTRY_KEY);
  if (capability === undefined && !selected) return undefined;
  const authored = context.pickupEntries[INFERNAL_CONTRACT_ENTRY_KEY];
  if (authored === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} contract opportunity has no structural child`,
    );
  }
  if (capability?.rewardTypes === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} contract opportunity has no attested reward domain`,
    );
  }
  const address = createAcquisitionEntryAddress(
    context.acquisitionSite,
    INFERNAL_CONTRACT_ENTRY_KEY,
  );
  return Object.freeze({
    kind: 'infernalContractReward' as const,
    key: INFERNAL_CONTRACT_ENTRY_KEY,
    label: 'Infernal Contract reward',
    materialized: true,
    purchase: supplementalPurchase(context, INFERNAL_CONTRACT_ENTRY_KEY),
    rewardControl: rewardControl(
      context.input,
      { kind: 'acquisitionEntry' as const, address },
      undefined,
      authored?.offer ?? null,
      authored,
      capability.rewardTypes,
    ) as WorkspaceExplicitRewardControl,
  });
}

function roomActionLabel(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rewardControl: WorkspaceRewardControl | undefined,
): string {
  const phase =
    'phaseKey' in reference
      ? encounterPhases.find((candidate) => candidate.address.phaseKey === reference.phaseKey)
      : undefined;
  switch (reference.kind) {
    case 'completeFieldsCage':
      return `Complete ${phase?.label ?? reference.phaseKey}`;
    case 'interactIncomingReward':
      return `Pick up ${workspaceAcquisitionRoleLabel(reference.acquisitionRole)}`;
    case 'interactLocalReward': {
      const local =
        roomLocal.kind !== 'fields'
          ? undefined
          : [...roomLocal.cages, ...roomLocal.optionalRewards].find(
              (candidate) =>
                candidate.control.owner.address.kind === 'localReward' &&
                candidate.control.owner.address.groupKey === reference.groupKey &&
                candidate.control.owner.address.slotKey === reference.slotKey,
            );
      return `Pick up ${local?.label ?? reference.slotKey}`;
    }
    case 'chooseRewardWheel': {
      const wheel =
        roomLocal.kind === 'ship'
          ? roomLocal.wheels.find((candidate) => candidate.key === reference.wheelKey)
          : undefined;
      return `Choose ${wheel?.label ?? reference.wheelKey}`;
    }
    case 'interactWheelReward': {
      const wheel =
        roomLocal.kind === 'ship'
          ? roomLocal.wheels.find((candidate) => candidate.key === reference.wheelKey)
          : undefined;
      return `Pick up ${wheel?.label ?? `${reference.wheelKey} reward`}`;
    }
    case 'interactShopOffer': {
      const offer =
        roomLocal.kind === 'shop'
          ? roomLocal.offers.find((candidate) => candidate.key === reference.offerKey)
          : undefined;
      const rewardLabel =
        rewardControl?.offer === null || rewardControl?.offer === undefined
          ? undefined
          : summarizeRewardOffer(catalog, rewardControl.offer);
      return `Buy ${rewardLabel ?? offer?.label ?? reference.offerKey}`;
    }
    case 'interactEncounter':
      return `Interact with ${phase?.selectedEncounter.label ?? `${reference.phaseKey} encounter`}`;
    case 'interactGorgon':
      return 'Interact with Athena';
    case 'interactAcquisitionEntry': {
      const supplemental =
        roomLocal.kind === 'shop'
          ? roomLocal.supplementalOffers.find((candidate) => candidate.key === reference.entryKey)
          : undefined;
      const rewardLabel =
        rewardControl?.offer === null || rewardControl?.offer === undefined
          ? undefined
          : summarizeRewardOffer(catalog, rewardControl.offer);
      const entryLabel =
        parseArtificerReplacementEntryKey(reference.entryKey) === undefined
          ? reference.entryKey
          : 'Artificer replacement';
      return `Pick up ${supplemental?.label ?? rewardLabel ?? entryLabel}`;
    }
  }
}

function roomActionsForOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  controls: readonly WorkspaceRewardControl[],
): WorkspaceRoomActions | undefined {
  const roster = input.evaluatedRoom?.roomActionRoster;
  if (roster === undefined || input.evaluatedRoom?.entered !== true) return undefined;
  const owner = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const proposals = roster.proposals.map((proposal, index) =>
    Object.freeze({
      kind: proposal.kind,
      key: `${proposal.kind}:${index}:${roomActionKey(proposal.reference)}`,
      label:
        proposal.kind === 'remove'
          ? 'Remove from room actions'
          : `${proposal.kind === 'insert' ? 'Insert' : 'Move'} to position ${(proposal.toIndex ?? 0) + 1}`,
      reference: proposal.reference,
      structurallyAuthorable: proposal.structurallyAuthorable,
      ...(proposal.toIndex === undefined ? {} : { toIndex: proposal.toIndex }),
    }),
  );
  const proposalKeysByAction = new Map<string, string[]>();
  for (const proposal of proposals) {
    const key = roomActionKey(proposal.reference);
    proposalKeysByAction.set(key, [...(proposalKeysByAction.get(key) ?? []), proposal.key]);
  }
  const controlAt = (address: SemanticAddress): WorkspaceRewardControl | undefined =>
    controls.find(
      (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(address),
    );
  const issuesFor = (actionKey: string): readonly string[] =>
    Object.freeze(
      roster.issues.flatMap((issue) => {
        if (roomActionKey(issue.reference) !== actionKey) return [];
        switch (issue.kind) {
          case 'dependency':
            return [`Dependency: ${issue.detail}`];
          case 'window':
            return [`Timing: ${issue.detail}`];
          case 'stale':
            return ['This action no longer belongs to the room.'];
          case 'unrankedRequired':
            return ['This required action has not been placed.'];
        }
      }),
    );
  const controlForRole = (
    control: WorkspaceRewardControl,
    role: string,
  ): WorkspaceRewardControl => {
    const traitOffers = control.traitOffers?.filter(
      (child) => child.address.acquisitionRole === role,
    );
    const levelResolutions = control.levelResolutions?.filter(
      (child) => child.address.acquisitionRole === role,
    );
    const conversions = control.conversions?.filter(
      (child) => child.address.acquisitionRole === role,
    );
    const children = {
      ...(traitOffers === undefined ? {} : { traitOffers }),
      ...(levelResolutions === undefined ? {} : { levelResolutions }),
      ...(conversions === undefined ? {} : { conversions }),
    };
    return control.kind === 'countedReward'
      ? Object.freeze({ ...control, ...children })
      : Object.freeze({ ...control, ...children });
  };
  return Object.freeze({
    checkpoints: Object.freeze(
      roster.checkpoints.map((checkpoint) =>
        Object.freeze({
          key: checkpoint.checkpointKey,
          label: checkpoint.label,
          afterRank: checkpoint.afterRank,
          window: checkpoint.window,
        }),
      ),
    ),
    interactionKey: semanticAddressKey(owner),
    owner,
    proposals: Object.freeze(proposals),
    rows: Object.freeze(
      roster.rows.map((row) => {
        const address = createRoomActionAddress(
          input.biome,
          input.occurrence.occurrenceId,
          row.key,
        );
        const directControl = controlAt(row.owner);
        const incomingControl =
          row.reference.kind === 'interactIncomingReward' && row.owner.kind === 'acquisitionRole'
            ? controlAt(row.owner.owner)
            : undefined;
        const wheelKey =
          row.reference.kind === 'interactWheelReward' ? row.reference.wheelKey : undefined;
        const wheel =
          roomLocal.kind === 'ship'
            ? roomLocal.wheels.find((candidate) => candidate.key === wheelKey)
            : undefined;
        const wheelControl = wheel?.offers.find(
          (_offer, index) => index + 1 === wheel.pickedOfferIndex,
        )?.control;
        const rewardControl = directControl ?? incomingControl ?? wheelControl;
        const phase = encounterPhases.find((candidate) =>
          row.reference.kind === 'interactGorgon'
            ? candidate.gorgonAthena !== undefined &&
              semanticAddressKey(candidate.gorgonAthena.rewardOwner) ===
                semanticAddressKey(row.owner)
            : semanticAddressKey(candidate.address) === semanticAddressKey(row.owner),
        );
        const traitOffer =
          row.reference.kind === 'interactEncounter'
            ? phase?.traitOffer
            : row.reference.kind === 'interactGorgon'
              ? phase?.gorgonAthena
              : undefined;
        const resolvedRewardControl =
          rewardControl === undefined
            ? undefined
            : row.reference.kind === 'interactIncomingReward'
              ? controlForRole(rewardControl, row.reference.acquisitionRole)
              : rewardControl;
        return Object.freeze({
          address,
          issues: issuesFor(row.key),
          key: row.key,
          label: roomActionLabel(
            input.catalog,
            row.reference,
            roomLocal,
            encounterPhases,
            resolvedRewardControl,
          ),
          marker: input.markerDestinations.marker(address),
          proposalKeys: Object.freeze(proposalKeysByAction.get(row.key) ?? []),
          reference: row.reference,
          participation: row.participation,
          rank: row.rank,
          ...(row.stale || resolvedRewardControl === undefined
            ? {}
            : {
                rewardPayload: Object.freeze({
                  control: resolvedRewardControl,
                  showOffer:
                    (row.reference.kind === 'interactLocalReward' &&
                      (roomLocal.kind !== 'fields' ||
                        row.reference.groupKey !== roomLocal.groupKey)) ||
                    (row.reference.kind === 'interactAcquisitionEntry' &&
                      input.occurrence.state.kind !== 'shop'),
                }),
              }),
          stale: row.stale,
          window: row.window,
          ...(row.stale || traitOffer === undefined ? {} : { traitOffer }),
          ...(row.stale ||
          row.reference.kind !== 'chooseRewardWheel' ||
          row.owner.kind !== 'rewardWheel'
            ? {}
            : { wheelPick: row.owner }),
          executable: row.executable,
        });
      }),
    ),
  });
}

function roomLocalForOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
  controls: readonly WorkspaceRewardControl[],
): WorkspaceRoomLocal {
  const { occurrence } = input;
  const incoming = createIncomingRewardAddress(input.biome, occurrence.occurrenceId);
  switch (occurrence.state.kind) {
    case 'none':
      return Object.freeze({ kind: 'none' as const });
    case 'fixed': {
      const offer = resolveWorkspaceFixedRewardOffer(room, occurrence.state);
      const rewardType =
        room.incomingReward.kind === 'fixed'
          ? input.catalog.rewards.rewardTypes.byKey[room.incomingReward.rewardType]
          : undefined;
      const control =
        rewardType?.payloadDomain === undefined
          ? undefined
          : requireProjectedRewardControl(controls, incoming, 'explicitReward');
      return Object.freeze({
        kind: 'fixed' as const,
        marker: input.markerDestinations.marker(incoming),
        offer,
        summary: offer === null ? 'Choose reward' : summarizeRewardOffer(input.catalog, offer),
        ...(control === undefined ? {} : { control }),
      });
    }
    case 'counted':
    case 'anomaly':
    case 'freeReward': {
      const control = requireProjectedRewardControl(controls, incoming, 'countedReward');
      return Object.freeze({
        kind: 'incomingReward' as const,
        control,
        summary:
          control.offer === null
            ? 'Choose reward'
            : summarizeRewardOffer(input.catalog, control.offer),
        ...(input.evaluatedRoom?.clockworkReward === undefined
          ? {}
          : { clockworkReward: input.evaluatedRoom.clockworkReward }),
      });
    }
    case 'ephyraCombat': {
      const incomingReward = requireProjectedRewardControl(controls, incoming, 'countedReward');
      return Object.freeze({
        kind: 'incomingReward' as const,
        control: incomingReward,
        summary:
          incomingReward.offer === null
            ? 'Choose reward'
            : summarizeRewardOffer(input.catalog, incomingReward.offer),
      });
    }
    case 'fieldsCombat': {
      const fieldsFacts = input.fieldsBatchFacts;
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no bounded cage declaration`,
        );
      }
      const cages = group.slotKeys
        .slice(0, fieldsFacts?.doorCageRewardCount ?? 0)
        .map((slotKey, index) => {
          const address = createLocalRewardAddress(
            input.biome,
            occurrence.occurrenceId,
            group.key,
            slotKey,
          );
          return Object.freeze({
            control: requireProjectedRewardControl(controls, address, 'countedReward'),
            key: slotKey,
            label: `Cage ${index + 1}`,
            summary: (() => {
              const control = requireProjectedRewardControl(controls, address, 'countedReward');
              return control.offer === null
                ? 'Choose reward'
                : summarizeRewardOffer(input.catalog, control.offer);
            })(),
          });
        });
      const optionalDescriptor = room.fieldsOptionalRewards;
      if (optionalDescriptor === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no optional reward declaration`,
        );
      }
      const optionalRewards = optionalDescriptor.slotKeys
        .slice(0, occurrence.state.optionalRewardCount)
        .map((slotKey, index) => {
          const address = createLocalRewardAddress(
            input.biome,
            occurrence.occurrenceId,
            optionalDescriptor.key,
            slotKey,
          );
          return Object.freeze({
            control: requireProjectedRewardControl(controls, address, 'countedReward'),
            key: slotKey,
            label: `Optional ${index + 1}`,
          });
        });
      return Object.freeze({
        kind: 'fields' as const,
        cages: Object.freeze(cages),
        owner: createOccurrenceAddress(input.biome, occurrence.occurrenceId),
        optionalRewardCount: occurrence.state.optionalRewardCount,
        optionalRewardCapacity: optionalDescriptor.optionalRewardCapacity,
        optionalRewardCountValues: Object.freeze(
          Array.from(
            { length: optionalDescriptor.optionalRewardCapacity + 1 },
            (_, index) => index,
          ),
        ),
        optionalRewards: Object.freeze(optionalRewards),
        groupKey: group.key,
      });
    }
    case 'shipCombat': {
      const state = occurrence.state;
      const envelope = requireEncounterEnvelope(input.catalog, room);
      let combatOrdinal = 0;
      const structuralPhases: readonly WorkspaceShipStructurePhase[] = envelope.slots.map(
        (slot) => {
          const rewardAttachment = slot.rewardAttachment;
          if (rewardAttachment?.kind !== 'rewardWheel') {
            return Object.freeze({ key: slot.key, label: slot.key });
          }
          combatOrdinal += 1;
          return Object.freeze({
            key: slot.key,
            label: `Combat ${combatOrdinal}`,
            rewardWheelKey: rewardAttachment.key,
          });
        },
      );
      const wheels = envelope.slots.flatMap((slot, phaseIndex) => {
        const declaration = slot.rewardAttachment;
        if (declaration?.kind !== 'rewardWheel') return [];
        const wheel = state.wheels[declaration.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${declaration.key}`,
          );
        }
        const address = createRewardWheelAddress(
          input.biome,
          occurrence.occurrenceId,
          declaration.key,
        );
        const active = phaseIndex < state.encounterCount;
        const phase = structuralPhases[phaseIndex];
        if (phase?.rewardWheelKey !== declaration.key) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} phase ${slot.key} lost reward-wheel presentation ownership`,
          );
        }
        const label = `${phase.label} reward`;
        const offers = declaration.offerKeys.map((offerKey, offerIndex) => {
          const offerAddress = createRewardWheelOfferAddress(
            input.biome,
            occurrence.occurrenceId,
            declaration.key,
            offerKey,
          );
          return Object.freeze({
            active: active && offerIndex < wheel.offerCount,
            control: requireProjectedRewardControl(controls, offerAddress, 'countedReward'),
            key: offerKey,
            label: `Offer ${offerIndex + 1}`,
          });
        });
        return [
          Object.freeze({
            active,
            address,
            encounterPhaseKey: slot.key,
            key: declaration.key,
            label,
            marker: input.markerDestinations.marker(address),
            offerCount: wheel.offerCount,
            offers: Object.freeze(offers),
            pickedOfferIndex: wheel.pickedOfferIndex,
            storeKey: wheel.storeKey,
          }),
        ];
      });
      return Object.freeze({
        kind: 'ship' as const,
        combatPhaseCount: state.encounterCount,
        phases: Object.freeze(structuralPhases.slice(0, state.encounterCount)),
        wheels: Object.freeze(wheels),
      });
    }
    case 'shop': {
      const state = occurrence.state;
      const shop = state.shop;
      if (!input.facts.detailsActive || shop === undefined) {
        return Object.freeze({
          kind: 'shop' as const,
          materialized: false,
          offers: Object.freeze([]),
          supplementalOffers: Object.freeze([]),
        });
      }
      const profile = input.catalog.rewards.shops.byKey[shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${shop.profileKey} is missing`,
        );
      }
      const selectedActionKeys = Object.freeze(
        occurrence.roomActions.order.flatMap((reference) =>
          reference.kind === 'interactShopOffer'
            ? [reference.offerKey]
            : reference.kind === 'interactAcquisitionEntry'
              ? [reference.entryKey]
              : [],
        ),
      );
      const acquisitionSite = createAcquisitionSiteAddress(
        createOccurrenceAddress(input.biome, occurrence.occurrenceId),
        'roomExit',
      );
      const derivedEntries = input.derivedAcquisitionEntries?.(acquisitionSite) ?? [];
      const contractCapability = derivedEntries.find(
        (entry) => entry.kind === 'infernalContractReward',
      );
      const travelCapability = derivedEntries.find(
        (entry) => entry.kind === 'travelDealRefill' || entry.kind === 'travelDealPlaceholder',
      );
      const goldCapability = derivedEntries.find(
        (entry) =>
          entry.kind === 'echoDoubleShopReward' || entry.kind === 'echoDoubleShopPlaceholder',
      );
      const offers = profile.slots.values.map((slot) => {
        if (shop.offers[slot.key] === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop state is missing ${slot.key}`,
          );
        }
        const offerAddress = createShopOfferAddress(input.biome, occurrence.occurrenceId, slot.key);
        const purchaseAddress = createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(
            createOccurrenceAddress(input.biome, occurrence.occurrenceId),
            'roomExit',
          ),
          slot.key,
        );
        return Object.freeze({
          key: slot.key,
          label: slot.label,
          purchase: Object.freeze({
            address: purchaseAddress,
            marker: input.markerDestinations.marker(purchaseAddress),
          }),
          rewardControl: requireProjectedRewardControl(controls, offerAddress, 'explicitReward'),
        });
      });
      const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries ?? {};
      const supplementalContext: ShopSupplementalAssemblyContext = Object.freeze({
        selectedActionKeys,
        acquisitionSite,
        input,
        offers,
        pickupEntries,
        roomGameName: room.gameName,
      });
      const supplementalOffers = Object.freeze(
        [
          derivedRewardSupplementalOffer('travel', travelCapability, supplementalContext),
          derivedRewardSupplementalOffer('gold', goldCapability, supplementalContext),
          contractSupplementalOffer(contractCapability, supplementalContext),
        ].filter((offer): offer is WorkspaceShopSupplementalDescriptor => offer !== undefined),
      );
      return Object.freeze({
        kind: 'shop' as const,
        materialized: true,
        ...(shop.deathDefianceConditionMet === undefined
          ? {}
          : {
              deathDefianceCondition: Object.freeze({
                value: shop.deathDefianceConditionMet,
              }) as WorkspaceShopConditionControl,
            }),
        offers: Object.freeze(offers),
        supplementalOffers,
      });
    }
  }
}

function encounterPhaseInteractionRequirement(
  owner: WorkspaceRoomSummary['address'],
  phases: readonly WorkspaceEncounterPhase[],
): WorkspaceOccurrenceInteractionRequirement | undefined {
  const interactivePhases = phases.filter(
    (phase) =>
      phase.customizable || phase.figLeaf !== undefined || phase.gorgonCondition !== undefined,
  );
  if (interactivePhases.length === 0) return undefined;
  return Object.freeze({
    kind: 'encounterPhases' as const,
    owner,
    phases: Object.freeze(
      interactivePhases.map((phase) =>
        Object.freeze({
          candidateChoices: phase.candidateChoices,
          owner: phase.address,
          selectedEncounterKey: phase.selectedEncounter.key,
          ...(phase.figLeaf === undefined
            ? {}
            : {
                figLeaf: Object.freeze({
                  selected: phase.figLeaf.selected,
                  supported: phase.figLeaf.supported,
                }),
              }),
          ...(phase.gorgonCondition === undefined
            ? {}
            : {
                gorgonCondition: Object.freeze({
                  selected: phase.gorgonCondition.selected,
                  supported: phase.gorgonCondition.supported,
                }),
              }),
        }),
      ),
    ),
  });
}

function presentedEncounterPhases(
  encounterPhases: readonly WorkspaceEncounterPhase[],
): readonly WorkspaceEncounterPhase[] {
  return Object.freeze(
    encounterPhases.filter(
      (phase) =>
        phase.customizable ||
        phase.marker.findingCount > 0 ||
        phase.traitOffer !== undefined ||
        phase.figLeaf !== undefined ||
        phase.gorgonCondition !== undefined ||
        phase.gorgonAthena !== undefined,
    ),
  );
}

function roomFeatures(
  zagreusSpawn: WorkspaceRoomSummary['zagreusSpawn'],
  naturalChaosSpawn: WorkspaceRoomSummary['naturalChaosSpawn'],
): readonly WorkspaceRoomFeature[] {
  return Object.freeze([
    ...(zagreusSpawn?.materialized === true
      ? [Object.freeze({ kind: 'zagreusContract' as const, control: zagreusSpawn })]
      : []),
    ...(naturalChaosSpawn === undefined
      ? []
      : [Object.freeze({ kind: 'naturalChaos' as const, control: naturalChaosSpawn })]),
  ]);
}

function shipWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: Extract<WorkspaceRoomLocal, { readonly kind: 'ship' }>,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  const activeWheels = roomLocal.wheels.filter((wheel) => wheel.active);
  for (const phase of roomLocal.phases) {
    if (phase.rewardWheelKey === undefined) continue;
    const wheel = activeWheels.find((candidate) => candidate.key === phase.rewardWheelKey);
    if (wheel === undefined || wheel.encounterPhaseKey !== phase.key) {
      throw new StructuredWorkspaceProjectionContractError(
        `Active Ship phase ${phase.key} has no matching projected wheel ${phase.rewardWheelKey}`,
      );
    }
  }
  const phaseIndexForWheel = (wheelKey: string): number => {
    const wheel = activeWheels.find((candidate) => candidate.key === wheelKey);
    if (wheel === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Ship room action references inactive wheel ${wheelKey}`,
      );
    }
    const phaseIndex = roomLocal.phases.findIndex(
      (phase) => phase.key === wheel.encounterPhaseKey && phase.rewardWheelKey === wheel.key,
    );
    if (phaseIndex >= 0) return phaseIndex;
    throw new StructuredWorkspaceProjectionContractError(
      `Ship wheel ${wheelKey} has no active declaration-owned encounter phase`,
    );
  };
  const phaseIndexForWindow = (window: WorkspaceRoomActionRow['window']): number => {
    switch (window.kind) {
      case 'shipPreCombat': {
        const wheelPhaseIndex = phaseIndexForWheel(window.wheelKey);
        if (wheelPhaseIndex > 0) return wheelPhaseIndex - 1;
        throw new StructuredWorkspaceProjectionContractError(
          `Ship pre-combat action ${window.wheelKey} has no preceding phase`,
        );
      }
      case 'shipPostCombat':
        return phaseIndexForWheel(window.wheelKey);
      case 'postOutgoing':
        return roomLocal.phases.length - 1;
      case 'standard': {
        if (window.phase !== 'afterCombat') {
          throw new StructuredWorkspaceProjectionContractError(
            `Ship room action published unsupported ${window.phase} standard window`,
          );
        }
        return 0;
      }
      case 'fields':
        throw new StructuredWorkspaceProjectionContractError(
          'Ship room action published a Fields lifecycle window',
        );
    }
  };
  const activeActionRows = roomActions?.rows.filter((row) => !row.stale) ?? [];
  const phases: WorkspaceShipPhasePresentation[] = roomLocal.phases.map((phase, index) => {
    const encounter = encounterPhases.find((candidate) => candidate.address.phaseKey === phase.key);
    const followingPhase = roomLocal.phases[index + 1];
    const wheel = activeWheels.find(
      (candidate) => candidate.encounterPhaseKey === followingPhase?.key,
    );
    return Object.freeze({
      actionRows: Object.freeze(
        activeActionRows.filter((row) => phaseIndexForWindow(row.window) === index),
      ),
      checkpoints: Object.freeze(
        roomActions?.checkpoints.filter(
          (checkpoint) => phaseIndexForWindow(checkpoint.window) === index,
        ) ?? [],
      ),
      ...(encounter === undefined ? {} : { encounter }),
      key: phase.key,
      label: phase.label,
      ...(wheel === undefined ? {} : { wheel }),
    });
  });
  return Object.freeze({
    combatPhaseCount: roomLocal.combatPhaseCount,
    features,
    kind: 'ship' as const,
    phases: Object.freeze(phases),
    repairRows: Object.freeze(roomActions?.rows.filter((row) => row.stale) ?? []),
    ...(roomActions === undefined ? {} : { roomActions }),
  });
}

function roomWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: WorkspaceRoomLocal,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  const presented = presentedEncounterPhases(encounterPhases);
  switch (roomLocal.kind) {
    case 'fields':
      return Object.freeze({
        encounterPhases: presented,
        features,
        fields: roomLocal,
        kind: 'fields' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
    case 'ship':
      return shipWorkbenchPresentation(presented, features, roomLocal, roomActions);
    case 'shop':
      return Object.freeze({
        features,
        kind: 'shop' as const,
        shop: roomLocal,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze({
        encounterPhases: presented,
        features,
        kind: 'standard' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
  }
}

function occurrenceInteractionRequirements(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
): readonly WorkspaceOccurrenceInteractionRequirement[] {
  const requirements: WorkspaceOccurrenceInteractionRequirement[] = [];
  const topLevelEncounterRequirement = encounterPhaseInteractionRequirement(
    room.address,
    room.encounterPhases,
  );
  if (topLevelEncounterRequirement !== undefined) requirements.push(topLevelEncounterRequirement);

  if (room.zagreusSpawn?.materialized === true) {
    requirements.push(
      Object.freeze({ kind: 'zagreusSpawn' as const, owner: room.zagreusSpawn.owner }),
    );
  }
  if (room.naturalChaosSpawn !== undefined) {
    requirements.push(
      Object.freeze({ kind: 'naturalChaosSpawn' as const, owner: room.naturalChaosSpawn.owner }),
    );
  }
  if (room.roomActions !== undefined) {
    requirements.push(
      Object.freeze({
        kind: 'roomActions' as const,
        owner: room.roomActions.owner,
        proposals: room.roomActions.proposals,
      }),
    );
  }

  switch (room.roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze(requirements);
    case 'fields':
      return Object.freeze(requirements);
    case 'ship': {
      const declaration = requireRoom(catalog, room.gameName);
      const wheels = room.roomLocal.wheels.map((wheel) => {
        const attachment = requireRewardWheelAttachment(catalog, declaration, wheel.key);
        return Object.freeze({
          address: wheel.address,
          offerCount: wheel.offerCount,
          offerCountChoices: Object.freeze(
            Array.from(
              { length: attachment.offerCount.max - attachment.offerCount.min + 1 },
              (_, index) => {
                const value = attachment.offerCount.min + index;
                return Object.freeze({ label: String(value), value });
              },
            ),
          ),
          pickChoices: Object.freeze(
            Array.from({ length: wheel.offerCount }, (_, index) => {
              const value = index + 1;
              return Object.freeze({ label: `Offer ${value}`, value });
            }),
          ),
          pickedOfferIndex: wheel.pickedOfferIndex,
          storeKey: wheel.storeKey,
          storeChoices: Object.freeze(
            attachment.reward.storeKeys.map((value) =>
              Object.freeze({ label: workspaceRewardStoreLabel(value), value }),
            ),
          ),
        });
      });
      requirements.push(
        Object.freeze({
          combatPhaseCount: room.roomLocal.combatPhaseCount,
          combatPhaseCountChoices: Object.freeze([
            Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
            Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
          ]),
          kind: 'shipCombatPhaseCount' as const,
          owner: room.address,
          wheels: Object.freeze(wheels),
        }),
      );
      return Object.freeze(requirements);
    }
    case 'shop': {
      const shop = room.roomLocal;
      if (!shop.materialized) {
        return Object.freeze(requirements);
      }
      if (shop.deathDefianceCondition !== undefined) {
        requirements.push(
          Object.freeze({
            kind: 'shopDeathDefianceCondition' as const,
            owner: room.address,
            value: shop.deathDefianceCondition.value,
          }),
        );
      }
      return Object.freeze(requirements);
    }
  }
}

/**
 * Assemble one reachable authored occurrence without consulting topology,
 * source indexes, candidate services, or registrations from other occurrences.
 */
export function assembleWorkspaceOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
): WorkspaceOccurrenceAssembly {
  const { occurrence } = input;
  const room = requireRoom(input.catalog, occurrence.gameName);
  const address = createOccurrenceAddress(input.biome, occurrence.occurrenceId);
  const entered = input.evaluatedRoom?.entered ?? false;
  const rewardControls = controlsForOccurrence(input, room);
  const roomControls =
    input.roomPicker === undefined ? Object.freeze([]) : Object.freeze([input.roomPicker]);
  const encounterPhases = input.facts.detailsActive
    ? activeEncounterPhasesForOwner(
        input,
        room,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        occurrence.encounters,
        {
          ...(occurrence.state.kind === 'shipCombat'
            ? { shipEncounterCount: occurrence.state.encounterCount }
            : {}),
          ...(occurrence.state.kind === 'fieldsCombat'
            ? {
                fieldsCageRewardCount: input.fieldsBatchFacts?.doorCageRewardCount ?? 0,
              }
            : {}),
        },
      )
    : Object.freeze([]);
  const roomLocal = roomLocalForOccurrence(input, room, rewardControls);
  const zagreusDeclaration = room.additionalExits.find(
    (candidate) => candidate.kind === 'zagreusContract',
  );
  const zagreusSpawn =
    zagreusDeclaration === undefined ||
    input.facts.authoredAdditionalExitKeys.includes(zagreusDeclaration.key) ||
    !input.facts.detailsActive ||
    roomLocal.kind !== 'shop' ||
    !roomLocal.materialized
      ? undefined
      : (() => {
          const owner = createAdditionalExitAddress(
            input.biome,
            occurrence.occurrenceId,
            zagreusDeclaration.key,
          );
          return Object.freeze({
            marker: input.markerDestinations.marker(owner),
            materialized: true,
            owner,
          });
        })();
  const naturalChaosDeclaration = room.additionalExits.find(
    (candidate) => candidate.kind === 'naturalChaos',
  );
  const naturalChaosSpawn =
    naturalChaosDeclaration === undefined ||
    input.facts.authoredAdditionalExitKeys.includes(naturalChaosDeclaration.key) ||
    !input.facts.detailsActive
      ? undefined
      : (() => {
          const owner = createAdditionalExitAddress(
            input.biome,
            occurrence.occurrenceId,
            naturalChaosDeclaration.key,
          );
          return Object.freeze({
            marker: input.markerDestinations.marker(owner),
            owner,
          });
        })();
  const pickupRewardControls =
    !input.facts.detailsActive || occurrence.acquisitionSites === undefined
      ? Object.freeze([])
      : (() => {
          const pickupProducer = selectedPickupProducer(input.catalog, occurrence.encounters);
          const activePickups = pickupProducer?.pickups ?? Object.freeze([]);
          const activeKeys = new Set(activePickups.map((pickup) => pickup.key));
          const structuralEchoKeys = new Set(
            echoLastRewardPickupEntryKeys(input.catalog, occurrence.encounters),
          );
          return Object.freeze(
            Object.entries(occurrence.acquisitionSites).flatMap(([siteKey, state]) => {
              if (occurrence.state.kind === 'shop' && siteKey === 'roomExit') return [];
              const site = acquisitionSiteFromStorageKey(address, siteKey);
              if (site === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${semanticAddressKey(address)} has invalid acquisition site ${siteKey}`,
                );
              }
              const derivedEntries = input.derivedAcquisitionEntries?.(site) ?? Object.freeze([]);
              return Object.entries(state.pickupEntries ?? {}).flatMap(([key, reward]) => {
                if (siteKey === 'roomExit' && structuralEchoKeys.has(key) && !activeKeys.has(key)) {
                  return [];
                }
                const pickup =
                  siteKey === 'roomExit'
                    ? activePickups.find((candidate) => candidate.key === key)
                    : undefined;
                const capability = derivedEntries.find(
                  (entry) => entry.kind === 'echoLastReward' && entry.address.entryKey === key,
                );
                const rewardTypes =
                  capability?.rewardTypes ??
                  (pickup?.rewardType === undefined
                    ? Object.freeze([])
                    : Object.freeze([pickup.rewardType]));
                const entry = createAcquisitionEntryAddress(site, key);
                return [
                  rewardControl(
                    input,
                    { kind: 'acquisitionEntry' as const, address: entry },
                    undefined,
                    reward?.offer ?? null,
                    reward,
                    rewardTypes,
                    undefined,
                    capability?.retainedSourceMismatch === true,
                  ) as WorkspaceExplicitRewardControl,
                ];
              });
            }),
          );
        })();
  const supplementalRewardControls = Object.freeze(
    roomLocal.kind !== 'shop'
      ? []
      : roomLocal.supplementalOffers.flatMap((offer) =>
          'rewardControl' in offer ? [offer.rewardControl] : [],
        ),
  );
  const allRewardControls = Object.freeze([
    ...rewardControls,
    ...pickupRewardControls,
    ...supplementalRewardControls,
  ]);
  const roomActions = roomActionsForOccurrence(
    input,
    roomLocal,
    encounterPhases,
    allRewardControls,
  );
  const localDetailMarkers = Object.freeze([
    ...encounterPhases.flatMap((phase) => [
      phase.marker,
      ...(phase.traitOffer === undefined ? [] : [phase.traitOffer.marker]),
      ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker]),
    ]),
    ...workspaceLocalDetailMarkers(roomLocal),
    ...(roomActions?.rows.map((row) => row.marker) ?? []),
    ...(zagreusSpawn === undefined ? [] : [zagreusSpawn.marker]),
    ...(naturalChaosSpawn === undefined ? [] : [naturalChaosSpawn.marker]),
  ]);
  const features = roomFeatures(zagreusSpawn, naturalChaosSpawn);
  const workbench = roomWorkbenchPresentation(encounterPhases, features, roomLocal, roomActions);
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    detailsActive: input.facts.detailsActive,
    encounterPhases,
    entered,
    gameName: occurrence.gameName,
    kind: room.kind,
    label: room.label,
    localDetailMarkers,
    marker: input.markerDestinations.marker(address),
    occurrenceId: occurrence.occurrenceId,
    ...(roomActions === undefined ? {} : { roomActions }),
    ...(occurrence.state.kind !== 'anomaly'
      ? {}
      : (() => {
          if (input.anomalyReplacementRoomGameNames === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(address)} Anomaly has no declared replacement map domain`,
            );
          }
          if (occurrence.anomalyReplacement === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(address)} Anomaly has no replacement provenance`,
            );
          }
          const remembered = requireRoom(
            input.catalog,
            occurrence.anomalyReplacement.replacedRoomGameName,
          );
          return {
            anomaly: Object.freeze({
              mapChoices: Object.freeze(
                input.anomalyReplacementRoomGameNames.map((gameName) => {
                  const map = requireRoom(input.catalog, gameName);
                  return Object.freeze({ label: map.label, value: map.gameName });
                }),
              ),
              rememberedRoomLabel: remembered.label,
              success: occurrence.state.success,
            }),
          };
        })()),
    ...(input.roomPicker === undefined ? {} : { roomPicker: input.roomPicker }),
    ...(zagreusSpawn === undefined ? {} : { zagreusSpawn }),
    ...(naturalChaosSpawn === undefined ? {} : { naturalChaosSpawn }),
    roomLocal,
    rewardControls: allRewardControls,
    workbench,
  });
  const node: WorkspaceOccurrenceWorkbenchNode = Object.freeze({
    inspectorPresentation: 'full' as const,
    kind: 'occurrenceWorkbench' as const,
    key: `occurrence:${semanticAddressKey(address)}`,
    localDetailMarkers: roomSummary.localDetailMarkers,
    marker: roomSummary.marker,
    room: roomSummary,
  });
  const localInteractionRequirements = occurrenceInteractionRequirements(
    input.catalog,
    roomSummary,
  );
  input.markerDestinations.redirect(workspaceOccurrenceOwnedMarkers(node.room), node.key);
  return Object.freeze({
    node,
    occurrenceInteractionRequirements: localInteractionRequirements,
    roomControls,
    rewardControls: allRewardControls,
  });
}
