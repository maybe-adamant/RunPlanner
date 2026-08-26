import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createAllTogetherSetAddress,
  createCirceResolutionAddress,
  createEchoLastRewardAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createLocalRewardAddress,
  createNaturalSelectionResultAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTraitAcquisitionTargetAddress,
  createTraitOfferAddress,
  echoLastRewardPickupEntryKey,
  materializeGorgonAthenaOffer,
  nemesisGeneratedPickupSiteKey,
  semanticAddressKey,
  traitOfferOption,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type AuthoredRewardState,
  type AuthoredTraitOffer,
  type BiomeAddress,
  type EncounterPhaseAddress,
  type LevelResolutionAddress,
  type RoomOccurrence,
  type SemanticAddress,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { traitGiverForAcquisitionRole } from '@run-planner/engine/authored-project';
import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  EncounterPhaseSequenceStatus,
  FigLeafPhaseCandidateSupport,
  FieldsBatchFacts,
  GorgonPhaseCandidateSupport,
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
import { resolveWorkspaceFixedRewardOffer } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceEncounterPhase,
  type WorkspaceAcquisitionConversionControl,
  type WorkspaceLevelResolutionControl,
  type WorkspaceMarker,
  type WorkspaceNaturalSelectionControl,
  type WorkspaceRewardControl,
  type WorkspaceTraitOfferControl,
  type WorkspaceTraitOfferStatus,
} from '../contract';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';

/**
 * The occurrence assembler consumes only the lifecycle facts needed to project
 * this occurrence. Expected-owner enumeration remains intentionally elsewhere.
 */
export interface WorkspaceOccurrenceProjectionFacts {
  readonly authoredAdditionalExitKeys: readonly string[];
  readonly detailsActive: boolean;
}

export type WorkspaceDerivedAcquisitionEntry = {
  readonly address: AcquisitionEntryAddress;
  readonly kind:
    | 'echoDoubleShopPlaceholder'
    | 'echoDoubleShopReward'
    | 'echoLastReward'
    | 'hermesShrineDelivery'
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

export interface WorkspaceOccurrenceRewardAssemblyInput {
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
  readonly fieldsBatchFacts?: FieldsBatchFacts;
  readonly facts: WorkspaceOccurrenceProjectionFacts;
  readonly levelResolutionAssessment: (
    owner: LevelResolutionAddress,
  ) => SelectedLevelResolutionAssessment | undefined;
  readonly isActiveTraitOffer: (owner: TraitOfferAddress) => boolean;
  readonly derivedAcquisitionEntries?: (
    site: AcquisitionSiteAddress,
  ) => readonly WorkspaceDerivedAcquisitionEntry[];
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly ordinaryRewardForfeited: (owner: RewardCandidateOwner) => boolean;
  readonly occurrence: RoomOccurrence;
}

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
  input: WorkspaceOccurrenceRewardAssemblyInput,
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
    const concaveStone =
      offer.kind !== 'traits' || input.catalog.traitGivers.byKey[giverKey]?.shopAwareGodTrait !== true
        ? undefined
        : Object.freeze({
            address,
            marker: input.markerDestinations.marker(address),
            ...(offer.concaveStoneResult === undefined
              ? {}
              : { value: offer.concaveStoneResult }),
          });
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
        ...(concaveStone === undefined ? {} : { concaveStone }),
      }),
    );
  }
  return Object.freeze(controls);
}

function levelResolutionControls(
  input: WorkspaceOccurrenceRewardAssemblyInput,
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
  input: WorkspaceOccurrenceRewardAssemblyInput,
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

export function rewardControl(
  input: WorkspaceOccurrenceRewardAssemblyInput,
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

export function controlsForOccurrence(
  input: WorkspaceOccurrenceRewardAssemblyInput,
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

export function requireProjectedRewardControl<TKind extends WorkspaceRewardControl['kind']>(
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

export function requireEncounterEnvelope(catalog: Catalog, room: RoomDeclaration) {
  const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  if (envelope === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} has no encounter envelope ${room.encounterEnvelopeKey}`,
    );
  }
  return envelope;
}

export function requireRewardWheelAttachment(
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
export function activeEncounterPhasesForOwner(
  input: WorkspaceOccurrenceRewardAssemblyInput,
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
