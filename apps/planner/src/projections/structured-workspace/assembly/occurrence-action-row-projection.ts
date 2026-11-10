import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  createAcquisitionSiteAddress,
  createRoomActionAddress,
  createInfernalContractPedestalAddress,
  createShopOfferAddress,
  roomActionKey,
  semanticAddressKey,
  sitesWithNemesisResultPickups,
  stygianWellGenerationItemKey,
  stygianWellGenerationTwistResultKey,
  type EncounterPhaseAddress,
  type OccurrenceAddress,
  type RoomOccurrence,
  type RoomActionReference,
  type RoomActionSemanticAddress,
  type RoomRunStateCheckpointAddress,
  type SemanticAddress,
  type FountainRarityOutcomeAddress,
} from '@run-planner/engine/authored-project';
import { requiredFirstTitle } from '@planner/projections/walkStopCopy';
import type { WorkspaceDerivedAcquisitionEntry } from './occurrence-reward-assembly';
import { observedChallengeSwitchKind } from './challenge-switch-assembly';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  appendSteadyGrowthTimelineEffects,
  appendTranscendentEmbryoTimelineEffects,
  scopeRoomLifecycleTimeline,
} from '@run-planner/engine/simulation';
import type {
  GoldAmount,
  GoldEstimate,
  GoldFightSummary,
  GoldRowSummary,
  GoldLedger,
  GoldMoments,
  RoomActionRow,
} from '@run-planner/engine/simulation';
import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type {
  WorkspaceFightGold,
  WorkspaceGoldAmount,
  WorkspacePurchaseAffordability,
  WorkspaceRoomActionRow,
  WorkspaceRoomActions,
  WorkspaceFountainRarityControl,
} from '../contracts/timeline';
import type { WorkspaceRoomFeature } from '../contracts/features';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import {
  occurrenceActionAddGroup,
  occurrenceActionLabel,
  occurrenceActionLabelParts,
} from './occurrence-action-label';
import { assembleFeatureRerollSlots } from './feature-roll-assembly';
import {
  projectRoomLifecycleTimeline,
  splitAtRoomStop,
} from './occurrence-action-timeline-projection';
import { projectSpawnedLoot } from './occurrence-spawned-loot-projection';
import type { WorkspaceRoomTab } from '../contracts/navigation';
import type { WorkspaceRunStateLauncher } from '../contracts/run-state';

export interface WorkspaceOccurrenceActionsInput {
  readonly roomActionPlacementRoster: (
    owner: import('@run-planner/engine/authored-project').OccurrenceAddress,
    roster: import('@run-planner/engine/simulation').RoomActionRoster,
  ) => import('@run-planner/engine/simulation').RoomActionRoster;
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
  readonly fountainRarityOutcome?: import('../source-index').WorkspaceBiomeSource['fountainRarityOutcome'];
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
  readonly purgingPoolAssessment?: (
    owner: import('@run-planner/engine/authored-project').OccurrenceAddress,
  ) => import('@run-planner/engine/simulation').PurgingPoolCandidateCapability | undefined;
  readonly gold?: import('@run-planner/engine/simulation').GoldLedger;
  /** Engine-published Timeline rows of the product this room's assessment stops at. */
  readonly blockingRowKeys?: ReadonlySet<string>;
  /** Where the walk stopped inside this room, when the assessment blocks in it. */
  readonly roomStop?: import('../source-index').WorkspaceRoomStop;
  readonly rerollTargetLabel?: import('./occurrence-action-label').WorkspaceDoorRerollTargetLabel;
  /** The loot the room spawns on its own, by moment and source action. */
  readonly spawnedLoot?: import('@run-planner/engine/simulation').RoomSpawnedLoot;
  /** Each phase's Encounter outcome that hosts a choice. */
  readonly encounterOutcomes?: readonly import('@run-planner/engine/simulation').EncounterOutcome[];
}

/** The Phial target control for one fountain use; pending until the engine requires a target. */
export function projectFountainRarityControl(
  outcome: FountainRarityOutcomeAddress,
  targetTraitKey: string | undefined,
  assess: WorkspaceOccurrenceActionsInput['fountainRarityAssessment'],
  settled: WorkspaceOccurrenceActionsInput['fountainRarityOutcome'],
  markerDestinations: WorkspaceMarkerDestinationEmitter,
): WorkspaceFountainRarityControl {
  const evaluated = assess?.(outcome, targetTraitKey);
  const settledOutcome = settled?.(outcome);
  const pending =
    evaluated?.kind !== 'fountainRarityOutcome'
      ? 'unreached'
      : evaluated.result.status !== 'pending'
        ? 'noPhial'
        : !evaluated.result.targetRequired || evaluated.result.mutationTargetKeys.length === 0
          ? 'noTargetRequired'
          : undefined;
  return Object.freeze<WorkspaceFountainRarityControl>({
    address: outcome,
    marker: markerDestinations.marker(outcome),
    ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
    ...(settledOutcome === undefined || settledOutcome.targetTraitKey !== targetTraitKey
      ? {}
      : {
          settledRarity: Object.freeze({
            before: settledOutcome.rarityBefore,
            after: settledOutcome.rarityAfter,
          }),
        }),
    ...(pending === undefined ? {} : { pending }),
  });
}

export interface WorkspaceOccurrenceActionAssemblyInput extends WorkspaceOccurrenceActionsInput {
  readonly controls: readonly WorkspaceRewardControl[];
  readonly encounterPhases: readonly WorkspaceEncounterPhase[];
  /** Room features whose refill inventory is authored on purchase rows. */
  readonly features: readonly WorkspaceRoomFeature[];
  readonly roomLabel: string;
  readonly roomLocal: WorkspaceRoomLocal;
}

export interface WorkspaceOccurrenceActionAssembly {
  readonly roomActions: WorkspaceRoomActions | undefined;
  readonly runStateLaunchers: readonly WorkspaceRunStateLauncher[];
  readonly runStateByTab: Readonly<Partial<Record<WorkspaceRoomTab, WorkspaceRunStateLauncher>>>;
}
function roomActionsForOccurrence(
  input: WorkspaceOccurrenceActionsInput,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  controls: readonly WorkspaceRewardControl[],
  features: readonly WorkspaceRoomFeature[],
): WorkspaceRoomActions | undefined {
  const evaluatedRoster = input.evaluatedRoom?.roomActionRoster;
  const roster =
    evaluatedRoster === undefined
      ? undefined
      : input.roomActionPlacementRoster(
          createOccurrenceAddress(input.biome, input.occurrence.occurrenceId),
          evaluatedRoster,
        );
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
  const isGoldPickup = (row: Pick<RoomActionRow, 'sourceFamily'>) =>
    row.sourceFamily?.kind === 'echo' && row.sourceFamily.effect === 'doubleShop';
  const goldNeedsPlacement = goldCapability !== undefined && !roster.rows.some(isGoldPickup);
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
    (row) => !skippedInteractionKeys.has(row.key) && (!goldNeedsPlacement || !isGoldPickup(row)),
  );
  const presentedActionKeys = new Set(presentedRows.map((row) => row.key));
  const goldGains = roomGoldGains(input.gold, owner);
  const fightGold = roomFightGold(input.gold, owner);
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
      undefined,
      input.rerollTargetLabel,
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
  const requiredKeys = new Set(
    roster.rows.flatMap((row) => (row.participation === 'required' ? [row.key] : [])),
  );
  const proposalEntries = roster.proposals
    .filter((proposal) => presentedActionKeys.has(roomActionKey(proposal.reference)))
    // A missing required action restores at its canonical position.
    .filter(
      (proposal) =>
        proposal.kind !== 'insert' ||
        proposal.canonical === true ||
        !requiredKeys.has(roomActionKey(proposal.reference)),
    )
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
        : blocker.kind === 'requiredFirst'
          ? [
              blocker.kind,
              roomActionKey(blocker.reference),
              roomActionKey(blocker.requiredAction),
              windowIdentity(blocker.window),
              windowIdentity(blocker.requiredWindow),
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
      issue.kind === 'dependency' || issue.kind === 'window' || issue.kind === 'requiredFirst'
        ? [blockerIdentity(issue)]
        : [],
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
        : blocker.kind === 'requiredFirst'
          ? roomActionKey(blocker.requiredAction) === proposedKey
          : blocker.dependency.kind === 'afterAction' &&
            roomActionKey(blocker.dependency.action) === proposedKey);
    // The most direct blockers first: what must precede the moved action, then its window.
    const rank = (entry: Blocker) =>
      (concernsProposal(entry) ? 0 : 2) + (entry.kind === 'window' ? 1 : 0);
    const ranked = [...candidates].sort((left, right) => rank(left) - rank(right));
    const prefix = introduced.length === 0 ? 'Existing timeline issue: ' : '';
    return Object.freeze(
      [
        ...new Set(ranked.map((blocker) => `${prefix}${blockerSentence(blocker, proposedKey)}`)),
      ].slice(0, 2),
    );
  };
  const blockerSentence = (blocker: Blocker, proposedKey: string): string => {
    const label = actionLabel(blocker.reference);
    let explanation: string;
    if (blocker.kind === 'window') {
      const movedPreceding = roomActionKey(blocker.precedingAction) === proposedKey;
      explanation = `${movedPreceding ? actionLabel(blocker.precedingAction) : label} belongs ${windowLabel(movedPreceding ? blocker.precedingWindow : blocker.window)}.`;
    } else if (blocker.kind === 'requiredFirst') {
      explanation = `${requiredFirstTitle(actionLabel(blocker.requiredAction))}.`;
    } else if (blocker.dependency.kind === 'afterAction') {
      const prerequisite = blocker.dependency.action;
      const movingDependent = roomActionKey(blocker.reference) === proposedKey;
      const movingPrerequisite = roomActionKey(prerequisite) === proposedKey;
      // An Artificer replacement depends on the reward it converts.
      const artificerSource = allProjectedRows.find(
        (row) => row.key === roomActionKey(prerequisite),
      );
      const artificer =
        roster.rows.find((row) => row.key === roomActionKey(blocker.reference))?.sourceFamily
          ?.kind === 'artificer' && artificerSource?.rewardPayload !== undefined;
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
        // The source reads as the transformation its verb now names.
        explanation = `${artificerSource?.labelParts === undefined ? actionLabel(prerequisite) : `Transform ${artificerSource.labelParts.name}`} first to create ${movingDependent ? 'this reward' : label}.`;
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
      explanation = `${label} requires a checkpoint this room cannot reach: ${checkpointLabel(blocker.dependency.checkpointKey)}.`;
    } else {
      explanation = `${label} must come ${blocker.dependency.kind === 'afterCheckpoint' ? 'after' : 'before'} ${checkpointLabel(blocker.dependency.checkpointKey)}.`;
    }
    return explanation;
  };
  const projectProposals = () =>
    proposalEntries.map(({ proposal, key }) =>
      Object.freeze({
        kind: proposal.kind,
        key,
        label:
          proposal.kind === 'unplace'
            ? 'Unplace delivery'
            : proposal.kind === 'remove'
              ? 'Remove from timeline'
              : `${proposal.kind === 'insert' ? 'Insert' : 'Move'} to position ${(proposal.toIndex ?? 0) + 1}`,
        reference: proposal.reference,
        structurallyAuthorable: proposal.structurallyAuthorable,
        explanations: explanationFor(proposal),
        ...(proposal.toIndex === undefined ? {} : { toIndex: proposal.toIndex }),
        ...(proposal.anchorIndex === undefined ? {} : { anchorIndex: proposal.anchorIndex }),
      }),
    );
  const controlAt = (address: SemanticAddress): WorkspaceRewardControl | undefined =>
    controls.find(
      (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(address),
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
  const purchaseRowProducts = shopPurchaseRowProducts(input, roomLocal, features);
  // A Nemesis result's collect names what her outcome spawns, not her offer.
  const pickupSites = sitesWithNemesisResultPickups(
    input.catalog,
    input.occurrence,
    input.biome.routeKey,
  );
  const labelOccurrence =
    pickupSites === input.occurrence.acquisitionSites || pickupSites === undefined
      ? input.occurrence
      : Object.freeze({ ...input.occurrence, acquisitionSites: pickupSites });
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
      // Object purchases and collects are added from their entry and removed on their rows.
      const participationOwnedByOverview = row.reference.kind === 'interactKeepsakeRack';
      const fountainRarity =
        row.reference.kind !== 'useFountain'
          ? undefined
          : projectFountainRarityControl(
              createFountainRarityOutcomeAddress(address),
              input.occurrence.fountainRarityResult?.targetTraitKey,
              input.fountainRarityAssessment,
              input.fountainRarityOutcome,
              input.markerDestinations,
            );
      const artificerConversion = resolvedRewardControl?.conversions?.find(
        (conversion) => conversion.value.kind === 'artificer',
      );
      const artificerOutput =
        artificerConversion === undefined
          ? undefined
          : (() => {
              // The engine names the replacement's family and makes it follow its source.
              const replacementRow = presentedRows.find(
                (candidate) =>
                  candidate.sourceFamily?.kind === 'artificer' &&
                  candidate.dependencies.some(
                    (dependency) =>
                      dependency.kind === 'afterAction' &&
                      roomActionKey(dependency.action) === row.key,
                  ),
              );
              if (replacementRow === undefined) return undefined;
              return controlAt(replacementRow.owner);
            })();
      const isArtificerReplacement = row.sourceFamily?.kind === 'artificer';
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
        const offerKey = stygianWellGenerationItemKey(input.occurrence, generationKey);
        const candidateItemKeys =
          input.stygianWellAssessment?.(owner)?.twistCandidateItemKeysByGeneration[generationKey];
        if (offerKey !== 'RandomStoreItem' || candidateItemKeys === undefined) return undefined;
        const featureAddress = createRoomFeatureAddress(owner, {
          kind: 'stygianWellTwist',
          generationKey,
        });
        const marker = input.markerDestinations.marker(featureAddress);
        input.markerDestinations.setRoomTab([marker], 'actions');
        const itemLabelFor = (itemKey: string): string =>
          input.catalog.rewards.shops.byKey.RoomShop?.groups.values
            .flatMap((group) => group.options.values)
            .find((option) => option.key === itemKey)?.label ?? itemKey;
        const itemKey =
          stygianWellGenerationTwistResultKey(input.occurrence, generationKey) ?? null;
        const well = features.find(
          (feature): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'stygianWell' }> =>
            feature.kind === 'stygianWell',
        );
        const boughtSlot =
          well?.slots.find((slot) => slot.generationKey === generationKey) ??
          (well?.travelDealRefill?.generationKey === generationKey
            ? well.travelDealRefill
            : undefined);
        return Object.freeze({
          address: featureAddress,
          generationKey,
          ...(boughtSlot === undefined ? {} : { boughtSlot }),
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
      const sourceFamily = row.sourceFamily;
      const labelParts = occurrenceActionLabelParts(
        input.catalog,
        row.reference,
        roomLocal,
        encounterPhases,
        resolvedRewardControl,
        labelOccurrence,
        input.occurrence.purgingPool?.traitKeyBySlot,
        sourceFamily,
        input.rerollTargetLabel,
        input.evaluatedRoom?.requiredReward,
      );
      const challengeSwitchKind =
        row.reference.kind === 'interactChallengeSwitch'
          ? observedChallengeSwitchKind(input.catalog, input.occurrence)
          : undefined;
      return Object.freeze({
        address,
        key: row.key,
        label: labelParts.label,
        addGroup: occurrenceActionAddGroup(input.catalog, row.reference, roomLocal, sourceFamily),
        ...(sourceFamily === undefined ? {} : { sourceFamily }),
        ...(challengeSwitchKind === undefined ? {} : { challengeSwitchKind }),
        ...(labelParts.slot === undefined ? {} : { slot: labelParts.slot }),
        ...(labelParts.roll === undefined ? {} : { roll: labelParts.roll }),
        ...(labelParts.travelDeal === undefined
          ? {}
          : {
              travelDeal: labelParts.travelDeal,
              shownLabel: labelParts.shownLabel ?? labelParts.label,
            }),
        ...(labelParts.name === undefined
          ? {}
          : {
              labelParts: Object.freeze({
                name: labelParts.name,
                ...(labelParts.verb === undefined ? {} : { verb: labelParts.verb }),
                ...(labelParts.suffix === undefined ? {} : { tag: labelParts.suffix }),
                ...(labelParts.place === undefined ? {} : { place: labelParts.place }),
                ...(labelParts.origin === undefined ? {} : { origin: labelParts.origin }),
                ...(labelParts.npcKey === undefined ? {} : { npcKey: labelParts.npcKey }),
                ...(labelParts.traitKey === undefined ? {} : { traitKey: labelParts.traitKey }),
                ...(labelParts.object === undefined ? {} : { object: labelParts.object }),
                ...(labelParts.reward === undefined ? {} : { reward: labelParts.reward }),
              }),
            }),
        marker: input.markerDestinations.marker(address),
        ...(row.requiredScope === undefined ? {} : { requiredScope: row.requiredScope }),
        proposalKeys: Object.freeze(proposalKeysByAction.get(row.key) ?? []),
        reference: row.reference,
        participation: isGoldPickup(row)
          ? (goldCapability?.participation ?? row.participation)
          : row.participation,
        participationOwnedByOverview,
        rank: row.rank,
        ...(row.stale || artificerOutput === undefined
          ? {}
          : {
              artificerOutput: Object.freeze({
                control: artificerOutput,
                label: 'Item' as const,
              }),
            }),
        ...(row.stale ||
        row.placementAssessment?.kind === 'invalid' ||
        resolvedRewardControl === undefined
          ? {}
          : {
              rewardPayload: Object.freeze({
                control: resolvedRewardControl,
                inlineLevelResolutions,
                inlineTraitOffers,
                showOffer:
                  !isArtificerReplacement &&
                  ((row.reference.kind === 'interactLocalReward' && roomLocal.kind !== 'fields') ||
                    ((row.reference.kind === 'interactShopOffer' ||
                      row.reference.kind === 'interactInfernalContractPedestal') &&
                      resolvedRewardControl.owner.kind === 'acquisitionEntry' &&
                      resolvedRewardControl.offerEditVisibility === 'visible') ||
                    (row.reference.kind === 'interactAcquisitionEntry' &&
                      // The Shop's Travel Deal item is authored on its line unless resolved here.
                      (sourceFamily?.kind !== 'shopTravelDealRefill' ||
                        resolvedRewardControl.owner.kind === 'acquisitionEntry') &&
                      resolvedRewardControl.offerEditVisibility === 'visible')),
              }),
            }),
        ...(row.placementAssessment === undefined
          ? {}
          : { placementAssessment: row.placementAssessment }),
        stale: row.stale,
        window: row.window,
        ...(row.stale || traitOffer === undefined ? {} : { traitOffer }),
        ...(fountainRarity === undefined ? {} : { fountainRarity }),
        ...(stygianWellTwist === undefined ? {} : { stygianWellTwist }),
        ...(row.reference.kind === 'rerollStygianWell' || row.reference.kind === 'rerollPurgingPool'
          ? {
              featureRoll: assembleFeatureRerollSlots({
                catalog: input.catalog,
                markerDestinations: input.markerDestinations,
                owner,
                occurrence: input.occurrence,
                reroll: row.reference,
                wellCapability: input.stygianWellAssessment?.(owner),
                poolCapability: input.purgingPoolAssessment?.(owner),
              }),
            }
          : {}),
        ...purchaseRowProducts(row.reference, address, sourceFamily),
        ...purchaseGold(input.gold, row.owner),
        ...rowGoldGain(goldGains, address),
        ...rowFightGold(fightGold, address),
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
            (row.reference.encounterPhaseKey === capability.encounterPhaseKey ||
              row.placementAssessment?.kind === 'invalid'),
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
          key: roomActionKey(reference),
          addGroup: occurrenceActionAddGroup(
            input.catalog,
            reference,
            roomLocal,
            capability.sourceFamily,
          ),
          label: occurrenceActionLabel(
            input.catalog,
            reference,
            roomLocal,
            encounterPhases,
            control,
            input.occurrence,
            input.occurrence.purgingPool?.traitKeyBySlot,
            capability.sourceFamily,
          ),
          marker: input.markerDestinations.marker(actionAddress),
          proposalKeys: Object.freeze([]),
          reference,
          participation: 'required' as const,
          participationOwnedByOverview: false,
          ...(capability.sourceFamily === undefined
            ? {}
            : { sourceFamily: capability.sourceFamily }),
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
      const labelParts = occurrenceActionLabelParts(
        input.catalog,
        reference,
        roomLocal,
        encounterPhases,
        control,
        input.occurrence,
        input.occurrence.purgingPool?.traitKeyBySlot,
        capability.sourceFamily,
      );
      return [
        Object.freeze({
          address: actionAddress,
          key: roomActionKey(reference),
          addGroup: occurrenceActionAddGroup(
            input.catalog,
            reference,
            roomLocal,
            capability.sourceFamily,
          ),
          label: labelParts.label,
          // Its one reward type names and shows the drop before it is placed.
          ...(labelParts.name === undefined
            ? {}
            : {
                labelParts: Object.freeze({
                  name: labelParts.name,
                  ...(labelParts.verb === undefined ? {} : { verb: labelParts.verb }),
                  ...(labelParts.origin === undefined ? {} : { origin: labelParts.origin }),
                  reward: Object.freeze({
                    offer: Object.freeze({ rewardType }),
                    boosted: false,
                  }),
                }),
              }),
          marker: input.markerDestinations.marker(actionAddress),
          proposalKeys: Object.freeze([]),
          reference,
          participation: 'optional' as const,
          participationOwnedByOverview: false,
          ...(capability.sourceFamily === undefined
            ? {}
            : { sourceFamily: capability.sourceFamily }),
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
            siteKey: goldCapability.address.site.pointKey,
            entryKey: goldCapability.address.entryKey,
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
              key: roomActionKey(reference),
              addGroup: occurrenceActionAddGroup(
                input.catalog,
                reference,
                roomLocal,
                goldCapability.sourceFamily,
              ),
              label: occurrenceActionLabel(
                input.catalog,
                reference,
                roomLocal,
                encounterPhases,
                controlAt(goldCapability.address),
                input.occurrence,
                input.occurrence.purgingPool?.traitKeyBySlot,
                goldCapability.sourceFamily,
              ),
              marker: input.markerDestinations.marker(actionAddress),
              proposalKeys: Object.freeze([]),
              reference,
              participation: required ? ('required' as const) : ('optional' as const),
              participationOwnedByOverview: false,
              ...(goldCapability.sourceFamily === undefined
                ? {}
                : { sourceFamily: goldCapability.sourceFamily }),
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
  const allProjectedRows: WorkspaceRoomActions['rows'] = Object.freeze(
    [...projectedRows, ...dueShrineRows, ...clockedTraitPickupRows, ...goldPickupRows].map((row) =>
      input.blockingRowKeys?.has(row.key) === true
        ? Object.freeze({ ...row, blockingProduct: true as const })
        : row,
    ),
  );
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
  const unplacedOptionalRows = Object.freeze([
    ...unrankedOrStaleRows.filter(
      (row) =>
        row.rank === null &&
        !row.stale &&
        row.participation === 'optional' &&
        !row.participationOwnedByOverview &&
        !addedFromEntry(row),
    ),
    ...clockedTraitPickupRows,
    ...goldPickupRows.filter((row) => row.participation === 'optional'),
  ]);
  const optionalKeys = new Set(unplacedOptionalRows.map((row) => row.key));
  const repairRows = Object.freeze([
    ...unrankedOrStaleRows.filter(
      (row) =>
        !optionalKeys.has(row.key) &&
        (row.stale ||
          (!row.participationOwnedByOverview && !(row.rank === null && addedFromEntry(row)))),
    ),
    ...dueShrineRows,
    ...goldPickupRows.filter((row) => row.participation === 'required'),
  ]);
  // The engine places each published outcome at its landing; this room keeps only its own.
  const steadyGrowthOutcomes = input.steadyGrowthOutcomes ?? [];
  const transcendentEmbryoOutcomes = input.transcendentEmbryoOutcomes ?? [];
  const activeLifecycleTimeline = scopeRoomLifecycleTimeline(
    appendTranscendentEmbryoTimelineEffects(
      appendSteadyGrowthTimelineEffects(
        {
          ...lifecycleTimeline,
          entries: lifecycleTimeline.entries.filter(
            (entry) => entry.kind !== 'action' || !skippedInteractionKeys.has(entry.action.key),
          ),
        },
        steadyGrowthOutcomes,
      ),
      transcendentEmbryoOutcomes,
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
          sourceTraitKey: outcome.sourceTraitKey,
          ...(outcome.targetTraitKey === undefined
            ? {}
            : { targetTraitKey: outcome.targetTraitKey }),
          ...(outcome.targetTraitKey === undefined ||
          outcome.rarityBefore === undefined ||
          outcome.rarityAfter === undefined
            ? {}
            : {
                settledRarity: Object.freeze({
                  before: outcome.rarityBefore,
                  after: outcome.rarityAfter,
                }),
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
          ...(outcome.value === undefined ? {} : { value: outcome.value }),
        }),
      ];
    }),
  );
  const proposals = projectProposals();
  const projectedTimeline = projectRoomLifecycleTimeline(
    input,
    activeLifecycleTimeline,
    roster.issues,
    roomLocal,
    encounterPhases,
    allProjectedRows,
    steadyGrowth,
    transcendentEmbryo,
  );
  const spawned = projectSpawnedLoot(
    input.catalog,
    input.spawnedLoot,
    projectedTimeline.entries,
    allProjectedRows,
    proposals,
    roomLocal,
  );
  // Spawned loot is placed from its spawn row, where that row is shown.
  const shownRowKeys = new Set(
    spawned.entries.flatMap((entry) =>
      entry.kind === 'action' && entry.presentation === 'row' ? [entry.actionKey] : [],
    ),
  );
  const spawnPlacedKeys = new Set([
    ...[
      ...spawned.entries.flatMap((entry) => (entry.kind === 'spawned' ? entry.groups : [])),
      ...spawned.actionSpawns.flatMap((spawn) =>
        shownRowKeys.has(spawn.sourceActionKey) ? spawn.groups : [],
      ),
    ].flatMap((group) => group.items.map((item) => item.actionKey)),
    ...spawned.copies.flatMap((copy) =>
      shownRowKeys.has(copy.sourceActionKey) ? [copy.item.actionKey] : [],
    ),
  ]);
  const optionalRows = Object.freeze(
    unplacedOptionalRows.filter((row) => !spawnPlacedKeys.has(row.key)),
  );
  // The Timeline ends where the room's walk stops; what spawns past it is not yet shown.
  const stop = splitAtRoomStop(spawned.entries, lifecycleTimeline.entries, input);
  return Object.freeze({
    timeline: Object.freeze({
      ...projectedTimeline,
      entries: stop?.reached ?? spawned.entries,
      ...(stop === undefined ? {} : { notReached: stop.notReached }),
      ...(stop?.waitsOn === undefined ? {} : { waitsOn: stop.waitsOn }),
      ...(stop?.doorsWait === undefined ? {} : { doorsWait: stop.doorsWait }),
    }),
    ...(spawned.actionSpawns.length === 0 ? {} : { actionSpawns: spawned.actionSpawns }),
    ...(spawned.copies.length === 0 ? {} : { spawnCopies: spawned.copies }),
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
    ...phaseFightGold(fightGold, input.gold, owner),
    ...roomEntryGold(input.gold, owner),
  });
}

/** A whole gold number; a balance below zero takes the typographic minus. */
function goldNumber(gold: number): string {
  return gold < 0 ? `\u2212${-gold}` : `${gold}`;
}

function goldAmount(amount: GoldAmount): WorkspaceGoldAmount {
  return Object.freeze({
    label:
      amount.min === amount.max
        ? goldNumber(amount.min)
        : `${goldNumber(amount.min)}–${goldNumber(amount.max)}`,
  });
}

function purchaseGold(
  gold: GoldLedger | undefined,
  owner: SemanticAddress,
): Pick<WorkspaceRoomActionRow, 'price' | 'affordability'> {
  const priced = gold?.purchaseAt(owner);
  if (priced?.availability !== 'available' || priced.purchase.venue === 'free') return {};
  const { affordableProbability, balanceBefore, price } = priced.purchase;
  return {
    price: goldAmount(price),
    ...(affordableProbability === undefined || balanceBefore.availability !== 'available'
      ? {}
      : {
          affordability: Object.freeze({
            ...purchaseAffordability(
              affordableProbability,
              balanceBefore.balance.variance === 0 && price.variance === 0,
            ),
            balanceBefore: goldBalanceLabel(balanceBefore.balance),
          }),
        }),
  };
}

/** The gold each timeline row in the room gains or loses outside its fight, by its row's key. */
function roomGoldGains(
  gold: GoldLedger | undefined,
  room: OccurrenceAddress,
): ReadonlyMap<string, GoldRowSummary> {
  const priced = gold?.roomAt(room);
  if (priced?.availability !== 'available') return new Map();
  return new Map(priced.room.rows.map((row) => [semanticAddressKey(row.roomAction), row] as const));
}

/** Each fight the room paid, by its fight's key. */
function roomFightGold(
  gold: GoldLedger | undefined,
  room: OccurrenceAddress,
): ReadonlyMap<string, GoldFightSummary> {
  const priced = gold?.roomAt(room);
  if (priced?.availability !== 'available') return new Map();
  return new Map(
    priced.room.fights.map((fight) => [semanticAddressKey(fight.fight), fight] as const),
  );
}

const FIGHT_GOLD_SOURCE_LABEL: Readonly<
  Record<GoldFightSummary['breakdown'][number]['source'], string>
> = Object.freeze({
  enemies: 'Enemies',
  passiveStore: 'Passive enemies',
  medea: 'Medea',
});

/** "+N" when exact, else "+N ± S" with its standard deviation. */
function fightGoldAmount(amount: {
  readonly mean: number;
  readonly spread: number;
  readonly exact: boolean;
}): string {
  const mean = goldNumber(Math.round(amount.mean));
  const signed = amount.mean < 0 ? mean : `+${mean}`;
  return amount.exact ? signed : `${signed} ± ${Math.max(1, Math.round(amount.spread))}`;
}

function fightGoldLabel(summary: GoldFightSummary): WorkspaceFightGold | undefined {
  if (Math.round(summary.mean) === 0) return undefined;
  return Object.freeze({
    label: fightGoldAmount(summary),
    breakdown: summary.breakdown
      .map((line) => `${FIGHT_GOLD_SOURCE_LABEL[line.source]} ${fightGoldAmount(line)}`)
      .join(' · '),
  });
}

/** The fight gold of a challenge switch's or locked door's press. */
function rowFightGold(
  fights: ReadonlyMap<string, GoldFightSummary>,
  row: SemanticAddress,
): Pick<WorkspaceRoomActionRow, 'fightGold'> {
  const fight = fights.get(semanticAddressKey(row));
  const gold = fight === undefined ? undefined : fightGoldLabel(fight);
  return gold === undefined ? {} : { fightGold: gold };
}

/**
 * Each encounter phase's fight gold, for its end banner; a Nemesis bet the phase
 * settles joins it as one figure, its payout a line of the breakdown.
 */
function phaseFightGold(
  fights: ReadonlyMap<string, GoldFightSummary>,
  gold: GoldLedger | undefined,
  room: OccurrenceAddress,
): Pick<WorkspaceRoomActions, 'phaseFightGold'> {
  const priced = gold?.roomAt(room);
  const bets =
    priced?.availability === 'available'
      ? priced.room.bets.filter((bet) => Math.round(bet.mean) !== 0)
      : [];
  const phaseFights = [...fights.values()].filter(
    (fight): fight is GoldFightSummary & { readonly fight: EncounterPhaseAddress } =>
      fight.fight.kind === 'encounterPhase' && Math.round(fight.mean) !== 0,
  );
  const phaseKeys = new Set([
    ...phaseFights.map((fight) => fight.fight.phaseKey),
    ...bets.map((bet) => bet.phase.phaseKey),
  ]);
  const phases = [...phaseKeys].map((phaseKey) => {
    const fight = phaseFights.find((candidate) => candidate.fight.phaseKey === phaseKey);
    const bet = bets.find((candidate) => candidate.phase.phaseKey === phaseKey);
    const parts = [...(fight === undefined ? [] : [fight]), ...(bet === undefined ? [] : [bet])];
    // Independent amounts: the means add and so do their variances.
    const total = {
      mean: parts.reduce((sum, part) => sum + part.mean, 0),
      spread: Math.sqrt(parts.reduce((sum, part) => sum + part.spread ** 2, 0)),
      exact: parts.every((part) => part.exact),
    };
    const breakdown = [
      ...(fight?.breakdown ?? []).map(
        (line) => `${FIGHT_GOLD_SOURCE_LABEL[line.source]} ${fightGoldAmount(line)}`,
      ),
      ...(bet === undefined ? [] : [`Nemesis bet ${fightGoldAmount(bet)}`]),
    ];
    return Object.freeze({
      phaseKey,
      gold: Object.freeze({
        label: fightGoldAmount(total),
        breakdown: breakdown.join(' · '),
        ...(Math.round(total.mean) < 0 ? { loss: true as const } : {}),
      }),
    });
  });
  return phases.length === 0 ? {} : { phaseFightGold: Object.freeze(phases) };
}

/** The room's entry gold, its urns, shown on its Room entered banner. */
function roomEntryGold(
  gold: GoldLedger | undefined,
  room: OccurrenceAddress,
): Pick<WorkspaceRoomActions, 'entryGold'> {
  const priced = gold?.roomAt(room);
  if (priced?.availability !== 'available') return {};
  const entry = priced.room.entry;
  if (entry === undefined || Math.round(entry.mean) === 0) return {};
  const label = fightGoldAmount(entry);
  return {
    entryGold: Object.freeze({ label, breakdown: `Urns ${label}` }),
  };
}

/** A row's or bet's gold summary in the fight gold's form. */
function goldGainLabel(gain: {
  readonly mean: number;
  readonly spread: number;
  readonly exact: boolean;
}): WorkspaceGoldAmount {
  return Object.freeze({
    label: fightGoldAmount(gain),
    ...(Math.round(gain.mean) < 0 ? { loss: true as const } : {}),
  });
}

/** The gold the ledger books against this row. */
function rowGoldGain(
  gains: ReadonlyMap<string, GoldRowSummary>,
  row: SemanticAddress,
): Pick<WorkspaceRoomActionRow, 'goldGained'> {
  const gain = gains.get(semanticAddressKey(row));
  if (gain === undefined || Math.round(gain.mean) === 0) return {};
  const hint = [...new Set((gain.estimates ?? []).map(goldEstimateHint))].join(' · ');
  return {
    goldGained: Object.freeze({ ...goldGainLabel(gain), ...(hint === '' ? {} : { hint }) }),
  };
}

/** Why an estimated gain pays the amount planned: the game's range is left to play. */
function goldEstimateHint(estimate: GoldEstimate): string {
  switch (estimate.basis) {
    case 'timeSwitchClaim':
      return `Pays up to ${goldNumber(estimate.range.max)} by finish time; planned at ${goldNumber(estimate.value)}`;
    case 'heraclesBounty':
      return `Pays up to ${goldNumber(estimate.range.max)} by marked kills; planned at ${goldNumber(estimate.value)}`;
  }
}

/**
 * The chance to afford as a whole percent, toned by the percent shown; only an
 * exact balance and price are certain either way.
 */
export function purchaseAffordability(
  probability: number,
  exact: boolean,
): Omit<WorkspacePurchaseAffordability, 'balanceBefore'> {
  const percent = Math.round(probability * 100);
  const label =
    exact || (percent > 0 && percent < 100) ? `${percent}%` : percent >= 100 ? '>99%' : '<1%';
  const tone = percent >= 90 ? 'high' : percent >= 50 ? 'medium' : 'low';
  return Object.freeze({ label, tone });
}

/**
 * A balance: its rounded mean, followed by its spread (one standard deviation,
 * to the nearest 5, or the nearest 10 from 50 up, never below one step) unless exact.
 */
export function goldBalanceLabel(moments: GoldMoments): WorkspaceGoldAmount {
  const mean = goldNumber(Math.round(moments.mean));
  if (moments.variance === 0) return Object.freeze({ label: mean });
  const deviation = Math.sqrt(moments.variance);
  const step = deviation < 50 ? 5 : 10;
  const spread = Math.max(step, Math.round(deviation / step) * step);
  return Object.freeze({ label: `${mean} ±${spread}` });
}

type PurchaseRowProducts = Pick<WorkspaceRoomActionRow, 'travelDealLine' | 'purchaseRemoval'>;

/** An action added from a room object's Timeline entry rather than the optional actions. */
function addedFromEntry({
  reference,
  sourceFamily,
}: Pick<WorkspaceRoomActionRow, 'reference' | 'sourceFamily'>): boolean {
  return (
    reference.kind === 'purchaseStygianWellOffer' ||
    reference.kind === 'sellPurgingPoolTrait' ||
    reference.kind === 'rerollStygianWell' ||
    reference.kind === 'rerollPurgingPool' ||
    reference.kind === 'interactShopOffer' ||
    reference.kind === 'interactInfernalContractPedestal' ||
    reference.kind === 'purchaseHermesShrineOffer' ||
    sourceFamily?.kind === 'shopTravelDealRefill'
  );
}

/**
 * Purchase and collect rows: the Travel Deal line under the purchase the engine
 * names as its trigger, and the delete that undoes the purchase or collect.
 */
function shopPurchaseRowProducts(
  input: WorkspaceOccurrenceActionsInput,
  roomLocal: WorkspaceRoomLocal,
  features: readonly WorkspaceRoomFeature[],
): (
  reference: RoomActionReference,
  address: RoomActionSemanticAddress,
  sourceFamily: WorkspaceRoomActionRow['sourceFamily'],
) => PurchaseRowProducts {
  const owner = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const shrineRefill = features.find(
    (feature): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'hermesShrine' }> =>
      feature.kind === 'hermesShrine',
  )?.travelDealRefill;
  const wellRefill = features.find(
    (feature): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'stygianWell' }> =>
      feature.kind === 'stygianWell',
  )?.travelDealRefill;
  const shopTravel =
    roomLocal.kind === 'shop'
      ? roomLocal.supplementalOffers.find(
          (offer) => offer.kind === 'travelDealRefill' || offer.kind === 'travelDealInvalid',
        )
      : undefined;
  const removal = (command: NonNullable<PurchaseRowProducts['purchaseRemoval']>['command']) =>
    Object.freeze({ purchaseRemoval: Object.freeze({ command: Object.freeze(command) }) });
  return (reference, address, sourceFamily) => {
    switch (reference.kind) {
      case 'interactShopOffer':
        return {
          ...(shopTravel?.kind === 'travelDealRefill' &&
          shopTravel.sourceOfferKey === reference.offerKey
            ? { travelDealLine: Object.freeze({ kind: 'worldShop' as const, offer: shopTravel }) }
            : {}),
          ...removal({
            kind: 'ReplaceShopPurchaseParticipation',
            offer: createShopOfferAddress(input.biome, owner.occurrenceId, reference.offerKey),
            purchased: false,
          }),
        };
      case 'interactAcquisitionEntry':
        return sourceFamily?.kind === 'shopTravelDealRefill'
          ? removal({ kind: 'RemoveRoomAction', action: address })
          : {};
      case 'interactInfernalContractPedestal':
        return removal({
          kind: 'SetInfernalContractPedestalCollected',
          pedestal: createInfernalContractPedestalAddress(input.biome, owner.occurrenceId),
          collected: false,
        });
      case 'purchaseStygianWellOffer':
        return {
          ...(wellRefill?.sourceGenerationKey === reference.generationKey
            ? {
                travelDealLine: Object.freeze({ kind: 'stygianWell' as const, refill: wellRefill }),
              }
            : {}),
          ...removal({
            kind: 'SetStygianWellPurchase',
            occurrence: owner,
            generationKey: reference.generationKey,
            purchased: false,
          }),
        };
      case 'purchaseHermesShrineOffer':
        return {
          ...(shrineRefill !== undefined &&
          shrineRefill.sourceGenerationKey === reference.generationKey
            ? {
                travelDealLine: Object.freeze({
                  kind: 'hermesShrine' as const,
                  refill: shrineRefill,
                }),
              }
            : {}),
          ...removal({
            kind: 'SetHermesShrinePurchase',
            occurrence: owner,
            generationKey: reference.generationKey,
            purchased: false,
          }),
        };
      default:
        return {};
    }
  };
}

export { roomActionsForOccurrence };
