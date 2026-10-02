import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  artificerReplacementEntryKey,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  createAcquisitionSiteAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  parseArtificerReplacementEntryKey,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  roomActionKey,
  semanticAddressKey,
  type RoomOccurrence,
  type RoomActionReference,
  type RoomRunStateCheckpointAddress,
  type SemanticAddress,
  type FountainRarityOutcomeAddress,
} from '@run-planner/engine/authored-project';
import type { WorkspaceDerivedAcquisitionEntry } from './occurrence-reward-assembly';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  appendSteadyGrowthTimelineEffects,
  appendTranscendentEmbryoTimelineEffects,
  scopeRoomLifecycleTimeline,
} from '@run-planner/engine/simulation';
import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type { WorkspaceRoomActions, WorkspaceFountainRarityControl } from '../contracts/timeline';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { occurrenceActionLabel } from './occurrence-action-label';
import { projectRoomLifecycleTimeline } from './occurrence-action-timeline-projection';
import type { WorkspaceRoomTab } from '../contracts/navigation';
import type { WorkspaceRunStateLauncher } from '../contracts/run-state';

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
  readonly transcendentEmbryoOutcomes?: readonly import('@run-planner/engine/simulation').BiomeRewardSimulation['transcendentEmbryoOutcomes'][number][];
  readonly fountainRarityAssessment?: (
    address: FountainRarityOutcomeAddress,
    targetTraitKey: string | null | undefined,
  ) =>
    | import('@run-planner/engine/simulation').EvaluatedFountainRarityOutcomeCandidate
    | {
        readonly kind: 'unavailable';
      };
  readonly derivedAcquisitionEntries?: (
    site: import('@run-planner/engine/authored-project').AcquisitionSiteAddress,
  ) => readonly WorkspaceDerivedAcquisitionEntry[];
  readonly stygianWellAssessment?: (
    owner: import('@run-planner/engine/authored-project').OccurrenceAddress,
  ) => import('@run-planner/engine/simulation').StygianWellCandidateCapability | undefined;
}

/** The Phial target control for one fountain use, present only while a target is required. */
export function projectFountainRarityControl(
  outcome: FountainRarityOutcomeAddress,
  targetTraitKey: string | undefined,
  assess: NonNullable<WorkspaceOccurrenceActionsInput['fountainRarityAssessment']>,
  markerDestinations: WorkspaceMarkerDestinationEmitter,
): WorkspaceFountainRarityControl | undefined {
  const evaluated = assess(outcome, targetTraitKey);
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
    marker: markerDestinations.marker(outcome),
    ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
  });
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
  const goldCapability = input
    .derivedAcquisitionEntries?.(createAcquisitionSiteAddress(owner, 'roomExit'))
    .find((entry) => entry.kind === 'echoDoubleShopReward');
  const isGoldPickup = (reference: RoomActionReference) =>
    reference.kind === 'interactAcquisitionEntry' &&
    reference.siteKey === 'roomExit' &&
    reference.entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY;
  const goldNeedsPlacement =
    goldCapability !== undefined && !input.occurrence.roomActions.order.some(isGoldPickup);
  const skippedInteractionKeys = new Set(
    roster.rows.flatMap((row) => {
      if (row.reference.kind !== 'interactEncounter') return [];
      const phase = createEncounterPhaseAddress(
        input.biome,
        { kind: 'occurrence', occurrenceId: input.occurrence.occurrenceId },
        row.reference.phaseKey,
      );
      const status = input.encounterPhaseStatus(phase);
      return status?.kind === 'active' && status.execution === 'skippedByFigLeaf' ? [row.key] : [];
    }),
  );
  const presentedRows = roster.rows.filter(
    (row) =>
      !skippedInteractionKeys.has(row.key) && (!goldNeedsPlacement || !isGoldPickup(row.reference)),
  );
  const presentedActionKeys = new Set(presentedRows.map((row) => row.key));
  const actionLabel = (reference: RoomActionReference): string =>
    allProjectedRows.find((row) => row.key === roomActionKey(reference))?.label ??
    occurrenceActionLabel(
      input.catalog,
      reference,
      roomLocal,
      encounterPhases,
      undefined,
      input.occurrence,
      input.occurrence.purgingPool?.traitKeyBySlot,
      input.evaluatedRoom?.pickupProducers,
    );
  const phaseLabel = (key: string) =>
    (roomLocal.kind === 'ship'
      ? roomLocal.phases.find((phase) => phase.key === key)?.label
      : undefined) ??
    encounterPhases.find((phase) => phase.address.phaseKey === key)?.label ??
    key;
  const wheelPhaseLabel = (key: string) =>
    phaseLabel(
      roster.lifecycleStructure.phases.find((phase) => phase.rewardWheelKey === key)?.phaseKey ??
        key,
    );
  const checkpointLabel = (key: string): string => {
    if (key.startsWith('combat:')) return `${phaseLabel(key.slice('combat:'.length))} complete`;
    if (key.startsWith('nextPhaseUsable:'))
      return `${wheelPhaseLabel(key.slice('nextPhaseUsable:'.length))} is ready to advance`;
    if (key === 'outgoingGeneration') return 'the next rooms are generated';
    if (key === 'exitUsable') return 'the doors can be used';
    return roster.checkpoints.find((entry) => entry.checkpointKey === key)?.label ?? key;
  };
  const windowLabel = (
    window: import('@run-planner/engine/simulation').RoomActionWindow,
  ): string => {
    switch (window.kind) {
      case 'standard':
        return window.phase === 'beforeCombat' ? 'before combat' : 'after combat';
      case 'encounterEnd':
        return `after ${phaseLabel(window.phaseKey)} ends`;
      case 'postOutgoing':
        return 'after the next rooms are generated';
      case 'fields':
        return 'during the Fields room';
      case 'shipPreCombat':
        return `before ${wheelPhaseLabel(window.wheelKey)}`;
      case 'shipPostCombat':
        return `after ${wheelPhaseLabel(window.wheelKey)}`;
    }
  };
  const proposalEntries = roster.proposals
    .filter((proposal) => presentedActionKeys.has(roomActionKey(proposal.reference)))
    .map((proposal, index) => ({
      proposal,
      key: `${proposal.kind}:${index}:${roomActionKey(proposal.reference)}`,
    }));
  const proposalKeysByAction = new Map<string, string[]>();
  for (const entry of proposalEntries) {
    const key = roomActionKey(entry.proposal.reference);
    proposalKeysByAction.set(key, [...(proposalKeysByAction.get(key) ?? []), entry.key]);
  }
  type Blocker = import('@run-planner/engine/simulation').RoomActionProposal['blockers'][number];
  const windowIdentity = (window: import('@run-planner/engine/simulation').RoomActionWindow) => [
    window.kind,
    'phase' in window ? window.phase : null,
    'phaseKey' in window ? window.phaseKey : null,
    'wheelKey' in window ? window.wheelKey : null,
  ];
  const blockerIdentity = (blocker: Blocker): string =>
    JSON.stringify(
      blocker.kind === 'window'
        ? [
            blocker.kind,
            roomActionKey(blocker.reference),
            roomActionKey(blocker.precedingAction),
            windowIdentity(blocker.window),
            windowIdentity(blocker.precedingWindow),
          ]
        : [
            blocker.kind,
            roomActionKey(blocker.reference),
            blocker.dependency.kind,
            blocker.dependency.kind === 'afterAction'
              ? roomActionKey(blocker.dependency.action)
              : blocker.dependency.checkpointKey,
            blocker.checkpointUnavailable === true,
          ],
    );
  const existingBlockers = new Set(
    roster.issues.flatMap((issue) =>
      issue.kind === 'dependency' || issue.kind === 'window' ? [blockerIdentity(issue)] : [],
    ),
  );
  const explanationFor = (
    proposal: import('@run-planner/engine/simulation').RoomActionProposal,
  ): readonly string[] => {
    if (proposal.blockers.length === 0) return Object.freeze([]);
    const proposedKey = roomActionKey(proposal.reference);
    const introduced = proposal.blockers.filter(
      (blocker) => !existingBlockers.has(blockerIdentity(blocker)),
    );
    const candidates = introduced.length > 0 ? introduced : proposal.blockers;
    const concernsProposal = (blocker: Blocker) =>
      roomActionKey(blocker.reference) === proposedKey ||
      (blocker.kind === 'window'
        ? roomActionKey(blocker.precedingAction) === proposedKey
        : blocker.dependency.kind === 'afterAction' &&
          roomActionKey(blocker.dependency.action) === proposedKey);
    const blocker =
      candidates.find((entry) => entry.kind === 'dependency' && concernsProposal(entry)) ??
      candidates.find(concernsProposal) ??
      candidates.find((entry) => entry.kind === 'dependency') ??
      candidates[0]!;
    const label = actionLabel(blocker.reference);
    let explanation: string;
    if (blocker.kind === 'window') {
      const movedPreceding = roomActionKey(blocker.precedingAction) === proposedKey;
      explanation = `${movedPreceding ? actionLabel(blocker.precedingAction) : label} belongs ${windowLabel(movedPreceding ? blocker.precedingWindow : blocker.window)}.`;
    } else if (blocker.dependency.kind === 'afterAction') {
      const prerequisite = blocker.dependency.action;
      const movingDependent = roomActionKey(blocker.reference) === proposedKey;
      const movingPrerequisite = roomActionKey(prerequisite) === proposedKey;
      const artificerEntry =
        blocker.reference.kind === 'interactAcquisitionEntry'
          ? parseArtificerReplacementEntryKey(blocker.reference.entryKey)
          : undefined;
      const prerequisiteControl = allProjectedRows.find(
        (row) => row.key === roomActionKey(prerequisite),
      )?.rewardPayload?.control;
      const artificer =
        artificerEntry !== undefined &&
        prerequisiteControl !== undefined &&
        semanticAddressKey(prerequisiteControl.owner.address) === artificerEntry.sourceKey;
      const cageReward =
        blocker.reference.kind === 'interactLocalReward' &&
        prerequisite.kind === 'completeFieldsCage';
      const cageInteraction =
        (blocker.reference.kind === 'interactEncounter' ||
          blocker.reference.kind === 'interactGorgon') &&
        prerequisite.kind === 'completeFieldsCage';
      const nextCage =
        blocker.reference.kind === 'completeFieldsCage' &&
        (prerequisite.kind === 'interactEncounter' || prerequisite.kind === 'interactGorgon');
      const wheelReward =
        blocker.reference.kind === 'interactWheelReward' &&
        prerequisite.kind === 'chooseRewardWheel';
      if (artificer)
        explanation = `${actionLabel(prerequisite)} first to create ${movingDependent ? 'this reward' : label}.`;
      else if (cageReward)
        explanation = `${actionLabel(prerequisite)} to unlock ${movingDependent ? 'this reward' : label}.`;
      else if (cageInteraction)
        explanation =
          blocker.reference.kind === 'interactGorgon'
            ? `${actionLabel(prerequisite)} to make Athena available.`
            : `${actionLabel(prerequisite)}, then ${label}.`;
      else if (nextCage)
        explanation = `${actionLabel(prerequisite)} before clearing ${blocker.reference.phaseKey}.`;
      else if (wheelReward)
        explanation = `${actionLabel(prerequisite)} before collecting its reward.`;
      else if (movingDependent) explanation = `Requires: ${actionLabel(prerequisite)}.`;
      else if (movingPrerequisite) explanation = `${label} requires this action first.`;
      else explanation = `${label} requires ${actionLabel(prerequisite)} first.`;
    } else if (blocker.checkpointUnavailable === true) {
      explanation = `${label} requires unavailable checkpoint ${blocker.dependency.checkpointKey}.`;
    } else {
      explanation = `${label} must come ${blocker.dependency.kind === 'afterCheckpoint' ? 'after' : 'before'} ${checkpointLabel(blocker.dependency.checkpointKey)}.`;
    }
    return Object.freeze([
      `${introduced.length === 0 ? 'Existing timeline issue: ' : ''}${explanation}`,
    ]);
  };
  const projectProposals = () =>
    proposalEntries.map(({ proposal, key }) =>
      Object.freeze({
        kind: proposal.kind,
        key,
        label:
          proposal.kind === 'remove'
            ? 'Remove from timeline'
            : `${proposal.kind === 'insert' ? 'Insert' : 'Move'} to position ${(proposal.toIndex ?? 0) + 1}`,
        reference: proposal.reference,
        structurallyAuthorable: proposal.structurallyAuthorable,
        explanations: explanationFor(proposal),
        ...(proposal.toIndex === undefined ? {} : { toIndex: proposal.toIndex }),
      }),
    );
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
      const participationOwnedByOverview =
        row.reference.kind === 'interactShopOffer' ||
        row.reference.kind === 'purchaseStygianWellOffer' ||
        row.reference.kind === 'sellPurgingPoolTrait' ||
        (roomLocal.kind === 'shop' &&
          row.reference.kind === 'interactAcquisitionEntry' &&
          row.reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY);
      const fountainRarity =
        row.reference.kind !== 'useFountain' || input.fountainRarityAssessment === undefined
          ? undefined
          : projectFountainRarityControl(
              createFountainRarityOutcomeAddress(address),
              input.occurrence.fountainRarityResult?.targetTraitKey,
              input.fountainRarityAssessment,
              input.markerDestinations,
            );
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
      const stygianWellTwist = (() => {
        if (row.reference.kind !== 'purchaseStygianWellOffer') return undefined;
        const generationKey = row.reference.generationKey;
        const slot = generationKey.startsWith('initial:')
          ? (generationKey.slice('initial:'.length) as 'healing' | 'secondLeft' | 'secondRight')
          : undefined;
        const offerKey =
          generationKey === 'travelDealRefill'
            ? input.occurrence.stygianWell?.travelDealRefillKey
            : slot === undefined
              ? undefined
              : input.occurrence.stygianWell?.offerKeyBySlot[slot];
        const candidateItemKeys =
          input.stygianWellAssessment?.(owner)?.twistCandidateItemKeysByGeneration[generationKey];
        if (offerKey !== 'RandomStoreItem' || candidateItemKeys === undefined) return undefined;
        const featureAddress = createRoomFeatureAddress(owner, {
          kind: 'stygianWellTwist',
          generationKey,
        });
        const marker = input.markerDestinations.marker(featureAddress);
        input.markerDestinations.setRoomTab([marker], 'actions');
        const childKey = generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot!;
        const itemLabelFor = (itemKey: string): string =>
          input.catalog.rewards.shops.byKey.RoomShop?.groups.values
            .flatMap((group) => group.options.values)
            .find((option) => option.key === itemKey)?.label ?? itemKey;
        const itemKey = input.occurrence.stygianWell?.twistResultKeyBySlot?.[childKey] ?? null;
        return Object.freeze({
          address: featureAddress,
          generationKey,
          marker,
          itemKey,
          ...(itemKey === null ? {} : { itemLabel: itemLabelFor(itemKey) }),
          candidateItemKeys,
          candidateItems: Object.freeze(
            candidateItemKeys.map((itemKey) =>
              Object.freeze({ key: itemKey, label: itemLabelFor(itemKey) }),
            ),
          ),
          interactionKey: `stygianWellTwist:${semanticAddressKey(owner)}:${generationKey}`,
        });
      })();
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
          input.occurrence,
          input.occurrence.purgingPool?.traitKeyBySlot,
          input.evaluatedRoom?.pickupProducers,
        ),
        marker: input.markerDestinations.marker(address),
        ...(row.requiredScope === undefined ? {} : { requiredScope: row.requiredScope }),
        proposalKeys: Object.freeze(proposalKeysByAction.get(row.key) ?? []),
        reference: row.reference,
        participation: isGoldPickup(row.reference)
          ? (goldCapability?.participation ?? row.participation)
          : row.participation,
        participationOwnedByOverview,
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
                showOffer:
                  !isArtificerReplacement &&
                  ((row.reference.kind === 'interactLocalReward' && roomLocal.kind !== 'fields') ||
                    (row.reference.kind === 'interactShopOffer' &&
                      resolvedRewardControl.owner.kind === 'acquisitionEntry' &&
                      resolvedRewardControl.offerEditVisibility === 'visible') ||
                    (row.reference.kind === 'interactAcquisitionEntry' &&
                      (!participationOwnedByOverview ||
                        (row.reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY &&
                          resolvedRewardControl.owner.kind === 'acquisitionEntry')) &&
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
        ...(fountainRarity === undefined ? {} : { fountainRarity }),
        ...(stygianWellTwist === undefined ? {} : { stygianWellTwist }),
        executable: row.executable,
      });
    }),
  );
  const dueShrineRows = Object.freeze(
    (
      input.derivedAcquisitionEntries?.(
        createAcquisitionSiteAddress(owner, 'hermesShrineDelivery'),
      ) ?? Object.freeze([])
    ).flatMap((capability) => {
      if (
        capability.kind !== 'hermesShrineDelivery' ||
        projectedRows.some(
          (row) =>
            row.reference.kind === 'interactAcquisitionEntry' &&
            row.reference.siteKey === 'hermesShrineDelivery' &&
            row.reference.entryKey === capability.address.entryKey &&
            row.reference.encounterPhaseKey === capability.encounterPhaseKey,
        )
      )
        return [];
      const reference = Object.freeze({
        kind: 'interactAcquisitionEntry' as const,
        siteKey: 'hermesShrineDelivery' as const,
        entryKey: capability.address.entryKey,
        ...(capability.encounterPhaseKey === undefined
          ? {}
          : { encounterPhaseKey: capability.encounterPhaseKey }),
      });
      const control = controlAt(capability.address);
      const actionAddress = createRoomActionAddress(
        input.biome,
        input.occurrence.occurrenceId,
        roomActionKey(reference),
      );
      return [
        Object.freeze({
          address: actionAddress,
          issues: Object.freeze(['This required action has not been placed.']),
          key: roomActionKey(reference),
          label: occurrenceActionLabel(
            input.catalog,
            reference,
            roomLocal,
            encounterPhases,
            control,
            input.occurrence,
            input.occurrence.purgingPool?.traitKeyBySlot,
            input.evaluatedRoom?.pickupProducers,
          ),
          marker: input.markerDestinations.marker(actionAddress),
          proposalKeys: Object.freeze([]),
          reference,
          participation: 'required' as const,
          participationOwnedByOverview: false,
          placement: Object.freeze({
            command: Object.freeze({
              kind: 'PlaceHermesShrineDelivery' as const,
              entry: capability.address,
              ...(capability.encounterPhaseKey === undefined
                ? {}
                : { encounterPhaseKey: capability.encounterPhaseKey }),
            }),
            focus: Object.freeze({ owner: actionAddress, timing: 'after' as const }),
          }),
          rank: null,
          stale: false,
          window:
            capability.encounterPhaseKey === undefined
              ? Object.freeze({ kind: 'postOutgoing' as const })
              : Object.freeze({
                  kind: 'encounterEnd' as const,
                  phaseKey: capability.encounterPhaseKey,
                }),
          executable: false,
        }),
      ];
    }),
  );
  const clockedTraitPickupRows = Object.freeze(
    (
      input.derivedAcquisitionEntries?.(createAcquisitionSiteAddress(owner, 'roomExit')) ??
      Object.freeze([])
    ).flatMap((capability) => {
      const rewardType = capability.rewardTypes?.[0];
      if (
        capability.kind !== 'clockedTraitPickup' ||
        capability.encounterPhaseKey === undefined ||
        capability.producerLifecycleKey === undefined ||
        capability.rewardTypes?.length !== 1 ||
        rewardType === undefined ||
        projectedRows.some(
          (row) =>
            row.reference.kind === 'interactAcquisitionEntry' &&
            row.reference.siteKey === 'roomExit' &&
            row.reference.entryKey === capability.address.entryKey,
        )
      )
        return [];
      const reference = Object.freeze({
        kind: 'interactAcquisitionEntry' as const,
        siteKey: 'roomExit',
        entryKey: capability.address.entryKey,
        encounterPhaseKey: capability.encounterPhaseKey,
      });
      const control = controlAt(capability.address);
      const actionAddress = createRoomActionAddress(
        input.biome,
        input.occurrence.occurrenceId,
        roomActionKey(reference),
      );
      return [
        Object.freeze({
          address: actionAddress,
          issues: Object.freeze([]),
          key: roomActionKey(reference),
          label: occurrenceActionLabel(
            input.catalog,
            reference,
            roomLocal,
            encounterPhases,
            control,
            input.occurrence,
            input.occurrence.purgingPool?.traitKeyBySlot,
            input.evaluatedRoom?.pickupProducers,
          ),
          marker: input.markerDestinations.marker(actionAddress),
          proposalKeys: Object.freeze([]),
          reference,
          participation: 'optional' as const,
          participationOwnedByOverview: false,
          placement: Object.freeze({
            command: Object.freeze({
              kind: 'PlaceClockedTraitPickup' as const,
              entry: capability.address,
              encounterPhaseKey: capability.encounterPhaseKey,
              producerLifecycleKey: capability.producerLifecycleKey,
              rewardType,
            }),
            focus: Object.freeze({ owner: actionAddress, timing: 'after' as const }),
          }),
          rank: null,
          stale: false,
          window: Object.freeze({
            kind: 'encounterEnd' as const,
            phaseKey: capability.encounterPhaseKey,
          }),
          executable: false,
        }),
      ];
    }),
  );
  const goldPickupRows =
    goldNeedsPlacement && goldCapability?.sourceOfferKey !== undefined
      ? (() => {
          const reference = Object.freeze({
            kind: 'interactAcquisitionEntry' as const,
            siteKey: 'roomExit',
            entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          });
          const actionAddress = createRoomActionAddress(
            input.biome,
            input.occurrence.occurrenceId,
            roomActionKey(reference),
          );
          const required = goldCapability.participation === 'required';
          const control = controlAt(goldCapability.address);
          return [
            Object.freeze({
              address: actionAddress,
              issues: Object.freeze(required ? ['This required action has not been placed.'] : []),
              key: roomActionKey(reference),
              label: occurrenceActionLabel(
                input.catalog,
                reference,
                roomLocal,
                encounterPhases,
                controlAt(goldCapability.address),
                input.occurrence,
                input.occurrence.purgingPool?.traitKeyBySlot,
                input.evaluatedRoom?.pickupProducers,
              ),
              marker: input.markerDestinations.marker(actionAddress),
              proposalKeys: Object.freeze([]),
              reference,
              participation: required ? ('required' as const) : ('optional' as const),
              participationOwnedByOverview: false,
              ...(control === undefined
                ? {}
                : {
                    rewardPayload: Object.freeze({
                      control,
                      inlineLevelResolutions: Object.freeze([]),
                      inlineTraitOffers: Object.freeze([]),
                      showOffer: false,
                    }),
                  }),
              placement: Object.freeze({
                command: Object.freeze({
                  kind: 'PlaceEchoGoldPickup' as const,
                  site: goldCapability.address.site,
                  entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
                  sourceOfferKey: goldCapability.sourceOfferKey,
                }),
                focus: Object.freeze({ owner: actionAddress, timing: 'after' as const }),
              }),
              rank: null,
              stale: false,
              window: Object.freeze({ kind: 'postOutgoing' as const }),
              executable: false,
            }),
          ];
        })()
      : [];
  const allProjectedRows: WorkspaceRoomActions['rows'] = Object.freeze([
    ...projectedRows,
    ...dueShrineRows,
    ...clockedTraitPickupRows,
    ...goldPickupRows,
  ]);
  const unrankedOrStaleRows = Object.freeze(
    lifecycleTimeline.repairRows.flatMap(({ key }) => {
      if (skippedInteractionKeys.has(key)) return [];
      const projected = allProjectedRows.find((row) => row.key === key);
      if (projected === undefined) {
        throw new Error(`Room action timeline repair row ${key} has no projected row`);
      }
      return projected === undefined || goldPickupRows.some((row) => row.key === key)
        ? []
        : [projected];
    }),
  );
  const optionalRows = Object.freeze([
    ...unrankedOrStaleRows.filter(
      (row) =>
        row.rank === null &&
        !row.stale &&
        row.participation === 'optional' &&
        !row.participationOwnedByOverview,
    ),
    ...clockedTraitPickupRows,
    ...goldPickupRows.filter((row) => row.participation === 'optional'),
  ]);
  const optionalKeys = new Set(optionalRows.map((row) => row.key));
  const repairRows = Object.freeze([
    ...unrankedOrStaleRows.filter(
      (row) => !optionalKeys.has(row.key) && (!row.participationOwnedByOverview || row.stale),
    ),
    ...dueShrineRows,
    ...goldPickupRows.filter((row) => row.participation === 'required'),
  ]);
  const steadyGrowthOutcomes = (input.steadyGrowthOutcomes ?? []).filter(
    (outcome) => semanticAddressKey(outcome.address.owner) === semanticAddressKey(owner),
  );
  const transcendentEmbryoOutcomes = (input.transcendentEmbryoOutcomes ?? []).filter(
    (outcome) => semanticAddressKey(outcome.address.owner) === semanticAddressKey(owner),
  );
  const activeLifecycleTimeline = scopeRoomLifecycleTimeline(
    appendTranscendentEmbryoTimelineEffects(
      appendSteadyGrowthTimelineEffects(
        {
          ...lifecycleTimeline,
          entries: lifecycleTimeline.entries.filter(
            (entry) => entry.kind !== 'action' || !skippedInteractionKeys.has(entry.action.key),
          ),
        },
        steadyGrowthOutcomes.map((outcome) => outcome.address),
      ),
      transcendentEmbryoOutcomes.map((outcome) => outcome.address),
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
      if (entry.kind !== 'automaticEffect' || entry.effect !== 'steadyGrowth') return [];
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
  const transcendentEmbryoOutcomeByAddress = new Map(
    transcendentEmbryoOutcomes.map(
      (outcome) => [semanticAddressKey(outcome.address), outcome] as const,
    ),
  );
  const transcendentEmbryo = Object.freeze(
    activeLifecycleTimeline.entries.flatMap((entry) => {
      if (entry.kind !== 'automaticEffect' || entry.effect !== 'transcendentEmbryo') return [];
      const outcome = transcendentEmbryoOutcomeByAddress.get(semanticAddressKey(entry.address));
      if (outcome === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(entry.address)} has no Transcendent Embryo outcome metadata`,
        );
      }
      return [
        Object.freeze({
          address: outcome.address,
          marker: input.markerDestinations.marker(outcome.address),
          phaseKey: outcome.phaseKey,
          ...(input.occurrence.encounters.transcendentEmbryoBlessingByPhase?.[outcome.phaseKey] ===
          undefined
            ? {}
            : {
                value:
                  input.occurrence.encounters.transcendentEmbryoBlessingByPhase[outcome.phaseKey],
              }),
        }),
      ];
    }),
  );
  const proposals = projectProposals();
  const projectedTimeline = projectRoomLifecycleTimeline(
    input,
    activeLifecycleTimeline,
    roomLocal,
    encounterPhases,
    allProjectedRows,
    steadyGrowth,
    transcendentEmbryo,
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
    rows: allProjectedRows,
    ...(steadyGrowth.length === 0 ? {} : { steadyGrowth }),
    ...(transcendentEmbryo.length === 0 ? {} : { transcendentEmbryo }),
  });
}

export { roomActionsForOccurrence };
