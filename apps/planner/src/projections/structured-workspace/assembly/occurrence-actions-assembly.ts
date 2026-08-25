import {
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createRoomRunStateCheckpointAddress,
  createShopOfferAddress,
  hermesShrineDeliveryEntryKey,
  INFERNAL_CONTRACT_ENTRY_KEY,
  parseArtificerReplacementEntryKey,
  parseEchoLastRewardPickupEntryKey,
  roomActionKey,
  semanticAddressKey,
  type RoomOccurrence,
  type RoomRunStateCheckpointAddress,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RoomLifecycleTimeline } from '@run-planner/engine/simulation';
import {
  appendSteadyGrowthTimelineEffects,
  scopeRoomLifecycleTimeline,
} from '@run-planner/engine/simulation';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';
import { requireWorkspaceRoom as requireRoom } from './catalog-room';
import { workspaceAcquisitionRoleLabel } from './occurrence-reward-assembly';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceEncounterPhase,
  type WorkspaceMarker,
  type WorkspaceRewardControl,
  type WorkspaceRoomActionProposal,
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimeline,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRoomLocal,
  type WorkspaceRoomTab,
  type WorkspaceRoomActionRow,
  type WorkspaceRunStateLauncher,
  type WorkspaceSteadyGrowthControl,
} from '../contract';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { presentRunState } from '../presentation/run-state';

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

function roomActionLabel(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rewardControl: WorkspaceRewardControl | undefined,
  purgingPoolTraitKeyBySlot?: Readonly<Record<'left' | 'middle' | 'right', string | null>>,
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
    case 'purchaseHermesShrineOffer':
      return `Buy Shrine offer ${reference.generationKey}`;
    case 'purchaseStygianWellOffer':
      return `Buy Well offer ${reference.generationKey}`;
    case 'sellPurgingPoolTrait': {
      const traitKey = purgingPoolTraitKeyBySlot?.[reference.slotKey];
      return `Sell ${traitKey === null || traitKey === undefined ? `${reference.slotKey} Pool trait` : (catalog.traits.byKey[traitKey]?.label ?? traitKey)}`;
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
  input: WorkspaceOccurrenceActionsInput,
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

export function assembleOccurrenceActions(
  input: WorkspaceOccurrenceActionAssemblyInput,
): WorkspaceOccurrenceActionAssembly {
  const owner = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const roomActions = roomActionsForOccurrence(
    input,
    input.roomLocal,
    input.encounterPhases,
    input.controls,
  );
  const beforeExitRunState = runStateLauncher(
    input,
    createRoomRunStateCheckpointAddress(owner, { kind: 'beforeRoomExit' }),
    `exiting ${input.roomLabel}`,
  );
  const runStateLaunchers = Object.freeze([
    ...(roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'boundary' && entry.runState !== undefined ? [entry.runState] : [],
    ),
    ...(beforeExitRunState === undefined ? [] : [beforeExitRunState]),
  ]);
  return Object.freeze({
    beforeExitRunState,
    roomActions,
    runStateLaunchers,
    runStateByTab: roomRunStateByTab(input.roomLocal, roomActions, beforeExitRunState),
  });
}

export function roomTabForPhase(roomLocal: WorkspaceRoomLocal, phaseKey: string): WorkspaceRoomTab {
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
  input: WorkspaceOccurrenceActionsInput,
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

export function rewardChildMarkers(control: WorkspaceRewardControl): readonly WorkspaceMarker[] {
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
