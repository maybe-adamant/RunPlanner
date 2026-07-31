import {
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createCompletionRoomAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeHubSlotClosureImpact,
  describeTopologyRemovalImpact,
  fixedWidthOneTakeoverForLayout,
  fixedWidthOneTakeoverTransitionForSource,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type AuthoredRoomState,
  type BiomeAddress,
  type DeclaredPhysicalExit,
  type ExitDecision,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type HubDecision,
  type HubDecisionAddress,
  type LocalChildAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
  type SideRoomGeneration,
  type TargetAddress,
  type TopologyRemovalImpact,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredFieldDescriptor,
  BiomeLayout,
  Catalog,
  HubDecisionDescriptor,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalHubDecision,
  CanonicalLinkedExit,
  CanonicalTarget,
  ProjectBiomeEvaluation,
  ProjectEvaluation,
  SemanticFinding,
} from '@run-planner/engine/simulation';
import {
  assertProjectEvaluationSource,
  evaluateBiomeCompleteness,
} from '@run-planner/engine/simulation';

import type {
  CandidateOptionProjection,
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '../candidateProjection';
import type { ContextualPickerModel } from '../contextualPicker';
import { explainCandidateEvaluation } from '../contextualOptions';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
} from '../roomSelectorProjection';
import { summarizeRewardOffer } from '../rewardPicker';
import {
  createTakeoverBatchCommand,
  type TakeoverBatchCommand,
} from '../../workspace/takeoverBatchInteraction';

import {
  StructuredWorkspaceProjectionContractError,
  workspaceInteractionKey,
  workspaceSideRoomEntryOrderKey,
} from './contract';
import { compareAuthoredTargetsInPhysicalOrder, requiredNormalExitOrdinal } from './ordering';
import {
  createWorkspaceProjectSourceIndex,
  type WorkspaceBiomeSource,
  type WorkspaceEvaluatedBatchOverlay,
  type WorkspaceProjectSourceIndex,
} from './source-index';
import {
  authoredFieldsActiveCageCountForDecision,
  createWorkspaceBiomeOccurrenceAssemblyFacts,
  type WorkspaceBiomeOccurrenceAssemblyFacts,
} from './occurrence-facts';
import type {
  StructuredWorkspaceContextualServices,
  StructuredWorkspaceProjection,
  StructuredWorkspaceProjectionService,
  WorkspaceAssessment,
  WorkspaceAuthoredLeafInteractionKind,
  WorkspaceAuthoredLeafInteractionRequirement,
  WorkspaceAuthoredLeafRequirement,
  WorkspaceAuthoringFrontier,
  WorkspaceBatchRepairScope,
  WorkspaceBiome,
  WorkspaceBiomeField,
  WorkspaceCandidateInteraction,
  WorkspaceCandidateTakeoverBatchInteraction,
  WorkspaceCompletedHubHandoffInteraction,
  WorkspaceCompletionNode,
  WorkspaceEphyraSideRoomEntryOption,
  WorkspaceEphyraSideRoomEntryOrderControl,
  WorkspaceExitFrontierCapabilities,
  WorkspaceExitSelectionInteraction,
  WorkspaceFieldsBatchContext,
  WorkspaceFixedWidthOneTakeoverActionResult,
  WorkspaceFixedWidthOneTakeoverInteraction,
  WorkspaceHubDecisionNode,
  WorkspaceHubRailEntry,
  WorkspaceHubSlotInteraction,
  WorkspaceHubVisitRailEntry,
  WorkspaceInspectorDestination,
  WorkspaceInteractionCatalog,
  WorkspaceInteractionChoice,
  WorkspaceLinkedExitNode,
  WorkspaceMarker,
  WorkspaceMissingPhysicalTarget,
  WorkspaceMissingTargetAuthoring,
  WorkspaceMixedBatchNode,
  WorkspaceNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspacePhysicalTarget,
  WorkspaceProjectionSource,
  WorkspaceRailEntry,
  WorkspaceRewardControl,
  WorkspaceRewardInteraction,
  WorkspaceRoomInteraction,
  WorkspaceRoomLocal,
  WorkspaceRoomPickerControl,
  WorkspaceRoomSummary,
  WorkspaceRoute,
  WorkspaceStageDecisionRemoval,
  WorkspaceStartInteraction,
  WorkspaceStatus,
  WorkspaceStructuralInteraction,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTakeoverBatchNode,
  WorkspaceTakeoverCandidate,
  WorkspaceTakeoverRepairInteraction,
  WorkspaceTakeoverReplacementImpact,
  WorkspaceTopologyRemovalInteraction,
  WorkspaceTopologyRemovalScope,
} from './contract';

type WorkspaceMissingTargetSetupPrerequisite = Extract<
  WorkspaceMissingTargetAuthoring,
  { readonly kind: 'awaitingBatchRewardStore' | 'awaitingFieldsCageOutcome' }
>;

/** A linked exit is validated by the core as the source room's sole normal door. */
const linkedExitOrdinal = 1;

interface MutableProjectionContext {
  readonly catalog: Catalog;
  readonly occurrenceFacts: WorkspaceBiomeOccurrenceAssemblyFacts;
  readonly evaluation: ProjectBiomeEvaluation | undefined;
  /** Biome-local destination builder; returned as a completed assembly product. */
  readonly focusDestinations: Map<string, WorkspaceInspectorDestination>;
  readonly biome: BiomeAddress;
  readonly routeKey: string;
  readonly source: WorkspaceBiomeSource;
}

function requireRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
}

function statusFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceStatus {
  if (evaluation === undefined) return 'blocked';
  if (evaluation.authoring === 'incomplete') return 'incomplete';
  return evaluation.validity;
}

function sourceFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceProjectionSource {
  if (evaluation === undefined) return 'authored';
  return evaluation.authoring === 'complete' ? 'canonical' : 'progressive';
}

function biomeFieldLabel(field: AuthoredFieldDescriptor): string {
  switch (field.key) {
    case 'maxNonGoalRewards':
      return 'Rolled non-goal limit';
    default:
      return field.key;
  }
}

function projectBiomeFields(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  layout: BiomeLayout,
): readonly WorkspaceBiomeField[] {
  return Object.freeze(
    layout.fields.map((field) => {
      const address = createBiomeFieldAddress(context.biome, field.key);
      const value = plan.state[field.key] ?? null;
      const base = {
        address,
        key: field.key,
        label: biomeFieldLabel(field),
        marker: marker(context, address),
      };
      switch (field.kind) {
        case 'boolean':
          if (value !== null && typeof value !== 'boolean') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not boolean`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'boolean' as const,
            value,
            values: Object.freeze([false, true]),
          });
        case 'boundedInteger':
          if (value !== null && typeof value !== 'number') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not numeric`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'boundedInteger' as const,
            value,
            values: Object.freeze(
              Array.from({ length: field.max - field.min + 1 }, (_, index) => field.min + index),
            ),
          });
        case 'enum':
          if (value !== null && typeof value !== 'string') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not an enum value`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'enum' as const,
            value,
            values: field.values,
          });
      }
    }),
  );
}

function assessmentFor(
  context: MutableProjectionContext,
  address: SemanticAddress,
): WorkspaceAssessment {
  const { evaluation } = context;
  if (evaluation === undefined) return 'blocked';
  if (evaluation.coverage.kind === 'none') return 'unassessed';
  if (evaluation.coverage.kind === 'complete') return 'assessed';
  return context.source.isAssessed(address) || context.source.findingsFor(address).length > 0
    ? 'assessed'
    : 'unassessed';
}

function marker(
  context: MutableProjectionContext,
  address: SemanticAddress,
  nodeKey = semanticAddressKey(address),
): WorkspaceMarker {
  const focusKey = semanticAddressKey(address);
  const findings = context.source.findingsFor(address);
  const value = Object.freeze({
    address,
    assessment: assessmentFor(context, address),
    findingCount: findings.length,
    focusKey,
  });
  if (!context.focusDestinations.has(focusKey)) {
    context.focusDestinations.set(
      focusKey,
      Object.freeze({
        biomeKey: context.biome.biomeKey,
        focusAddress: address,
        focusKey,
        nodeKey,
        ownerAddress: address,
        region: 'structure',
        routeKey: context.routeKey,
      }),
    );
  }
  return value;
}

function summarizeOffers(catalog: Catalog, offers: readonly ResolvedRewardOffer[]): string {
  return offers.map((offer) => summarizeRewardOffer(catalog, offer)).join(', ');
}

function fixedRewardOffer(
  room: RoomDeclaration,
  state: Extract<AuthoredRoomState, { readonly kind: 'fixed' }>,
): ResolvedRewardOffer {
  if (room.incomingReward.kind !== 'fixed') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} fixed state has ${room.incomingReward.kind} reward binding`,
    );
  }
  return Object.freeze({
    rewardType: room.incomingReward.offer.rewardType,
    ...(state.payload === undefined
      ? room.incomingReward.offer.payload === undefined
        ? {}
        : { payload: room.incomingReward.offer.payload }
      : { payload: state.payload }),
  });
}

function rewardSummary(
  catalog: Catalog,
  room: RoomDeclaration,
  state: AuthoredRoomState,
): string | undefined {
  switch (state.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return summarizeRewardOffer(catalog, fixedRewardOffer(room, state));
    case 'counted':
    case 'freeReward':
    case 'ephyraCombat':
      return summarizeRewardOffer(catalog, state.offer);
    case 'fieldsCombat': {
      const offers = Object.values(state.cages);
      return offers.length === 0
        ? 'Cages not configured'
        : `Cages · ${summarizeOffers(catalog, offers)}`;
    }
    case 'shipCombat': {
      const offers = Object.values(state.wheels).flatMap((wheel) => Object.values(wheel.offers));
      return offers.length === 0
        ? `${state.encounterCount} encounters · Wheels not configured`
        : `${state.encounterCount} encounters · ${summarizeOffers(catalog, offers)}`;
    }
    case 'shop': {
      if (state.shop === undefined) return 'Shop not configured';
      const offers = Object.values(state.shop.offers);
      return `${offers.length} offers · ${offers.filter((offer) => offer.purchased).length} purchased`;
    }
  }
}

function rewardControl(
  context: MutableProjectionContext,
  owner: RewardCandidateOwner,
  binding: CountedRewardBinding | undefined,
  offer: ResolvedRewardOffer,
  explicitRewardTypes: readonly string[] = Object.freeze([offer.rewardType]),
): WorkspaceRewardControl {
  const item =
    binding === undefined
      ? Object.freeze({
          kind: 'explicitReward' as const,
          marker: marker(context, owner.address),
          offer,
          owner,
          rewardTypes: Object.freeze([...explicitRewardTypes]),
        })
      : Object.freeze({
          kind: 'countedReward' as const,
          binding,
          marker: marker(context, owner.address),
          offer,
          owner: owner as CountedRewardCandidateOwner,
        });
  return item;
}

function incomingRewardBinding(
  room: RoomDeclaration,
  state: Extract<AuthoredRoomState, { readonly kind: 'counted' | 'ephyraCombat' | 'freeReward' }>,
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
  context: MutableProjectionContext,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  detailsActive: boolean,
): readonly WorkspaceRewardControl[] {
  const controls: WorkspaceRewardControl[] = [];
  const incoming = createIncomingRewardAddress(context.biome, occurrence.occurrenceId);
  const addIncoming = (
    state: Extract<AuthoredRoomState, { readonly kind: 'counted' | 'ephyraCombat' | 'freeReward' }>,
  ) => {
    controls.push(
      rewardControl(
        context,
        { kind: 'incomingReward', address: incoming },
        incomingRewardBinding(room, state),
        state.offer,
      ),
    );
  };
  switch (occurrence.state.kind) {
    case 'counted':
    case 'freeReward':
      addIncoming(occurrence.state);
      break;
    case 'ephyraCombat': {
      addIncoming(occurrence.state);
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) {
        break;
      }
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state has no fixed side-room declaration`,
        );
      }
      for (const [slotKey, side] of Object.entries(occurrence.state.sideRooms)) {
        const slot = group.slots.find((candidate) => candidate.slotKey === slotKey);
        if (slot === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} has no side-room slot ${slotKey}`,
          );
        }
        const sideRoom = requireRoom(context.catalog, slot.roomGameName);
        if (sideRoom.incomingReward.kind !== 'countedChoice') {
          throw new StructuredWorkspaceProjectionContractError(
            `${sideRoom.gameName} side room has no counted reward binding`,
          );
        }
        const address = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        controls.push(
          rewardControl(
            context,
            { kind: 'localReward', address },
            sideRoom.incomingReward,
            side.offer,
          ),
        );
      }
      break;
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') break;
      for (const [slotKey, offer] of Object.entries(occurrence.state.cages)) {
        const address = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        controls.push(
          rewardControl(context, { kind: 'localReward', address }, group.reward, offer),
        );
      }
      break;
    }
    case 'shipCombat': {
      const state = occurrence.state;
      const profile = context.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} encounter profile is missing`,
        );
      }
      for (const [wheelKey, wheel] of Object.entries(state.wheels)) {
        const declaration = profile.phases.find(
          (phase) => phase.offerPoint?.key === wheelKey,
        )?.offerPoint;
        if (declaration === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} wheel ${wheelKey} has no reward declaration`,
          );
        }
        for (const [offerKey, offer] of Object.entries(wheel.offers)) {
          const address = createRewardWheelOfferAddress(
            context.biome,
            occurrence.occurrenceId,
            wheelKey,
            offerKey,
          );
          controls.push(
            rewardControl(
              context,
              { kind: 'rewardWheelOffer', address },
              declaration.reward,
              offer,
            ),
          );
        }
      }
      break;
    }
    case 'shop': {
      // Selecting a Shop target creates its declaration-owned inventory.
      // A retained, selected Shop stays editable even when evaluation has not
      // reached it; an unpicked Shop remains a dormant structural leaf.
      if (!detailsActive) break;
      if (occurrence.state.shop === undefined) break;
      const profile = context.catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${occurrence.state.shop.profileKey} is missing`,
        );
      }
      for (const [offerKey, shopOffer] of Object.entries(occurrence.state.shop?.offers ?? {})) {
        const slot = profile.slots.byKey[offerKey];
        const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
        if (group === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop offer ${offerKey} has no declared reward domain`,
          );
        }
        const address = createShopOfferAddress(context.biome, occurrence.occurrenceId, offerKey);
        controls.push(
          rewardControl(
            context,
            { kind: 'shopOffer', address },
            undefined,
            shopOffer.offer,
            group.rewardTypes,
          ),
        );
      }
      break;
    }
    case 'fixed': {
      const offer = fixedRewardOffer(room, occurrence.state);
      const rewardType = context.catalog.rewards.rewardTypes.byKey[offer.rewardType];
      if (rewardType?.payloadDomain !== undefined) {
        controls.push(
          rewardControl(
            context,
            { kind: 'incomingReward', address: incoming },
            undefined,
            offer,
            Object.freeze([offer.rewardType]),
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

function ordinalLabel(position: number): string {
  const remainder = position % 100;
  if (remainder >= 11 && remainder <= 13) return `${position}th`;
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

function ephyraSideRoomEntryOrderControl(
  address: LocalChildAddress,
  enteredSlotKeys: readonly string[],
  slotKey: string,
): WorkspaceEphyraSideRoomEntryOrderControl {
  const index = enteredSlotKeys.indexOf(slotKey);
  const withoutSlot = Object.freeze(enteredSlotKeys.filter((candidate) => candidate !== slotKey));
  const options: WorkspaceEphyraSideRoomEntryOption[] = [
    Object.freeze({
      key: 'notEntered',
      label: 'Not entered',
      position: null,
      proposedEnteredSlotKeys: withoutSlot,
    }),
  ];
  for (let insertionIndex = 0; insertionIndex <= withoutSlot.length; insertionIndex += 1) {
    const position = insertionIndex + 1;
    options.push(
      Object.freeze({
        key: `position:${position}`,
        label: ordinalLabel(position),
        position,
        proposedEnteredSlotKeys: Object.freeze([
          ...withoutSlot.slice(0, insertionIndex),
          slotKey,
          ...withoutSlot.slice(insertionIndex),
        ]),
      }),
    );
  }
  return Object.freeze({
    interactionKey: workspaceSideRoomEntryOrderKey(address),
    options: Object.freeze(options),
    selectedKey: index < 0 ? 'notEntered' : `position:${index + 1}`,
  });
}

function roomLocalForOccurrence(
  context: MutableProjectionContext,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  controls: readonly WorkspaceRewardControl[],
  detailsActive: boolean,
  canonical: CanonicalAuthoredRoom | undefined,
  authoredFieldsActiveCageCount: number | undefined = undefined,
): WorkspaceRoomLocal {
  const incoming = createIncomingRewardAddress(context.biome, occurrence.occurrenceId);
  switch (occurrence.state.kind) {
    case 'none':
      return Object.freeze({ kind: 'none' as const });
    case 'fixed': {
      const offer = fixedRewardOffer(room, occurrence.state);
      const rewardType = context.catalog.rewards.rewardTypes.byKey[offer.rewardType];
      const control =
        rewardType?.payloadDomain === undefined
          ? undefined
          : requireProjectedRewardControl(controls, incoming, 'explicitReward');
      return Object.freeze({
        kind: 'fixed' as const,
        marker: marker(context, incoming),
        summary: summarizeRewardOffer(context.catalog, offer),
        ...(control === undefined ? {} : { control }),
      });
    }
    case 'counted':
    case 'freeReward': {
      const control = requireProjectedRewardControl(controls, incoming, 'countedReward');
      return Object.freeze({
        kind: 'incomingReward' as const,
        control,
        ...(canonical?.clockworkReward === undefined
          ? {}
          : { clockworkReward: canonical.clockworkReward }),
      });
    }
    case 'ephyraCombat': {
      const state = occurrence.state;
      const incomingReward = requireProjectedRewardControl(controls, incoming, 'countedReward');
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      // Ephyra combat state owns the incoming Hub reward for every Hub room;
      // only the declarations with fixed side-room slots expose the additional
      // local lifecycle. Do not invent an empty side-room group for the rest.
      if (group === undefined && Object.keys(state.sideRooms).length === 0) {
        return Object.freeze({ kind: 'incomingReward' as const, control: incomingReward });
      }
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state has no fixed side-room declaration`,
        );
      }
      const groupAddress = createLocalChildGroupAddress(
        context.biome,
        occurrence.occurrenceId,
        group.key,
      );
      const enteredSlotKeys = Object.entries(state.sideRooms)
        .filter(([, side]) => side.enteredOrdinal !== null)
        .sort((left, right) => left[1].enteredOrdinal! - right[1].enteredOrdinal!)
        .map(([slotKey]) => slotKey);
      const slots = group.slots.map((slot) => {
        const side = state.sideRooms[slot.slotKey];
        if (side === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ephyra state is missing side room ${slot.slotKey}`,
          );
        }
        const sideRoom = requireRoom(context.catalog, slot.roomGameName);
        const address = createLocalChildAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        const reward = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        return Object.freeze({
          address,
          entered: side.enteredOrdinal !== null,
          enteredOrdinal: side.enteredOrdinal,
          entryOrder: ephyraSideRoomEntryOrderControl(address, enteredSlotKeys, slot.slotKey),
          generation: side.generation,
          key: slot.slotKey,
          label: sideRoom.label,
          marker: marker(context, address),
          physicalDoorId: slot.physicalDoorId,
          rewardControl: requireProjectedRewardControl(controls, reward, 'countedReward'),
        });
      });
      return Object.freeze({
        kind: 'ephyra' as const,
        incomingReward,
        sideRooms: Object.freeze({
          address: groupAddress,
          enteredSlotKeys: Object.freeze(enteredSlotKeys),
          marker: marker(context, groupAddress),
          slots: Object.freeze(slots),
        }),
      });
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no bounded cage declaration`,
        );
      }
      const active = new Set(
        canonical?.localRewards?.map((reward) => semanticAddressKey(reward.origin)) ??
          (authoredFieldsActiveCageCount === undefined
            ? []
            : group.slotKeys
                .slice(0, authoredFieldsActiveCageCount)
                .map((slotKey) =>
                  semanticAddressKey(
                    createLocalRewardAddress(
                      context.biome,
                      occurrence.occurrenceId,
                      group.key,
                      slotKey,
                    ),
                  ),
                )),
      );
      const cages = group.slotKeys.map((slotKey, index) => {
        const address = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        return Object.freeze({
          active: active.has(semanticAddressKey(address)),
          control: requireProjectedRewardControl(controls, address, 'countedReward'),
          key: slotKey,
          label: `Cage ${index + 1}`,
        });
      });
      return Object.freeze({
        kind: 'fields' as const,
        cages: Object.freeze(cages),
        groupKey: group.key,
      });
    }
    case 'shipCombat': {
      const state = occurrence.state;
      const profile = context.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ship state has no encounter profile`,
        );
      }
      let wheelOrdinal = 0;
      const wheels = profile.phases.flatMap((phase, phaseIndex) => {
        const declaration = phase.offerPoint;
        if (declaration === undefined) return [];
        const wheel = state.wheels[declaration.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${declaration.key}`,
          );
        }
        const address = createRewardWheelAddress(
          context.biome,
          occurrence.occurrenceId,
          declaration.key,
        );
        const active = phaseIndex < state.encounterCount;
        const label = `Reward wheel ${wheelOrdinal + 1}`;
        wheelOrdinal += 1;
        const offers = declaration.offerKeys.map((offerKey, offerIndex) => {
          const offerAddress = createRewardWheelOfferAddress(
            context.biome,
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
            key: declaration.key,
            label,
            marker: marker(context, address),
            offerCount: wheel.offerCount,
            offers: Object.freeze(offers),
            pickedOfferIndex: wheel.pickedOfferIndex,
            storeKey: wheel.storeKey,
          }),
        ];
      });
      return Object.freeze({
        kind: 'ship' as const,
        encounterCount: state.encounterCount,
        wheels: Object.freeze(wheels),
      });
    }
    case 'shop': {
      const state = occurrence.state;
      if (!detailsActive || state.shop === undefined) {
        return Object.freeze({
          kind: 'shop' as const,
          materialized: false,
          offers: Object.freeze([]),
        });
      }
      const shop = state.shop;
      const profile = context.catalog.rewards.shops.byKey[shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${shop.profileKey} is missing`,
        );
      }
      const offers = profile.slots.values.map((slot) => {
        if (shop.offers[slot.key] === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop state is missing ${slot.key}`,
          );
        }
        const offerAddress = createShopOfferAddress(
          context.biome,
          occurrence.occurrenceId,
          slot.key,
        );
        const purchaseAddress = createShopPurchaseAddress(
          context.biome,
          occurrence.occurrenceId,
          slot.key,
        );
        return Object.freeze({
          key: slot.key,
          label: slot.label,
          purchase: Object.freeze({
            address: purchaseAddress,
            marker: marker(context, purchaseAddress),
            purchased: shop.offers[slot.key]!.purchased,
          }),
          rewardControl: requireProjectedRewardControl(controls, offerAddress, 'explicitReward'),
        });
      });
      return Object.freeze({
        kind: 'shop' as const,
        materialized: true,
        offers: Object.freeze(offers),
      });
    }
  }
}

/**
 * A room workbench's local surface is distinct from its incoming reward. Hub
 * visits use this explicit set for child selection so board-owned offers do
 * not become child-owned merely because they share an occurrence.
 */
function localDetailMarkers(roomLocal: WorkspaceRoomLocal): readonly WorkspaceMarker[] {
  switch (roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze([]);
    case 'ephyra':
      return Object.freeze([
        roomLocal.sideRooms.marker,
        ...roomLocal.sideRooms.slots.flatMap((slot) => [slot.marker, slot.rewardControl.marker]),
      ]);
    case 'fields':
      return Object.freeze(roomLocal.cages.map((cage) => cage.control.marker));
    case 'ship':
      return Object.freeze(
        roomLocal.wheels.flatMap((wheel) => [
          wheel.marker,
          ...wheel.offers.map((offer) => offer.control.marker),
        ]),
      );
    case 'shop':
      return Object.freeze(
        roomLocal.offers.flatMap((offer) => [offer.purchase.marker, offer.rewardControl.marker]),
      );
  }
}

interface WorkspaceOccurrenceProjectionInput {
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

interface WorkspaceOccurrenceAssembly {
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
}

function projectOccurrence(
  context: MutableProjectionContext,
  occurrence: RoomOccurrence,
  input: WorkspaceOccurrenceProjectionInput,
): WorkspaceOccurrenceAssembly {
  const room = requireRoom(context.catalog, occurrence.gameName);
  const address = createOccurrenceAddress(context.biome, occurrence.occurrenceId);
  const occurrenceFacts = context.occurrenceFacts.occurrence(occurrence.occurrenceId);
  if (occurrenceFacts === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(address)} has no authored occurrence assembly facts`,
    );
  }
  const { detailsActive } = occurrenceFacts;
  if (
    input.roomPicker !== undefined &&
    semanticAddressKey(input.roomPicker.address) !== semanticAddressKey(address)
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(address)} received a room picker for ${semanticAddressKey(input.roomPicker.address)}`,
    );
  }
  const entered = input.evaluatedRoom?.entered ?? false;
  // A dormant Shop is a dead leaf. Its persisted inventory remains available
  // to the command model if the room is picked again, but neither its offer
  // summary nor its editable lifecycle controls are active.
  const summary =
    occurrence.state.kind === 'shop' && !detailsActive
      ? undefined
      : rewardSummary(context.catalog, room, occurrence.state);
  const rewardControls = controlsForOccurrence(context, occurrence, room, detailsActive);
  const roomControls =
    input.roomPicker === undefined ? Object.freeze([]) : Object.freeze([input.roomPicker]);
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    detailsActive,
    entered,
    gameName: occurrence.gameName,
    kind: room.kind,
    label: room.label,
    marker: marker(context, address),
    occurrenceId: occurrence.occurrenceId,
    ...(input.roomPicker === undefined ? {} : { roomPicker: input.roomPicker }),
    roomLocal: roomLocalForOccurrence(
      context,
      occurrence,
      room,
      rewardControls,
      detailsActive,
      input.evaluatedRoom,
      occurrenceFacts.fieldsActiveCageCount,
    ),
    rewardControls,
    ...(summary === undefined ? {} : { rewardSummary: summary }),
  });
  const node = Object.freeze({
    inspectorPresentation: 'full' as const,
    kind: 'occurrenceWorkbench' as const,
    key: `occurrence:${semanticAddressKey(address)}`,
    localDetailMarkers: localDetailMarkers(roomSummary.roomLocal),
    marker: roomSummary.marker,
    room: roomSummary,
  });
  redirectOccurrenceFocus(context, node);
  return Object.freeze({ node, roomControls, rewardControls });
}

/** @internal Composition never silently replaces a separately projected room control. */
export function appendUniqueRoomControls(
  controlsByOwner: Map<string, WorkspaceRoomPickerControl>,
  controls: Iterable<WorkspaceRoomPickerControl>,
): void {
  for (const control of controls) {
    const key = semanticAddressKey(control.address);
    if (controlsByOwner.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected room controls`,
      );
    }
    controlsByOwner.set(key, control);
  }
}

/** @internal Composition never silently replaces a separately projected reward control. */
export function appendUniqueRewardControls(
  controlsByOwner: Map<string, WorkspaceRewardControl>,
  controls: Iterable<WorkspaceRewardControl>,
): void {
  for (const control of controls) {
    const key = semanticAddressKey(control.owner.address);
    if (controlsByOwner.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected reward controls`,
      );
    }
    controlsByOwner.set(key, control);
  }
}

/** @internal Composition never silently replaces a separately projected focus destination. */
export function appendUniqueFocusDestinations(
  destinationsByOwner: Map<string, WorkspaceInspectorDestination>,
  destinations: Iterable<readonly [string, WorkspaceInspectorDestination]>,
): void {
  for (const [key, destination] of destinations) {
    const ownerKey = semanticAddressKey(destination.ownerAddress);
    if (key !== ownerKey) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} focus destination key does not match its semantic owner ${ownerKey}`,
      );
    }
    if (destinationsByOwner.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected focus destinations`,
      );
    }
    destinationsByOwner.set(key, destination);
  }
}

function authoredOccurrence(
  context: MutableProjectionContext,
  id: OccurrenceId,
): RoomOccurrence | undefined {
  return context.source.occurrence(id);
}

function isTakeover(room: RoomDeclaration | undefined): boolean {
  return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
}

function isMixed(room: RoomDeclaration | undefined): boolean {
  return room?.prebossBatchPolicy?.kind === 'retainNormalPeers';
}

function hubStageDecisionRemoval(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  owner: ExitDecisionAddress,
  stage: 'preHub' | 'preboss',
): WorkspaceStageDecisionRemoval | undefined {
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.progression.kind !== 'hub') return undefined;
  const isExpectedSource =
    stage === 'preHub'
      ? layout.start.kind === 'fixedAuthored' &&
        owner.source.kind === 'occurrence' &&
        authoredOccurrence(context, owner.source.occurrenceId)?.gameName ===
          layout.start.roomGameName
      : owner.source.kind === 'hubDecision' &&
        owner.source.decisionKey === layout.progression.hubKey;
  if (!isExpectedSource) return undefined;
  return Object.freeze({
    interactionKey: workspaceInteractionKey(owner),
    label: stage === 'preHub' ? 'Remove PreHub' : 'Remove Preboss',
  });
}

type WorkspaceDecisionBatchNode =
  WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function occurrenceOwnedMarkers(room: WorkspaceRoomSummary): readonly WorkspaceMarker[] {
  return Object.freeze([
    room.marker,
    ...room.rewardControls.map((control) => control.marker),
    ...localDetailMarkers(room.roomLocal),
    ...(room.roomLocal.kind === 'fixed' ? [room.roomLocal.marker] : []),
  ]);
}

function decisionOwnedMarkers(node: WorkspaceDecisionBatchNode): readonly WorkspaceMarker[] {
  return Object.freeze([
    node.marker,
    node.selection,
    ...(node.rewardStore === undefined ? [] : [node.rewardStore]),
    ...node.targets.flatMap((target) => [target.marker, ...occurrenceOwnedMarkers(target.room)]),
    ...node.missingTargets.map((target) => target.marker),
  ]);
}

function redirectMarkersToNode(
  context: MutableProjectionContext,
  markers: readonly WorkspaceMarker[],
  nodeKey: string,
): void {
  for (const focusMarker of markers) {
    const existing = context.focusDestinations.get(focusMarker.focusKey);
    if (existing === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${focusMarker.focusKey} has no registered focus destination`,
      );
    }
    context.focusDestinations.set(focusMarker.focusKey, Object.freeze({ ...existing, nodeKey }));
  }
}

function redirectOccurrenceFocus(
  context: MutableProjectionContext,
  node: WorkspaceOccurrenceWorkbenchNode,
): void {
  redirectMarkersToNode(context, occurrenceOwnedMarkers(node.room), node.key);
}

function redirectLinkedFocus(
  context: MutableProjectionContext,
  node: WorkspaceLinkedExitNode,
): void {
  redirectMarkersToNode(
    context,
    Object.freeze([node.marker, node.target.marker, ...occurrenceOwnedMarkers(node.target.room)]),
    node.key,
  );
}

/**
 * Ordinary offer and finding owners remain exact semantic addresses, while
 * their visible workbench is the decision that contains them. Hub-owned
 * stages keep their existing board/visit routing.
 */
function redirectDecisionFocus(
  context: MutableProjectionContext,
  node: WorkspaceDecisionBatchNode,
): void {
  if (node.source.kind === 'hubDecision') return;
  redirectMarkersToNode(context, decisionOwnedMarkers(node), node.key);
}

function projectRemovalScope(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  roots: ReadonlySet<OccurrenceId>,
):
  | {
      readonly removedDecisionOwners: readonly ExitDecisionAddress[];
      readonly removedOccurrenceIds: readonly OccurrenceId[];
    }
  | undefined {
  const topology = plan.topology;
  if (topology === null) return undefined;
  if (roots.size === 0) return undefined;
  const impact = describeTopologyRemovalImpact(topology, roots);

  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedOccurrenceIds: impact.removedOccurrenceIds,
  });
}

function topologyRemovalScope(
  biome: BiomeAddress,
  impact: TopologyRemovalImpact,
): WorkspaceTopologyRemovalScope {
  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedHubDecisionKeys: impact.removedHubDecisionKeys,
    removedOccurrenceIds: impact.removedOccurrenceIds,
  });
}

/**
 * The command owns retained-target reconciliation. Both canonical and raw
 * authored projections ask this one domain-derived calculation for its exact
 * removal impact; blocked suffixes must not silently lose the repair that
 * their persisted topology still requires.
 */
function batchRepairScopeForRoots(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  owner: ExitDecisionAddress,
  kind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
  roots: ReadonlySet<OccurrenceId>,
): WorkspaceBatchRepairScope | undefined {
  const removal = projectRemovalScope(context.biome, plan, roots);
  if (removal === undefined) return undefined;
  return kind === 'takeoverBatch'
    ? Object.freeze({ commandKind: 'ReconcileTakeoverBatch' as const, owner, ...removal })
    : Object.freeze({
        command: Object.freeze({ kind: 'ReconcileBatchExitCapacity' as const, decision: owner }),
        commandKind: 'ReconcileBatchExitCapacity' as const,
        owner,
        ...removal,
      });
}

function takeoverReplacementImpact(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
): WorkspaceTakeoverReplacementImpact | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  const replacedOccurrenceIds = new Set(
    decision.normal.targets.map((target) => target.occurrenceId),
  );
  const removal = projectRemovalScope(biome, plan, replacedOccurrenceIds);
  if (removal === undefined) return undefined;
  return Object.freeze({
    command: 'ReplaceWithTakeoverBatch',
    owner: createExitDecisionAddress(biome, decision.source),
    removedDecisionOwners: removal.removedDecisionOwners,
    removedOccurrenceIds: removal.removedOccurrenceIds,
    replacedOccurrenceIds: Object.freeze(
      plan.topology?.occurrences
        .filter((occurrence) => replacedOccurrenceIds.has(occurrence.occurrenceId))
        .map((occurrence) => occurrence.occurrenceId) ?? [],
    ),
  });
}

function missingTargetsForPhysicalExits(
  context: MutableProjectionContext,
  source: ExitDecisionSourceAddress,
  exits: readonly { readonly exitKey: string; readonly index: number }[],
  authoredExitKeys: ReadonlySet<string>,
  prerequisite: WorkspaceMissingTargetSetupPrerequisite | undefined = undefined,
): readonly WorkspaceMissingPhysicalTarget[] {
  let firstMissing: { readonly exitKey: string; readonly index: number } | undefined;
  const missing: WorkspaceMissingPhysicalTarget[] = [];
  for (const exit of [...exits].sort((left, right) => left.index - right.index)) {
    if (authoredExitKeys.has(exit.exitKey)) continue;
    const owner = createTargetAddress(context.biome, source, exit.exitKey);
    missing.push(
      Object.freeze({
        authoring:
          prerequisite ??
          (firstMissing === undefined
            ? Object.freeze({ kind: 'ready' as const })
            : Object.freeze({
                kind: 'awaitingPriorExit' as const,
                message: `Choose Exit ${firstMissing.index} first.`,
                prerequisiteExitKey: firstMissing.exitKey,
              })),
        exitKey: exit.exitKey,
        index: exit.index,
        marker: marker(context, owner),
        owner,
      }),
    );
    firstMissing ??= exit;
  }
  return Object.freeze(missing);
}

function fieldsContextForCanonicalBatch(
  context: MutableProjectionContext,
  batch: CanonicalBatch,
): WorkspaceFieldsBatchContext | undefined {
  if (batch.batchState.kind !== 'fields') return undefined;
  const support =
    context.evaluation !== undefined && 'roomGeneration' in context.evaluation
      ? context.evaluation.roomGeneration.ordinary.fieldsCageOutcomes.find(
          (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(batch.origin),
        )
      : undefined;
  return Object.freeze({
    cageOutcome: batch.batchState.cageOutcome,
    cageTargetCount: batch.batchState.cageTargetCount,
    doorCageRewardCount: batch.batchState.doorCageRewardCount,
    ...(support === undefined
      ? {}
      : {
          priorMaxOutcomes: Object.freeze({
            fieldsMaxDoorsRolled: support.fieldsMaxDoorsRolled,
            maxDoorCageCeiling: support.maxDoorCageCeiling,
          }),
        }),
  });
}

function hubOccurrenceMap(plan: AuthoredBiomePlan): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(
    (plan.topology?.occurrences ?? []).map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
}

interface ProjectedHubTarget {
  readonly canonical?: CanonicalAuthoredRoom;
  readonly occurrenceId: OccurrenceId;
}

function hubMainRewardMarker(room: WorkspaceRoomSummary): WorkspaceMarker | undefined {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return room.roomLocal.marker;
    case 'incomingReward':
      return room.roomLocal.control.marker;
    case 'ephyra':
      return room.roomLocal.incomingReward.marker;
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return undefined;
  }
}

/** Hub main offers retain their semantic owner but navigate to the Hub board. */
function redirectHubMainRewardFocus(
  context: MutableProjectionContext,
  hub: WorkspaceMarker,
  mainReward: WorkspaceMarker,
): void {
  context.focusDestinations.set(
    mainReward.focusKey,
    Object.freeze({
      biomeKey: context.biome.biomeKey,
      focusAddress: hub.address,
      focusKey: hub.focusKey,
      nodeKey: `hub:${hub.focusKey}`,
      ownerAddress: mainReward.address,
      region: 'structure' as const,
      routeKey: context.routeKey,
    }),
  );
}

/**
 * The Hub board is one declaration-owned decision.  Materialization may only
 * retain a prefix of it, while the authored decision can retain later rooms
 * and visits.  Project both through the same board shape so React never has
 * to choose between topology and the simulator product.
 */
interface WorkspaceHubAssembly {
  readonly node: WorkspaceHubDecisionNode;
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
}

function projectHubNode(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  descriptor: HubDecisionDescriptor,
  owner: HubDecisionAddress,
  targets: ReadonlyMap<string, ProjectedHubTarget>,
  visitOrder: readonly string[],
  nextVisitIndex: number | undefined,
  boardAuthored: boolean,
): WorkspaceHubAssembly {
  const hubMarker = marker(context, owner);
  const occurrences = hubOccurrenceMap(plan);
  const roomControls: WorkspaceRoomPickerControl[] = [];
  const rewardControls: WorkspaceRewardControl[] = [];
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const roomsBySlot = new Map<string, WorkspaceRoomSummary>();
  const slots = descriptor.slots.map((slot) => {
    const target = targets.get(slot.slotKey);
    const occurrence = target === undefined ? undefined : occurrences.get(target.occurrenceId);
    const address = createHubSlotAddress(context.biome, descriptor.hubKey, slot.slotKey);
    const slotMarker = marker(context, address);
    const detailsActive =
      occurrence === undefined
        ? false
        : (context.occurrenceFacts.occurrence(occurrence.occurrenceId)?.detailsActive ?? false);
    const occurrenceAssembly =
      occurrence === undefined
        ? undefined
        : projectOccurrence(context, occurrence, {
            ...(target?.canonical === undefined ? {} : { evaluatedRoom: target.canonical }),
          });
    const occurrenceNode = occurrenceAssembly?.node;
    if (occurrenceNode !== undefined) {
      roomControls.push(...occurrenceAssembly!.roomControls);
      rewardControls.push(...occurrenceAssembly!.rewardControls);
      const workbench = Object.freeze({
        ...occurrenceNode,
        inspectorPresentation: 'hubRoomLocal' as const,
        railMarker: slotMarker,
        railVisibility: 'inspectorOnly' as const,
      });
      workbenches.push(workbench);
      roomsBySlot.set(slot.slotKey, workbench.room);
      const mainReward = hubMainRewardMarker(workbench.room);
      if (mainReward !== undefined) redirectHubMainRewardFocus(context, hubMarker, mainReward);
    }
    return Object.freeze({
      canClose: boardAuthored && target !== undefined && !detailsActive,
      canOpen: boardAuthored && target === undefined && targets.size < descriptor.openCount.max,
      hubSlotKey: slot.slotKey,
      label: requireRoom(context.catalog, slot.roomGameName).label,
      marker: slotMarker,
      open: target !== undefined,
      physicalDoorId: slot.physicalDoorId,
      ...(occurrenceNode === undefined ? {} : { room: occurrenceNode.room }),
      roomKind: requireRoom(context.catalog, slot.roomGameName).kind,
      visited: detailsActive,
    });
  });
  const visits = Array.from({ length: descriptor.requiredVisits }, (_, index) => {
    const visitIndex = index + 1;
    const hubSlotKey = visitOrder[index];
    const authoring =
      hubSlotKey !== undefined
        ? ('authored' as const)
        : nextVisitIndex === visitIndex
          ? ('next' as const)
          : ('locked' as const);
    return Object.freeze({
      authoring,
      marker: marker(context, createHubVisitAddress(context.biome, descriptor.hubKey, visitIndex)),
      ...(hubSlotKey === undefined ? {} : { hubSlotKey }),
      ...(hubSlotKey === undefined || roomsBySlot.get(hubSlotKey) === undefined
        ? {}
        : { room: roomsBySlot.get(hubSlotKey)! }),
      visitIndex,
    });
  });
  const node = Object.freeze({
    authoring: boardAuthored ? ('authored' as const) : ('outline' as const),
    kind: 'hubDecision' as const,
    key: `hub:${semanticAddressKey(owner)}`,
    hubKey: descriptor.hubKey,
    marker: hubMarker,
    openSet: marker(context, createHubOpenSetAddress(context.biome, descriptor.hubKey)),
    openSlotCount: Object.freeze({
      current: targets.size,
      min: descriptor.openCount.min,
      max: descriptor.openCount.max,
    }),
    owner,
    requiredVisitCount: descriptor.requiredVisits,
    slots: Object.freeze(slots),
    visits: Object.freeze(visits),
  });
  redirectMarkersToNode(
    context,
    Object.freeze([
      node.marker,
      node.openSet,
      ...node.slots.map((slot) => slot.marker),
      ...node.visits.map((visit) => visit.marker),
    ]),
    node.key,
  );
  return Object.freeze({
    node,
    roomControls: Object.freeze(roomControls),
    rewardControls: Object.freeze(rewardControls),
    workbenches: Object.freeze(workbenches),
  });
}

function projectAuthoredHubWithOverlay(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  hub: HubDecision,
  descriptor: HubDecisionDescriptor,
  evaluated: CanonicalHubDecision | undefined,
  nextVisitIndex: number | undefined,
): WorkspaceHubAssembly {
  const owner = createHubDecisionAddress(context.biome, descriptor.hubKey);
  if (evaluated !== undefined) {
    if (
      semanticAddressKey(evaluated.origin) !== semanticAddressKey(owner) ||
      semanticAddressKey(evaluated.board.origin) !==
        semanticAddressKey(createHubOpenSetAddress(context.biome, descriptor.hubKey))
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} evaluated Hub does not match authored topology`,
      );
    }
  }
  const evaluatedTargets = new Map(
    (evaluated?.board.targets ?? []).map((target) => [target.hubSlotKey, target] as const),
  );
  if (evaluatedTargets.size !== (evaluated?.board.targets.length ?? 0)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has duplicate evaluated Hub slot targets`,
    );
  }
  const authoredTargets = new Map(hub.openTargets.map((target) => [target.hubSlotKey, target]));
  const targets = new Map<string, ProjectedHubTarget>();
  for (const target of hub.openTargets) {
    const overlay = evaluatedTargets.get(target.hubSlotKey);
    evaluatedTargets.delete(target.hubSlotKey);
    const address = createHubSlotAddress(context.biome, descriptor.hubKey, target.hubSlotKey);
    if (
      overlay !== undefined &&
      (semanticAddressKey(overlay.origin) !== semanticAddressKey(address) ||
        overlay.room.occurrenceId !== target.occurrenceId ||
        semanticAddressKey(overlay.room.origin) !==
          semanticAddressKey(createOccurrenceAddress(context.biome, target.occurrenceId)) ||
        overlay.room.gameName !== authoredOccurrence(context, target.occurrenceId)?.gameName)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} evaluated Hub target does not match its authored occurrence`,
      );
    }
    targets.set(
      target.hubSlotKey,
      Object.freeze({
        ...(overlay === undefined ? {} : { canonical: overlay.room }),
        occurrenceId: target.occurrenceId,
      }),
    );
  }
  if (evaluatedTargets.size > 0) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has evaluated Hub targets with no authored slot`,
    );
  }
  const evaluatedVisitIndexes = new Set<number>();
  for (const visit of evaluated?.visits ?? []) {
    if (evaluatedVisitIndexes.has(visit.visitIndex)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has duplicate evaluated Hub visit ${visit.visitIndex}`,
      );
    }
    evaluatedVisitIndexes.add(visit.visitIndex);
    const expectedSlot = hub.visitOrder[visit.visitIndex - 1];
    const target = authoredTargets.get(visit.target.hubSlotKey);
    const expectedVisit = createHubVisitAddress(context.biome, descriptor.hubKey, visit.visitIndex);
    const expectedTarget = createHubSlotAddress(
      context.biome,
      descriptor.hubKey,
      visit.target.hubSlotKey,
    );
    if (
      expectedSlot !== visit.target.hubSlotKey ||
      target === undefined ||
      target.occurrenceId !== visit.target.room.occurrenceId ||
      visit.target.room.gameName !== authoredOccurrence(context, target.occurrenceId)?.gameName ||
      semanticAddressKey(visit.target.room.origin) !==
        semanticAddressKey(createOccurrenceAddress(context.biome, target.occurrenceId)) ||
      semanticAddressKey(visit.origin) !== semanticAddressKey(expectedVisit) ||
      semanticAddressKey(visit.target.origin) !== semanticAddressKey(expectedTarget)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has an evaluated Hub visit that does not match authored order`,
      );
    }
  }
  return projectHubNode(
    context,
    plan,
    descriptor,
    owner,
    targets,
    hub.visitOrder,
    nextVisitIndex,
    true,
  );
}

function projectHubOutline(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  descriptor: HubDecisionDescriptor,
): WorkspaceHubAssembly {
  return projectHubNode(
    context,
    plan,
    descriptor,
    createHubDecisionAddress(context.biome, descriptor.hubKey),
    new Map(),
    Object.freeze([]),
    undefined,
    false,
  );
}

type AuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};
type AuthoredLinkedExitDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'linked' }>;
};
type AuthoredBatchTarget = AuthoredBatchDecision['normal']['targets'][number];

function authoredTargetIsSelected(
  decision: AuthoredBatchDecision,
  target: AuthoredBatchTarget,
): boolean {
  if (decision.selection.kind === 'normal') {
    return decision.selection.exitKey === target.exitKey;
  }
  return (
    decision.selection.kind === 'derived' && decision.normal.targets[0]?.exitKey === target.exitKey
  );
}

/**
 * Detail activation is an authored relationship. It is intentionally derived
 * from topology alone so a blocked or invalid evaluator prefix cannot remove
 * an active room's declaration-owned lifecycle surface.
 */
function expectedDetailsActiveOccurrenceIds(plan: AuthoredBiomePlan): ReadonlySet<OccurrenceId> {
  const active = new Set<OccurrenceId>();
  const topology = plan.topology;
  if (topology === null) return active;
  active.add(topology.startOccurrenceId);
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      for (const slotKey of decision.visitOrder) {
        const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === slotKey);
        if (target !== undefined) active.add(target.occurrenceId);
      }
      continue;
    }
    if (decision.normal.kind === 'linked') {
      active.add(decision.normal.occurrenceId);
      continue;
    }
    const target = decision.normal.targets.find((candidate) =>
      authoredTargetIsSelected(decision as AuthoredBatchDecision, candidate),
    );
    if (target !== undefined) active.add(target.occurrenceId);
  }
  return active;
}

interface MutableWorkspaceAuthoredLeafRequirement {
  readonly address: SemanticAddress;
  readonly interactions: Map<
    WorkspaceAuthoredLeafInteractionKind,
    WorkspaceAuthoredLeafInteractionRequirement
  >;
}

function authoredLeafInteraction(
  kind: WorkspaceAuthoredLeafInteractionKind,
  key: string,
): WorkspaceAuthoredLeafInteractionRequirement {
  return Object.freeze({ key, kind });
}

/**
 * Enumerates the leaf contract from persisted room state and declarations.
 *
 * This must stay independent of workspace products: it is the expected side
 * of the closure audit. It includes offer-time values for all authored
 * occurrences, while Ephyra side details and Shop inventory remain dormant
 * until their room is on an authored active detail path.
 */
export function authoredWorkspaceLeafRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
): readonly WorkspaceAuthoredLeafRequirement[] {
  const required = new Map<string, MutableWorkspaceAuthoredLeafRequirement>();
  const requireLeaf = (
    address: SemanticAddress,
    ...interactions: readonly WorkspaceAuthoredLeafInteractionRequirement[]
  ): void => {
    const key = semanticAddressKey(address);
    let requirement = required.get(key);
    if (requirement === undefined) {
      requirement = {
        address,
        interactions: new Map(),
      };
      required.set(key, requirement);
    }
    for (const interaction of interactions) {
      const existing = requirement.interactions.get(interaction.kind);
      if (existing !== undefined && existing.key !== interaction.key) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has conflicting authored ${interaction.kind} interaction requirements`,
        );
      }
      requirement.interactions.set(interaction.kind, interaction);
    }
  };
  const requireReward = (address: SemanticAddress): void =>
    requireLeaf(address, authoredLeafInteraction('reward', semanticAddressKey(address)));
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const detailsActive = expectedDetailsActiveOccurrenceIds(plan);
  for (const occurrence of topology.occurrences) {
    const room = requireRoom(catalog, occurrence.gameName);
    const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
    const incoming = createIncomingRewardAddress(biome, occurrence.occurrenceId);
    switch (occurrence.state.kind) {
      case 'none':
        break;
      case 'fixed': {
        const offer = fixedRewardOffer(room, occurrence.state);
        const rewardType = catalog.rewards.rewardTypes.byKey[offer.rewardType];
        requireLeaf(
          incoming,
          ...(rewardType?.payloadDomain === undefined
            ? []
            : [authoredLeafInteraction('reward', semanticAddressKey(incoming))]),
        );
        break;
      }
      case 'counted':
      case 'freeReward':
        requireReward(incoming);
        break;
      case 'ephyraCombat': {
        requireReward(incoming);
        // Main rewards are offer-time data. The side-room lifecycle is
        // picked-room customization, so an unvisited Hub room retains it as
        // dormant state rather than publishing editable children.
        if (!detailsActive.has(occurrence.occurrenceId)) break;
        const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
        if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) break;
        if (group?.kind !== 'fixedRoomSlots') {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ephyra state has no fixed side-room declaration`,
          );
        }
        requireLeaf(createLocalChildGroupAddress(biome, occurrence.occurrenceId, group.key));
        for (const slot of group.slots) {
          const sideAddress = createLocalChildAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
            slot.slotKey,
          );
          requireLeaf(
            sideAddress,
            authoredLeafInteraction('sideRoomGeneration', semanticAddressKey(sideAddress)),
            authoredLeafInteraction(
              'sideRoomEntryOrder',
              workspaceSideRoomEntryOrderKey(sideAddress),
            ),
          );
          requireReward(
            createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slot.slotKey),
          );
        }
        break;
      }
      case 'fieldsCombat': {
        const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
        if (group?.kind !== 'boundedRewardSlots') {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Fields state has no bounded cage declaration`,
          );
        }
        for (const slotKey of group.slotKeys) {
          requireReward(
            createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slotKey),
          );
        }
        break;
      }
      case 'shipCombat': {
        const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
        if (profile === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state has no encounter profile`,
          );
        }
        requireLeaf(
          occurrenceAddress,
          authoredLeafInteraction('shipEncounterCount', semanticAddressKey(occurrenceAddress)),
        );
        for (const phase of profile.phases) {
          const wheel = phase.offerPoint;
          if (wheel === undefined) continue;
          const wheelAddress = createRewardWheelAddress(biome, occurrence.occurrenceId, wheel.key);
          const wheelKey = semanticAddressKey(wheelAddress);
          requireLeaf(
            wheelAddress,
            authoredLeafInteraction('rewardWheelOfferCount', wheelKey),
            authoredLeafInteraction('rewardWheelStore', wheelKey),
            authoredLeafInteraction('rewardWheelPick', wheelKey),
          );
          for (const offerKey of wheel.offerKeys) {
            requireReward(
              createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheel.key, offerKey),
            );
          }
        }
        break;
      }
      case 'shop': {
        // A persisted unpicked Shop inventory is deliberately dormant. A
        // selected-but-unassessed Shop is active because this checks authored
        // detail activation rather than evaluator entry.
        if (!detailsActive.has(occurrence.occurrenceId) || occurrence.state.shop === undefined) {
          break;
        }
        const profile = catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
        if (profile === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop profile ${occurrence.state.shop.profileKey} is missing`,
          );
        }
        for (const slot of profile.slots.values) {
          const offer = createShopOfferAddress(biome, occurrence.occurrenceId, slot.key);
          requireReward(offer);
          requireLeaf(
            createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key),
            authoredLeafInteraction(
              'shopPurchase',
              semanticAddressKey(
                createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key),
              ),
            ),
          );
        }
        break;
      }
    }
  }
  return Object.freeze(
    [...required.values()].map((requirement) =>
      Object.freeze({
        address: requirement.address,
        interactions: Object.freeze([...requirement.interactions.values()]),
      }),
    ),
  );
}

/**
 * The occurrence facts are a production convenience, never the expected side
 * of this audit. Compare them to the independently enumerated authored leaf
 * requirements before semantic assembly relies on them.
 */
function assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
  facts: WorkspaceBiomeOccurrenceAssemblyFacts,
  plan: AuthoredBiomePlan,
  requirements: readonly WorkspaceAuthoredLeafRequirement[],
): void {
  const expectedDetailsActive = expectedDetailsActiveOccurrenceIds(plan);
  const authoredOccurrenceIds = new Set(
    (plan.topology?.occurrences ?? []).map((occurrence) => occurrence.occurrenceId),
  );
  for (const occurrenceId of authoredOccurrenceIds) {
    const fact = facts.occurrence(occurrenceId);
    if (fact === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, occurrenceId))} has no authored occurrence assembly facts`,
      );
    }
    if (fact.detailsActive !== expectedDetailsActive.has(occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, occurrenceId))} has incorrect authored detail activation`,
      );
    }
  }
  for (const fact of facts.occurrences) {
    if (!authoredOccurrenceIds.has(fact.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, fact.occurrenceId))} has no authored occurrence owner`,
      );
    }
  }
  const expected = new Set(
    requirements.map((requirement) => semanticAddressKey(requirement.address)),
  );
  for (const occurrence of facts.occurrences) {
    for (const leaf of occurrence.leaves) {
      const key = semanticAddressKey(leaf.address);
      if (leaf.lifecycle === 'active' && leaf.surface === 'published' && !expected.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} active authored occurrence leaf is absent from the independent closure requirements`,
        );
      }
      if (leaf.surface === 'withheld' && expected.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} withheld authored occurrence leaf is unexpectedly required by the independent closure`,
        );
      }
    }
  }
  for (const requirement of requirements) {
    const surface = facts.leafSurface(requirement.address);
    if (surface !== 'published') {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(requirement.address)} required authored leaf is ${surface} in occurrence assembly facts`,
      );
    }
  }
}

function fieldsContextForAuthoredBatch(
  context: MutableProjectionContext,
  decision: AuthoredBatchDecision,
): WorkspaceFieldsBatchContext | undefined {
  if (decision.normal.batchState === null) return undefined;
  const doorCageRewardCount = authoredFieldsActiveCageCountForDecision(
    context.catalog,
    context.source,
    decision,
  );
  if (doorCageRewardCount === undefined) return undefined;
  const cageTargetCount = decision.normal.targets.filter((target) => {
    const occurrence = authoredOccurrence(context, target.occurrenceId);
    if (occurrence === undefined) return false;
    return requireRoom(context.catalog, occurrence.gameName).localChildren.some(
      (child) => child.kind === 'boundedRewardSlots',
    );
  }).length;
  return Object.freeze({
    cageOutcome: decision.normal.batchState.cageOutcome,
    cageTargetCount,
    doorCageRewardCount,
  });
}

function missingTargetPrerequisite(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
): WorkspaceMissingTargetSetupPrerequisite | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  if (
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    return Object.freeze({
      kind: 'awaitingBatchRewardStore' as const,
      message: 'Select the batch reward store first.',
    });
  }
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  if (
    layout?.progression.kind === 'generated' &&
    layout.progression.batchPolicy.kind === 'fields' &&
    decision.normal.batchState === null
  ) {
    return Object.freeze({
      kind: 'awaitingFieldsCageOutcome' as const,
      message: 'Select the Fields cage outcome first.',
    });
  }
  return undefined;
}

function physicalExitsForSource(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  source: ExitDecisionSourceAddress,
): readonly DeclaredPhysicalExit[] {
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined || plan.topology === null) return Object.freeze([]);
  return (
    resolveDeclaredPhysicalExits(context.catalog, layout, plan.topology, source) ??
    Object.freeze([])
  );
}

function rawBatchKind(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredBatchDecision,
): 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch' {
  const rooms = decision.normal.targets.flatMap((target) => {
    const occurrence = authoredOccurrence(context, target.occurrenceId);
    return occurrence === undefined ? [] : [requireRoom(context.catalog, occurrence.gameName)];
  });
  if (rooms.length > 0 && rooms.every(isTakeover)) return 'takeoverBatch';
  if (rooms.some(isMixed)) return 'mixedBatch';
  return 'ordinaryBatch';
}

function rawBatchTopologyState(
  context: MutableProjectionContext,
  owner: ExitDecisionAddress,
): 'partial' | 'retained' {
  const evaluation = context.evaluation;
  return evaluation?.authoring === 'incomplete' &&
    evaluation.coverage.kind === 'prefix' &&
    semanticAddressKey(evaluation.frontier) === semanticAddressKey(owner)
    ? 'partial'
    : 'retained';
}

/** Evaluation enriches an authored batch but never supplies its membership. */
type EvaluatedBatchOverlay = WorkspaceEvaluatedBatchOverlay;

function projectAuthoredTargetWithOverlay(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredBatchDecision,
  target: AuthoredBatchTarget,
  physical: readonly DeclaredPhysicalExit[],
  sourceDecisionRemoval: WorkspaceStageDecisionRemoval | undefined,
  evaluatedTarget: CanonicalTarget | undefined,
): {
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly target: WorkspacePhysicalTarget;
} {
  const occurrence = authoredOccurrence(context, target.occurrenceId);
  if (occurrence === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} target ${target.occurrenceId} is absent from authored occurrences`,
    );
  }
  const address = createTargetAddress(context.biome, decision.source, target.exitKey);
  if (evaluatedTarget !== undefined) {
    if (semanticAddressKey(evaluatedTarget.origin) !== semanticAddressKey(address)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} received an evaluated target for ${semanticAddressKey(evaluatedTarget.origin)}`,
      );
    }
    const occurrenceAddress = createOccurrenceAddress(context.biome, occurrence.occurrenceId);
    if (
      evaluatedTarget.room.occurrenceId !== occurrence.occurrenceId ||
      evaluatedTarget.room.gameName !== occurrence.gameName ||
      semanticAddressKey(evaluatedTarget.room.origin) !== semanticAddressKey(occurrenceAddress)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} evaluated room does not match its authored occurrence`,
      );
    }
  }
  const selected = authoredTargetIsSelected(decision, target);
  const declaredExit = physical.find((candidate) => candidate.exitKey === target.exitKey);
  const physicalState =
    evaluatedTarget?.exit.kind ??
    (declaredExit === undefined ? ('unavailable' as const) : ('available' as const));
  const fallbackContinuation: WorkspacePhysicalTarget['nextPath'] =
    requireRoom(context.catalog, occurrence.gameName).kind === 'Preboss'
      ? 'startsCompletion'
      : selected
        ? 'continuesSpine'
        : 'deadLeaf';
  const markerForTarget = marker(context, address);
  const occurrenceAssembly = projectOccurrence(context, occurrence, {
    ...(evaluatedTarget === undefined ? {} : { evaluatedRoom: evaluatedTarget.room }),
  });
  const node = Object.freeze({
    ...occurrenceAssembly.node,
    ...(sourceDecisionRemoval === undefined ? {} : { sourceDecisionRemoval }),
    railMarker: markerForTarget,
  });
  return Object.freeze({
    node,
    roomControls: occurrenceAssembly.roomControls,
    rewardControls: occurrenceAssembly.rewardControls,
    target: Object.freeze({
      ...(evaluatedTarget?.room.clockworkReward === undefined
        ? {}
        : { clockworkReward: evaluatedTarget.room.clockworkReward }),
      exitKey: target.exitKey,
      index:
        evaluatedTarget?.exit.index ??
        declaredExit?.index ??
        requiredNormalExitOrdinal(target.exitKey),
      marker: markerForTarget,
      physicalState,
      selected,
      retained: evaluatedTarget === undefined || physicalState === 'unavailable',
      nextPath: evaluatedTarget?.continuation ?? fallbackContinuation,
      room: node.room,
    }),
  });
}

function topologyStateForAuthoredBatch(
  context: MutableProjectionContext,
  owner: ExitDecisionAddress,
  evaluated: EvaluatedBatchOverlay | undefined,
): 'complete' | 'partial' | 'retained' {
  if (evaluated?.partial === true || rawBatchTopologyState(context, owner) === 'partial') {
    return 'partial';
  }
  if (evaluated === undefined) return 'retained';
  return evaluated.batch.targets.some((target) => target.exit.kind === 'unavailable')
    ? 'retained'
    : 'complete';
}

/**
 * A normal decision owns its target pickers. This consumes the same physical
 * target and missing-target products rendered by the workbench, rather than
 * creating controls in an earlier unrelated topology pass.
 */
function roomControlsForBatch(
  context: MutableProjectionContext,
  decision: AuthoredBatchDecision,
  kind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
  physical: readonly DeclaredPhysicalExit[],
  targets: readonly WorkspacePhysicalTarget[],
  missingTargets: readonly WorkspaceMissingPhysicalTarget[],
): readonly WorkspaceRoomPickerControl[] {
  if (kind === 'takeoverBatch' || decision.source.kind !== 'occurrence') {
    return Object.freeze([]);
  }
  const targetsByExit = new Map(targets.map((target) => [target.exitKey, target] as const));
  const missingByExit = new Map(missingTargets.map((target) => [target.exitKey, target] as const));
  const controls: WorkspaceRoomPickerControl[] = [];
  for (const exit of [...physical].sort((left, right) => left.index - right.index)) {
    const target = targetsByExit.get(exit.exitKey);
    if (target !== undefined) {
      controls.push(
        targetRoomControl(
          createTargetAddress(context.biome, decision.source, target.exitKey),
          target.room.gameName,
        ),
      );
      continue;
    }
    const missing = missingByExit.get(exit.exitKey);
    if (missing?.authoring.kind === 'ready') {
      controls.push(targetRoomControl(missing.owner));
    }
  }
  return Object.freeze(controls);
}

function projectAuthoredBatchWithOverlay(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredBatchDecision,
  evaluated: EvaluatedBatchOverlay | undefined,
): {
  readonly batch: WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode | WorkspaceMixedBatchNode;
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const owner = createExitDecisionAddress(context.biome, decision.source);
  if (
    evaluated !== undefined &&
    semanticAddressKey(evaluated.batch.origin) !== semanticAddressKey(owner)
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} received an evaluated batch for ${semanticAddressKey(evaluated.batch.origin)}`,
    );
  }
  const evaluatedTargets = new Map<string, CanonicalTarget>();
  for (const target of evaluated?.batch.targets ?? []) {
    if (evaluatedTargets.has(target.exit.exitKey)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has duplicate evaluated target ${target.exit.exitKey}`,
      );
    }
    evaluatedTargets.set(target.exit.exitKey, target);
  }
  const kind = rawBatchKind(context, plan, decision);
  const sourceDecisionRemoval =
    kind === 'takeoverBatch' && decision.source.kind === 'hubDecision'
      ? hubStageDecisionRemoval(context, plan, owner, 'preboss')
      : undefined;
  const physical = physicalExitsForSource(context, plan, decision.source);
  const rank = new Map(physical.map((exit) => [exit.exitKey, exit.index] as const));
  const projectedTargets = [...decision.normal.targets]
    .sort((left, right) => compareAuthoredTargetsInPhysicalOrder(rank, left, right))
    .map((target) => {
      const overlay = evaluatedTargets.get(target.exitKey);
      evaluatedTargets.delete(target.exitKey);
      return projectAuthoredTargetWithOverlay(
        context,
        plan,
        decision,
        target,
        physical,
        sourceDecisionRemoval,
        overlay,
      );
    });
  if (evaluatedTargets.size > 0) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has evaluated targets with no authored target`,
    );
  }
  const targets = projectedTargets.map((value) => value.target);
  const missingTargets = missingTargetsForPhysicalExits(
    context,
    decision.source,
    physical,
    new Set(decision.normal.targets.map((target) => target.exitKey)),
    missingTargetPrerequisite(context, plan, decision),
  );
  const targetRoomControls = roomControlsForBatch(
    context,
    decision,
    kind,
    physical,
    targets,
    missingTargets,
  );
  const repairScope = batchRepairScopeForRoots(
    context,
    plan,
    owner,
    kind,
    new Set(
      targets
        .filter((target) => target.physicalState === 'unavailable')
        .map((target) => target.room.occurrenceId),
    ),
  );
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  const fieldsCageOutcome =
    kind !== 'takeoverBatch' &&
    layout?.progression.kind === 'generated' &&
    layout.progression.batchPolicy.kind === 'fields'
      ? marker(context, owner)
      : undefined;
  const fields =
    evaluated === undefined
      ? fieldsContextForAuthoredBatch(context, decision)
      : fieldsContextForCanonicalBatch(context, evaluated.batch);
  const hasEditableAuthoredRewardStore =
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    (kind !== 'takeoverBatch' || decision.normal.rewardStore.baseRewardStoreKey !== null);
  const base = {
    batchState: decision.normal.batchState,
    ...(fieldsCageOutcome === undefined ? {} : { fieldsCageOutcome }),
    ...(fields === undefined ? {} : { fields }),
    key: `batch:${semanticAddressKey(owner)}`,
    marker: marker(context, owner),
    missingTargets,
    owner,
    ...(repairScope === undefined ? {} : { repairScope }),
    ...(hasEditableAuthoredRewardStore
      ? {
          rewardStore: marker(
            context,
            createBatchRewardStoreAddress(context.biome, decision.source),
          ),
        }
      : {}),
    selection: marker(context, createExitSelectionAddress(context.biome, decision.source)),
    source: decision.source,
    targets: Object.freeze(targets),
    topologyState: topologyStateForAuthoredBatch(context, owner, evaluated),
  } as const;
  const batch: WorkspaceDecisionBatchNode =
    kind === 'takeoverBatch'
      ? Object.freeze({
          ...base,
          kind: 'takeoverBatch' as const,
          targetInteraction: 'readOnly' as const,
          takeoverInteractionKey: workspaceInteractionKey(owner),
        })
      : kind === 'mixedBatch'
        ? Object.freeze({
            ...base,
            kind: 'mixedBatch' as const,
            targetInteraction: 'replaceable' as const,
          })
        : Object.freeze({
            ...base,
            kind: 'ordinaryBatch' as const,
            targetInteraction: 'replaceable' as const,
          });
  redirectDecisionFocus(context, batch);
  if (sourceDecisionRemoval !== undefined) {
    const workbench = projectedTargets[0]?.node;
    if (workbench === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} Hub handoff has no authored target workbench`,
      );
    }
    redirectMarkersToNode(context, decisionOwnedMarkers(batch), workbench.key);
  }
  return Object.freeze({
    batch,
    roomControls: Object.freeze([
      ...projectedTargets.flatMap((target) => target.roomControls),
      ...targetRoomControls,
    ]),
    rewardControls: Object.freeze(projectedTargets.flatMap((target) => target.rewardControls)),
    workbenches: Object.freeze(projectedTargets.map((target) => target.node)),
  });
}

function projectAuthoredLinkedExitWithOverlay(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredLinkedExitDecision,
  evaluated: CanonicalLinkedExit | undefined,
): {
  readonly node: WorkspaceLinkedExitNode;
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly workbench: WorkspaceOccurrenceWorkbenchNode;
} {
  const owner = createExitDecisionAddress(context.biome, decision.source);
  const occurrence = authoredOccurrence(context, decision.normal.occurrenceId);
  if (occurrence === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} linked target ${decision.normal.occurrenceId} is absent from authored occurrences`,
    );
  }
  const address = createTargetAddress(context.biome, decision.source, decision.normal.exitKey);
  if (evaluated !== undefined) {
    if (
      semanticAddressKey(evaluated.origin) !== semanticAddressKey(owner) ||
      semanticAddressKey(evaluated.target.origin) !== semanticAddressKey(address) ||
      evaluated.target.room.occurrenceId !== occurrence.occurrenceId ||
      evaluated.target.room.gameName !== occurrence.gameName ||
      semanticAddressKey(evaluated.target.room.origin) !==
        semanticAddressKey(createOccurrenceAddress(context.biome, occurrence.occurrenceId))
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} evaluated linked exit does not match authored topology`,
      );
    }
  }
  const sourceDecisionRemoval = hubStageDecisionRemoval(context, plan, owner, 'preHub');
  const markerForTarget = marker(context, address);
  const physical = physicalExitsForSource(context, plan, decision.source).find(
    (exit) => exit.exitKey === decision.normal.exitKey,
  );
  const physicalState =
    evaluated?.target.exit.kind ??
    (physical === undefined ? ('unavailable' as const) : ('available' as const));
  const occurrenceAssembly = projectOccurrence(context, occurrence, {
    ...(evaluated === undefined ? {} : { evaluatedRoom: evaluated.target.room }),
  });
  const workbench = Object.freeze({
    ...occurrenceAssembly.node,
    ...(sourceDecisionRemoval === undefined ? {} : { sourceDecisionRemoval }),
    railMarker: markerForTarget,
  });
  const node = Object.freeze({
    kind: 'linkedExit' as const,
    key: `linked:${semanticAddressKey(owner)}`,
    marker: marker(context, owner),
    owner,
    source: decision.source,
    target: Object.freeze({
      ...(evaluated?.target.room.clockworkReward === undefined
        ? {}
        : { clockworkReward: evaluated.target.room.clockworkReward }),
      exitKey: decision.normal.exitKey,
      index: evaluated?.target.exit.index ?? physical?.index ?? linkedExitOrdinal,
      marker: markerForTarget,
      physicalState,
      selected: true,
      retained: evaluated === undefined || physicalState === 'unavailable',
      nextPath: evaluated?.target.continuation ?? ('continuesSpine' as const),
      room: workbench.room,
    }),
  });
  if (sourceDecisionRemoval === undefined) {
    redirectLinkedFocus(context, node);
  } else {
    redirectMarkersToNode(
      context,
      Object.freeze([node.marker, node.target.marker, ...occurrenceOwnedMarkers(node.target.room)]),
      workbench.key,
    );
  }
  return Object.freeze({
    node,
    roomControls: occurrenceAssembly.roomControls,
    rewardControls: occurrenceAssembly.rewardControls,
    workbench,
  });
}

function authoringFrontier(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
): WorkspaceAuthoringFrontier | null {
  if (plan.topology === null) {
    return Object.freeze({
      kind: 'start' as const,
      interactionKey: semanticAddressKey(context.biome),
      marker: marker(context, context.biome),
      owner: context.biome,
    });
  }
  const completeness = evaluateBiomeCompleteness(context.catalog, context.biome, plan);
  if (completeness.completion === 'complete') return null;
  const frontier = completeness.frontier;
  switch (frontier.kind) {
    case 'exitDecision': {
      const predecessorNodeKey =
        frontier.source.kind === 'occurrence'
          ? `occurrence:${semanticAddressKey(
              createOccurrenceAddress(context.biome, frontier.source.occurrenceId),
            )}`
          : undefined;
      return Object.freeze({
        kind: 'exitDecision' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker(context, frontier),
        owner: frontier,
        ...(predecessorNodeKey === undefined ? {} : { predecessorNodeKey }),
      });
    }
    case 'hubDecision':
      return Object.freeze({
        kind: 'hubDecision' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker(context, frontier),
        owner: frontier,
      });
    case 'hubVisit':
      return Object.freeze({
        kind: 'hubVisit' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker(context, frontier),
        owner: frontier,
      });
    case 'hubOpenSet':
      return Object.freeze({
        kind: 'hubOpenSet' as const,
        marker: marker(context, frontier),
        owner: frontier,
      });
    default:
      return null;
  }
}

function targetRoomControl(
  address: TargetAddress,
  selectedGameName?: string,
): WorkspaceRoomPickerControl {
  return Object.freeze({
    address,
    kind: 'targetRoomPicker',
    ...(selectedGameName === undefined ? {} : { selectedGameName }),
  });
}

function startRoomControl(
  address: OccurrenceAddress,
  candidateGameNames: readonly string[],
  selectedGameName: string,
): WorkspaceRoomPickerControl {
  return Object.freeze({
    address,
    candidateGameNames: Object.freeze([...candidateGameNames]),
    kind: 'startRoomPicker' as const,
    selectedGameName,
  });
}

function candidateInteraction<T>(
  owner: SemanticAddress,
  choices: readonly WorkspaceInteractionChoice<T>[],
  selected: T | undefined,
  load: () => readonly CandidateOptionProjection<T>[],
  key = workspaceInteractionKey(owner),
): WorkspaceCandidateInteraction<T> {
  return Object.freeze({
    choices: Object.freeze([...choices]),
    key,
    load,
    owner,
    ...(selected === undefined ? {} : { selected }),
  });
}

function storeLabel(storeKey: string): string {
  return storeKey === 'RunProgress'
    ? 'Run Progress'
    : storeKey === 'MetaProgress'
      ? 'Meta Progress'
      : storeKey;
}

function createInteractionCatalog(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  services: StructuredWorkspaceContextualServices,
  sources: WorkspaceProjectSourceIndex,
  roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>,
  rewardControls: ReadonlyMap<string, WorkspaceRewardControl>,
): WorkspaceInteractionCatalog {
  const candidates = services.candidateSessions.bind(project, evaluation);
  const takeoverCandidate = (gameName: string): WorkspaceTakeoverCandidate => {
    const room = requireRoom(catalog, gameName);
    return Object.freeze({ gameName: room.gameName, label: room.label });
  };
  const takeoverCandidates = (
    owner: ExitDecisionAddress,
    gameNames: readonly string[],
  ): readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] =>
    Object.freeze(
      candidates.takeoverPrebossBatches(owner, gameNames).map((candidate) =>
        Object.freeze({
          evaluation: candidate.evaluation,
          value: takeoverCandidate(candidate.value),
        }),
      ),
    );
  const createCandidateTakeoverInteraction = ({
    action,
    existingTargetOccurrenceIds,
    gameNames,
    impact,
    owner,
    selected,
  }: {
    readonly action: WorkspaceCandidateTakeoverBatchInteraction['action'];
    readonly existingTargetOccurrenceIds?: ReadonlyMap<string, OccurrenceId>;
    readonly gameNames: readonly string[];
    readonly impact?: WorkspaceTakeoverReplacementImpact;
    readonly owner: ExitDecisionAddress;
    readonly selected?: WorkspaceTakeoverCandidate;
  }): WorkspaceCandidateTakeoverBatchInteraction => {
    let loaded: readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] | undefined;
    const load = (): readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] => {
      if (loaded === undefined) loaded = takeoverCandidates(owner, gameNames);
      return loaded;
    };
    return Object.freeze({
      action,
      commandFor(selection: WorkspaceTakeoverCandidate): TakeoverBatchCommand {
        const candidate = load().find((option) => option.value.gameName === selection.gameName);
        if (
          candidate?.evaluation.kind !== 'takeoverPrebossBatch' ||
          !candidate.evaluation.result.selectedPossible
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `Takeover candidate ${selection.gameName} is not currently applicable.`,
          );
        }
        return createTakeoverBatchCommand({
          action,
          decision: owner,
          existingTargetOccurrenceIds: existingTargetOccurrenceIds ?? new Map(),
          gameName: selection.gameName,
          requiredExitKeys: candidate.evaluation.result.requiredExitKeys,
        });
      },
      ...(impact === undefined ? {} : { impact }),
      key: semanticAddressKey(owner),
      load,
      owner,
      presentation: 'candidate' as const,
      ...(selected === undefined ? {} : { selected }),
    });
  };
  const createFixedWidthOneTakeoverInteraction = ({
    gameName,
    owner,
    requiredExitKeys,
  }: {
    readonly gameName: string;
    readonly owner: ExitDecisionAddress;
    readonly requiredExitKeys: readonly string[];
  }): WorkspaceFixedWidthOneTakeoverInteraction => {
    const candidate = takeoverCandidate(gameName);
    const room = requireRoom(catalog, gameName);
    const summary =
      room.incomingReward.kind === 'shop'
        ? `Enter ${candidate.label}. This declaration-owned transition creates one automatically entered World Shop.`
        : `Enter ${candidate.label} through this declaration-owned transition.`;
    return Object.freeze({
      execute(): WorkspaceFixedWidthOneTakeoverActionResult {
        // This fixed declaration still receives the engine's contextual
        // validation only when the player takes it. React never loads or
        // interprets a candidate result.
        const evaluated = takeoverCandidates(owner, Object.freeze([gameName]))[0];
        if (
          evaluated?.evaluation.kind !== 'takeoverPrebossBatch' ||
          !evaluated.evaluation.result.selectedPossible
        ) {
          const explanation =
            evaluated === undefined
              ? undefined
              : explainCandidateEvaluation(catalog, evaluated.evaluation);
          return Object.freeze({
            kind: 'unavailable' as const,
            message:
              explanation?.message ??
              'This fixed Preboss takeover is not supported by the current route state.',
          });
        }
        return Object.freeze({
          kind: 'command' as const,
          command: createTakeoverBatchCommand({
            action: 'create',
            decision: owner,
            existingTargetOccurrenceIds: new Map(),
            gameName,
            // `requiredExitKeys` comes from shared topology authority.  The
            // The lazy engine evaluation above establishes whether this fixed
            // width-one takeover is currently possible; it does not make
            // React derive the physical exit vocabulary.
            requiredExitKeys,
          }),
        });
      },
      action: 'create' as const,
      key: semanticAddressKey(owner),
      label: candidate.label,
      owner,
      presentation: 'fixedWidthOneTakeover' as const,
      summary,
    });
  };
  const createCompletedHubHandoffInteraction = ({
    gameName,
    owner,
    requiredExitKeys,
  }: {
    readonly gameName: string;
    readonly owner: ExitDecisionAddress;
    readonly requiredExitKeys: readonly string[];
  }): WorkspaceCompletedHubHandoffInteraction =>
    Object.freeze({
      action: 'create' as const,
      execute: () =>
        createTakeoverBatchCommand({
          action: 'create',
          decision: owner,
          existingTargetOccurrenceIds: new Map(),
          gameName,
          requiredExitKeys,
        }),
      key: semanticAddressKey(owner),
      label: takeoverCandidate(gameName).label,
      owner,
      presentation: 'completedHubHandoff' as const,
    });
  const createTakeoverRepairInteraction = ({
    existingTargetOccurrenceIds,
    gameName,
    owner,
    requiredExitKeys,
  }: {
    readonly existingTargetOccurrenceIds: ReadonlyMap<string, OccurrenceId>;
    readonly gameName: string;
    readonly owner: ExitDecisionAddress;
    readonly requiredExitKeys: readonly string[];
  }): WorkspaceTakeoverRepairInteraction =>
    Object.freeze({
      action: 'reconcile' as const,
      execute: () =>
        createTakeoverBatchCommand({
          action: 'reconcile',
          decision: owner,
          existingTargetOccurrenceIds,
          gameName,
          requiredExitKeys,
        }),
      key: semanticAddressKey(owner),
      label: takeoverCandidate(gameName).label,
      owner,
      presentation: 'repair' as const,
    });
  const rooms = new Map<string, WorkspaceRoomInteraction>();
  for (const [key, control] of roomControls) {
    const candidateRooms = (() => {
      if (control.kind === 'startRoomPicker') {
        return Object.freeze(
          control.candidateGameNames.map((gameName) => requireRoom(catalog, gameName)),
        );
      }
      const candidatesForCategories = roomSelectorCategories(
        catalog,
        control.address.biomeKey,
      ).flatMap((category) =>
        selectRoomsForTargetCategory(catalog, project, control.address, category),
      );
      return Object.freeze([
        ...new Map(candidatesForCategories.map((room) => [room.gameName, room])).values(),
      ]);
    })();
    let model: ContextualPickerModel<RoomDeclaration> | undefined;
    rooms.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          candidateRooms.map((room) =>
            Object.freeze({
              category: roomCategoryForKind(room.kind) ?? room.kind,
              gameName: room.gameName,
              label: room.label,
            }),
          ),
        ),
        key,
        owner: control.address,
        load(): ContextualPickerModel<RoomDeclaration> {
          if (model !== undefined) return model;
          model = services.contextualPicker.project(
            control.kind === 'startRoomPicker'
              ? candidates.startRooms(control.address, candidateRooms)
              : candidates.roomTargets(control.address, candidateRooms),
            (option) =>
              Object.freeze({
                label: option.value.label,
                category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                selected: option.value.gameName === control.selectedGameName,
              }),
            (room) => room.gameName,
          );
          return model;
        },
        ...(control.selectedGameName === undefined
          ? {}
          : { selected: requireRoom(catalog, control.selectedGameName) }),
      }),
    );
  }

  const rewards = new Map<string, WorkspaceRewardInteraction>();
  for (const [key, control] of rewardControls) {
    const rewardTypes =
      control.kind === 'countedReward'
        ? candidates.countedRewardTypes(control.owner, control.binding, control.offer.rewardType)
        : control.rewardTypes;
    rewards.set(
      key,
      Object.freeze({
        authoredRewardTypes: rewardTypes,
        choiceLabel: services.rewardPicker.choiceLabel,
        key,
        load: () => candidates.rewardDomain(control.owner, rewardTypes, control.offer),
        model: services.rewardPicker.project,
        owner: control.owner.address,
        selected: control.offer,
        summary: services.rewardPicker.summary,
      }),
    );
  }

  const batchRewardStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const exitFrontierCapabilities = new Map<string, WorkspaceExitFrontierCapabilities>();
  const exitSelections = new Map<string, WorkspaceExitSelectionInteraction>();
  const fieldsCageOutcomes = new Map<string, WorkspaceCandidateInteraction<'min' | 'max'>>();
  const hubSlots = new Map<string, WorkspaceHubSlotInteraction>();
  const hubVisits = new Map<string, WorkspaceCandidateInteraction<string>>();
  const rewardWheelOfferCounts = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelPicks = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const shipEncounterCounts = new Map<string, WorkspaceCandidateInteraction<2 | 3>>();
  const shopPurchases = new Map<string, WorkspaceCandidateInteraction<boolean>>();
  const sideRoomEntryOrders = new Map<string, WorkspaceCandidateInteraction<readonly string[]>>();
  const sideRoomGenerations = new Map<string, WorkspaceCandidateInteraction<SideRoomGeneration>>();
  const starts = new Map<string, WorkspaceStartInteraction>();
  const structural = new Map<string, WorkspaceStructuralInteraction>();
  const takeoverBatches = new Map<string, WorkspaceTakeoverBatchInteraction>();
  const topologyRemovals = new Map<string, WorkspaceTopologyRemovalInteraction>();

  for (const route of sources.routes) {
    for (const biomeSource of route.biomes) {
      const { biome, layout, plan } = biomeSource;
      if (plan.topology === null) {
        const rooms = Object.freeze(
          (layout.start.kind === 'authoredChoice'
            ? layout.start.roomGameNames
            : [layout.start.roomGameName]
          ).map((gameName) => requireRoom(catalog, gameName)),
        );
        let model: ContextualPickerModel<RoomDeclaration> | undefined;
        starts.set(
          semanticAddressKey(biome),
          Object.freeze({
            ...(layout.start.kind === 'fixedAuthored'
              ? {
                  fixedGameName: layout.start.roomGameName,
                  fixedLabel: requireRoom(catalog, layout.start.roomGameName).label,
                  kind: 'fixed' as const,
                }
              : { kind: 'choice' as const }),
            key: semanticAddressKey(biome),
            owner: biome,
            load(): ContextualPickerModel<RoomDeclaration> {
              if (model !== undefined) return model;
              model = services.contextualPicker.project(
                candidates.startRooms(biome, rooms),
                (option) =>
                  Object.freeze({
                    category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                    label: option.value.label,
                    selected: false,
                  }),
                (room) => room.gameName,
              );
              return model;
            },
          }),
        );
        continue;
      }
      const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
      const fixedWidthOneTakeover = fixedWidthOneTakeoverForLayout(catalog, layout);
      topologyRemovals.set(
        semanticAddressKey(biome),
        Object.freeze({
          action: 'clearTopology' as const,
          command: Object.freeze({ kind: 'ClearTopology' as const, biome }),
          impact: topologyRemovalScope(biome, describeClearTopologyImpact(plan.topology)),
          key: semanticAddressKey(biome),
          owner: biome,
        }),
      );
      for (const decision of plan.topology.decisions) {
        if (decision.kind === 'hub') {
          if (layout.progression.kind !== 'hub' || decision.hubKey !== layout.progression.hubKey)
            continue;
          for (const slot of layout.progression.slots) {
            const opened = decision.openTargets.find(
              (target) => target.hubSlotKey === slot.slotKey,
            );
            const owner = createHubSlotAddress(biome, decision.hubKey, slot.slotKey);
            const closeImpact =
              opened === undefined
                ? undefined
                : describeHubSlotClosureImpact(
                    plan.topology,
                    decision.hubKey,
                    slot.slotKey,
                    layout.progression.openCount.min,
                  );
            const values = Object.freeze([false, true]);
            hubSlots.set(
              semanticAddressKey(owner),
              Object.freeze({
                bind: (proposedOccurrenceId: OccurrenceId) =>
                  candidateInteraction(
                    owner,
                    Object.freeze([
                      Object.freeze({ label: 'Closed', value: false }),
                      Object.freeze({ label: 'Open', value: true }),
                    ]),
                    opened !== undefined,
                    () =>
                      candidates.hubSlots(
                        owner,
                        opened?.occurrenceId ?? proposedOccurrenceId,
                        values,
                      ),
                    `${semanticAddressKey(owner)}:proposed:${proposedOccurrenceId}`,
                  ),
                ...(closeImpact === undefined
                  ? {}
                  : {
                      close: Object.freeze({
                        command: Object.freeze({ kind: 'CloseHubSlot' as const, slot: owner }),
                        impact: topologyRemovalScope(biome, closeImpact),
                      }),
                    }),
                key: semanticAddressKey(owner),
                owner,
                roomGameName: slot.roomGameName,
                selected: opened !== undefined,
              }),
            );
          }
          // Visit order is constrained by the authored board, not by candidate
          // coverage. An invalid room-local leaf can make visit evaluation
          // unassessed, but it must not expand this selector back to every
          // declaration-fixed Hub slot.
          const hubVisitSlots = Object.freeze(
            layout.progression.slots.filter((slot) =>
              decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey),
            ),
          );
          const hubVisitChoices = Object.freeze(
            hubVisitSlots.map((slot) =>
              Object.freeze({
                label: requireRoom(catalog, slot.roomGameName).label,
                value: slot.slotKey,
              }),
            ),
          );
          for (let visitIndex = 1; visitIndex <= decision.visitOrder.length + 1; visitIndex += 1) {
            if (visitIndex > layout.progression.requiredVisits) break;
            const slotKey = decision.visitOrder[visitIndex - 1];
            const owner = createHubVisitAddress(biome, decision.hubKey, visitIndex);
            const visitChoices = Object.freeze(
              hubVisitChoices.filter(
                (choice) => choice.value === slotKey || !decision.visitOrder.includes(choice.value),
              ),
            );
            hubVisits.set(
              semanticAddressKey(owner),
              candidateInteraction(owner, visitChoices, slotKey, () =>
                candidates.hubVisits(
                  owner,
                  Object.freeze(visitChoices.map((choice) => choice.value)),
                ),
              ),
            );
          }
          continue;
        }
        const owner = createExitDecisionAddress(biome, decision.source);
        const removalImpact = describeExitDecisionRemovalImpact(plan.topology, decision.source);
        if (removalImpact !== undefined) {
          topologyRemovals.set(
            semanticAddressKey(owner),
            Object.freeze({
              action: 'removeExitDecision' as const,
              command: Object.freeze({ kind: 'RemoveExitDecision' as const, decision: owner }),
              impact: topologyRemovalScope(biome, removalImpact),
              key: semanticAddressKey(owner),
              owner,
            }),
          );
        }
        if (decision.normal.kind === 'batch') {
          if (decision.selection.kind !== 'derived') {
            const declaredExits =
              resolveDeclaredPhysicalExits(catalog, layout, plan.topology, decision.source) ?? [];
            const physicalOrder = new Map<string, number>(
              declaredExits.map((exit) => [exit.exitKey, exit.index] as const),
            );
            const selection = createExitSelectionAddress(biome, decision.source);
            exitSelections.set(
              semanticAddressKey(selection),
              Object.freeze({
                key: semanticAddressKey(selection),
                owner,
                ...(decision.selection.kind === 'normal'
                  ? { selectedExitKey: decision.selection.exitKey }
                  : {}),
                targets: Object.freeze(
                  [...decision.normal.targets]
                    .sort((left, right) =>
                      compareAuthoredTargetsInPhysicalOrder(physicalOrder, left, right),
                    )
                    .map((target) =>
                      Object.freeze({ label: target.exitKey, value: target.exitKey }),
                    ),
                ),
              }),
            );
          }
          const targetRooms = decision.normal.targets.map((target) =>
            biomeSource.occurrence(target.occurrenceId),
          );
          const targetDeclarations = targetRooms.map((room) =>
            room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
          );
          const takeover = targetDeclarations.length > 0 && targetDeclarations.every(isTakeover);
          const takeoverGameNames = catalog.rooms.values
            .filter((room) => room.biomeKey === plan.biomeKey && isTakeover(room))
            .map((room) => room.gameName);
          const existingTargetOccurrenceIds = new Map(
            decision.normal.targets.map((target) => [target.exitKey, target.occurrenceId] as const),
          );
          const policy =
            layout.progression.kind === 'generated'
              ? layout.progression.rewardStorePolicy
              : undefined;
          const authoredRewardStore =
            decision.normal.rewardStore.kind === 'authoredBaseStore'
              ? decision.normal.rewardStore
              : undefined;
          if (
            authoredRewardStore !== undefined &&
            (!takeover || authoredRewardStore.baseRewardStoreKey !== null) &&
            policy?.kind === 'authoredBaseStore'
          ) {
            const store = createBatchRewardStoreAddress(biome, decision.source);
            batchRewardStores.set(
              semanticAddressKey(store),
              candidateInteraction(
                store,
                Object.freeze(
                  policy.storeKeys.map((value) =>
                    Object.freeze({ label: storeLabel(value), value }),
                  ),
                ),
                authoredRewardStore.baseRewardStoreKey ?? undefined,
                () => candidates.batchRewardStores(store, policy.storeKeys),
              ),
            );
          }
          if (takeover) {
            const gameName = targetRooms[0]?.gameName;
            const requiredExits = resolveDeclaredPhysicalExits(
              catalog,
              layout,
              plan.topology,
              decision.source,
            );
            const requiredExitKeys =
              requiredExits === undefined
                ? undefined
                : Object.freeze(requiredExits.map((exit) => exit.exitKey));
            if (gameName !== undefined && requiredExitKeys !== undefined) {
              takeoverBatches.set(
                semanticAddressKey(owner),
                createTakeoverRepairInteraction({
                  existingTargetOccurrenceIds,
                  gameName,
                  owner,
                  requiredExitKeys,
                }),
              );
            }
          } else {
            if (
              layout.progression.kind === 'generated' &&
              layout.progression.batchPolicy.kind === 'fields'
            ) {
              fieldsCageOutcomes.set(
                semanticAddressKey(owner),
                candidateInteraction(
                  owner,
                  Object.freeze([
                    Object.freeze({ label: 'Minimum', value: 'min' as const }),
                    Object.freeze({ label: 'Maximum', value: 'max' as const }),
                  ]),
                  decision.normal.batchState?.cageOutcome,
                  () => candidates.fieldsCageOutcomes(owner, Object.freeze(['min', 'max'])),
                ),
              );
            }
            if (
              layout.progression.kind === 'generated' &&
              fixedWidthOneTakeover === undefined &&
              takeoverGameNames.length > 0
            ) {
              const impact = takeoverReplacementImpact(biome, plan, decision);
              takeoverBatches.set(
                semanticAddressKey(owner),
                createCandidateTakeoverInteraction({
                  action: 'replace' as const,
                  existingTargetOccurrenceIds,
                  gameNames: takeoverGameNames,
                  ...(impact === undefined ? {} : { impact }),
                  owner,
                }),
              );
            }
          }
        } else if (layout.progression.kind === 'generated' && fixedWidthOneTakeover === undefined) {
          const candidatesForTakeover = catalog.rooms.values
            .filter((room) => room.biomeKey === plan.biomeKey && isTakeover(room))
            .map((room) => room.gameName);
          if (candidatesForTakeover.length > 0) {
            takeoverBatches.set(
              semanticAddressKey(owner),
              createCandidateTakeoverInteraction({
                action: 'create' as const,
                gameNames: candidatesForTakeover,
                owner,
              }),
            );
          }
        }
      }
      for (const occurrence of plan.topology.occurrences) {
        const room = catalog.rooms.byKey[occurrence.gameName];
        if (room === undefined) continue;
        const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
        if (occurrence.state.kind === 'shipCombat') {
          shipEncounterCounts.set(
            semanticAddressKey(occurrenceAddress),
            candidateInteraction(
              occurrenceAddress,
              Object.freeze([
                Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
                Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
              ]),
              occurrence.state.encounterCount,
              () => candidates.shipEncounterCounts(occurrenceAddress, Object.freeze([2, 3])),
            ),
          );
          for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels)) {
            const wheelAddress = createRewardWheelAddress(biome, occurrence.occurrenceId, wheelKey);
            const declaration = catalog.encounterProfiles.byKey[
              room.encounterProfileKey
            ]?.phases.find((phase) => phase.offerPoint?.key === wheelKey)?.offerPoint;
            if (declaration === undefined) continue;
            const countValues = Object.freeze(
              Array.from(
                { length: declaration.offerCount.max - declaration.offerCount.min + 1 },
                (_, index) => declaration.offerCount.min + index,
              ),
            );
            rewardWheelOfferCounts.set(
              semanticAddressKey(wheelAddress),
              candidateInteraction(
                wheelAddress,
                countValues.map((value) => Object.freeze({ label: String(value), value })),
                wheel.offerCount,
                () => candidates.rewardWheelOfferCounts(wheelAddress, countValues),
              ),
            );
            rewardWheelStores.set(
              semanticAddressKey(wheelAddress),
              candidateInteraction(
                wheelAddress,
                declaration.reward.storeKeys.map((value) =>
                  Object.freeze({ label: storeLabel(value), value }),
                ),
                wheel.storeKey,
                () => candidates.rewardWheelStores(wheelAddress, declaration.reward.storeKeys),
              ),
            );
            const picks = Object.freeze(
              Array.from({ length: wheel.offerCount }, (_, index) => index + 1),
            );
            rewardWheelPicks.set(
              semanticAddressKey(wheelAddress),
              candidateInteraction(
                wheelAddress,
                picks.map((value) => Object.freeze({ label: `Offer ${value}`, value })),
                wheel.pickedOfferIndex,
                () => candidates.rewardWheelPicks(wheelAddress, picks),
              ),
            );
          }
        }
        if (occurrence.state.kind === 'shop' && occurrence.state.shop !== undefined) {
          for (const [offerKey, offer] of Object.entries(occurrence.state.shop.offers)) {
            // A persisted Shop inventory becomes editable when the projected
            // room's authored detail surface is active. Re-use the published
            // offer control as that authority so selected, unassessed Shops
            // remain editable while unpicked retained inventory stays dormant.
            const offerAddress = createShopOfferAddress(biome, occurrence.occurrenceId, offerKey);
            if (!rewardControls.has(semanticAddressKey(offerAddress))) continue;
            const purchase = createShopPurchaseAddress(biome, occurrence.occurrenceId, offerKey);
            shopPurchases.set(
              semanticAddressKey(purchase),
              candidateInteraction(
                purchase,
                Object.freeze([
                  Object.freeze({ label: 'Not purchased', value: false }),
                  Object.freeze({ label: 'Purchased', value: true }),
                ]),
                offer.purchased,
                () => candidates.shopPurchases(purchase, Object.freeze([false, true])),
              ),
            );
          }
        }
        if (occurrence.state.kind === 'ephyraCombat') {
          const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
          if (group?.kind !== 'fixedRoomSlots') continue;
          const groupAddress = createLocalChildGroupAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
          );
          const entered = Object.entries(occurrence.state.sideRooms)
            .filter(([, value]) => value.enteredOrdinal !== null)
            .sort((left, right) => left[1].enteredOrdinal! - right[1].enteredOrdinal!)
            .map(([slotKey]) => slotKey);
          for (const slot of group.slots) {
            const side = occurrence.state.sideRooms[slot.slotKey];
            if (side === undefined) continue;
            const address = createLocalChildAddress(
              biome,
              occurrence.occurrenceId,
              group.key,
              slot.slotKey,
            );
            sideRoomGenerations.set(
              semanticAddressKey(address),
              candidateInteraction(
                address,
                Object.freeze([
                  Object.freeze({ label: 'Generated', value: 'generated' as const }),
                  Object.freeze({ label: 'Not generated', value: 'notGenerated' as const }),
                ]),
                side.generation,
                () =>
                  candidates.sideRoomGenerations(
                    address,
                    Object.freeze(['generated', 'notGenerated']),
                  ),
              ),
            );
            const entryOrder = ephyraSideRoomEntryOrderControl(address, entered, slot.slotKey);
            const proposals = Object.freeze(
              entryOrder.options.map((option) => option.proposedEnteredSlotKeys),
            );
            const selected = entryOrder.options.find(
              (option) => option.key === entryOrder.selectedKey,
            );
            if (selected === undefined) {
              throw new StructuredWorkspaceProjectionContractError(
                `${semanticAddressKey(address)} has no selected side-room entry position`,
              );
            }
            sideRoomEntryOrders.set(
              entryOrder.interactionKey,
              candidateInteraction(
                groupAddress,
                Object.freeze(
                  entryOrder.options.map((option) =>
                    Object.freeze({ label: option.label, value: option.proposedEnteredSlotKeys }),
                  ),
                ),
                selected.proposedEnteredSlotKeys,
                () => candidates.sideRoomEntryOrders(groupAddress, proposals),
                entryOrder.interactionKey,
              ),
            );
          }
        }
      }
      if (completeness.completion === 'incomplete') {
        const frontier = completeness.frontier;
        if (frontier.kind === 'exitDecision') {
          const existing = biomeSource.exitDecision(frontier.source);
          const gameNames = catalog.rooms.values
            .filter((room) => room.biomeKey === plan.biomeKey && isTakeover(room))
            .map((room) => room.gameName);
          const fixedWidthOneTakeoverAtFrontier = fixedWidthOneTakeoverTransitionForSource(
            catalog,
            layout,
            plan.topology,
            frontier.source,
          );
          const key = semanticAddressKey(frontier);
          const fixedWidthOneRequiredExits =
            fixedWidthOneTakeoverAtFrontier === undefined
              ? undefined
              : resolveDeclaredPhysicalExits(catalog, layout, plan.topology, frontier.source);
          const fixedWidthOneRequiredExitKeys =
            fixedWidthOneRequiredExits === undefined
              ? undefined
              : Object.freeze(fixedWidthOneRequiredExits.map((exit) => exit.exitKey));
          const structuralCapability: WorkspaceExitFrontierCapabilities['structural'] =
            existing === undefined &&
            frontier.source.kind === 'occurrence' &&
            fixedWidthOneTakeoverAtFrontier === undefined
              ? layout.progression.kind === 'hub' &&
                frontier.source.occurrenceId === plan.topology.startOccurrenceId
                ? 'createLinkedExit'
                : 'createBatch'
              : undefined;
          const takeoverCapability =
            existing === undefined &&
            ((fixedWidthOneTakeoverAtFrontier !== undefined &&
              fixedWidthOneRequiredExitKeys !== undefined) ||
              (fixedWidthOneTakeoverAtFrontier === undefined &&
                layout.progression.kind === 'generated' &&
                fixedWidthOneTakeover === undefined &&
                gameNames.length > 0))
              ? (true as const)
              : undefined;
          if (structuralCapability !== undefined || takeoverCapability !== undefined) {
            exitFrontierCapabilities.set(
              key,
              Object.freeze({
                ...(structuralCapability === undefined ? {} : { structural: structuralCapability }),
                ...(takeoverCapability === undefined ? {} : { takeover: takeoverCapability }),
              }),
            );
          }
          if (
            fixedWidthOneTakeoverAtFrontier !== undefined &&
            existing === undefined &&
            fixedWidthOneRequiredExitKeys !== undefined
          ) {
            takeoverBatches.set(
              key,
              fixedWidthOneTakeoverAtFrontier.kind === 'completedHubHandoff'
                ? createCompletedHubHandoffInteraction({
                    gameName: fixedWidthOneTakeoverAtFrontier.room.gameName,
                    owner: frontier,
                    requiredExitKeys: fixedWidthOneRequiredExitKeys,
                  })
                : createFixedWidthOneTakeoverInteraction({
                    gameName: fixedWidthOneTakeoverAtFrontier.room.gameName,
                    owner: frontier,
                    requiredExitKeys: fixedWidthOneRequiredExitKeys,
                  }),
            );
          } else if (
            layout.progression.kind === 'generated' &&
            fixedWidthOneTakeover === undefined &&
            gameNames.length > 0 &&
            !takeoverBatches.has(semanticAddressKey(frontier))
          ) {
            const existingTargetOccurrenceIds =
              existing?.normal.kind === 'batch'
                ? new Map(
                    existing.normal.targets.map(
                      (target) => [target.exitKey, target.occurrenceId] as const,
                    ),
                  )
                : undefined;
            takeoverBatches.set(
              semanticAddressKey(frontier),
              createCandidateTakeoverInteraction({
                action:
                  existing?.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
                ...(existingTargetOccurrenceIds === undefined
                  ? {}
                  : { existingTargetOccurrenceIds }),
                gameNames,
                owner: frontier,
              }),
            );
          }
          if (
            existing === undefined &&
            frontier.source.kind === 'occurrence' &&
            fixedWidthOneTakeoverAtFrontier === undefined
          ) {
            const action: WorkspaceStructuralInteraction =
              layout.progression.kind === 'hub' &&
              frontier.source.occurrenceId === plan.topology.startOccurrenceId
                ? Object.freeze({
                    action: 'createLinkedExit' as const,
                    key: semanticAddressKey(frontier),
                    owner: frontier,
                    targetGameName: layout.progression.linkedExit.roomGameName,
                  })
                : Object.freeze({
                    action: 'createBatch' as const,
                    key: semanticAddressKey(frontier),
                    owner: frontier,
                  });
            structural.set(action.key, action);
          }
          if (structuralCapability !== undefined) {
            const structuralAction = structural.get(key);
            if (structuralAction?.action !== structuralCapability) {
              throw new StructuredWorkspaceProjectionContractError(
                key + ' exit frontier structural capability was not constructed',
              );
            }
          }
          if (takeoverCapability === true && !takeoverBatches.has(key)) {
            throw new StructuredWorkspaceProjectionContractError(
              key + ' exit frontier takeover capability was not constructed',
            );
          }
        } else if (frontier.kind === 'hubDecision') {
          const action: WorkspaceStructuralInteraction = Object.freeze({
            action: 'createHubDecision' as const,
            key: semanticAddressKey(frontier),
            owner: frontier,
          });
          structural.set(action.key, action);
        }
      }
    }
  }
  return Object.freeze({
    batchRewardStores,
    exitFrontierCapabilities,
    exitSelections,
    fieldsCageOutcomes,
    hubSlots,
    hubVisits,
    rewards,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    rooms,
    shipEncounterCounts,
    shopPurchases,
    sideRoomEntryOrders,
    sideRoomGenerations,
    starts,
    structural,
    takeoverBatches,
    topologyRemovals,
  });
}

function railMarkerForNode(node: WorkspaceNode): WorkspaceMarker {
  return node.kind === 'occurrenceWorkbench' ? (node.railMarker ?? node.marker) : node.marker;
}

function pickedTargetSummary(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): string | undefined {
  const picked = node.targets.find((target) => target.selected);
  if (picked === undefined) return undefined;
  return picked.room.rewardSummary === undefined
    ? picked.room.label
    : `${picked.room.label} · ${picked.room.rewardSummary}`;
}

function decisionRailMarker(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): WorkspaceMarker {
  const markers = new Map<string, WorkspaceMarker>();
  for (const value of decisionOwnedMarkers(node)) markers.set(value.focusKey, value);
  const findingCount = [...markers.values()].reduce(
    (total, marker) => total + marker.findingCount,
    0,
  );
  return findingCount === node.marker.findingCount
    ? node.marker
    : Object.freeze({ ...node.marker, findingCount });
}

function nodeRailPresentation(
  node: WorkspaceNode,
  decisionIndex: number | undefined,
  isEntry = false,
): { readonly label: string; readonly summary?: string } {
  switch (node.kind) {
    case 'occurrenceWorkbench': {
      const entryLabel = isEntry && node.room.kind === 'Opening' ? 'Opening' : node.room.label;
      const rewardSummary =
        entryLabel === node.room.label
          ? node.room.rewardSummary
          : node.room.rewardSummary === undefined
            ? node.room.label
            : `${node.room.label} · ${node.room.rewardSummary}`;
      return {
        label: entryLabel,
        ...(rewardSummary === undefined ? {} : { summary: rewardSummary }),
      };
    }
    case 'linkedExit':
      return {
        label: node.target.room.label,
        ...(node.target.room.rewardSummary === undefined
          ? {}
          : { summary: node.target.room.rewardSummary }),
      };
    case 'ordinaryBatch':
    case 'mixedBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: `Decision ${decisionIndex ?? 1}`,
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'takeoverBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: 'Preboss',
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'completion':
      return { label: node.label };
    case 'hubDecision':
      return { label: 'Hub' };
  }
}

/**
 * The rail needs the visit's room-local workbench identity, while the Hub
 * board retains its distinct visit-order owner.  Publishing both avoids
 * making React join visits to occurrences or infer which Hub rooms are shown.
 */
function projectHubRailEntry(
  node: WorkspaceHubDecisionNode,
  structuralNodes: readonly WorkspaceNode[],
): WorkspaceHubRailEntry {
  const workbenchesByOccurrenceId = new Map(
    structuralNodes
      .filter(
        (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
          candidate.kind === 'occurrenceWorkbench',
      )
      .map((workbench) => [workbench.room.occurrenceId, workbench] as const),
  );
  const visits: WorkspaceHubVisitRailEntry[] = [];
  for (const visit of node.visits) {
    if (visit.authoring !== 'authored') continue;
    if (visit.room === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} has no authored room workbench`,
      );
    }
    const workbench = workbenchesByOccurrenceId.get(visit.room.occurrenceId);
    if (workbench === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} room ${visit.room.occurrenceId} is not projected`,
      );
    }
    if (workbench.inspectorPresentation !== 'hubRoomLocal') {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} must use a room-local workbench presentation`,
      );
    }
    visits.push(
      Object.freeze({
        key: `${node.key}:visit:${visit.visitIndex}`,
        label: `Visit ${visit.visitIndex} · ${visit.room.label}`,
        marker: workbench.room.marker,
        node: workbench,
        visitIndex: visit.visitIndex,
        visitMarker: visit.marker,
      }),
    );
  }
  return Object.freeze({
    kind: 'hubGroup' as const,
    key: node.key,
    marker: node.marker,
    node,
    visits: Object.freeze(visits),
  });
}

/**
 * A fixed N transition remains an inspectable node, but once its target room
 * exists the room is the player-facing rail stage.  The source-owned command
 * and finding destination remain in `WorkspaceBiome.nodes`.
 */
function isHubRailScaffoldWithRenderedTarget(
  node: WorkspaceNode,
  renderedOccurrenceIds: ReadonlySet<OccurrenceId>,
): boolean {
  if (node.kind === 'linkedExit') {
    return renderedOccurrenceIds.has(node.target.room.occurrenceId);
  }
  if (
    node.kind !== 'ordinaryBatch' &&
    node.kind !== 'mixedBatch' &&
    node.kind !== 'takeoverBatch'
  ) {
    return false;
  }
  return (
    node.owner.source.kind === 'hubDecision' &&
    node.targets.some((target) => renderedOccurrenceIds.has(target.room.occurrenceId))
  );
}

function workspaceMarkersForNode(node: WorkspaceNode): readonly WorkspaceMarker[] {
  switch (node.kind) {
    case 'linkedExit':
      return Object.freeze([
        node.marker,
        node.target.marker,
        ...occurrenceOwnedMarkers(node.target.room),
      ]);
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return decisionOwnedMarkers(node);
    case 'hubDecision':
      return Object.freeze([
        node.marker,
        node.openSet,
        ...node.slots.map((slot) => slot.marker),
        ...node.visits.map((visit) => visit.marker),
        ...node.slots.flatMap((slot) => {
          const mainReward = slot.room === undefined ? undefined : hubMainRewardMarker(slot.room);
          return mainReward === undefined ? [] : [mainReward];
        }),
      ]);
    case 'occurrenceWorkbench':
      return occurrenceOwnedMarkers(node.room);
    case 'completion':
      return Object.freeze([node.marker]);
  }
}

function isFineGrainedFindingOwner(address: SemanticAddress): boolean {
  switch (address.kind) {
    case 'batchRewardStore':
    case 'exitSelection':
    case 'target':
    case 'occurrence':
    case 'incomingReward':
    case 'localReward':
    case 'localChild':
    case 'localChildGroup':
    case 'rewardWheel':
    case 'rewardWheelOffer':
    case 'hubSlot':
    case 'hubVisit':
    case 'shopOffer':
    case 'shopPurchase':
      return true;
    default:
      return false;
  }
}

function assertWorkspaceMarkerDestination(
  focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
  nodesByKey: ReadonlyMap<string, WorkspaceNode>,
  containingNodeKeys: ReadonlySet<string>,
  marker: WorkspaceMarker,
  detail: string,
): void {
  const destination = focusByOwner.get(marker.focusKey);
  if (destination === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} has no workspace focus destination`,
    );
  }
  if (semanticAddressKey(destination.ownerAddress) !== marker.focusKey) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} is registered with a conflicting focus owner`,
    );
  }
  if (destination.region !== 'structure' || !nodesByKey.has(destination.nodeKey)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} does not resolve to a reachable workspace node`,
    );
  }
  if (!containingNodeKeys.has(destination.nodeKey)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} does not resolve to a containing workspace package`,
    );
  }
}

function exactlyOneWorkspaceValue<TValue>(values: readonly TValue[], detail: string): TValue {
  if (values.length !== 1) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} resolves to ${values.length} workspace values instead of one`,
    );
  }
  return values[0]!;
}

interface WorkspaceMarkerPackageIndex {
  readonly markerPackageKeys: Map<string, Set<string>>;
  readonly markersByOwner: Map<string, WorkspaceMarker>;
  readonly nodesByKey: Map<string, WorkspaceNode>;
}

function workspaceMarkerPackageIndex(
  structuralNodes: readonly WorkspaceNode[],
  detail: string,
): WorkspaceMarkerPackageIndex {
  const nodesByKey = new Map<string, WorkspaceNode>();
  const markersByOwner = new Map<string, WorkspaceMarker>();
  const markerPackageKeys = new Map<string, Set<string>>();
  for (const node of structuralNodes) {
    if (nodesByKey.has(node.key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} projects duplicate workspace node ${node.key}`,
      );
    }
    nodesByKey.set(node.key, node);
  }
  for (const node of structuralNodes) {
    for (const workspaceMarker of workspaceMarkersForNode(node)) {
      const prior = markersByOwner.get(workspaceMarker.focusKey);
      if (
        prior !== undefined &&
        semanticAddressKey(prior.address) !== semanticAddressKey(workspaceMarker.address)
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${detail} projects conflicting marker packages for ${workspaceMarker.focusKey}`,
        );
      }
      markersByOwner.set(workspaceMarker.focusKey, workspaceMarker);
      const packages = markerPackageKeys.get(workspaceMarker.focusKey) ?? new Set<string>();
      packages.add(node.key);
      markerPackageKeys.set(workspaceMarker.focusKey, packages);
    }
  }
  return { markerPackageKeys, markersByOwner, nodesByKey };
}

/**
 * The workspace is a semantic adapter over authored topology. This closes the
 * adapter contract before findings are allowed to use a coarse biome fallback:
 * every persisted owner must have one rendered package and every published
 * marker must lead to a real structural node.
 */
function assertWorkspaceProjectionClosure(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  structuralNodes: readonly WorkspaceNode[],
): void {
  const { markerPackageKeys, markersByOwner, nodesByKey } = workspaceMarkerPackageIndex(
    structuralNodes,
    plan.biomeKey,
  );
  for (const node of structuralNodes) {
    if (node.kind !== 'occurrenceWorkbench' || node.sourceDecisionRemoval === undefined) {
      continue;
    }
    const source = structuralNodes.find(
      (candidate): candidate is WorkspaceLinkedExitNode | WorkspaceDecisionBatchNode =>
        (candidate.kind === 'linkedExit' ||
          candidate.kind === 'ordinaryBatch' ||
          candidate.kind === 'mixedBatch' ||
          candidate.kind === 'takeoverBatch') &&
        candidate.marker.focusKey === node.sourceDecisionRemoval!.interactionKey,
    );
    if (source === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${node.sourceDecisionRemoval.interactionKey} has no source decision package`,
      );
    }
    for (const workspaceMarker of workspaceMarkersForNode(source)) {
      const packages = markerPackageKeys.get(workspaceMarker.focusKey);
      if (packages === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${workspaceMarker.focusKey} has no registered source marker package`,
        );
      }
      packages.add(node.key);
    }
  }
  for (const [owner, workspaceMarker] of markersByOwner) {
    assertWorkspaceMarkerDestination(
      context.focusDestinations,
      nodesByKey,
      markerPackageKeys.get(owner)!,
      workspaceMarker,
      plan.biomeKey,
    );
  }

  const topology = plan.topology;
  if (topology !== null) {
    const occurrenceNodes = new Map<OccurrenceId, WorkspaceOccurrenceWorkbenchNode>();
    for (const occurrence of topology.occurrences) {
      const occurrenceNode = exactlyOneWorkspaceValue(
        structuralNodes.filter(
          (node): node is WorkspaceOccurrenceWorkbenchNode =>
            node.kind === 'occurrenceWorkbench' &&
            node.room.occurrenceId === occurrence.occurrenceId,
        ),
        `${plan.biomeKey} occurrence ${occurrence.occurrenceId}`,
      );
      if (occurrenceNode.room.gameName !== occurrence.gameName) {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} occurrence ${occurrence.occurrenceId} projects a different room declaration`,
        );
      }
      occurrenceNodes.set(occurrence.occurrenceId, occurrenceNode);
    }

    for (const decision of topology.decisions) {
      if (decision.kind === 'hub') {
        const owner = createHubDecisionAddress(context.biome, decision.hubKey);
        const hub = exactlyOneWorkspaceValue(
          structuralNodes.filter(
            (node): node is WorkspaceHubDecisionNode =>
              node.kind === 'hubDecision' &&
              semanticAddressKey(node.owner) === semanticAddressKey(owner),
          ),
          `${plan.biomeKey} Hub ${decision.hubKey}`,
        );
        for (const target of decision.openTargets) {
          const slot = exactlyOneWorkspaceValue(
            hub.slots.filter((candidate) => candidate.hubSlotKey === target.hubSlotKey),
            `${semanticAddressKey(owner)} slot ${target.hubSlotKey}`,
          );
          if (!slot.open || slot.room?.occurrenceId !== target.occurrenceId) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} slot ${target.hubSlotKey} does not project its authored occurrence`,
            );
          }
        }
        for (const [index, slotKey] of decision.visitOrder.entries()) {
          const visit = exactlyOneWorkspaceValue(
            hub.visits.filter((candidate) => candidate.visitIndex === index + 1),
            `${semanticAddressKey(owner)} visit ${index + 1}`,
          );
          if (visit.authoring !== 'authored' || visit.hubSlotKey !== slotKey) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} visit ${index + 1} does not project authored order`,
            );
          }
        }
        continue;
      }

      const owner = createExitDecisionAddress(context.biome, decision.source);
      const decisionNode = exactlyOneWorkspaceValue(
        structuralNodes.filter(
          (
            node,
          ): node is
            | WorkspaceLinkedExitNode
            | WorkspaceOrdinaryBatchNode
            | WorkspaceMixedBatchNode
            | WorkspaceTakeoverBatchNode =>
            node.kind !== 'hubDecision' &&
            node.kind !== 'occurrenceWorkbench' &&
            node.kind !== 'completion' &&
            semanticAddressKey(node.owner) === semanticAddressKey(owner),
        ),
        `${semanticAddressKey(owner)} decision`,
      );
      if (decision.normal.kind === 'linked') {
        if (
          decisionNode.kind !== 'linkedExit' ||
          decisionNode.target.exitKey !== decision.normal.exitKey ||
          decisionNode.target.room.occurrenceId !== decision.normal.occurrenceId
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} does not project its authored linked target`,
          );
        }
        continue;
      }
      if (decisionNode.kind === 'linkedExit') {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(owner)} projects a linked exit for an authored batch`,
        );
      }
      for (const target of decision.normal.targets) {
        const projectedTarget = exactlyOneWorkspaceValue(
          decisionNode.targets.filter((candidate) => candidate.exitKey === target.exitKey),
          `${semanticAddressKey(owner)} target ${target.exitKey}`,
        );
        if (projectedTarget.room.occurrenceId !== target.occurrenceId) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} target ${target.exitKey} projects a different occurrence`,
          );
        }
        if (!occurrenceNodes.has(target.occurrenceId)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} target ${target.exitKey} has no occurrence workbench`,
          );
        }
      }
    }
  }

  for (const finding of context.source.findings) {
    if (!isFineGrainedFindingOwner(finding.origin)) continue;
    const workspaceMarker = markersByOwner.get(semanticAddressKey(finding.origin));
    if (workspaceMarker === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(finding.origin)} finding has no exact workspace marker`,
      );
    }
    assertWorkspaceMarkerDestination(
      context.focusDestinations,
      nodesByKey,
      markerPackageKeys.get(workspaceMarker.focusKey)!,
      workspaceMarker,
      `${semanticAddressKey(finding.origin)} finding`,
    );
  }
}

/**
 * Checks the rendered side of the authored leaf contract before findings can
 * use generic destination fallback. The expected requirements are produced
 * solely from authored state and declarations by `authoredWorkspaceLeafRequirements`.
 */
export function assertAuthoredWorkspaceLeafProjectionClosure(
  requirements: readonly WorkspaceAuthoredLeafRequirement[],
  focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
  structuralNodes: readonly WorkspaceNode[],
): void {
  const { markerPackageKeys, markersByOwner, nodesByKey } = workspaceMarkerPackageIndex(
    structuralNodes,
    'authored leaf audit',
  );
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.address);
    const workspaceMarker = markersByOwner.get(key);
    if (workspaceMarker === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored leaf has no workspace marker`,
      );
    }
    if (semanticAddressKey(workspaceMarker.address) !== key) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored leaf resolves to a conflicting workspace marker`,
      );
    }
    assertWorkspaceMarkerDestination(
      focusByOwner,
      nodesByKey,
      markerPackageKeys.get(key)!,
      workspaceMarker,
      'required authored leaf',
    );
  }
}

function projectBiome(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
): {
  readonly authoredLeafRequirements: readonly WorkspaceAuthoredLeafRequirement[];
  readonly biome: WorkspaceBiome;
  readonly focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
} {
  const { biome: biomeAddress, evaluation, layout, plan } = source;
  const occurrenceFacts = createWorkspaceBiomeOccurrenceAssemblyFacts(catalog, source);
  const focusDestinations = new Map<string, WorkspaceInspectorDestination>();
  const roomControls = new Map<string, WorkspaceRoomPickerControl>();
  const rewardControls = new Map<string, WorkspaceRewardControl>();
  const context: MutableProjectionContext = {
    catalog,
    occurrenceFacts,
    evaluation,
    focusDestinations,
    biome: biomeAddress,
    routeKey: biomeAddress.routeKey,
    source,
  };
  const authoredLeafRequirements = authoredWorkspaceLeafRequirements(catalog, biomeAddress, plan);
  assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
    occurrenceFacts,
    plan,
    authoredLeafRequirements,
  );
  // Structural completeness is authoritative even when simulation coverage is
  // blocked upstream.  In particular, a Hub's next visit must remain a
  // projectable frontier after its board has been authored.
  let frontier = authoringFrontier(context, plan);
  const nextHubVisitIndex = frontier?.kind === 'hubVisit' ? frontier.owner.visitIndex : undefined;
  const fields = projectBiomeFields(context, plan, layout);
  let startRoomPicker: WorkspaceRoomPickerControl | undefined;
  if (plan.topology !== null && layout.start.kind === 'authoredChoice') {
    const start = authoredOccurrence(context, plan.topology.startOccurrenceId);
    if (start !== undefined) {
      startRoomPicker = startRoomControl(
        createOccurrenceAddress(context.biome, start.occurrenceId),
        layout.start.roomGameNames,
        start.gameName,
      );
    }
  }
  const authoredExitDecisions = source.exitDecisions;
  const nodes: WorkspaceNode[] = [];
  let entry: WorkspaceOccurrenceWorkbenchNode | undefined;
  if (plan.topology !== null) {
    const start = authoredOccurrence(context, plan.topology.startOccurrenceId);
    if (start !== undefined) {
      if (
        source.entryRoom !== undefined &&
        (source.entryRoom.occurrenceId !== start.occurrenceId ||
          source.entryRoom.gameName !== start.gameName ||
          semanticAddressKey(source.entryRoom.origin) !==
            semanticAddressKey(createOccurrenceAddress(context.biome, start.occurrenceId)))
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} evaluated entry does not match the authored start`,
        );
      }
      const projectedEntry = projectOccurrence(context, start, {
        ...(source.entryRoom === undefined ? {} : { evaluatedRoom: source.entryRoom }),
        ...(startRoomPicker === undefined ? {} : { roomPicker: startRoomPicker }),
      });
      entry = projectedEntry.node;
      appendUniqueRoomControls(roomControls, projectedEntry.roomControls);
      appendUniqueRewardControls(rewardControls, projectedEntry.rewardControls);
      nodes.push(entry);
    }
  }
  if (source.entryRoom !== undefined && entry === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} has an evaluated entry without an authored start`,
    );
  }
  const projectAuthoredExitDecision = (decision: ExitDecision): void => {
    const owner = createExitDecisionAddress(context.biome, decision.source);
    if (decision.normal.kind === 'linked') {
      const projected = projectAuthoredLinkedExitWithOverlay(
        context,
        plan,
        decision as AuthoredLinkedExitDecision,
        source.evaluatedLinkedExit(owner),
      );
      appendUniqueRoomControls(roomControls, projected.roomControls);
      appendUniqueRewardControls(rewardControls, projected.rewardControls);
      nodes.push(projected.node, projected.workbench);
    } else {
      const projected = projectAuthoredBatchWithOverlay(
        context,
        plan,
        decision as AuthoredBatchDecision,
        source.evaluatedBatch(owner),
      );
      appendUniqueRoomControls(roomControls, projected.roomControls);
      appendUniqueRewardControls(rewardControls, projected.rewardControls);
      nodes.push(projected.batch, ...projected.workbenches);
    }
  };
  // Hub-owned handoffs belong after the persistent board, even when their
  // authored decision is otherwise traversed as a disconnected suffix.
  // Evaluation cannot be allowed to reorder that authored stage.
  for (const decision of authoredExitDecisions) {
    if (decision.source.kind === 'hubDecision') continue;
    projectAuthoredExitDecision(decision);
  }
  if (layout.progression.kind === 'hub') {
    const hubDescriptor = layout.progression;
    const authoredHub = source.hubDecision(hubDescriptor.hubKey);
    const owner = createHubDecisionAddress(context.biome, hubDescriptor.hubKey);
    const projected =
      authoredHub === undefined
        ? projectHubOutline(context, plan, hubDescriptor)
        : projectAuthoredHubWithOverlay(
            context,
            plan,
            authoredHub,
            hubDescriptor,
            source.evaluatedHub(owner),
            nextHubVisitIndex,
          );
    appendUniqueRoomControls(roomControls, projected.roomControls);
    appendUniqueRewardControls(rewardControls, projected.rewardControls);
    nodes.push(projected.node, ...projected.workbenches);
  }
  for (const decision of authoredExitDecisions) {
    if (decision.source.kind !== 'hubDecision') continue;
    projectAuthoredExitDecision(decision);
  }
  const structuralNodes = Object.freeze([...nodes]);
  if (frontier?.kind === 'exitDecision' && frontier.owner.source.kind === 'occurrence') {
    const predecessorOccurrenceId = frontier.owner.source.occurrenceId;
    const predecessorDecision = structuralNodes.find(
      (
        node,
      ): node is
        WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.targets.some((target) => target.room.occurrenceId === predecessorOccurrenceId),
    );
    if (predecessorDecision !== undefined) {
      frontier = Object.freeze({
        ...frontier,
        predecessorNodeKey: predecessorDecision.key,
      });
    }
  }
  const completion = layout.completion.rooms.map((descriptor) => {
    const address = createCompletionRoomAddress(biomeAddress, descriptor.role);
    const node: WorkspaceCompletionNode = Object.freeze({
      kind: 'completion' as const,
      key: `completion:${semanticAddressKey(address)}`,
      marker: marker(context, address),
      role: descriptor.role,
      gameName: descriptor.roomGameName,
      label: requireRoom(catalog, descriptor.roomGameName).label,
    });
    redirectMarkersToNode(context, Object.freeze([node.marker]), node.key);
    return node;
  });
  nodes.push(...completion);
  const completedNodes = Object.freeze([...nodes]);
  assertAuthoredWorkspaceLeafProjectionClosure(
    authoredLeafRequirements,
    context.focusDestinations,
    completedNodes,
  );
  assertWorkspaceProjectionClosure(context, plan, completedNodes);
  const renderedOccurrenceIds = new Set(
    structuralNodes
      .filter(
        (node): node is WorkspaceOccurrenceWorkbenchNode => node.kind === 'occurrenceWorkbench',
      )
      .map((node) => node.room.occurrenceId),
  );
  const railNodes = structuralNodes
    .filter((node) => {
      if (node.kind !== 'occurrenceWorkbench') return true;
      if (node.railVisibility === 'inspectorOnly') return false;
      // Ordinary room offers belong inside their owning decision workbench.
      // N's fixed Opening, PreHub, and Preboss occurrences remain structural
      // stages, while an ordinary biome keeps only its authored entry.
      return layout.progression.kind === 'hub' || node.key === entry?.key;
    })
    .filter(
      (node) =>
        layout.progression.kind !== 'hub' ||
        !isHubRailScaffoldWithRenderedTarget(node, renderedOccurrenceIds),
    );
  // The N board is declaration-owned outline structure until the fixed
  // Opening -> PreHub path has reached it. Keep that read-only preview after
  // the active entry frontier; otherwise it would claim a position in the
  // rail before the action that makes it reachable. Persisted Hub decisions
  // and retained authored structure stay in their topology order.
  const hubOutlines = railNodes.filter(
    (node): node is WorkspaceHubDecisionNode =>
      node.kind === 'hubDecision' && node.authoring === 'outline',
  );
  const reachableRailNodes = railNodes.filter(
    (node) => !(node.kind === 'hubDecision' && node.authoring === 'outline'),
  );
  const railFrontier =
    frontier?.kind === 'start' ||
    (frontier?.kind === 'exitDecision' && frontier.owner.source.kind !== 'hubDecision')
      ? frontier
      : undefined;
  let decisionIndex = 0;
  const railEntryForNode = (node: WorkspaceNode): WorkspaceRailEntry => {
    if (node.kind === 'hubDecision') return projectHubRailEntry(node, structuralNodes);
    if (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') decisionIndex += 1;
    const presentation = nodeRailPresentation(
      node,
      node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' ? decisionIndex : undefined,
      node.key === entry?.key,
    );
    return Object.freeze({
      kind: 'node' as const,
      key: node.key,
      label: presentation.label,
      marker:
        node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
          ? decisionRailMarker(node)
          : railMarkerForNode(node),
      node,
      ...(presentation.summary === undefined ? {} : { summary: presentation.summary }),
    });
  };
  const rail = Object.freeze([
    ...reachableRailNodes.map(railEntryForNode),
    ...(railFrontier === undefined
      ? []
      : [
          Object.freeze({
            kind: 'frontier' as const,
            frontier: railFrontier,
            key: `frontier:${railFrontier.marker.focusKey}`,
            marker: railFrontier.marker,
          }),
        ]),
    ...hubOutlines.map(railEntryForNode),
  ]);
  const biomeMarker = marker(
    context,
    biomeAddress,
    `biome:${biomeAddress.routeKey}:${plan.biomeKey}`,
  );
  const projected = Object.freeze({
    biomeKey: plan.biomeKey,
    completion: Object.freeze(completion),
    completionOutline: Object.freeze(completion),
    ...(entry === undefined ? {} : { entry }),
    fields,
    frontier,
    label: catalog.biomes.byKey[plan.biomeKey]?.label ?? plan.biomeKey,
    marker: biomeMarker,
    nodes: Object.freeze(nodes),
    rail,
    source: sourceFor(evaluation),
    status: statusFor(evaluation),
  });
  return Object.freeze({
    authoredLeafRequirements,
    biome: projected,
    focusDestinations,
    roomControls,
    rewardControls,
  });
}

function routeStatus(route: { readonly status: ProjectEvaluation['status'] }): WorkspaceStatus {
  return route.status;
}

function registerFindingDestinations(
  findings: readonly SemanticFinding[],
  focusByOwner: Map<string, WorkspaceInspectorDestination>,
): void {
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    if (focusByOwner.has(key)) continue;
    if (isFineGrainedFindingOwner(finding.origin)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} finding has no exact workspace destination`,
      );
    }
    if (!('routeKey' in finding.origin) || !('biomeKey' in finding.origin)) continue;
    const biome = createBiomeAddress(finding.origin.routeKey, finding.origin.biomeKey);
    const fallback = focusByOwner.get(semanticAddressKey(biome));
    if (fallback === undefined) continue;
    focusByOwner.set(key, Object.freeze({ ...fallback, ownerAddress: finding.origin }));
  }
}

function requireWorkspaceProjectionInteraction(
  interactions: ReadonlyMap<string, unknown>,
  key: string,
  detail: string,
): void {
  if (!interactions.has(key)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${key} has no exact workspace interaction`,
    );
  }
}

/**
 * Checks the interaction side of the independently enumerated authored leaf
 * contract. This is intentionally not derived from room controls or rendered
 * room-local products, which could both disappear with the same projection
 * omission.
 */
export function assertAuthoredWorkspaceLeafInteractionClosure(
  requirements: readonly WorkspaceAuthoredLeafRequirement[],
  interactions: WorkspaceInteractionCatalog,
): void {
  for (const requirement of requirements) {
    for (const interaction of requirement.interactions) {
      switch (interaction.kind) {
        case 'reward':
          requireWorkspaceProjectionInteraction(
            interactions.rewards,
            interaction.key,
            'authored reward leaf',
          );
          break;
        case 'rewardWheelOfferCount':
          requireWorkspaceProjectionInteraction(
            interactions.rewardWheelOfferCounts,
            interaction.key,
            'authored reward-wheel offer-count leaf',
          );
          break;
        case 'rewardWheelPick':
          requireWorkspaceProjectionInteraction(
            interactions.rewardWheelPicks,
            interaction.key,
            'authored reward-wheel pick leaf',
          );
          break;
        case 'rewardWheelStore':
          requireWorkspaceProjectionInteraction(
            interactions.rewardWheelStores,
            interaction.key,
            'authored reward-wheel store leaf',
          );
          break;
        case 'shipEncounterCount':
          requireWorkspaceProjectionInteraction(
            interactions.shipEncounterCounts,
            interaction.key,
            'authored Ship encounter-count leaf',
          );
          break;
        case 'shopPurchase':
          requireWorkspaceProjectionInteraction(
            interactions.shopPurchases,
            interaction.key,
            'authored Shop purchase leaf',
          );
          break;
        case 'sideRoomEntryOrder':
          requireWorkspaceProjectionInteraction(
            interactions.sideRoomEntryOrders,
            interaction.key,
            'authored side-room entry-order leaf',
          );
          break;
        case 'sideRoomGeneration':
          requireWorkspaceProjectionInteraction(
            interactions.sideRoomGenerations,
            interaction.key,
            'authored side-room generation leaf',
          );
          break;
      }
    }
  }
}

function assertWorkspaceRoomInteractionClosure(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
): void {
  if (room.roomPicker !== undefined) {
    requireWorkspaceProjectionInteraction(
      interactions.rooms,
      workspaceInteractionKey(room.roomPicker.address),
      'room picker',
    );
  }
  for (const control of room.rewardControls) {
    requireWorkspaceProjectionInteraction(
      interactions.rewards,
      control.marker.focusKey,
      'reward control',
    );
  }
  switch (room.roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
    case 'fields':
      return;
    case 'ephyra':
      for (const sideRoom of room.roomLocal.sideRooms.slots) {
        requireWorkspaceProjectionInteraction(
          interactions.sideRoomGenerations,
          sideRoom.marker.focusKey,
          'side-room generation',
        );
        requireWorkspaceProjectionInteraction(
          interactions.sideRoomEntryOrders,
          sideRoom.entryOrder.interactionKey,
          'side-room entry order',
        );
      }
      return;
    case 'ship':
      requireWorkspaceProjectionInteraction(
        interactions.shipEncounterCounts,
        room.marker.focusKey,
        'Ship encounter count',
      );
      for (const wheel of room.roomLocal.wheels) {
        requireWorkspaceProjectionInteraction(
          interactions.rewardWheelOfferCounts,
          wheel.marker.focusKey,
          'reward-wheel offer count',
        );
        requireWorkspaceProjectionInteraction(
          interactions.rewardWheelStores,
          wheel.marker.focusKey,
          'reward-wheel store',
        );
        requireWorkspaceProjectionInteraction(
          interactions.rewardWheelPicks,
          wheel.marker.focusKey,
          'reward-wheel pick',
        );
      }
      return;
    case 'shop':
      for (const offer of room.roomLocal.offers) {
        requireWorkspaceProjectionInteraction(
          interactions.shopPurchases,
          offer.purchase.marker.focusKey,
          'Shop purchase',
        );
      }
      return;
  }
}

export function assertWorkspaceInteractionClosure(
  routes: readonly WorkspaceRoute[],
  roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>,
  rewardControls: ReadonlyMap<string, WorkspaceRewardControl>,
  interactions: WorkspaceInteractionCatalog,
  authoredLeafRequirements: readonly WorkspaceAuthoredLeafRequirement[] = Object.freeze([]),
): void {
  assertAuthoredWorkspaceLeafInteractionClosure(authoredLeafRequirements, interactions);
  for (const [key, control] of roomControls) {
    requireWorkspaceProjectionInteraction(interactions.rooms, key, control.kind);
  }
  for (const [key, control] of rewardControls) {
    requireWorkspaceProjectionInteraction(interactions.rewards, key, control.kind);
  }
  for (const route of routes) {
    for (const biome of route.biomes) {
      for (const node of biome.nodes) {
        switch (node.kind) {
          case 'occurrenceWorkbench':
            assertWorkspaceRoomInteractionClosure(node.room, interactions);
            break;
          case 'ordinaryBatch':
          case 'mixedBatch':
            if (node.targets.length !== 1) {
              requireWorkspaceProjectionInteraction(
                interactions.exitSelections,
                node.selection.focusKey,
                'exit selection',
              );
            }
            if (node.rewardStore !== undefined) {
              requireWorkspaceProjectionInteraction(
                interactions.batchRewardStores,
                node.rewardStore.focusKey,
                'batch reward store',
              );
            }
            if (node.fieldsCageOutcome !== undefined) {
              requireWorkspaceProjectionInteraction(
                interactions.fieldsCageOutcomes,
                node.fieldsCageOutcome.focusKey,
                'Fields cage outcome',
              );
            }
            requireWorkspaceProjectionInteraction(
              interactions.topologyRemovals,
              workspaceInteractionKey(node.owner),
              'decision topology removal',
            );
            break;
          case 'takeoverBatch':
            if (node.targets.length !== 1) {
              requireWorkspaceProjectionInteraction(
                interactions.exitSelections,
                node.selection.focusKey,
                'exit selection',
              );
            }
            if (node.rewardStore !== undefined) {
              requireWorkspaceProjectionInteraction(
                interactions.batchRewardStores,
                node.rewardStore.focusKey,
                'batch reward store',
              );
            }
            requireWorkspaceProjectionInteraction(
              interactions.takeoverBatches,
              node.takeoverInteractionKey,
              'takeover batch',
            );
            requireWorkspaceProjectionInteraction(
              interactions.topologyRemovals,
              workspaceInteractionKey(node.owner),
              'decision topology removal',
            );
            break;
          case 'hubDecision':
            if (node.authoring !== 'authored') break;
            for (const slot of node.slots) {
              requireWorkspaceProjectionInteraction(
                interactions.hubSlots,
                slot.marker.focusKey,
                'Hub slot',
              );
              const interaction = interactions.hubSlots.get(slot.marker.focusKey);
              if (slot.canClose && interaction?.close === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  slot.marker.focusKey + ' closable Hub slot has no exact close interaction',
                );
              }
            }
            for (const visit of node.visits) {
              if (visit.authoring === 'locked') continue;
              requireWorkspaceProjectionInteraction(
                interactions.hubVisits,
                visit.marker.focusKey,
                'Hub visit',
              );
            }
            break;
          case 'linkedExit':
            requireWorkspaceProjectionInteraction(
              interactions.topologyRemovals,
              workspaceInteractionKey(node.owner),
              'linked-exit topology removal',
            );
            break;
          case 'completion':
            break;
        }
      }
      if (biome.entry !== undefined) {
        requireWorkspaceProjectionInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(biome.marker.address),
          'biome topology removal',
        );
      }
      for (const node of biome.nodes) {
        if (node.kind !== 'occurrenceWorkbench' || node.sourceDecisionRemoval === undefined) {
          continue;
        }
        requireWorkspaceProjectionInteraction(
          interactions.topologyRemovals,
          node.sourceDecisionRemoval.interactionKey,
          'staged decision removal',
        );
      }
      const frontier = biome.frontier;
      if (frontier === null) continue;
      switch (frontier.kind) {
        case 'start':
          requireWorkspaceProjectionInteraction(
            interactions.starts,
            frontier.interactionKey,
            'start frontier',
          );
          break;
        case 'hubDecision':
          requireWorkspaceProjectionInteraction(
            interactions.structural,
            frontier.interactionKey,
            'Hub creation frontier',
          );
          break;
        case 'exitDecision': {
          const hasDecisionWorkbench = biome.nodes.some(
            (node) =>
              (node.kind === 'linkedExit' ||
                node.kind === 'ordinaryBatch' ||
                node.kind === 'mixedBatch' ||
                node.kind === 'takeoverBatch') &&
              node.marker.focusKey === frontier.marker.focusKey,
          );
          const requiresFrontierActions =
            !hasDecisionWorkbench || frontier.owner.source.kind === 'hubDecision';
          if (!requiresFrontierActions) break;
          const capability = interactions.exitFrontierCapabilities.get(frontier.interactionKey);
          if (capability?.structural !== undefined) {
            const structural = interactions.structural.get(frontier.interactionKey);
            requireWorkspaceProjectionInteraction(
              interactions.structural,
              frontier.interactionKey,
              'exit frontier structural action',
            );
            if (structural?.action !== capability.structural) {
              throw new StructuredWorkspaceProjectionContractError(
                frontier.interactionKey +
                  ' exit frontier structural capability disagrees with its interaction',
              );
            }
          } else if (interactions.structural.has(frontier.interactionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              frontier.interactionKey + ' exit frontier has an unadvertised structural interaction',
            );
          }
          if (capability?.takeover === true) {
            requireWorkspaceProjectionInteraction(
              interactions.takeoverBatches,
              frontier.interactionKey,
              'exit frontier takeover action',
            );
          } else if (interactions.takeoverBatches.has(frontier.interactionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              frontier.interactionKey + ' exit frontier has an unadvertised takeover interaction',
            );
          }
          if (capability === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              'exit frontier ' +
                frontier.interactionKey +
                ' has no workspace authoring interaction',
            );
          }
          if (frontier.owner.source.kind === 'hubDecision' && capability.takeover !== true) {
            throw new StructuredWorkspaceProjectionContractError(
              frontier.interactionKey +
                ' Hub handoff frontier has no workspace authoring interaction',
            );
          }
          break;
        }
        case 'hubVisit':
        case 'hubOpenSet':
          break;
      }
    }
  }
}

export function createStructuredWorkspaceProjection(
  catalog: Catalog,
  services: StructuredWorkspaceContextualServices,
): StructuredWorkspaceProjectionService {
  const cache = new WeakMap<
    ProjectDocument,
    WeakMap<ProjectEvaluation, StructuredWorkspaceProjection>
  >();
  return Object.freeze({
    project(
      project: ProjectDocument,
      evaluation: ProjectEvaluation,
    ): StructuredWorkspaceProjection {
      assertProjectEvaluationSource(project, evaluation);
      const existing = cache.get(project)?.get(evaluation);
      if (existing !== undefined) return existing;
      const focusByOwner = new Map<string, WorkspaceInspectorDestination>();
      const roomControls = new Map<string, WorkspaceRoomPickerControl>();
      const rewardControls = new Map<string, WorkspaceRewardControl>();
      const authoredLeafRequirements: WorkspaceAuthoredLeafRequirement[] = [];
      const sources = createWorkspaceProjectSourceIndex(catalog, project, evaluation);
      const routes = sources.routes.map((routeSource) => {
        const biomes = routeSource.biomes.map((biomeSource) => {
          const projected = projectBiome(catalog, biomeSource);
          appendUniqueFocusDestinations(focusByOwner, projected.focusDestinations.entries());
          appendUniqueRoomControls(roomControls, projected.roomControls.values());
          appendUniqueRewardControls(rewardControls, projected.rewardControls.values());
          authoredLeafRequirements.push(...projected.authoredLeafRequirements);
          return projected.biome;
        });
        const routeAddress = { kind: 'route' as const, routeKey: routeSource.routeKey };
        const routeMarker = Object.freeze({
          address: routeAddress,
          assessment:
            routeSource.evaluation === undefined ? ('blocked' as const) : ('assessed' as const),
          findingCount: routeSource.evaluation?.findings.length ?? 0,
          focusKey: semanticAddressKey(routeAddress),
        });
        appendUniqueFocusDestinations(focusByOwner, [
          [
            routeMarker.focusKey,
            Object.freeze<WorkspaceInspectorDestination>({
              focusAddress: routeAddress,
              focusKey: routeMarker.focusKey,
              nodeKey: `route:${routeSource.routeKey}`,
              ownerAddress: routeAddress,
              region: 'routeRail',
              routeKey: routeSource.routeKey,
            }),
          ],
        ]);
        return Object.freeze({
          biomes: Object.freeze(biomes),
          label: catalog.routes.byKey[routeSource.routeKey]?.label ?? routeSource.routeKey,
          marker: routeMarker,
          rail: Object.freeze(
            biomes.map((biome) =>
              Object.freeze({
                biomeKey: biome.biomeKey,
                label: biome.label,
                marker: biome.marker,
                source: biome.source,
                status: biome.status,
              }),
            ),
          ),
          routeKey: routeSource.routeKey,
          status:
            routeSource.evaluation === undefined ? 'blocked' : routeStatus(routeSource.evaluation),
        });
      });
      registerFindingDestinations(evaluation.findings, focusByOwner);
      const interactions = createInteractionCatalog(
        catalog,
        project,
        evaluation,
        services,
        sources,
        roomControls,
        rewardControls,
      );
      assertWorkspaceInteractionClosure(
        routes,
        roomControls,
        rewardControls,
        interactions,
        Object.freeze([...authoredLeafRequirements]),
      );
      const projectAddress = { kind: 'project' as const };
      const result = Object.freeze({
        focusByOwner,
        interactions,
        marker: Object.freeze({
          address: projectAddress,
          assessment: 'assessed' as const,
          findingCount: evaluation.findings.length,
          focusKey: semanticAddressKey(projectAddress),
        }),
        routes: Object.freeze(routes),
        status: evaluation.status,
      });
      let byEvaluation = cache.get(project);
      if (byEvaluation === undefined) {
        byEvaluation = new WeakMap();
        cache.set(project, byEvaluation);
      }
      byEvaluation.set(evaluation, result);
      return result;
    },
  });
}
