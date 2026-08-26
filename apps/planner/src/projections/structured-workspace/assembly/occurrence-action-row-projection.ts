import {
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  hermesShrineDeliveryEntryKey,
  INFERNAL_CONTRACT_ENTRY_KEY,
  parseArtificerReplacementEntryKey,
  roomActionKey,
  semanticAddressKey,
  type RoomOccurrence,
  type RoomRunStateCheckpointAddress,
  type SemanticAddress,
  type FountainRarityOutcomeAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  appendSteadyGrowthTimelineEffects,
  scopeRoomLifecycleTimeline,
} from '@run-planner/engine/simulation';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceEncounterPhase,
  type WorkspaceRewardControl,
  type WorkspaceRoomActions,
  type WorkspaceRoomLocal,
  type WorkspaceRoomTab,
  type WorkspaceRunStateLauncher,
  type WorkspaceFountainRarityControl,
} from '../contract';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { occurrenceActionLabel } from './occurrence-action-label';
import { projectRoomLifecycleTimeline } from './occurrence-action-timeline-projection';

export interface WorkspaceOccurrenceActionsInput {
  readonly biome: import('@run-planner/engine/authored-project').BiomeAddress;
  readonly catalog: Catalog;
  readonly encounterPhaseStatus: (
    phase: import('@run-planner/engine/authored-project').EncounterPhaseAddress,
  ) => import('@run-planner/engine/simulation').EncounterPhaseSequenceStatus | undefined;
  readonly evaluatedRoom?: import('@run-planner/engine/simulation').CanonicalAuthoredRoom;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly runState: (owner: RoomRunStateCheckpointAddress) =>
    | {
        readonly availability: 'available';
        readonly snapshot: import('@run-planner/engine/simulation').RunStateSnapshot;
      }
    | {
        readonly availability: 'unavailable';
        readonly reason?: import('@run-planner/engine/simulation').RunStateAvailability['reason'];
      }
    | undefined;
  readonly steadyGrowthOutcomes?: readonly import('@run-planner/engine/simulation').BiomeRewardSimulation['steadyGrowthOutcomes'][number][];
  readonly fountainRarityAssessment?: (
    address: FountainRarityOutcomeAddress,
    targetTraitKey: string | null | undefined,
  ) =>
    | import('@run-planner/engine/simulation').EvaluatedFountainRarityOutcomeCandidate
    | {
        readonly kind: 'unavailable';
      };
}

export interface WorkspaceOccurrenceActionAssemblyInput extends WorkspaceOccurrenceActionsInput {
  readonly controls: readonly WorkspaceRewardControl[];
  readonly encounterPhases: readonly WorkspaceEncounterPhase[];
  readonly roomLabel: string;
  readonly roomLocal: WorkspaceRoomLocal;
}

export interface WorkspaceOccurrenceActionAssembly {
  readonly beforeExitRunState: WorkspaceRunStateLauncher | undefined;
  readonly roomActions: WorkspaceRoomActions | undefined;
  readonly runStateLaunchers: readonly WorkspaceRunStateLauncher[];
  readonly runStateByTab: Readonly<Partial<Record<WorkspaceRoomTab, WorkspaceRunStateLauncher>>>;
}
function roomActionsForOccurrence(
  input: WorkspaceOccurrenceActionsInput,
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
      const shrinePurchaseControl =
        row.reference.kind !== 'purchaseHermesShrineOffer'
          ? undefined
          : controlAt(
              createAcquisitionEntryAddress(
                createAcquisitionSiteAddress(owner, 'hermesShrineDelivery'),
                hermesShrineDeliveryEntryKey(owner, row.reference.generationKey),
              ),
            );
      const rewardControl =
        directControl ?? incomingControl ?? wheelControl ?? shrinePurchaseControl;
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
      const fountainRarity = (() => {
        if (row.reference.kind !== 'useFountain' || input.fountainRarityAssessment === undefined) {
          return undefined;
        }
        const outcome = createFountainRarityOutcomeAddress(address);
        const targetTraitKey = input.occurrence.fountainRarityResult?.targetTraitKey;
        const evaluated = input.fountainRarityAssessment(outcome, targetTraitKey);
        if (evaluated.kind !== 'fountainRarityOutcome') return undefined;
        if (
          evaluated.result.status !== 'pending' ||
          evaluated.result.targetRequired !== true ||
          evaluated.result.mutationTargetKeys.length === 0
        ) {
          return undefined;
        }
        return Object.freeze<WorkspaceFountainRarityControl>({
          address: outcome,
          marker: input.markerDestinations.marker(outcome),
          ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
        });
      })();
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
        label: occurrenceActionLabel(
          input.catalog,
          row.reference,
          roomLocal,
          encounterPhases,
          resolvedRewardControl,
          input.occurrence.purgingPool?.traitKeyBySlot,
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
        ...(fountainRarity === undefined ? {} : { fountainRarity }),
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

export { roomActionsForOccurrence };
