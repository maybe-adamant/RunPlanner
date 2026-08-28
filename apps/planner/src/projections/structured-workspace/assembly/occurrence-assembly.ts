import {
  createJudgmentArcanaAddress,
  createFigurineArcanaAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createAcquisitionEntryAddress,
  createKeepsakeEquipResultAddress,
  semanticAddressKey,
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
  acquisitionSiteFromStorageKey,
  INFERNAL_CONTRACT_ENTRY_KEY,
} from '@run-planner/engine/authored-project';
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
import { requireWorkspaceRoom as requireRoom } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceRewardControl,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
  type WorkspaceRoomTab,
  type WorkspaceRunStateLauncher,
} from '../contract';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';
import {
  workspaceLocalDetailMarkers,
  workspaceOccurrenceOwnedMarkers,
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
  const room = requireRoom(input.catalog, occurrence.gameName);
  const address = createOccurrenceAddress(input.biome, occurrence.occurrenceId);
  const entered = input.evaluatedRoom?.entered ?? false;
  const roomControls =
    input.roomPicker === undefined ? Object.freeze([]) : Object.freeze([input.roomPicker]);
  const rewardLocal = assembleOccurrenceRewardLocal(
    {
      biome: input.biome,
      catalog: input.catalog,
      encounterPhaseStatus: input.encounterPhaseStatus,
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
    },
    room,
  );
  const { encounterPhases, roomLocal, rewardControls: allRewardControls } = rewardLocal;
  const actionAssembly = assembleOccurrenceActions({
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
    controls: allRewardControls,
    encounterPhases,
    roomLabel: room.label,
    roomLocal,
  });
  const { roomActions, runStateByTab, runStateLaunchers } = actionAssembly;
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
  const keepsakeSelection =
    !input.facts.detailsActive || room.hasKeepsakeRack !== true
      ? undefined
      : (() => {
          const address = createPostbossKeepsakeSelectionAddress(
            createOccurrenceAddress(input.biome, occurrence.occurrenceId),
          );
          const effect =
            occurrence.keepsakeRack === undefined
              ? undefined
              : input.catalog.keepsakes.byKey[occurrence.keepsakeRack.keepsakeKey]?.effect;
          const resultAddress =
            effect?.kind === 'jeweledPom' ||
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
          });
        })();
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
  const { features, naturalChaosSpawn, zagreusSpawn } = featureAssembly;
  const workbench = roomWorkbenchPresentation(encounterPhases, features, roomLocal, roomActions);
  const localDetailMarkers = Object.freeze([
    ...encounterPhases.flatMap((phase) => [
      phase.marker,
      ...(phase.traitOffer === undefined ? [] : [phase.traitOffer.marker]),
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
    ...(naturalChaosSpawn === undefined ? [] : [naturalChaosSpawn.marker]),
  ]);
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
    ...(figurine === undefined ? {} : { figurine }),
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
    const shipRepairKeys = new Set(roomActions.repairRows.map((row) => row.key));
    const timelineActionPhaseKeys = new Map(
      roomActions.timeline.entries.flatMap((entry) =>
        entry.kind === 'action' && entry.phaseKey !== undefined
          ? [[entry.actionKey, entry.phaseKey] as const]
          : [],
      ),
    );
    for (const row of roomActions.rows) {
      const acquisitionMarkers = Object.freeze([
        ...(row.traitOffer === undefined ? [] : traitOfferMarkers(row.traitOffer)),
        ...(row.rewardPayload === undefined ? [] : rewardChildMarkers(row.rewardPayload.control)),
        ...(row.artificerOutput === undefined
          ? []
          : rewardChildMarkers(row.artificerOutput.control)),
      ]);
      for (const marker of acquisitionMarkers) {
        input.markerDestinations.redirectToContext(marker, row.marker, node.key);
      }
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
          ...(row.rewardPayload === undefined ? [] : [row.rewardPayload.control.marker]),
          ...acquisitionMarkers,
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
  return Object.freeze({
    node,
    occurrenceInteractionRequirements: localInteractionRequirements,
    roomControls,
    rewardControls: allRewardControls,
    runStateLaunchers,
  });
}
