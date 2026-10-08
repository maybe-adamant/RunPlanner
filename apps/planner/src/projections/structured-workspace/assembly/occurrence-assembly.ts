import {
  resolveEntryDeclaration,
  routeErisHost,
  routeHasKeepsakeRack,
  routeRoomDeclaration,
  type ResolvedRoutePosition,
} from '@run-planner/engine/authored-project';
import {
  createJudgmentArcanaAddress,
  createFigurineArcanaAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRoomFeatureAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createKeepsakeEquipResultAddress,
  semanticAddressKey,
  roomActionKey,
  createPostbossKeepsakeSelectionAddress,
  type BiomeAddress,
  type AcquisitionSiteAddress,
  type EncounterPhaseAddress,
  type RoomOccurrence,
  type OccurrenceAddress,
  type RoomRunStateCheckpointAddress,
  type TraitOfferAddress,
  type LevelResolutionAddress,
  type KeepsakeEquipResultAddress,
} from '@run-planner/engine/authored-project';
import type { WorkspaceRunStateLauncher } from '../contracts/run-state';
import type { WorkspaceOccurrenceWorkbenchNode, WorkspaceDoorReward } from '../contracts/structure';
import type {
  WorkspaceFindingControl,
  WorkspaceMarker,
  WorkspaceRoomTab,
} from '../contracts/navigation';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  CanonicalAuthoredRoom,
  EncounterPhaseSequenceStatus,
  FigLeafPhaseCandidateSupport,
  GorgonPhaseCandidateSupport,
  FieldsBatchFacts,
  RunStateAvailability,
  RunStateSnapshot,
  SelectedLevelResolutionAssessment,
} from '@run-planner/engine/simulation';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardPicker';
import { requireWorkspaceRoom as requireRoom } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceBossDoorRewardStoreControl,
  type WorkspaceInteractionChoice,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
} from '../contract';
import { workspaceRewardStoreLabel } from './reward-labels';

/**
 * The boss-door pool variant the biome assembler admits, before this assembly
 * attaches the row's presentation copy and the editor's marker.
 */
export type WorkspaceBossDoorRewardStoreInput =
  | {
      readonly kind: 'editor';
      readonly address: import('@run-planner/engine/authored-project').BatchRewardStoreAddress;
      readonly selected?: string;
      readonly storeChoices: readonly WorkspaceInteractionChoice<string>[];
    }
  | { readonly kind: 'fixed'; readonly storeKey: string }
  | { readonly kind: 'ignored' };
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type { WorkspaceRoomLocal } from '../contracts/locals';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';
import {
  workspaceLocalDetailMarkers,
  workspaceOccurrenceOwnedMarkers,
  workspaceRoomFeatureMarkers,
} from '../navigation/marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import {
  type WorkspaceDerivedAcquisitionEntry,
  type WorkspaceOccurrenceProjectionFacts,
} from './occurrence-reward-assembly';
export type { WorkspaceOccurrenceProjectionFacts } from './occurrence-reward-assembly';
import { assembleOccurrenceRewardLocal } from './occurrence-room-facts';
import {
  assembleOccurrenceActions,
  roomTabForPhase,
  rewardChildMarkers,
  traitOfferMarkers,
} from './occurrence-actions-assembly';
import { assembleOccurrenceFeatures } from './occurrence-features-assembly';
import { occurrenceInteractionRequirements } from './occurrence-interaction-requirements';
import { roomWorkbenchPresentation } from './occurrence-room-workbench';
import { resourceOutcomeLabel } from './resource-labels';

function offerRewardRewards(
  input: WorkspaceOccurrenceAssemblyInput,
  room: ReturnType<typeof requireRoom>,
  roomLocal: WorkspaceRoomLocal,
  controls: readonly WorkspaceRewardControl[],
): readonly WorkspaceDoorReward[] {
  // One Preboss declaration can materialize as either its declared Shop or a
  // takeover-owned free-reward peer. The authored occurrence selects that
  // producer mode, while the declaration still owns the counted reward domain.
  const binding =
    input.occurrence.state.kind === 'freeReward'
      ? ({ kind: 'incomingReward' } as const)
      : room.offerRewardBinding;
  switch (binding.kind) {
    case 'none': {
      // A Shop door carries no reward offer; it names the Shop itself.
      if (room.incomingReward.kind !== 'shop') return Object.freeze([]);
      const shop = input.catalog.rewards.rewardTypes.byKey[room.incomingReward.rewardType];
      if (shop === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} declares unknown shop reward type ${room.incomingReward.rewardType}`,
        );
      }
      return Object.freeze([
        Object.freeze({
          key: 'incoming',
          label: 'Door reward',
          marker: input.markerDestinations.marker(
            createIncomingRewardAddress(input.biome, input.occurrence.occurrenceId),
          ),
          offer: null,
          summary: shop.label,
        }),
      ]);
    }
    case 'incomingReward': {
      if (roomLocal.kind === 'none') return Object.freeze([]);
      // A Clockwork Goal door shows the goal itself; its counted reward stays dormant.
      if (roomLocal.kind === 'incomingReward' && roomLocal.clockworkReward === 'goal') {
        const goal = input.catalog.rewards.rewardTypes.byKey.ClockworkGoal;
        if (goal === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            'the catalog declares no ClockworkGoal reward type',
          );
        }
        return Object.freeze([
          Object.freeze({
            key: 'incoming',
            label: 'Door reward',
            marker: roomLocal.control.marker,
            offer: null,
            summary: goal.label,
          }),
        ]);
      }
      if (roomLocal.kind === 'fixed') {
        return Object.freeze([
          Object.freeze({
            ...(roomLocal.control === undefined ? {} : { control: roomLocal.control }),
            key: 'incoming',
            label: 'Door reward',
            marker: roomLocal.marker,
            offer: roomLocal.offer,
            summary: roomLocal.summary,
          }),
        ]);
      }
      if (roomLocal.kind !== 'incomingReward') return Object.freeze([]);
      const incomingAddress = createIncomingRewardAddress(
        input.biome,
        input.occurrence.occurrenceId,
      );
      const control = controls.find(
        (candidate) =>
          semanticAddressKey(candidate.owner.address) === semanticAddressKey(incomingAddress),
      );
      if (control === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(incomingAddress)} has no projected incoming reward control`,
        );
      }
      return Object.freeze([
        Object.freeze({
          control,
          key: 'incoming',
          label: 'Door reward',
          marker: control.marker,
          offer: control.offer,
          summary: roomLocal.summary,
        }),
      ]);
    }
    case 'localRewardGroup': {
      const group = room.localChildren.find((child) => child.key === binding.groupKey);
      if (group?.kind !== 'boundedRewardSlots' || group.offerRewardCapability !== 'fieldsCages') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} offer reward group ${binding.groupKey} has no projected group`,
        );
      }
      const rewards: WorkspaceDoorReward[] = [];
      for (const [index, slotKey] of group.slotKeys.entries()) {
        const address = createLocalRewardAddress(
          input.biome,
          input.occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        const control = controls.find(
          (candidate) =>
            semanticAddressKey(candidate.owner.address) === semanticAddressKey(address),
        );
        if (control === undefined) break;
        rewards.push(
          Object.freeze({
            control,
            key: slotKey,
            label: `Cage ${index + 1}`,
            marker: control.marker,
            offer: control.offer,
            summary:
              control.offer === null
                ? 'Choose reward'
                : summarizeRewardOffer(input.catalog, control.offer),
          }),
        );
      }
      return Object.freeze(rewards);
    }
  }
}

/** Exact authored/evaluated inputs for one room-local workspace product. */
export interface WorkspaceOccurrenceAssemblyInput {
  readonly structuralPlacementRepairs: (
    owner: OccurrenceAddress,
    order: readonly import('@run-planner/engine/authored-project').RoomActionReference[],
  ) => readonly import('../contracts/timeline').WorkspaceGeneratedPickupPlacementRepair[];
  readonly roomActionPlacementRoster: (
    owner: OccurrenceAddress,
    roster: import('@run-planner/engine/simulation').RoomActionRoster,
  ) => import('@run-planner/engine/simulation').RoomActionRoster;
  readonly configuredRivalsRank: number;
  readonly routePosition: ResolvedRoutePosition;
  /** Closed declaration-owned map domain for an Anomaly replacement in this biome. */
  readonly anomalyReplacementRoomGameNames?: readonly string[];
  readonly biome: BiomeAddress;
  /**
   * Present for any room with a boss door. The caller owns the declaration
   * predicate and the policy bound; this assembly only turns the admitted
   * variant into its room-summary row and registers the editor's marker.
   */
  readonly bossDoorRewardStore?: WorkspaceBossDoorRewardStoreInput;
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
  readonly preparedEncounterDefinitionKeysBySlot?: Readonly<Record<string, string>>;
  /** Shared decision-owned Fields derivation for this target occurrence. */
  readonly fieldsBatchFacts?: FieldsBatchFacts;
  readonly facts: WorkspaceOccurrenceProjectionFacts;
  readonly levelResolutionAssessment: (
    owner: LevelResolutionAddress,
  ) => SelectedLevelResolutionAssessment | undefined;
  readonly acquisitionConversionCandidate?: (
    owner: import('@run-planner/engine/authored-project').AcquisitionRoleAddress,
  ) =>
    import('@run-planner/engine/simulation').AcquisitionConversionCandidateCapability | undefined;
  readonly purgingPoolAssessment?: (
    owner: OccurrenceAddress,
  ) => import('@run-planner/engine/simulation').PurgingPoolCandidateCapability | undefined;
  readonly steadyGrowthOutcomes?: readonly import('@run-planner/engine/simulation').BiomeRewardSimulation['steadyGrowthOutcomes'][number][];
  readonly transcendentEmbryoOutcomes?: readonly import('@run-planner/engine/simulation').BiomeRewardSimulation['transcendentEmbryoOutcomes'][number][];
  readonly fountainRarityAssessment?: import('./occurrence-action-row-projection').WorkspaceOccurrenceActionsInput['fountainRarityAssessment'];
  readonly hermesShrineAssessment?: (
    owner: OccurrenceAddress,
  ) => import('@run-planner/engine/simulation').HermesShrineCandidateCapability | undefined;
  readonly stygianWellAssessment?: (
    owner: OccurrenceAddress,
  ) => import('@run-planner/engine/simulation').StygianWellCandidateCapability | undefined;
  readonly isActiveTraitOffer: (owner: TraitOfferAddress) => boolean;
  /** Engine-published Timeline rows of the product this room's assessment stops at. */
  readonly blockingRowKeys?: ReadonlySet<string>;
  readonly judgmentArcanaCapability?: (
    address: import('@run-planner/engine/authored-project').JudgmentArcanaAddress,
  ) =>
    { readonly inactiveArcanaKeys: readonly string[]; readonly requiredCount: number } | undefined;
  readonly figurineArcanaCapability?: (
    address: import('@run-planner/engine/authored-project').FigurineArcanaAddress,
  ) =>
    | {
        readonly inactiveArcanaKeys: readonly string[];
        readonly requiredCount: number;
        readonly rarity: import('@run-planner/engine/catalog-schema').TraitRarity;
      }
    | undefined;
  readonly keepsakeEquipResultSupported?: (address: KeepsakeEquipResultAddress) => boolean;
  readonly derivedAcquisitionEntries?: (
    site: AcquisitionSiteAddress,
  ) => readonly WorkspaceDerivedAcquisitionEntry[];
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly runState: (owner: RoomRunStateCheckpointAddress) =>
    | { readonly availability: 'available'; readonly snapshot: RunStateSnapshot }
    | {
        readonly availability: 'unavailable';
        readonly reason?: RunStateAvailability['reason'];
      }
    | undefined;
  readonly resourceAuthoring?: import('@run-planner/engine/simulation').RouteResourceAuthoring;
  readonly startingReward?:
    import('@run-planner/engine/authored-project').AuthoredRewardState | null;
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

export function assembleWorkspaceOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
): WorkspaceOccurrenceAssembly {
  const { occurrence } = input;
  const room = resolveEntryDeclaration(
    requireRoom(input.catalog, occurrence.gameName),
    input.routePosition,
  );
  const address = createOccurrenceAddress(input.biome, occurrence.occurrenceId);
  const entered = input.evaluatedRoom?.entered ?? false;
  const roomControls =
    input.roomPicker === undefined ? Object.freeze([]) : Object.freeze([input.roomPicker]);
  const rewardLocal = assembleOccurrenceRewardLocal(
    {
      configuredRivalsRank: input.configuredRivalsRank,
      routePosition: input.routePosition,
      biome: input.biome,
      catalog: input.catalog,
      encounterPhaseStatus: input.encounterPhaseStatus,
      ...(input.preparedEncounterDefinitionKeysBySlot === undefined
        ? {}
        : { preparedEncounterDefinitionKeysBySlot: input.preparedEncounterDefinitionKeysBySlot }),
      ...(input.figLeafSupport === undefined ? {} : { figLeafSupport: input.figLeafSupport }),
      ...(input.gorgonSupport === undefined ? {} : { gorgonSupport: input.gorgonSupport }),
      ...(input.evaluatedRoom === undefined ? {} : { evaluatedRoom: input.evaluatedRoom }),
      ...(input.fieldsBatchFacts === undefined ? {} : { fieldsBatchFacts: input.fieldsBatchFacts }),
      facts: input.facts,
      levelResolutionAssessment: input.levelResolutionAssessment,
      ...(input.acquisitionConversionCandidate === undefined
        ? {}
        : { acquisitionConversionCandidate: input.acquisitionConversionCandidate }),
      isActiveTraitOffer: input.isActiveTraitOffer,
      ...(input.derivedAcquisitionEntries === undefined
        ? {}
        : { derivedAcquisitionEntries: input.derivedAcquisitionEntries }),
      markerDestinations: input.markerDestinations,
      occurrence: input.occurrence,
      ...(input.startingReward === undefined ? {} : { startingReward: input.startingReward }),
    },
    room,
  );
  const { encounterPhases, roomLocal, rewardControls: allRewardControls } = rewardLocal;
  const offerRewardRewardsForRoom = offerRewardRewards(input, room, roomLocal, allRewardControls);
  const featureAssembly = assembleOccurrenceFeatures(
    {
      biome: input.biome,
      catalog: input.catalog,
      facts: input.facts,
      ...(input.hermesShrineAssessment === undefined
        ? {}
        : { hermesShrineAssessment: input.hermesShrineAssessment }),
      markerDestinations: input.markerDestinations,
      occurrence: input.occurrence,
      ...(input.purgingPoolAssessment === undefined
        ? {}
        : { purgingPoolAssessment: input.purgingPoolAssessment }),
      ...(input.stygianWellAssessment === undefined
        ? {}
        : { stygianWellAssessment: input.stygianWellAssessment }),
    },
    room,
    encounterPhases,
    roomLocal,
  );
  const { features, chaosSpawn, zagreusSpawn } = featureAssembly;
  const actionAssembly = assembleOccurrenceActions({
    roomActionPlacementRoster: input.roomActionPlacementRoster,
    biome: input.biome,
    catalog: input.catalog,
    encounterPhaseStatus: input.encounterPhaseStatus,
    ...(input.evaluatedRoom === undefined ? {} : { evaluatedRoom: input.evaluatedRoom }),
    markerDestinations: input.markerDestinations,
    occurrence: input.occurrence,
    runState: input.runState,
    ...(input.steadyGrowthOutcomes === undefined
      ? {}
      : { steadyGrowthOutcomes: input.steadyGrowthOutcomes }),
    ...(input.transcendentEmbryoOutcomes === undefined
      ? {}
      : { transcendentEmbryoOutcomes: input.transcendentEmbryoOutcomes }),
    ...(input.fountainRarityAssessment === undefined
      ? {}
      : { fountainRarityAssessment: input.fountainRarityAssessment }),
    ...(input.derivedAcquisitionEntries === undefined
      ? {}
      : { derivedAcquisitionEntries: input.derivedAcquisitionEntries }),
    ...(input.stygianWellAssessment === undefined
      ? {}
      : { stygianWellAssessment: input.stygianWellAssessment }),
    ...(input.blockingRowKeys === undefined ? {} : { blockingRowKeys: input.blockingRowKeys }),
    controls: allRewardControls,
    encounterPhases,
    features,
    roomLabel: room.label,
    roomLocal,
  });
  const { roomActions, runStateByTab, runStateLaunchers } = actionAssembly;
  const placementRepairs =
    roomActions === undefined
      ? input.structuralPlacementRepairs(
          createOccurrenceAddress(input.biome, input.occurrence.occurrenceId),
          input.occurrence.roomActions.order,
        )
      : undefined;
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
  const figurine = (() => {
    if (room.kind !== 'Boss' || !input.facts.detailsActive) return undefined;
    const bossDefeated = input.evaluatedRoom?.roomLifecycleTimeline.boundaries.find(
      (boundary) => boundary.kind === 'bossDefeated',
    );
    if (bossDefeated === undefined) return undefined;
    const address = createFigurineArcanaAddress(
      createOccurrenceAddress(input.biome, occurrence.occurrenceId),
      bossDefeated.phaseKey,
    );
    const capability = input.figurineArcanaCapability?.(address);
    if (capability === undefined) return undefined;
    return Object.freeze({
      address,
      inactiveArcanaKeys: capability.inactiveArcanaKeys,
      marker: input.markerDestinations.marker(address),
      requiredCount: capability.requiredCount,
      rarity: capability.rarity,
      value:
        occurrence.encounters.figurineArcanaKeysByPhase?.[bossDefeated.phaseKey] ??
        Object.freeze([]),
    });
  })();
  const rackOnRoute = routeHasKeepsakeRack(room, input.biome.routeKey);
  // A keepsake retained where the route lost its rack keeps a removal-only selection.
  const rackRetainedOffRoute =
    !rackOnRoute && room.hasKeepsakeRack && occurrence.keepsakeRack !== undefined;
  const keepsakeSelection =
    !input.facts.detailsActive || (!rackOnRoute && !rackRetainedOffRoute)
      ? undefined
      : (() => {
          const address = createPostbossKeepsakeSelectionAddress(
            createOccurrenceAddress(input.biome, occurrence.occurrenceId),
          );
          const effect =
            occurrence.keepsakeRack === undefined
              ? undefined
              : input.catalog.keepsakes.byKey[occurrence.keepsakeRack.keepsakeKey]?.effect;
          const resultAddress = rackRetainedOffRoute
            ? undefined
            : effect?.kind === 'jeweledPom' ||
                effect?.kind === 'experimentalHammer' ||
                effect?.kind === 'transcendentEmbryo'
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
            ...(occurrence.keepsakeRack === undefined
              ? {}
              : { selectedKeepsakeKey: occurrence.keepsakeRack.keepsakeKey }),
            ...(rackRetainedOffRoute
              ? { unavailableReason: 'rackUnavailableOnRoute' as const }
              : {}),
          });
        })();
  const erisObservation =
    !input.facts.detailsActive || routeErisHost(room, input.biome.routeKey) === undefined
      ? undefined
      : (() => {
          const spawn = createRoomFeatureAddress(address, { kind: 'erisSpawn' });
          return Object.freeze({
            address: spawn,
            interactionKey: semanticAddressKey(spawn),
            marker: input.markerDestinations.marker(spawn),
            spawned: occurrence.eris !== undefined,
          });
        })();
  const workbench = roomWorkbenchPresentation(encounterPhases, features, roomLocal, roomActions);
  const localDetailMarkers = Object.freeze([
    ...encounterPhases.flatMap((phase) => [
      phase.marker,
      ...(phase.nemesisEvent === undefined ? [] : [phase.nemesisEvent.marker]),
      ...(phase.traitOffer === undefined ? [] : [phase.traitOffer.marker]),
      ...(phase.figLeaf === undefined ? [] : [phase.figLeaf.marker]),
      ...(phase.aetos === undefined ? [] : [phase.aetos.marker]),
      ...(phase.gorgonCondition === undefined ? [] : [phase.gorgonCondition.marker]),
      ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker]),
    ]),
    ...workspaceLocalDetailMarkers(roomLocal),
    ...(roomActions?.rows.map((row) => row.marker) ?? []),
    ...(judgment === undefined ? [] : [judgment.marker]),
    ...(figurine === undefined ? [] : [figurine.marker]),
    ...(keepsakeSelection === undefined
      ? []
      : [
          keepsakeSelection.marker,
          ...(keepsakeSelection.equipResult === undefined
            ? []
            : [keepsakeSelection.equipResult.marker]),
        ]),
    ...(zagreusSpawn === undefined ? [] : [zagreusSpawn.marker]),
    ...(chaosSpawn === undefined ? [] : [chaosSpawn.marker]),
  ]);
  const bossDoorRewardStore = ((
    admitted: WorkspaceBossDoorRewardStoreInput | undefined,
  ): WorkspaceBossDoorRewardStoreControl | undefined => {
    if (admitted === undefined) return undefined;
    switch (admitted.kind) {
      case 'ignored':
        return Object.freeze({
          kind: 'ignored' as const,
          summary: 'Ignored for this boss',
        });
      case 'fixed':
        return Object.freeze({
          kind: 'fixed' as const,
          summary: `${workspaceRewardStoreLabel(admitted.storeKey)} · Fixed`,
        });
      case 'editor':
        return Object.freeze({
          kind: 'editor' as const,
          address: admitted.address,
          // The same label term the three variants share and the ordinary
          // batch store control uses.
          label: 'Reward Pool',
          marker: input.markerDestinations.marker(admitted.address),
          ...(admitted.selected === undefined ? {} : { selected: admitted.selected }),
          storeChoices: admitted.storeChoices,
        });
    }
  })(input.bossDoorRewardStore);
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    ...(bossDoorRewardStore === undefined ? {} : { bossDoorRewardStore }),
    detailsActive: input.facts.detailsActive,
    offerRewardRewards: offerRewardRewardsForRoom,
    ...(judgment === undefined ? {} : { judgment }),
    ...(figurine === undefined ? {} : { figurine }),
    ...(keepsakeSelection === undefined ? {} : { keepsakeSelection }),
    ...(erisObservation === undefined ? {} : { erisObservation }),
    encounterPhases,
    entered,
    gameName: occurrence.gameName,
    kind: room.kind,
    label: room.label,
    localDetailMarkers,
    marker: input.markerDestinations.marker(address),
    occurrenceId: occurrence.occurrenceId,
    ...(roomActions === undefined ? {} : { roomActions }),
    ...(placementRepairs === undefined || placementRepairs.length === 0
      ? {}
      : { placementRepairs }),
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
    ...(chaosSpawn === undefined ? {} : { chaosSpawn }),
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
              const rule = room.resourcePointSupport.rules[family];
              if (rule === undefined && !here) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${room.gameName} declares ${family} without resource rules`,
                );
              }
              const currentPlacement =
                placement !== null && !here
                  ? (() => {
                      const entry = input.resourceAuthoring!.entered.find(
                        (candidate) =>
                          candidate.biomeKey === placement.biomeKey &&
                          candidate.origin.kind === 'occurrence' &&
                          candidate.origin.occurrenceId === placement.occurrenceId,
                      );
                      return Object.freeze({
                        address: createOccurrenceAddress(
                          createBiomeAddress(input.biome.routeKey, placement.biomeKey),
                          placement.occurrenceId,
                        ),
                        biomeKey: placement.biomeKey,
                        locationLabel:
                          entry === undefined
                            ? 'Unavailable room'
                            : routeRoomDeclaration(
                                requireRoom(input.catalog, entry.gameName),
                                input.biome.routeKey,
                              ).label,
                      });
                    })()
                  : undefined;
              return Object.freeze({
                address: createRoomFeatureAddress(address, { kind: 'resource', family }),
                family,
                label: resourceOutcomeLabel(family, rule?.element),
                marker: input.markerDestinations.marker(
                  createRoomFeatureAddress(address, { kind: 'resource', family }),
                ),
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
                ...(currentPlacement === undefined ? {} : { currentPlacement }),
              });
            }),
          ),
        }),
    runStateByTab,
    workbench,
  });
  const node: WorkspaceOccurrenceWorkbenchNode = Object.freeze({
    ...(input.isEntry === true ? { isEntry: true } : {}),
    inspectorPresentation: 'full' as const,
    kind: 'occurrenceWorkbench' as const,
    key: `occurrence:${semanticAddressKey(address)}`,
    localDetailMarkers: roomSummary.localDetailMarkers,
    marker: roomSummary.marker,
    room: roomSummary,
  });
  input.markerDestinations.setRoomTab(
    [
      roomSummary.marker,
      ...(zagreusSpawn === undefined ? [] : [zagreusSpawn.marker]),
      ...(chaosSpawn === undefined ? [] : [chaosSpawn.marker]),
      ...workspaceRoomFeatureMarkers(features),
      ...(roomSummary.resources?.map((resource) => resource.marker) ?? []),
      ...(erisObservation === undefined ? [] : [erisObservation.marker]),
      ...(input.isEntry === true && roomLocal.kind === 'incomingReward'
        ? [roomLocal.control.marker]
        : []),
    ],
    'overview',
  );
  // The boss-door pool sits beside its door, so its findings route to Doors.
  if (bossDoorRewardStore?.kind === 'editor') {
    input.markerDestinations.setRoomTab([bossDoorRewardStore.marker], 'doors');
  }
  if (roomLocal.kind === 'shop') {
    input.markerDestinations.setRoomTab(
      roomLocal.offers.map((offer) => offer.rewardControl.marker),
      'overview',
    );
    input.markerDestinations.setRoomTab(
      roomLocal.supplementalOffers.flatMap((offer) =>
        offer.kind === 'travelDealRefill' ? [offer.rewardControl.marker] : [],
      ),
      'actions',
    );
  }
  // Refill inventory is authored on the timeline: on its Travel Deal line, or
  // at its own purchase row while no line hosts it.
  for (const feature of features) {
    if (feature.kind !== 'hermesShrine' && feature.kind !== 'stygianWell') continue;
    const refill = feature.travelDealRefill;
    if (refill === undefined) continue;
    input.markerDestinations.setRoomTab([refill.marker], 'actions');
    if (refill.sourceGenerationKey !== undefined) continue;
    const purchaseKind =
      feature.kind === 'hermesShrine' ? 'purchaseHermesShrineOffer' : 'purchaseStygianWellOffer';
    const refillRow = roomActions?.rows.find(
      (row) =>
        row.reference.kind === purchaseKind && row.reference.generationKey === 'travelDealRefill',
    );
    // An unhosted refill purchase that should not exist is removed from its row.
    if (refillRow !== undefined)
      input.markerDestinations.redirectTo(
        refill.marker,
        refillRow.marker,
        node.key,
        refillRow.marker,
        'delete',
      );
  }
  if (roomLocal.kind === 'fields') {
    // Cage rewards are authored on the source door, which routes them to Room Doors.
    input.markerDestinations.setRoomTab(
      [
        ...roomLocal.optionalRewards.map((reward) => reward.control.marker),
        roomLocal.optionalRewardCountMarker,
      ],
      'overview',
    );
    input.markerDestinations.setRoomTab(
      roomLocal.spatial.map((control) => control.marker),
      'layout',
    );
  }
  for (const phase of encounterPhases) {
    // A fixed phase's slot is activated by its room's choices: the Ship combat phase count.
    if (!phase.customizable && phase.customization === undefined)
      input.markerDestinations.markCodeAt(
        phase.marker,
        'encounterSlotActivationUnavailable',
        roomSummary.marker,
      );
    if (phase.customizable && phase.nemesisEvent !== undefined) {
      input.markerDestinations.redirectTo(phase.nemesisEvent.marker, phase.marker, node.key);
    }
    const phaseTab = roomTabForPhase(roomLocal, phase.address.phaseKey);
    // Identity, customization and the Nemesis family are fixed on entry: authored in Overview.
    input.markerDestinations.setRoomTab(
      [phase.marker, ...(phase.nemesisEvent === undefined ? [] : [phase.nemesisEvent.marker])],
      'overview',
    );
    input.markerDestinations.setRoomTab(
      [
        ...(phase.figLeaf === undefined ? [] : [phase.figLeaf.marker]),
        ...(phase.aetos === undefined ? [] : [phase.aetos.marker]),
        ...(phase.gorgonCondition === undefined ? [] : [phase.gorgonCondition.marker]),
        ...(phase.traitOffer === undefined ? [] : [phase.traitOffer.marker]),
        ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker]),
      ],
      phaseTab,
    );
  }
  if (judgment !== undefined) {
    input.markerDestinations.setRoomTab([judgment.marker], 'actions');
  }
  if (figurine !== undefined) {
    input.markerDestinations.setRoomTab([figurine.marker], 'actions');
  }
  if (keepsakeSelection !== undefined) {
    input.markerDestinations.setRoomTab(
      [
        keepsakeSelection.marker,
        ...(keepsakeSelection.equipResult === undefined
          ? []
          : [keepsakeSelection.equipResult.marker]),
      ],
      'actions',
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
    for (const effect of roomActions.transcendentEmbryo ?? []) {
      input.markerDestinations.setRoomTab(
        [effect.marker],
        roomLocal.kind === 'ship' ? roomTabForPhase(roomLocal, effect.phaseKey) : 'actions',
      );
    }
    const shipActionTabs = new Map(
      workbench.kind === 'ship'
        ? workbench.phases.flatMap((phase) =>
            [...phase.actionRows, ...phase.optionalRows, ...phase.unplacedRows].map(
              (row) => [row.key, phase.tab] as const,
            ),
          )
        : [],
    );
    const artificerOfferTargets = new Set(
      roomActions.rows.flatMap((row) =>
        row.artificerOutput === undefined ? [] : [row.artificerOutput.control.marker.focusKey],
      ),
    );
    for (const row of roomActions.rows) {
      const placementCommand = row.placement?.command;
      const placementEntry =
        placementCommand === undefined
          ? undefined
          : input.markerDestinations.marker(
              'entry' in placementCommand
                ? placementCommand.entry
                : createAcquisitionEntryAddress(placementCommand.site, placementCommand.entryKey),
            );
      const invalidPlacementEntry =
        row.placementAssessment?.kind === 'invalid' &&
        row.reference.kind === 'interactAcquisitionEntry'
          ? input.markerDestinations.marker(
              createAcquisitionEntryAddress(
                createAcquisitionSiteAddress(
                  createOccurrenceAddress(input.biome, input.occurrence.occurrenceId),
                  row.reference.siteKey,
                ),
                row.reference.entryKey,
              ),
            )
          : undefined;
      const supplementalPurchaseMarkers =
        roomLocal.kind === 'shop'
          ? roomLocal.supplementalOffers.flatMap((offer) =>
              (offer.kind === 'echoDoubleShopInvalid' ||
                offer.kind === 'travelDealRefill' ||
                offer.kind === 'travelDealInvalid') &&
              roomActionKey(offer.purchase.reference) === row.key &&
              // An acquisition-resolved refill shows its own entry control on the row.
              row.rewardPayload?.control.marker.focusKey !== offer.purchase.marker.focusKey
                ? [offer.purchase.marker]
                : [],
            )
          : [];
      const acquisitionMarkers = Object.freeze([
        ...(placementEntry === undefined ? [] : [placementEntry]),
        ...(row.stygianWellTwist === undefined ? [] : [row.stygianWellTwist.marker]),
        ...(invalidPlacementEntry === undefined ? [] : [invalidPlacementEntry]),
        ...supplementalPurchaseMarkers,
        ...(row.traitOffer === undefined ? [] : traitOfferMarkers(row.traitOffer)),
        ...(row.rewardPayload !== undefined &&
        !row.rewardPayload.showOffer &&
        !artificerOfferTargets.has(row.rewardPayload.control.marker.focusKey) &&
        row.rewardPayload.control.owner.address.kind === 'acquisitionEntry'
          ? [row.rewardPayload.control.marker]
          : []),
        ...(row.rewardPayload === undefined ? [] : rewardChildMarkers(row.rewardPayload.control)),
        ...(row.artificerOutput === undefined
          ? []
          : rewardChildMarkers(row.artificerOutput.control)),
      ]);
      // An applicable Anvil result is repaired at its own launcher inside the row.
      const anvilFocusKeys = new Set(
        (row.rewardPayload?.control.conversions ?? []).flatMap((conversion) =>
          conversion.anvilApplies === true ? [conversion.marker.focusKey] : [],
        ),
      );
      // Each finding marks the row control whose edit repairs it.
      const rowControlMarks = new Map<
        string,
        { readonly mark: WorkspaceMarker; readonly control?: WorkspaceFindingControl }
      >();
      // Purchases that should not exist are removed; an unplaced pickup is placed.
      for (const marker of supplementalPurchaseMarkers)
        rowControlMarks.set(marker.focusKey, { mark: row.marker, control: 'delete' });
      if (invalidPlacementEntry !== undefined)
        rowControlMarks.set(invalidPlacementEntry.focusKey, {
          mark: row.marker,
          control: row.rank === null ? 'place' : 'delete',
        });
      if (placementEntry !== undefined)
        rowControlMarks.set(placementEntry.focusKey, { mark: row.marker, control: 'place' });
      if (row.stygianWellTwist !== undefined)
        rowControlMarks.set(row.stygianWellTwist.marker.focusKey, {
          mark: row.stygianWellTwist.marker,
        });
      for (const conversion of row.rewardPayload?.control.conversions ?? [])
        rowControlMarks.set(conversion.marker.focusKey, {
          mark: conversion.marker,
          control: 'pickupOutcome',
        });
      for (const trait of [
        ...(row.traitOffer === undefined ? [] : [row.traitOffer]),
        ...(row.rewardPayload?.inlineTraitOffers ?? []),
      ]) {
        for (const marker of traitOfferMarkers(trait))
          rowControlMarks.set(marker.focusKey, { mark: trait.marker });
      }
      for (const resolution of row.rewardPayload?.inlineLevelResolutions ?? [])
        rowControlMarks.set(resolution.marker.focusKey, { mark: resolution.marker });
      for (const marker of acquisitionMarkers) {
        if (anvilFocusKeys.has(marker.focusKey)) {
          input.markerDestinations.redirect([marker], node.key);
          continue;
        }
        const mark = rowControlMarks.get(marker.focusKey);
        input.markerDestinations.redirectToContext(
          marker,
          row.marker,
          node.key,
          mark?.mark,
          mark?.control,
        );
      }
      const tab =
        roomLocal.kind === 'ship'
          ? (shipActionTabs.get(row.key) ??
            (workbench.kind === 'ship' &&
            workbench.repairRows.some((repair) => repair.key === row.key)
              ? 'shipInactiveRepair'
              : undefined))
          : 'actions';
      if (tab === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `Ship action ${row.key} has no rendered timeline destination`,
        );
      }
      input.markerDestinations.setRoomTab(
        [
          row.marker,
          ...(row.fountainRarity === undefined ? [] : [row.fountainRarity.marker]),
          ...(row.artificerOutput === undefined ? [] : [row.artificerOutput.control.marker]),
          ...(row.rewardPayload?.showOffer === true ? [row.rewardPayload.control.marker] : []),
          ...acquisitionMarkers,
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
      const wheelMarkers = [wheel.marker, ...wheel.offers.map((offer) => offer.control.marker)];
      if (!wheel.active) {
        // The phase-count control restores an inactive wheel; no wheel editor exists in repairs.
        for (const marker of wheelMarkers) {
          input.markerDestinations.redirectToContext(marker, roomSummary.marker, node.key);
        }
        input.markerDestinations.setRoomTab(wheelMarkers, 'overview');
        continue;
      }
      const tab: WorkspaceRoomTab = workbenchPhase!.tab;
      input.markerDestinations.setRoomTab(wheelMarkers, tab);
      const choice = roomActions?.rows.find(
        (row) => row.reference.kind === 'chooseRewardWheel' && row.reference.wheelKey === wheel.key,
      );
      if (
        choice !== undefined &&
        roomActions?.timeline.entries.some(
          (entry) =>
            entry.kind === 'action' &&
            entry.actionKey === choice.key &&
            entry.presentation === 'rewardWheelAnchor',
        )
      ) {
        // Every pickable offer of the wheel repairs its choice.
        input.markerDestinations.redirectToContext(
          choice.marker,
          wheel.marker,
          node.key,
          wheel.marker,
          'wheelChoice',
        );
        input.markerDestinations.setRoomTab([choice.marker], tab);
      }
    }
  }
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
    runStateLaunchers,
  });
}
