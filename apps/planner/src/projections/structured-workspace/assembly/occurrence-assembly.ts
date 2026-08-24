import {
  createAcquisitionSiteAddress,
  createAdditionalExitAddress,
  createEncounterPhaseAddress,
  createJudgmentArcanaAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRoomActionAddress,
  createRoomRunStateCheckpointAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createKeepsakeEquipResultAddress,
  createTraitOfferAddress,
  createGorgonPhaseAddress,
  createNemesisRandomEventAddress,
  nemesisGeneratedPickupSiteKey,
  materializeGorgonAthenaOffer,
  createCirceResolutionAddress,
  createTraitAcquisitionTargetAddress,
  createEchoPomTargetAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createPostbossKeepsakeSelectionAddress,
  createAllTogetherSetAddress,
  createNaturalSelectionResultAddress,
  createLevelResolutionAddress,
  createAcquisitionRoleAddress,
  traitOfferOption,
  semanticAddressKey,
  type BiomeAddress,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type EncounterPhaseAddress,
  type RoomOccurrence,
  type OccurrenceAddress,
  type SemanticAddress,
  type RoomActionSemanticAddress,
  type RoomRunStateCheckpointAddress,
  type AuthoredRewardState,
  type AuthoredTraitOffer,
  type TraitOfferAddress,
  type LevelResolutionAddress,
  type KeepsakeEquipResultAddress,
  roomActionKey,
  acquisitionSiteFromStorageKey,
  artificerReplacementEntryKey,
  parseArtificerReplacementEntryKey,
  activeSelectedPickupProducers,
  echoLastRewardPickupEntryKey,
  parseEchoLastRewardPickupEntryKey,
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
  RoomLifecycleTimeline,
  RunStateAvailability,
  RunStateSnapshot,
  SelectedLevelResolutionAssessment,
} from '@run-planner/engine/simulation';
import {
  appendSteadyGrowthTimelineEffects,
  encounterPhaseAuthoringDomainForRoom,
  scopeRoomLifecycleTimeline,
  fieldsOptionalRewardCountSupport,
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
  type WorkspaceShopPurchaseDescriptor,
  type WorkspaceTraitOfferControl,
  type WorkspaceAcquisitionConversionControl,
  type WorkspaceLevelResolutionControl,
  type WorkspaceRoomLocal,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
  type WorkspaceRoomActions,
  type WorkspaceRoomActionProposal,
  type WorkspaceRoomLifecycleTimeline,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRoomTab,
  type WorkspaceRoomActionRow,
  type WorkspaceRoomFeature,
  type WorkspaceRoomWorkbenchPresentation,
  type WorkspaceShipPhasePresentation,
  type WorkspaceShipStructurePhase,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceShopSupplementalDescriptor,
  type WorkspaceMarker,
  type WorkspaceTraitOfferStatus,
  type WorkspaceNaturalSelectionControl,
  type WorkspaceRunStateLauncher,
  type WorkspaceSteadyGrowthControl,
  workspaceInteractionKey,
} from '../contract';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';
import {
  workspaceLocalDetailMarkers,
  workspaceOccurrenceOwnedMarkers,
} from '../navigation/marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { workspaceRewardStoreLabel } from './reward-labels';
import { presentRunState } from '../presentation/run-state';

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
  readonly steadyGrowthOutcomes?: readonly import('@run-planner/engine/simulation').BiomeRewardSimulation['steadyGrowthOutcomes'][number][];
  readonly isActiveTraitOffer: (owner: TraitOfferAddress) => boolean;
  readonly judgmentArcanaCapability?: (
    address: import('@run-planner/engine/authored-project').JudgmentArcanaAddress,
  ) =>
    { readonly inactiveArcanaKeys: readonly string[]; readonly requiredCount: number } | undefined;
  readonly keepsakeEquipResultSupported?: (address: KeepsakeEquipResultAddress) => boolean;
  readonly derivedAcquisitionEntries?: (
    site: AcquisitionSiteAddress,
  ) => readonly WorkspaceDerivedAcquisitionEntry[];
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly ordinaryRewardForfeited: (owner: RewardCandidateOwner) => boolean;
  readonly occurrence: RoomOccurrence;
  readonly runState: (owner: RoomRunStateCheckpointAddress) =>
    | { readonly availability: 'available'; readonly snapshot: RunStateSnapshot }
    | {
        readonly availability: 'unavailable';
        readonly reason?: RunStateAvailability['reason'];
      }
    | undefined;
  readonly resourceAuthoring?: import('@run-planner/engine/simulation').RouteResourceAuthoring;
  /** Semantic entry ownership, independent of whether the entry room is selectable. */
  readonly isEntry?: boolean;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

/** Immutable occurrence-owned workspace products consumed by decision and Hub assembly. */
export interface WorkspaceOccurrenceAssembly {
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  readonly occurrenceInteractionRequirements: readonly WorkspaceOccurrenceInteractionRequirement[];
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly runStateLaunchers: readonly WorkspaceRunStateLauncher[];
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
  /** Semantic entry ownership, independent of whether the entry room is selectable. */
  readonly isEntry?: boolean;
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

function traitOfferStatus(
  marker: WorkspaceMarker,
  offer: AuthoredTraitOffer | null,
  contextMarker = marker,
  contextInvalid = false,
): WorkspaceTraitOfferStatus {
  return offer === null
    ? 'unspecified'
    : contextInvalid || marker.findingCount > 0 || contextMarker.findingCount > 0
      ? 'invalid'
      : 'valid';
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
    // Exact engine candidate capability distinguishes reached spell children.
    // Unreached authored children remain retained but publish no app controls.
    if (giver.providerKind === 'spell' && !input.isActiveTraitOffer(address)) continue;
    if (offer === null) {
      const marker = input.markerDestinations.marker(address);
      controls.push(
        Object.freeze({
          acquisitionRoleLabel: workspaceAcquisitionRoleLabel(acquisitionRole),
          address,
          giver,
          marker,
          offer: null,
          rewardOwner: owner.address,
          status: traitOfferStatus(marker, null),
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
    const naturalSelection =
      offer.kind !== 'traits' || selectedDisposition?.kind !== 'naturalSelection'
        ? undefined
        : (() => {
            const naturalAddress = createNaturalSelectionResultAddress(
              address,
              offer.selectedOptionKey,
            );
            return Object.freeze({
              address: naturalAddress,
              marker: input.markerDestinations.marker(naturalAddress),
              optionKey: offer.selectedOptionKey,
              slotCount: selectedDisposition.levelCount,
            }) satisfies WorkspaceNaturalSelectionControl;
          })();
    const marker = input.markerDestinations.marker(address);
    controls.push(
      Object.freeze({
        acquisitionRoleLabel: workspaceAcquisitionRoleLabel(acquisitionRole),
        address,
        giver,
        marker,
        offer,
        rewardOwner: owner.address,
        status: traitOfferStatus(marker, offer),
        ...(traitAcquisitionTarget === undefined ? {} : { traitAcquisitionTarget }),
        ...(circeResolution === undefined ? {} : { circeResolution }),
        ...(allTogetherSets === undefined ? {} : { allTogetherSets }),
        ...(naturalSelection === undefined ? {} : { naturalSelection }),
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
      const marker = input.markerDestinations.marker(address);
      const selectedTarget =
        value.kind === 'choice' ? value.selectedTraitKey : value.targetTraitKey;
      const settledEmptyNoOp =
        value.kind === 'random' &&
        value.targetTraitKey === null &&
        assessment.branches.some(
          (branch) =>
            branch.emptyTargetAllowed &&
            branch.eligibleTargetCount === 0 &&
            branch.findings.length === 0,
        );
      return [
        Object.freeze({
          acquisitionRoleLabel: workspaceAcquisitionRoleLabel(acquisitionRole),
          address,
          levelCount,
          settledEmptyNoOp,
          marker,
          rewardOwner: owner.address,
          status:
            selectedTarget === null && !settledEmptyNoOp
              ? ('unspecified' as const)
              : marker.findingCount > 0
                ? ('invalid' as const)
                : ('valid' as const),
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
  fixedOfferEdit?: WorkspaceRewardControl['fixedOfferEdit'],
  suppressOfferPicker = false,
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
          fixedOfferEdit !== undefined
            ? ('visible' as const)
            : suppressOfferPicker
              ? ('hidden' as const)
              : offer === null || offer.payload !== undefined || retainedSourceMismatch
                ? ('visible' as const)
                : ('hidden' as const),
        ...(fixedOfferEdit === undefined ? {} : { fixedOfferEdit }),
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
      const reward = occurrence.state.reward;
      const hasAuthoredAcquisitionChildren =
        reward !== null &&
        (Object.keys(reward.traitOffersByAcquisitionRole).length > 0 ||
          Object.keys(reward.levelResolutionsByAcquisitionRole ?? {}).length > 0 ||
          Object.values(reward.dispositionByAcquisitionRole).some(
            (disposition) => disposition.kind !== 'normal',
          ));
      if (rewardType?.payloadDomain !== undefined || hasAuthoredAcquisitionChildren) {
        controls.push(
          rewardControl(
            input,
            { kind: 'incomingReward', address: incoming },
            undefined,
            offer,
            reward,
            Object.freeze(offer === null ? [] : [offer.rewardType]),
            undefined,
            false,
            undefined,
            rewardType?.payloadDomain === undefined,
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
        ? { athenaTriggerConditionMet: false as const }
        : authoredGorgonResult;
    const retainedGorgon =
      gorgonResult?.athenaTriggerConditionMet === true || gorgonResult?.athenaOffer !== undefined;
    const fixedPhase = domain.declaredEncounterKeys.length === 1;
    const fieldsPassive =
      room.mode.kind === 'authored' &&
      room.mode.templateKey === 'FieldsCombat' &&
      domain.slotKey === 'Passive';
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
      !retainedGorgon &&
      !fieldsPassive
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
    const nemesisEvent =
      selectedDefinition.key === 'NemesisRandomEvent'
        ? Object.freeze({
            owner: createNemesisRandomEventAddress(address),
            reward:
              input.occurrence?.acquisitionSites?.[nemesisGeneratedPickupSiteKey(domain.slotKey)]
                ?.pickupEntries?.result?.offer ?? null,
            value: encounters.nemesisRandomEventByPhase?.[domain.slotKey] ?? null,
          })
        : undefined;
    const producer = selectedDefinition.traitOfferProducer;
    const authoredTraitOffer =
      input.facts.detailsActive && producer !== undefined
        ? encounters.traitOffersByPhase?.[domain.slotKey]?.[selectedDefinition.key]
        : undefined;
    const gorgonPhaseAddress = createGorgonPhaseAddress(address);
    const gorgonAthenaOffer =
      input.facts.detailsActive && gorgonResult?.athenaTriggerConditionMet === true
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
    const gorgonTraitAddress = createTraitOfferAddress(gorgonPhaseAddress, 'gorgonAthena');
    const gorgonTraitMarker = input.markerDestinations.marker(gorgonTraitAddress);
    const gorgonPhaseMarker = input.markerDestinations.marker(gorgonPhaseAddress);
    const gorgonAthena =
      input.facts.detailsActive &&
      gorgonResult?.athenaTriggerConditionMet === true &&
      gorgonResult.athenaOffer !== undefined &&
      gorgonGiver !== undefined
        ? Object.freeze({
            acquisitionRoleLabel: 'Gorgon Athena',
            address: gorgonTraitAddress,
            giver: gorgonGiver,
            marker: gorgonTraitMarker,
            offer: gorgonResult.athenaOffer === null ? null : gorgonAthenaOffer!,
            rarityEditable: false,
            rewardOwner: gorgonPhaseAddress,
            status: traitOfferStatus(
              gorgonTraitMarker,
              gorgonResult.athenaOffer === null ? null : gorgonAthenaOffer!,
              gorgonPhaseMarker,
              gorgonSupport?.supported === false,
            ),
          })
        : undefined;
    const giver =
      producer === undefined ? undefined : input.catalog.traitGivers.byKey[producer.giverKey];
    const traitOffer =
      authoredTraitOffer !== undefined && producer !== undefined && giver !== undefined
        ? (() => {
            const traitAddress = createTraitOfferAddress(address, 'selection');
            if (authoredTraitOffer === null) {
              const marker = input.markerDestinations.marker(traitAddress);
              return Object.freeze({
                acquisitionRoleLabel: 'Selection',
                address: traitAddress,
                giver,
                marker,
                offer: null,
                rewardOwner: address,
                status: traitOfferStatus(marker, null),
              });
            }
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
            const marker = input.markerDestinations.marker(traitAddress);
            return Object.freeze({
              acquisitionRoleLabel: 'Selection',
              address: traitAddress,
              giver,
              marker,
              offer: authoredTraitOffer,
              rewardOwner: address,
              status: traitOfferStatus(marker, authoredTraitOffer),
              ...(traitAcquisitionTarget === undefined ? {} : { traitAcquisitionTarget }),
              ...(circeResolution === undefined ? {} : { circeResolution }),
              ...(echoPomTarget === undefined ? {} : { echoPomTarget }),
              ...(echoLastRunBoon === undefined ? {} : { echoLastRunBoon }),
              ...(echoLastReward === undefined ? {} : { echoLastReward }),
            });
          })()
        : undefined;
    phases.push(
      Object.freeze({
        address,
        candidateChoices,
        customizable: domain.declaredEncounterKeys.length > 1 && !fieldsPassive,
        label:
          room.encounterEnvelopeKey === 'PEncounter'
            ? domain.slotKey === 'Intro'
              ? 'Opening encounter'
              : domain.slotKey === 'Combat'
                ? 'Follow-up encounter'
                : domain.slotKey
            : domain.slotKey,
        marker: input.markerDestinations.marker(address),
        timelineAnchor: fieldsPassive
          ? selectedDefinition.key === 'NemesisRandomEvent'
            ? 'action'
            : 'roomEntered'
          : 'encounterStart',
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
                selected: gorgonResult.athenaTriggerConditionMet,
                supported: gorgonSupported,
              }),
            }),
        ...(gorgonAthena === undefined ? {} : { gorgonAthena }),
        resettable: domain.selectedEncounterKey !== domain.defaultEncounterKey,
        selectedEncounter: Object.freeze({
          key: selectedDefinition.key,
          label: selectedDefinition.label,
        }),
        ...(fieldsPassive && domain.declaredEncounterKeys.includes('NemesisRandomEvent')
          ? {
              nemesisFeature: Object.freeze({
                encounterKey: 'NemesisRandomEvent',
                selected: selectedDefinition.key === 'NemesisRandomEvent',
              }),
            }
          : {}),
        ...(nemesisEvent === undefined ? {} : { nemesisEvent }),
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
  if (capability === undefined) return undefined;
  const authored = context.pickupEntries[INFERNAL_CONTRACT_ENTRY_KEY];
  if (authored === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} contract opportunity has no structural child`,
    );
  }
  if (capability.rewardTypes === undefined) {
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
  const pickupLabel = (subject: string): string => {
    if (rewardControl?.offer === null || rewardControl?.offer === undefined)
      return `Interact with ${subject} pickup`;
    const summary = summarizeRewardOffer(catalog, rewardControl.offer);
    const label = `Interact with ${subject} pickup`;
    if (summary === subject) return label;
    return summary.startsWith(`${subject} · `)
      ? `${label} · ${summary.slice(subject.length + 3)}`
      : `${label} · ${summary}`;
  };
  const phase =
    'phaseKey' in reference
      ? encounterPhases.find((candidate) => candidate.address.phaseKey === reference.phaseKey)
      : undefined;
  switch (reference.kind) {
    case 'completeFieldsCage':
      return `Complete ${phase?.label ?? reference.phaseKey}`;
    case 'interactIncomingReward':
      return pickupLabel(workspaceAcquisitionRoleLabel(reference.acquisitionRole));
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
      return pickupLabel(local?.label ?? reference.slotKey);
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
      return pickupLabel(wheel?.label ?? `${reference.wheelKey} reward`);
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
      const entryLabel =
        parseArtificerReplacementEntryKey(reference.entryKey) !== undefined
          ? 'Artificer'
          : parseEchoLastRewardPickupEntryKey(reference.entryKey) !== undefined
            ? 'Reward Reward Reward replay'
            : rewardControl?.kind === 'explicitReward' && rewardControl.rewardTypes.length === 1
              ? (catalog.rewards.rewardTypes.byKey[rewardControl.rewardTypes[0]!]?.label ??
                reference.entryKey)
              : reference.entryKey;
      return pickupLabel(supplemental?.label ?? entryLabel);
    }
    case 'useFountain':
      return 'Use fountain';
    case 'interactKeepsakeRack':
      return 'Choose keepsake';
  }
}

/**
 * Adapt the engine-owned roster and lifecycle products without re-owning their
 * participation, repair, proposal, or timeline policy. Occurrence assembly
 * enriches these rows with reward controls below.
 */
export function assembleBaseWorkspaceRoomActions(input: {
  readonly roster: import('@run-planner/engine/simulation').RoomActionRoster;
  readonly lifecycleTimeline: RoomLifecycleTimeline;
  readonly owner: OccurrenceAddress;
  readonly markerFor: (address: RoomActionSemanticAddress) => WorkspaceMarker;
  readonly labelFor: (
    reference: import('@run-planner/engine/authored-project').RoomActionReference,
  ) => string;
  readonly proposalFilter?: (
    proposal: import('@run-planner/engine/simulation').RoomActionProposal,
  ) => boolean;
  readonly boundaryFilter?: (boundary: WorkspaceRoomLifecycleBoundary) => boolean;
}): WorkspaceRoomActions {
  const proposals = input.roster.proposals
    .filter((proposal) => input.proposalFilter?.(proposal) ?? true)
    .map((proposal, index) =>
      Object.freeze({
        kind: proposal.kind,
        key: `${proposal.kind}:${index}:${roomActionKey(proposal.reference)}`,
        label:
          proposal.kind === 'remove'
            ? 'Remove from timeline'
            : `${proposal.kind === 'insert' ? 'Insert' : 'Move'} to position ${(proposal.toIndex ?? 0) + 1}`,
        reference: proposal.reference,
        structurallyAuthorable: proposal.structurallyAuthorable,
        ...(proposal.toIndex === undefined ? {} : { toIndex: proposal.toIndex }),
      }),
    );
  const keysByAction = new Map<string, string[]>();
  for (const proposal of proposals) {
    const key = roomActionKey(proposal.reference);
    keysByAction.set(key, [...(keysByAction.get(key) ?? []), proposal.key]);
  }
  const issuesFor = (actionKey: string): readonly string[] =>
    Object.freeze(
      input.roster.issues.flatMap((issue) => {
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
  const rows = Object.freeze(
    input.roster.rows.map((row) =>
      Object.freeze({
        address: row.owner as RoomActionSemanticAddress,
        executable: row.executable,
        issues: issuesFor(row.key),
        key: row.key,
        label: input.labelFor(row.reference),
        marker: input.markerFor(row.owner as RoomActionSemanticAddress),
        participation: row.participation,
        proposalKeys: Object.freeze(keysByAction.get(row.key) ?? []),
        rank: row.rank,
        reference: row.reference,
        stale: row.stale,
        window: row.window,
      }),
    ),
  );
  const repair = input.lifecycleTimeline.repairRows.flatMap(({ key }) => {
    const row = rows.find((candidate) => candidate.key === key);
    return row === undefined ? [] : [row];
  });
  const optionalRows = Object.freeze(
    repair.filter((row) => row.rank === null && !row.stale && row.participation === 'optional'),
  );
  const optionalKeys = new Set(optionalRows.map((row) => row.key));
  const entries: WorkspaceRoomLifecycleTimeline['entries'][number][] = [];
  for (const entry of input.lifecycleTimeline.entries) {
    if (entry.kind === 'action') {
      entries.push(
        Object.freeze({
          kind: 'action' as const,
          actionKey: entry.action.key,
          rank: entry.rank,
          presentation: 'row' as const,
          ...(entry.phaseKey === undefined ? {} : { phaseKey: entry.phaseKey }),
        }),
      );
    } else if (
      entry.kind === 'boundary' &&
      (input.boundaryFilter === undefined || input.boundaryFilter(entry.boundary))
    ) {
      entries.push(
        Object.freeze({
          kind: 'boundary' as const,
          boundary: entry.boundary,
          rank: entry.rank,
          placement: entry.placement,
        }),
      );
    }
  }
  return Object.freeze({
    interactionKey: semanticAddressKey(input.owner),
    owner: input.owner,
    rows,
    proposals: Object.freeze(proposals),
    checkpoints: Object.freeze(
      input.roster.checkpoints
        .filter((checkpoint) => checkpoint.checkpointKey !== 'outgoingGeneration')
        .map((checkpoint) =>
          Object.freeze({
            key: checkpoint.checkpointKey,
            label: checkpoint.label,
            afterRank: checkpoint.afterRank,
            window: checkpoint.window,
          }),
        ),
    ),
    optionalRows,
    repairRows: Object.freeze(repair.filter((row) => !optionalKeys.has(row.key))),
    timeline: Object.freeze({
      entries: Object.freeze(entries),
      boundaries: Object.freeze(
        input.lifecycleTimeline.boundaries.filter(
          (boundary) => input.boundaryFilter?.(boundary) ?? true,
        ),
      ),
    }),
  });
}

function roomActionsForOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  controls: readonly WorkspaceRewardControl[],
): WorkspaceRoomActions | undefined {
  const roster = input.evaluatedRoom?.roomActionRoster;
  const lifecycleTimeline = input.evaluatedRoom?.roomLifecycleTimeline;
  if (
    roster === undefined ||
    lifecycleTimeline === undefined ||
    input.evaluatedRoom?.entered !== true
  )
    return undefined;
  const owner = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const contractAvailable =
    roomLocal.kind === 'shop' &&
    roomLocal.supplementalOffers.some((offer) => offer.kind === 'infernalContractReward');
  const suppressUnavailableContract = (row: (typeof roster.rows)[number]): boolean =>
    !contractAvailable &&
    row.rank === null &&
    row.reference.kind === 'interactAcquisitionEntry' &&
    row.reference.entryKey === INFERNAL_CONTRACT_ENTRY_KEY;
  const suppressedActionKeys = new Set(
    roster.rows.filter(suppressUnavailableContract).map((row) => row.key),
  );
  const presentedRows = roster.rows.filter((row) => !suppressUnavailableContract(row));
  const presentedActionKeys = new Set(presentedRows.map((row) => row.key));
  const proposals = roster.proposals
    .filter((proposal) => presentedActionKeys.has(roomActionKey(proposal.reference)))
    .map((proposal, index) =>
      Object.freeze({
        kind: proposal.kind,
        key: `${proposal.kind}:${index}:${roomActionKey(proposal.reference)}`,
        label:
          proposal.kind === 'remove'
            ? 'Remove from timeline'
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
  const projectedRows = Object.freeze(
    presentedRows.map((row) => {
      const address = createRoomActionAddress(input.biome, input.occurrence.occurrenceId, row.key);
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
            semanticAddressKey(candidate.gorgonAthena.rewardOwner) === semanticAddressKey(row.owner)
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
      const artificerConversion = resolvedRewardControl?.conversions?.find(
        (conversion) => conversion.value.kind === 'artificer',
      );
      const artificerOutput =
        artificerConversion === undefined
          ? undefined
          : (() => {
              const entryKey = artificerReplacementEntryKey(
                artificerConversion.rewardOwner,
                artificerConversion.address.acquisitionRole,
              );
              const replacementRow = presentedRows.find(
                (candidate) =>
                  candidate.reference.kind === 'interactAcquisitionEntry' &&
                  candidate.reference.entryKey === entryKey,
              );
              if (replacementRow === undefined) return undefined;
              return controlAt(replacementRow.owner);
            })();
      const isArtificerReplacement =
        row.reference.kind === 'interactAcquisitionEntry' &&
        parseArtificerReplacementEntryKey(row.reference.entryKey) !== undefined;
      const roleIsAcquired = (acquisitionRole: string): boolean => {
        if (resolvedRewardControl?.acquisitionOutcome === 'forfeitedByVow') return false;
        const conversion = resolvedRewardControl?.conversions?.find(
          (candidate) => candidate.address.acquisitionRole === acquisitionRole,
        );
        return conversion === undefined || conversion.value.kind === 'normal';
      };
      const inlineTraitOffers = Object.freeze(
        (resolvedRewardControl?.traitOffers ?? []).filter((control) =>
          roleIsAcquired(control.address.acquisitionRole),
        ),
      );
      const inlineLevelResolutions = Object.freeze(
        (resolvedRewardControl?.levelResolutions ?? []).filter((control) =>
          roleIsAcquired(control.address.acquisitionRole),
        ),
      );
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
        ...(row.stale || artificerOutput === undefined
          ? {}
          : {
              artificerOutput: Object.freeze({
                control: artificerOutput,
                label: 'Artificer item' as const,
              }),
            }),
        ...(row.stale || resolvedRewardControl === undefined
          ? {}
          : {
              rewardPayload: Object.freeze({
                control: resolvedRewardControl,
                inlineLevelResolutions,
                inlineTraitOffers,
                showOwner: !isArtificerReplacement,
                showOffer:
                  !isArtificerReplacement &&
                  ((row.reference.kind === 'interactLocalReward' && roomLocal.kind !== 'fields') ||
                    (row.reference.kind === 'interactAcquisitionEntry' &&
                      input.occurrence.state.kind !== 'shop' &&
                      resolvedRewardControl.offerEditVisibility === 'visible')),
              }),
            }),
        stale: row.stale,
        ...(row.reference.kind !== 'interactShopOffer'
          ? {}
          : {
              shopParticipation: (() => {
                const owner = createShopOfferAddress(
                  input.biome,
                  input.occurrence.occurrenceId,
                  row.reference.offerKey,
                );
                return Object.freeze({
                  interactionKey: semanticAddressKey(owner),
                  owner,
                });
              })(),
            }),
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
  );
  const unrankedOrStaleRows = Object.freeze(
    lifecycleTimeline.repairRows.flatMap(({ key }) => {
      const projected = projectedRows.find((row) => row.key === key);
      if (projected === undefined && !suppressedActionKeys.has(key)) {
        throw new Error(`Room action timeline repair row ${key} has no projected row`);
      }
      return projected === undefined ? [] : [projected];
    }),
  );
  const optionalRows = Object.freeze(
    unrankedOrStaleRows.filter(
      (row) => row.rank === null && !row.stale && row.participation === 'optional',
    ),
  );
  const optionalKeys = new Set(optionalRows.map((row) => row.key));
  const repairRows = Object.freeze(unrankedOrStaleRows.filter((row) => !optionalKeys.has(row.key)));
  const steadyGrowthOutcomes = (input.steadyGrowthOutcomes ?? []).filter(
    (outcome) => semanticAddressKey(outcome.address.owner) === semanticAddressKey(owner),
  );
  const activeLifecycleTimeline = scopeRoomLifecycleTimeline(
    appendSteadyGrowthTimelineEffects(
      lifecycleTimeline,
      steadyGrowthOutcomes.map((outcome) => outcome.address),
    ),
    lifecycleTimeline.structure.activeEncounterSlotKeys.flatMap((phaseKey) => {
      const address = createEncounterPhaseAddress(
        input.biome,
        { kind: 'occurrence', occurrenceId: input.occurrence.occurrenceId },
        phaseKey,
      );
      return input.encounterPhaseStatus(address)?.kind === 'dormantSuffix' ? [] : [phaseKey];
    }),
  );
  const steadyGrowthOutcomeByAddress = new Map(
    steadyGrowthOutcomes.map((outcome) => [semanticAddressKey(outcome.address), outcome] as const),
  );
  const steadyGrowth = Object.freeze(
    activeLifecycleTimeline.entries.flatMap((entry) => {
      if (entry.kind !== 'automaticEffect') return [];
      const outcome = steadyGrowthOutcomeByAddress.get(semanticAddressKey(entry.address));
      if (outcome === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(entry.address)} has no Steady Growth outcome metadata`,
        );
      }
      return [
        Object.freeze({
          address: outcome.address,
          marker: input.markerDestinations.marker(outcome.address),
          phaseKey: outcome.phaseKey,
          ...(input.occurrence.encounters.steadyGrowthTargetByPhase?.[outcome.phaseKey] ===
          undefined
            ? {}
            : {
                targetTraitKey:
                  input.occurrence.encounters.steadyGrowthTargetByPhase[outcome.phaseKey],
              }),
        }),
      ];
    }),
  );
  const projectedTimeline = projectRoomLifecycleTimeline(
    input,
    activeLifecycleTimeline,
    roomLocal,
    encounterPhases,
    projectedRows,
    proposals,
    steadyGrowth,
  );
  return Object.freeze({
    timeline: projectedTimeline,
    checkpoints: Object.freeze(
      roster.checkpoints
        .filter((checkpoint) => checkpoint.checkpointKey !== 'outgoingGeneration')
        .map((checkpoint) =>
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
    optionalRows,
    proposals: Object.freeze(proposals),
    repairRows,
    rows: projectedRows,
    ...(steadyGrowth.length === 0 ? {} : { steadyGrowth }),
  });
}

function projectRoomLifecycleTimeline(
  input: WorkspaceOccurrenceAssemblyInput,
  timeline: RoomLifecycleTimeline,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rows: readonly WorkspaceRoomActionRow[],
  proposals: readonly WorkspaceRoomActionProposal[],
  steadyGrowth: readonly WorkspaceSteadyGrowthControl[],
): WorkspaceRoomLifecycleTimeline {
  const occurrence = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const launcherForBoundary = (
    boundary: WorkspaceRoomLifecycleBoundary,
  ): WorkspaceRunStateLauncher | undefined => {
    if (boundary.kind === 'roomEntered' && roomLocal.kind !== 'ship') {
      return runStateLauncher(
        input,
        createRoomRunStateCheckpointAddress(occurrence, { kind: 'roomEntered' }),
        `the first action in ${requireRoom(input.catalog, input.occurrence.gameName).label}`,
      );
    }
    if (boundary.kind === 'encounterStart' && roomLocal.kind === 'ship') {
      const phase = roomLocal.phases.find((candidate) => candidate.key === boundary.phaseKey);
      return runStateLauncher(
        input,
        createRoomRunStateCheckpointAddress(occurrence, {
          kind: 'beforeEncounterStart',
          phaseKey: boundary.phaseKey,
        }),
        `${phase?.label ?? boundary.phaseKey} encounter`,
      );
    }
    return undefined;
  };
  const timelineActionKeys = new Set(
    timeline.entries.flatMap((entry) => (entry.kind === 'action' ? [entry.action.key] : [])),
  );
  const activeCageRows =
    roomLocal.kind !== 'fields'
      ? []
      : rows
          .filter(
            (row) =>
              row.reference.kind === 'completeFieldsCage' &&
              row.rank !== null &&
              !row.stale &&
              timelineActionKeys.has(row.key),
          )
          .sort((left, right) => left.rank! - right.rank!);
  const activeCageByPhase = new Map(
    activeCageRows.map((row) => [
      row.reference.kind === 'completeFieldsCage' ? row.reference.phaseKey : '',
      row,
    ]),
  );
  const cageChoiceRows = [...activeCageRows].sort((left, right) => {
    const phaseIndex = (row: WorkspaceRoomActionRow): number => {
      if (row.reference.kind !== 'completeFieldsCage') return Number.POSITIVE_INFINITY;
      const phaseKey = row.reference.phaseKey;
      return encounterPhases.findIndex((phase) => phase.address.phaseKey === phaseKey);
    };
    return phaseIndex(left) - phaseIndex(right);
  });
  const cageSlotByBoundaryKey = new Map(
    timeline.entries
      .flatMap((entry) =>
        entry.kind === 'boundary' && entry.boundary.kind === 'encounterStart'
          ? [entry.boundary]
          : [],
      )
      .flatMap((boundary, index) => {
        const selected = activeCageByPhase.get(boundary.phaseKey);
        if (selected === undefined || selected.rank === null) return [];
        const choices = cageChoiceRows.map((row) => {
          if (row.reference.kind !== 'completeFieldsCage') {
            throw new StructuredWorkspaceProjectionContractError(
              `${row.key} is not a Fields cage-completion anchor`,
            );
          }
          const phaseKey = row.reference.phaseKey;
          const selectedChoice = row.key === selected.key;
          const proposal = selectedChoice
            ? undefined
            : proposals.find(
                (candidate) =>
                  candidate.kind === 'move' &&
                  roomActionKey(candidate.reference) === row.key &&
                  candidate.toIndex === selected.rank! - 1,
              );
          if (!selectedChoice && proposal === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${row.key} cannot be projected into Fields encounter slot ${index + 1}`,
            );
          }
          return Object.freeze({
            label:
              encounterPhases.find((phase) => phase.address.phaseKey === phaseKey)?.label ??
              phaseKey,
            ...(proposal === undefined ? {} : { proposalKey: proposal.key }),
            value: phaseKey,
          });
        });
        return [
          [
            boundary.key,
            Object.freeze({
              choices: Object.freeze(choices),
              marker: selected.marker,
              owner:
                selected.address as import('@run-planner/engine/authored-project').RoomActionAddress,
              selected: boundary.phaseKey,
              slotOrdinal: index + 1,
            }),
          ] as const,
        ];
      }),
  );
  const representedCagePhases = new Set(
    [...cageSlotByBoundaryKey.values()].map((slot) => slot.selected),
  );
  const entries: WorkspaceRoomLifecycleTimelineEntry[] = [];
  for (const entry of timeline.entries) {
    if (entry.kind === 'boundary') {
      const runState = launcherForBoundary(entry.boundary);
      const fieldsCageSlot = cageSlotByBoundaryKey.get(entry.boundary.key);
      entries.push(
        Object.freeze({
          kind: 'boundary' as const,
          boundary: entry.boundary,
          placement: entry.placement,
          rank: entry.rank,
          ...(runState === undefined ? {} : { runState }),
          ...(fieldsCageSlot === undefined ? {} : { fieldsCageSlot }),
        }),
      );
      continue;
    }
    if (entry.kind === 'automaticEffect') {
      const control = steadyGrowth.find(
        (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(entry.address),
      );
      if (control !== undefined) {
        entries.push(
          Object.freeze({
            kind: 'automaticEffect' as const,
            effect: 'steadyGrowth' as const,
            address: control.address,
            phaseKey: control.phaseKey,
            rank: entry.rank,
          }),
        );
      }
      continue;
    }
    entries.push(
      Object.freeze({
        kind: 'action' as const,
        actionKey: entry.action.key,
        presentation:
          entry.action.reference.kind === 'completeFieldsCage' &&
          representedCagePhases.has(entry.action.reference.phaseKey)
            ? ('fieldsCageAnchor' as const)
            : ('row' as const),
        rank: entry.rank,
        ...(entry.phaseKey === undefined ? {} : { phaseKey: entry.phaseKey }),
      }),
    );
  }
  return Object.freeze({
    boundaries: Object.freeze([...timeline.boundaries]),
    entries: Object.freeze(entries),
  });
}

function roomTabForPhase(roomLocal: WorkspaceRoomLocal, phaseKey: string): WorkspaceRoomTab {
  if (roomLocal.kind !== 'ship') return 'actions';
  switch (roomLocal.phases.findIndex((phase) => phase.key === phaseKey)) {
    case 0:
      return 'shipIntroActions';
    case 1:
      return 'shipCombat1Actions';
    case 2:
      return 'shipCombat2Actions';
    default:
      return 'actions';
  }
}

function roomRunStateByTab(
  roomLocal: WorkspaceRoomLocal,
  roomActions: WorkspaceRoomActions | undefined,
  beforeExit: WorkspaceRunStateLauncher | undefined,
): Readonly<Partial<Record<WorkspaceRoomTab, WorkspaceRunStateLauncher>>> {
  const byTab: Partial<Record<WorkspaceRoomTab, WorkspaceRunStateLauncher>> = {};
  const lifecycleLaunchers = (roomActions?.timeline.entries ?? []).flatMap((entry) =>
    entry.kind === 'boundary' && entry.runState !== undefined
      ? [{ boundary: entry.boundary, launcher: entry.runState }]
      : [],
  );
  if (roomLocal.kind === 'ship') {
    for (const { boundary, launcher } of lifecycleLaunchers) {
      if (boundary.kind !== 'encounterStart') continue;
      const tab = roomTabForPhase(roomLocal, boundary.phaseKey);
      byTab[tab] = launcher;
      if (byTab.overview === undefined) byTab.overview = launcher;
    }
  } else {
    const entry = lifecycleLaunchers.find(({ boundary }) => boundary.kind === 'roomEntered');
    if (entry !== undefined) {
      byTab.overview = entry.launcher;
      byTab.actions = entry.launcher;
    }
  }
  if (beforeExit !== undefined) byTab.doors = beforeExit;
  return Object.freeze(byTab);
}

function runStateLauncher(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RoomRunStateCheckpointAddress,
  title: string,
): WorkspaceRunStateLauncher | undefined {
  const runState = input.runState(owner);
  if (runState === undefined) return undefined;
  return runState.availability === 'available'
    ? Object.freeze({
        availability: 'available' as const,
        owner,
        state: presentRunState(input.catalog, runState.snapshot),
        title,
      })
    : Object.freeze({ availability: 'unavailable' as const, owner, title });
}

function rewardChildMarkers(control: WorkspaceRewardControl): readonly WorkspaceMarker[] {
  const markers: WorkspaceMarker[] = [];
  for (const trait of control.traitOffers ?? []) {
    markers.push(trait.marker);
    if (trait.traitAcquisitionTarget !== undefined)
      markers.push(trait.traitAcquisitionTarget.marker);
    if (trait.circeResolution !== undefined) markers.push(trait.circeResolution.marker);
    if (trait.echoPomTarget !== undefined) markers.push(trait.echoPomTarget.marker);
    if (trait.echoLastRunBoon !== undefined) markers.push(trait.echoLastRunBoon.marker);
    if (trait.echoLastReward !== undefined) markers.push(trait.echoLastReward.marker);
    for (const set of trait.allTogetherSets ?? []) markers.push(set.marker);
  }
  for (const resolution of control.levelResolutions ?? []) markers.push(resolution.marker);
  for (const conversion of control.conversions ?? []) markers.push(conversion.marker);
  return Object.freeze(markers);
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
        optionalRewardCountValues: (() => {
          const support = fieldsOptionalRewardCountSupport(
            input.catalog,
            occurrence,
            createOccurrenceAddress(input.biome, occurrence.occurrenceId),
          );
          const maximum = support?.effectiveMaximum ?? optionalDescriptor.optionalRewardCapacity;
          return Object.freeze([
            ...Array.from({ length: maximum + 1 }, (_, index) => index),
            ...(occurrence.state.optionalRewardCount > maximum
              ? [occurrence.state.optionalRewardCount]
              : []),
          ]);
        })(),
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
          participation: Object.freeze({
            interactionKey: semanticAddressKey(offerAddress),
            owner: offerAddress,
            purchased: occurrence.roomActions.order.some(
              (reference) =>
                reference.kind === 'interactShopOffer' && reference.offerKey === slot.key,
            ),
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
      phase.customizable ||
      phase.nemesisFeature !== undefined ||
      phase.nemesisEvent !== undefined ||
      phase.figLeaf !== undefined ||
      phase.gorgonCondition !== undefined,
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
          selectionEnabled: phase.customizable,
          ...(phase.nemesisFeature === undefined ? {} : { nemesisFeature: phase.nemesisFeature }),
          ...(phase.nemesisEvent === undefined ? {} : { nemesisEvent: phase.nemesisEvent }),
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
        phase.address.phaseKey === 'Passive' ||
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
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  zagreusSpawn: WorkspaceRoomSummary['zagreusSpawn'],
  naturalChaosSpawn: WorkspaceRoomSummary['naturalChaosSpawn'],
): readonly WorkspaceRoomFeature[] {
  const authored = new Set(input.facts.authoredAdditionalExitKeys);
  const additionalOwner = (key: string) =>
    createAdditionalExitAddress(input.biome, input.occurrence.occurrenceId, key);
  const zagreus = room.additionalExits.find((candidate) => candidate.kind === 'zagreusContract');
  const chaos = room.additionalExits.find((candidate) => candidate.kind === 'naturalChaos');
  const passive = encounterPhases.find((phase) => phase.nemesisFeature !== undefined);
  return Object.freeze([
    ...(room.mode.kind === 'authored' &&
    room.mode.templateKey === 'FieldsCombat' &&
    passive?.nemesisFeature !== undefined
      ? [
          Object.freeze({
            kind: 'nemesisEvent' as const,
            action: (passive.nemesisFeature.selected ? 'remove' : 'add') as 'add' | 'remove',
            interactionKey: workspaceInteractionKey(passive.address),
          }),
        ]
      : []),
    ...(zagreusSpawn?.materialized === true
      ? [
          Object.freeze({
            kind: 'zagreusContract' as const,
            action: 'add' as const,
            control: zagreusSpawn,
          }),
        ]
      : zagreus !== undefined && authored.has(zagreus.key)
        ? [
            Object.freeze({
              kind: 'zagreusContract' as const,
              action: 'remove' as const,
              owner: additionalOwner(zagreus.key),
            }),
          ]
        : []),
    ...(naturalChaosSpawn !== undefined
      ? [
          Object.freeze({
            kind: 'naturalChaos' as const,
            action: 'add' as const,
            control: naturalChaosSpawn,
          }),
        ]
      : chaos !== undefined && authored.has(chaos.key)
        ? [
            Object.freeze({
              kind: 'naturalChaos' as const,
              action: 'remove' as const,
              owner: additionalOwner(chaos.key),
            }),
          ]
        : []),
  ]);
}

function shipWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: Extract<WorkspaceRoomLocal, { readonly kind: 'ship' }>,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  const activeWheels = roomLocal.wheels.filter((wheel) => wheel.active);
  for (const wheel of activeWheels) {
    const phase = roomLocal.phases.find((candidate) => candidate.key === wheel.encounterPhaseKey);
    if (phase?.rewardWheelKey !== wheel.key) {
      throw new StructuredWorkspaceProjectionContractError(
        `Ship wheel ${wheel.key} has no active declaration-owned encounter phase`,
      );
    }
  }
  const phaseIndexForKey = (phaseKey: string): number => {
    const index = roomLocal.phases.findIndex((phase) => phase.key === phaseKey);
    if (index < 0) {
      throw new StructuredWorkspaceProjectionContractError(
        `Ship timeline references unknown phase ${phaseKey}`,
      );
    }
    return index;
  };
  const wheelForNextPhase = (phaseIndex: number): WorkspaceRewardWheelDescriptor | undefined => {
    const nextPhase = roomLocal.phases[phaseIndex + 1];
    return nextPhase?.rewardWheelKey === undefined
      ? undefined
      : activeWheels.find((wheel) => wheel.key === nextPhase.rewardWheelKey);
  };
  const boundaryPhaseIndex = (boundary: WorkspaceRoomLifecycleBoundary): number => {
    switch (boundary.kind) {
      case 'roomEntered':
        return 0;
      case 'encounterStart':
      case 'encounterEnd':
        return phaseIndexForKey(boundary.phaseKey);
      case 'bossDefeated':
        return phaseIndexForKey(boundary.phaseKey);
      case 'nextPhase': {
        const targetIndex = roomLocal.phases.findIndex(
          (phase) => phase.rewardWheelKey === boundary.wheelKey,
        );
        return targetIndex <= 0 ? 0 : targetIndex - 1;
      }
      case 'cleanup':
        return roomLocal.phases.length - 1;
    }
  };
  const checkpointKeyForBoundary = (boundary: WorkspaceRoomLifecycleBoundary): string => {
    switch (boundary.kind) {
      case 'encounterEnd':
        return `combat:${boundary.phaseKey}`;
      case 'nextPhase':
        return `nextPhaseUsable:${boundary.wheelKey}`;
      default:
        return boundary.key;
    }
  };
  const actionByKey = new Map(roomActions?.rows.map((row) => [row.key, row]) ?? []);
  const phaseRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseOptionalRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseBoundaryEntries = roomLocal.phases.map(
    () => [] as Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>[],
  );
  const phaseTimelineEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomLifecycleTimelineEntry[],
  );
  const phaseCheckpointEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomActions['checkpoints'][number][],
  );
  if (roomActions !== undefined) {
    let currentPhaseIndex = 0;
    for (const entry of roomActions.timeline.entries) {
      if (entry.kind === 'boundary') {
        const phaseIndex = boundaryPhaseIndex(entry.boundary);
        phaseBoundaryEntries[phaseIndex]!.push(entry);
        phaseTimelineEntries[phaseIndex]!.push(entry);
        if (entry.boundary.kind === 'encounterStart') currentPhaseIndex = phaseIndex;
        continue;
      }
      if (entry.kind === 'automaticEffect') {
        phaseTimelineEntries[phaseIndexForKey(entry.phaseKey)]!.push(entry);
        continue;
      }
      const row = actionByKey.get(entry.actionKey);
      if (row === undefined) continue;
      const phaseIndex =
        entry.phaseKey === undefined ? currentPhaseIndex : phaseIndexForKey(entry.phaseKey);
      phaseTimelineEntries[phaseIndex]!.push(entry);
      phaseRows[phaseIndex]!.push(row);
    }
    for (const checkpoint of roomActions.checkpoints) {
      if (checkpoint.key === 'exitUsable') continue;
      const matchingBoundary = roomActions.timeline.entries.find(
        (entry) =>
          entry.kind === 'boundary' && checkpointKeyForBoundary(entry.boundary) === checkpoint.key,
      );
      const phaseIndex =
        matchingBoundary?.kind === 'boundary'
          ? boundaryPhaseIndex(matchingBoundary.boundary)
          : roomLocal.phases.length - 1;
      phaseCheckpointEntries[phaseIndex]!.push(checkpoint);
    }
    for (const row of roomActions.optionalRows) {
      const phaseIndex = (() => {
        const window = row.window;
        if (window.kind === 'shipPostCombat') {
          return roomLocal.phases.findIndex((phase) => phase.rewardWheelKey === window.wheelKey);
        }
        if (window.kind === 'shipPreCombat') {
          const targetIndex = roomLocal.phases.findIndex(
            (phase) => phase.rewardWheelKey === window.wheelKey,
          );
          return Math.max(0, targetIndex - 1);
        }
        return roomLocal.phases.length - 1;
      })();
      if (phaseIndex < 0) {
        throw new StructuredWorkspaceProjectionContractError(
          `Ship optional action ${row.key} has no declaration-owned phase`,
        );
      }
      phaseOptionalRows[phaseIndex]!.push(row);
    }
  }
  const phases: WorkspaceShipPhasePresentation[] = roomLocal.phases.map((phase, index) => {
    const encounter = encounterPhases.find((candidate) => candidate.address.phaseKey === phase.key);
    const wheel = wheelForNextPhase(index);
    return Object.freeze({
      actionRows: Object.freeze(phaseRows[index]!),
      checkpoints: Object.freeze(phaseCheckpointEntries[index]!),
      ...(encounter === undefined ? {} : { encounter }),
      key: phase.key,
      label: phase.label,
      timeline: Object.freeze(phaseTimelineEntries[index]!),
      optionalRows: Object.freeze(phaseOptionalRows[index]!),
      ...(wheel === undefined ? {} : { wheel }),
    });
  });
  return Object.freeze({
    combatPhaseCount: roomLocal.combatPhaseCount,
    features,
    kind: 'ship' as const,
    phases: Object.freeze(phases),
    repairRows: Object.freeze(roomActions?.repairRows ?? []),
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
  if (room.resources !== undefined) {
    requirements.push(
      Object.freeze({
        kind: 'resourcePlacements' as const,
        owner: room.address,
        resources: room.resources,
      }),
    );
  }
  const activeShopOwners = new Set<string>();
  if (room.roomLocal.kind === 'shop' && room.roomLocal.materialized) {
    for (const offer of room.roomLocal.offers) {
      activeShopOwners.add(offer.participation.interactionKey);
      requirements.push(
        Object.freeze({
          kind: 'shopPurchaseParticipation' as const,
          owner: offer.participation.owner,
          purchased: offer.participation.purchased,
        }),
      );
    }
  }
  if (room.roomActions !== undefined) {
    requirements.push(
      Object.freeze({
        kind: 'roomActions' as const,
        owner: room.roomActions.owner,
        proposals: room.roomActions.proposals,
      }),
    );
    for (const row of room.roomActions.repairRows) {
      if (row.shopParticipation === undefined) continue;
      if (activeShopOwners.has(row.shopParticipation.interactionKey)) continue;
      requirements.push(
        Object.freeze({
          kind: 'shopPurchaseParticipation' as const,
          owner: row.shopParticipation.owner,
          purchased: true,
        }),
      );
    }
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
  const hasRetainedNemesisEvent = Object.values(occurrence.encounters.encounterKeyByPhase).some(
    (encounterKey) => encounterKey === 'NemesisRandomEvent',
  );
  const encounterPhases =
    input.facts.detailsActive || hasRetainedNemesisEvent
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
          const pickupProducers = activeSelectedPickupProducers(
            input.catalog,
            input.biome,
            occurrence,
          );
          const activePickups = pickupProducers.flatMap((producer) =>
            producer.pickups.map((pickup) =>
              Object.freeze({ ...pickup, siteKey: producer.siteKey }),
            ),
          );
          const activeKeys = new Set(
            activePickups.map((pickup) => `${pickup.siteKey}\u0000${pickup.key}`),
          );
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
                if (
                  siteKey === 'roomExit' &&
                  structuralEchoKeys.has(key) &&
                  !activeKeys.has(`${siteKey}\u0000${key}`)
                ) {
                  return [];
                }
                const pickup = activePickups.find(
                  (candidate) => candidate.siteKey === siteKey && candidate.key === key,
                );
                const capability = derivedEntries.find(
                  (entry) => entry.kind === 'echoLastReward' && entry.address.entryKey === key,
                );
                const fixedEchoOffer = capability?.fixedReward?.offer;
                const fixedOfferEdit =
                  fixedEchoOffer === undefined ||
                  (reward !== null && capability?.retainedSourceMismatch !== true)
                    ? undefined
                    : Object.freeze({
                        actionLabel: `${reward === null ? 'Set' : 'Update'} replay reward · ${summarizeRewardOffer(input.catalog, fixedEchoOffer)}`,
                        offer: fixedEchoOffer,
                      });
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
                    fixedOfferEdit,
                    structuralEchoKeys.has(key),
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
  const judgment = (() => {
    if (room.kind !== 'Boss' || !input.facts.detailsActive) return undefined;
    const bossDefeated = input.evaluatedRoom?.roomLifecycleTimeline.boundaries.find(
      (boundary) => boundary.kind === 'bossDefeated',
    );
    if (bossDefeated === undefined) return undefined;
    const phaseKey = bossDefeated.phaseKey;
    const address = createJudgmentArcanaAddress(
      createOccurrenceAddress(input.biome, occurrence.occurrenceId),
      phaseKey,
    );
    const capability = input.judgmentArcanaCapability?.(address);
    if (capability === undefined) return undefined;
    return Object.freeze({
      address,
      inactiveArcanaKeys: capability.inactiveArcanaKeys,
      marker: input.markerDestinations.marker(address),
      requiredCount: capability.requiredCount,
      value: occurrence.encounters.judgmentArcanaKeysByPhase?.[phaseKey] ?? Object.freeze([]),
    });
  })();
  const keepsakeSelection =
    !input.facts.detailsActive || occurrence.keepsakeRack === undefined
      ? undefined
      : (() => {
          const address = createPostbossKeepsakeSelectionAddress(
            createOccurrenceAddress(input.biome, occurrence.occurrenceId),
          );
          const effect =
            occurrence.keepsakeRack.disposition.kind !== 'replace'
              ? undefined
              : input.catalog.keepsakes.byKey[occurrence.keepsakeRack.disposition.keepsakeKey]
                  ?.effect;
          const resultAddress =
            effect?.kind === 'jeweledPom' || effect?.kind === 'experimentalHammer'
              ? createKeepsakeEquipResultAddress(address, effect.kind)
              : undefined;
          return Object.freeze({
            address,
            ...(resultAddress === undefined || !input.keepsakeEquipResultSupported?.(resultAddress)
              ? {}
              : {
                  equipResult: Object.freeze({
                    address: resultAddress,
                    marker: input.markerDestinations.marker(resultAddress),
                  }),
                }),
            marker: input.markerDestinations.marker(address),
            value: occurrence.keepsakeRack.disposition,
          });
        })();
  const localDetailMarkers = Object.freeze([
    ...encounterPhases.flatMap((phase) => [
      phase.marker,
      ...(phase.traitOffer === undefined ? [] : [phase.traitOffer.marker]),
      ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker]),
    ]),
    ...workspaceLocalDetailMarkers(roomLocal),
    ...(roomActions?.rows.map((row) => row.marker) ?? []),
    ...(judgment === undefined ? [] : [judgment.marker]),
    ...(keepsakeSelection === undefined
      ? []
      : [
          keepsakeSelection.marker,
          ...(keepsakeSelection.equipResult === undefined
            ? []
            : [keepsakeSelection.equipResult.marker]),
        ]),
    ...(zagreusSpawn === undefined ? [] : [zagreusSpawn.marker]),
    ...(naturalChaosSpawn === undefined ? [] : [naturalChaosSpawn.marker]),
  ]);
  const features = roomFeatures(input, room, encounterPhases, zagreusSpawn, naturalChaosSpawn);
  const workbench = roomWorkbenchPresentation(encounterPhases, features, roomLocal, roomActions);
  const beforeExitRunState = runStateLauncher(
    input,
    createRoomRunStateCheckpointAddress(address, { kind: 'beforeRoomExit' }),
    `exiting ${room.label}`,
  );
  const runStateByTab = roomRunStateByTab(roomLocal, roomActions, beforeExitRunState);
  const entryReward =
    input.isEntry === true
      ? allRewardControls.find(
          (control) =>
            semanticAddressKey(control.owner.address) ===
            semanticAddressKey(createIncomingRewardAddress(input.biome, occurrence.occurrenceId)),
        )
      : undefined;
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    detailsActive: input.facts.detailsActive,
    ...(entryReward === undefined ? {} : { entryReward }),
    ...(judgment === undefined ? {} : { judgment }),
    ...(keepsakeSelection === undefined ? {} : { keepsakeSelection }),
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
    ...(input.resourceAuthoring === undefined
      ? {}
      : {
          resources: Object.freeze(
            (
              [
                ...new Set([
                  ...room.resourcePointSupport.families,
                  ...(['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).filter((family) => {
                    const placement = input.resourceAuthoring!.placements[family];
                    return (
                      placement?.biomeKey === input.biome.biomeKey &&
                      placement.occurrenceId === occurrence.occurrenceId
                    );
                  }),
                ]),
              ] as import('@run-planner/engine/catalog-schema').ResourceFamily[]
            ).map((family) => {
              const placement = input.resourceAuthoring!.placements[family];
              const here =
                placement?.biomeKey === input.biome.biomeKey &&
                placement.occurrenceId === occurrence.occurrenceId;
              return Object.freeze({
                family,
                action: here
                  ? ('remove' as const)
                  : placement === null
                    ? ('add' as const)
                    : ('move' as const),
                interactionKey: `${semanticAddressKey(input.biome)}:resource:${input.occurrence.occurrenceId}:${family}`,
                legal: here
                  ? input.resourceAuthoring!.assessmentByFamily[family]?.legal === true
                  : input.resourceAuthoring!.legalTargetsByFamily[family].some(
                      (target) =>
                        target.biomeKey === input.biome.biomeKey &&
                        target.occurrenceId === occurrence.occurrenceId,
                    ),
              });
            }),
          ),
        }),
    runStateByTab,
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
  for (const phase of encounterPhases) {
    input.markerDestinations.setRoomTab(
      [
        phase.marker,
        ...(phase.traitOffer === undefined ? [] : [phase.traitOffer.marker]),
        ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker]),
      ],
      roomTabForPhase(roomLocal, phase.address.phaseKey),
    );
  }
  if (judgment !== undefined) {
    input.markerDestinations.setRoomTab([judgment.marker], 'actions');
  }
  if (keepsakeSelection !== undefined) {
    const keepsakeActionInTimeline = roomActions?.rows.some(
      (row) => row.reference.kind === 'interactKeepsakeRack',
    );
    input.markerDestinations.setRoomTab(
      [
        keepsakeSelection.marker,
        ...(keepsakeSelection.equipResult === undefined
          ? []
          : [keepsakeSelection.equipResult.marker]),
      ],
      keepsakeActionInTimeline ? 'actions' : 'overview',
    );
    if (keepsakeSelection.equipResult !== undefined) {
      input.markerDestinations.redirectTo(
        keepsakeSelection.equipResult.marker,
        keepsakeSelection.marker,
        node.key,
      );
    }
  }
  if (roomActions !== undefined) {
    for (const effect of roomActions.steadyGrowth ?? []) {
      input.markerDestinations.setRoomTab(
        [effect.marker],
        roomLocal.kind === 'ship' ? roomTabForPhase(roomLocal, effect.phaseKey) : 'actions',
      );
    }
    const shipRepairKeys = new Set(roomActions.repairRows.map((row) => row.key));
    const timelineActionPhaseKeys = new Map(
      roomActions.timeline.entries.flatMap((entry) =>
        entry.kind === 'action' && entry.phaseKey !== undefined
          ? [[entry.actionKey, entry.phaseKey] as const]
          : [],
      ),
    );
    for (const row of roomActions.rows) {
      const unavailableAcquisitionMarkers = (() => {
        if (
          row.rewardPayload !== undefined ||
          row.reference.kind !== 'interactAcquisitionEntry' ||
          row.reference.entryKey !== INFERNAL_CONTRACT_ENTRY_KEY
        ) {
          return Object.freeze([]);
        }
        const site = acquisitionSiteFromStorageKey(address, row.reference.siteKey);
        if (site === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${row.key} has invalid acquisition site ${row.reference.siteKey}`,
          );
        }
        return Object.freeze([
          input.markerDestinations.marker(site),
          input.markerDestinations.marker(
            createAcquisitionEntryAddress(site, row.reference.entryKey),
          ),
        ]);
      })();
      for (const marker of unavailableAcquisitionMarkers) {
        input.markerDestinations.redirectTo(marker, row.marker, node.key);
      }
      const wheelKey =
        row.window.kind === 'shipPostCombat' || row.window.kind === 'shipPreCombat'
          ? row.window.wheelKey
          : undefined;
      const tab =
        roomLocal.kind === 'ship' && shipRepairKeys.has(row.key)
          ? 'shipInactiveRepair'
          : row.reference.kind === 'interactEncounter' || row.reference.kind === 'interactGorgon'
            ? roomTabForPhase(roomLocal, row.reference.phaseKey)
            : roomLocal.kind === 'ship' && timelineActionPhaseKeys.has(row.key)
              ? roomTabForPhase(roomLocal, timelineActionPhaseKeys.get(row.key)!)
              : wheelKey !== undefined
                ? roomTabForPhase(
                    roomLocal,
                    roomLocal.kind === 'ship'
                      ? (roomLocal.phases.find((phase) => phase.rewardWheelKey === wheelKey)?.key ??
                          '')
                      : '',
                  )
                : 'actions';
      input.markerDestinations.setRoomTab(
        [
          row.marker,
          ...(row.rewardPayload === undefined
            ? []
            : [row.rewardPayload.control.marker, ...rewardChildMarkers(row.rewardPayload.control)]),
          ...unavailableAcquisitionMarkers,
        ],
        tab,
      );
    }
  }
  if (roomLocal.kind === 'ship') {
    for (const wheel of roomLocal.wheels) {
      const workbenchPhase =
        workbench.kind === 'ship'
          ? workbench.phases.find((phase) => phase.wheel?.key === wheel.key)
          : undefined;
      if (wheel.active && workbenchPhase === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `Ship wheel ${wheel.key} has no preceding workbench phase`,
        );
      }
      const tab: WorkspaceRoomTab = !wheel.active
        ? 'shipInactiveRepair'
        : roomTabForPhase(roomLocal, workbenchPhase!.key);
      input.markerDestinations.setRoomTab(
        [wheel.marker, ...wheel.offers.flatMap((offer) => [offer.control.marker])],
        tab,
      );
    }
  }
  const localInteractionRequirements = occurrenceInteractionRequirements(
    input.catalog,
    roomSummary,
  );
  input.markerDestinations.redirect(workspaceOccurrenceOwnedMarkers(node.room), node.key);
  const runStateLaunchers = Object.freeze([
    ...(roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'boundary' && entry.runState !== undefined ? [entry.runState] : [],
    ),
    ...(beforeExitRunState === undefined ? [] : [beforeExitRunState]),
  ]);
  return Object.freeze({
    node,
    occurrenceInteractionRequirements: localInteractionRequirements,
    roomControls,
    rewardControls: allRewardControls,
    runStateLaunchers,
  });
}
