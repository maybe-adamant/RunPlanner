import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { BiomeRailPinPreference } from '@planner/persistence/biomeRailPinPreference';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon, rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { clockworkCountdownArtwork } from '@planner/ui/artwork/clockwork/clockworkCountdownArtwork';
import { biomeIcon } from '@planner/ui/artwork/roomArtwork';
import { noRewardArtwork } from '@planner/ui/artwork/no-reward/noRewardArtwork';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type StructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceDefaultInspectorDestination,
  type WorkspaceInspectorDestination,
  type WorkspaceInteractionCatalog,
  type WorkspaceAuthoringFrontier,
  type WorkspaceMarker,
  type WorkspaceNode,
  type WorkspacePlanEndRelation,
  type WorkspaceRailEntry,
  type WorkspaceRailReward,
  type WorkspaceRailSelectedTarget,
  type WorkspaceRoomIcon,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { FindingCount } from '@planner/ui/feedback/EvaluationFeedback';
import { AuthoringFrontier, TopologyRemovalAction } from './DecisionWorkbench';
import { BiomeFieldControls } from './BiomeFieldControls';
import { RunStateSheet } from './RunStateSheet';
import { EchoKeepsakeReplayControl } from './BiomeInspectorControls';
import { BiomeInspectorNode } from './BiomeInspectorNode';
import { roomKindIcon } from './roomIcon';
import { planEndHereLabel } from './planEndCopy';

interface BiomeWorkspaceProps {
  readonly biome: WorkspaceBiome;
  readonly focusByOwner: StructuredWorkspaceProjection['focusByOwner'];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly repairBanner?: ReactNode;
  readonly runStateLaunchers: StructuredWorkspaceProjection['runStateLaunchers'];
  /** Whether the rail stays open beside the room, remembered on this device. */
  readonly railPinPreference?: BiomeRailPinPreference;
}

/**
 * The rail folds to its circles and room icons when unpinned, or when the
 * editor panel leaves too little room beside it (a breakpoint the stylesheet
 * owns and publishes as a custom property). Folded, it opens over the room.
 */
function useRailFold(
  workspace: RefObject<HTMLDivElement | null>,
  preference: BiomeRailPinPreference | undefined,
) {
  const [pinned, setPinnedState] = useState(() => preference?.read() ?? true);
  const [open, setOpen] = useState(false);
  const [autoFolded, setAutoFolded] = useState(false);
  useLayoutEffect(() => {
    const element = workspace.current;
    if (element === null) return;
    const read = (): void =>
      setAutoFolded(
        getComputedStyle(element).getPropertyValue('--biome-rail-auto-fold').trim() === '1',
      );
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [workspace]);
  const setPinned = (next: boolean): void => {
    setPinnedState(next);
    preference?.write(next);
  };
  const folded = !pinned || autoFolded;
  const toggle = (): void => {
    if (!folded) setPinned(false);
    else if (!open) setOpen(true);
    else {
      // Too narrow to pin beside the room, the opened rail only closes.
      if (!autoFolded) setPinned(true);
      setOpen(false);
    }
  };
  const toggleLabel = !folded
    ? 'Fold rooms'
    : !open
      ? 'Show rooms'
      : autoFolded
        ? 'Hide rooms'
        : 'Pin rooms';
  const toggleGlyph = !folded ? '⇤' : !open ? '☰' : autoFolded ? '⇤' : '⇥';
  return { folded, open, setOpen, toggle, toggleGlyph, toggleLabel };
}

type InspectorSubject =
  | { readonly kind: 'frontier'; readonly marker: WorkspaceMarker }
  | { readonly kind: 'node'; readonly node: WorkspaceNode };

/** An owner belongs to the biome hosting its destination, e.g. where a timed outcome lands. */
function ownsBiome(
  address: SemanticAddress,
  biome: WorkspaceBiome,
  focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
): boolean {
  const destination = focusByOwner.get(semanticAddressKey(address));
  const routeKey = destination?.routeKey ?? ('routeKey' in address ? address.routeKey : undefined);
  const biomeKey = destination?.biomeKey ?? ('biomeKey' in address ? address.biomeKey : undefined);
  return routeKey === biome.owner.routeKey && biomeKey === biome.owner.biomeKey;
}

/** React resolves projected keys only; containment and fallback policy stay in projection. */
function resolveInspectorSubject(
  biome: WorkspaceBiome,
  destination:
    | WorkspaceDefaultInspectorDestination
    | WorkspaceInspectorDestination['inspectorSubject']
    | undefined,
): InspectorSubject | undefined {
  if (destination === undefined) return undefined;
  switch (destination.kind) {
    case 'node': {
      const node = biome.nodes.find((candidate) => candidate.key === destination.nodeKey);
      return node === undefined ? undefined : { kind: 'node', node };
    }
    case 'frontier': {
      const frontier = biome.frontier;
      if (
        (frontier?.kind !== 'start' && frontier?.kind !== 'exitDecision') ||
        frontier.marker.focusKey !== destination.frontierFocusKey
      ) {
        return undefined;
      }
      return { kind: 'frontier', marker: frontier.marker };
    }
  }
}

/**
 * A stop's place against the plan end replaces its assessment: the end room
 * says so, a stop past it says nothing. Findings still count.
 */
function assessmentLabel(marker: WorkspaceMarker, planEnd?: WorkspacePlanEndRelation): string {
  if (planEnd === 'end') return planEndHereLabel;
  if (planEnd === 'pastEnd') return '';
  if (marker.findingCount > 0)
    return `${marker.findingCount} finding${marker.findingCount === 1 ? '' : 's'}`;
  switch (marker.assessment) {
    case 'assessed':
      return 'Evaluated';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Not evaluated';
  }
}

function nodeLabel(node: WorkspaceNode): string {
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return node.room.label;
    case 'ordinaryBatch':
      return 'Doors';
    case 'mixedBatch':
      return 'Doors';
    case 'takeoverBatch':
      return 'Preboss doors';
    case 'hubDecision':
      return 'Hub';
  }
}

function structureLabelForNode(biome: WorkspaceBiome, node: WorkspaceNode): string {
  for (const entry of biome.rail) {
    if (entry.kind === 'node' && entry.node.key === node.key) return entry.label;
    if (entry.kind === 'hubGroup' && entry.node.key === node.key) return 'Hub';
  }
  return nodeLabel(node);
}

function FocusButton({
  accessibleLabel,
  children,
  marker,
  focusMarker = marker,
  presentationMarker = marker,
  selected,
}: {
  readonly accessibleLabel?: string;
  readonly children: ReactNode;
  /** Exact navigation owner when presentation remains attached to another semantic stage. */
  readonly focusMarker?: WorkspaceMarker;
  readonly marker: WorkspaceMarker;
  /** May retain a distinct staged-owner assessment while focus stays on a room. */
  readonly presentationMarker?: WorkspaceMarker;
  readonly selected: boolean;
}) {
  const dispatch = useAppDispatch();
  return (
    <button
      aria-label={accessibleLabel}
      aria-current={selected ? 'location' : undefined}
      className="biome-rail-node"
      data-assessment={presentationMarker.assessment}
      data-findings={presentationMarker.findingCount > 0}
      data-selected={selected}
      data-workspace-node={marker.focusKey}
      onClick={() => dispatch(semanticOwnerFocused(focusMarker.address))}
      type="button"
    >
      {children}
    </button>
  );
}

function RailMainReward({
  reward,
  roomIcon,
  roomLabel,
}: {
  readonly reward: WorkspaceRailReward;
  readonly roomIcon: WorkspaceRoomIcon | undefined;
  readonly roomLabel: string | undefined;
}) {
  return (
    <span className="biome-rail-selection">
      {roomIcon === undefined ? null : (
        <ArtworkIcon className="biome-rail-reward-icon" source={roomKindIcon(roomIcon)} />
      )}
      {roomLabel === undefined ? null : <>{roomLabel} · </>}
      <span className="visually-hidden">Main reward: </span>
      <ArtworkIcon className="biome-rail-reward-icon" source={offerIcon(reward.offer)} />
      <span className="biome-rail-reward">{reward.label}</span>
    </span>
  );
}

/** A horizontal rail card's room icon over its reward icons; the card's text names it. */
function RailIcons({
  rewards = [],
  room,
}: {
  readonly rewards?: readonly (ArtworkSource | undefined)[];
  readonly room: WorkspaceRoomIcon;
}) {
  return (
    <span aria-hidden="true" className="biome-rail-icons">
      <ArtworkIcon className="biome-rail-icons-room" source={roomKindIcon(room)} />
      {rewards.length === 0 ? null : (
        <span className="biome-rail-icons-rewards">
          {rewards.map((icon, index) => (
            <ArtworkIcon className="biome-rail-icons-reward" key={index} source={icon} />
          ))}
        </span>
      )}
    </span>
  );
}

function RailTargetIcons({
  biomeKey,
  target,
}: {
  readonly biomeKey: string;
  readonly target: WorkspaceRailSelectedTarget;
}) {
  return <RailIcons rewards={railRewardIcons(biomeKey, target)} room={target.roomIcon} />;
}

/** A room seen without a door: its icon and name. */
function RailRoom({
  icon,
  label,
}: {
  readonly icon: WorkspaceRoomIcon;
  readonly label: string | undefined;
}) {
  return (
    <span className="biome-rail-selection">
      <ArtworkIcon className="biome-rail-reward-icon" source={roomKindIcon(icon)} />
      {label}
    </span>
  );
}

/** Shop, Clockwork countdown, each offered reward, or the biome's no-reward arrow. */
function railRewardIcons(
  biomeKey: string,
  target: WorkspaceRailSelectedTarget,
): readonly (ArtworkSource | undefined)[] {
  // A shop room already shows Shop as its room icon.
  if (target.shop === true) return target.roomIcon.kind === 'shop' ? [] : [rewardIcon('Shop')];
  if (target.clockworkGoalsRemaining !== undefined)
    return [clockworkCountdownArtwork[String(target.clockworkGoalsRemaining)] ?? undefined];
  if (target.roomRewards.length === 0) {
    const arrow = noRewardArtwork[biomeKey];
    return arrow == null ? [] : [arrow];
  }
  return target.roomRewards.map(offerIcon);
}

/** `[room] Room · [reward] Reward`: each icon sits before the thing it describes. */
function RailSelectedTarget({
  biomeKey,
  selectedTarget,
}: {
  readonly biomeKey: string;
  readonly selectedTarget: WorkspaceRailSelectedTarget;
}) {
  const rewardIcons = railRewardIcons(biomeKey, selectedTarget).map((icon, index) => (
    <ArtworkIcon className="biome-rail-reward-icon" key={index} source={icon} />
  ));
  return (
    <span className="biome-rail-selection">
      <ArtworkIcon
        className="biome-rail-reward-icon"
        source={roomKindIcon(selectedTarget.roomIcon)}
      />
      {selectedTarget.roomLabel}
      {rewardIcons.length === 0 && selectedTarget.reward === undefined ? null : (
        <>
          {' · '}
          {rewardIcons}
          {selectedTarget.reward === undefined ? null : (
            <span className="biome-rail-reward">{selectedTarget.reward.label}</span>
          )}
        </>
      )}
    </span>
  );
}

/** A rail card's title and assessment, read by assistive tech; its border carries the assessment. */
function RailHeading({
  label,
  marker,
  planEnd,
}: {
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly planEnd?: WorkspacePlanEndRelation | undefined;
}) {
  return (
    <span className="biome-rail-heading visually-hidden">
      <strong>{label}</strong>
      <span className="biome-rail-status visually-hidden">
        {assessmentLabel(marker, planEnd)}
        <FindingCount count={marker.findingCount} label="findings" />
      </span>
    </span>
  );
}

/** A stop still waiting on a choice: a glyph where its room icon would be, and what to do. */
function RailPending({ glyph, label }: { readonly glyph: string; readonly label: string }) {
  return (
    <span className="biome-rail-selection biome-rail-pending">
      <span aria-hidden="true" className="biome-rail-glyph">
        {glyph}
      </span>
      {label}
    </span>
  );
}

/** The plan's end, noted under its room's card. */
function RailPlanEnd({ planEnd }: { readonly planEnd: WorkspacePlanEndRelation | undefined }) {
  return planEnd !== 'end' ? null : (
    <p aria-hidden="true" className="biome-rail-plan-end">
      {planEndHereLabel}
    </p>
  );
}

function RailNode({
  biomeKey,
  entry,
  selectedRailKey,
}: {
  readonly biomeKey: string;
  readonly entry: Extract<WorkspaceRailEntry, { readonly kind: 'node' }>;
  readonly selectedRailKey: string | undefined;
}) {
  const { marker, node } = entry;
  const selected = selectedRailKey === marker.focusKey;
  // A decision with no room chosen yet has no room line.
  const undecided = entry.selectedTarget === undefined && entry.roomIcon === undefined;
  return (
    <div
      className="biome-rail-stop"
      data-kind={node.kind}
      data-plan-end={entry.planEnd}
      data-step={entry.stepNumber}
      {...(undecided ? { 'data-pending': 'room' } : {})}
    >
      <FocusButton focusMarker={entry.focusMarker ?? marker} marker={marker} selected={selected}>
        <RailHeading label={entry.label} marker={marker} planEnd={entry.planEnd} />
        {undecided ? <RailPending glyph="?" label="Choose a room" /> : null}
        {entry.selectedTarget === undefined ? null : (
          <RailSelectedTarget biomeKey={biomeKey} selectedTarget={entry.selectedTarget} />
        )}
        {entry.selectedTarget !== undefined ? (
          <RailTargetIcons biomeKey={biomeKey} target={entry.selectedTarget} />
        ) : entry.roomIcon === undefined ? null : (
          <RailIcons
            rewards={entry.mainReward === undefined ? [] : [offerIcon(entry.mainReward.offer)]}
            room={entry.roomIcon}
          />
        )}
        {entry.mainReward !== undefined ? (
          <RailMainReward
            reward={entry.mainReward}
            roomIcon={entry.roomIcon}
            roomLabel={entry.roomLabel}
          />
        ) : entry.roomIcon === undefined ? null : (
          <RailRoom icon={entry.roomIcon} label={entry.roomLabel} />
        )}
      </FocusButton>
      <RailPlanEnd planEnd={entry.planEnd} />
    </div>
  );
}

function RailFrontier({
  frontier,
  selectedRailKey,
}: {
  readonly frontier: Extract<
    WorkspaceAuthoringFrontier,
    { readonly kind: 'start' | 'exitDecision' }
  >;
  readonly selectedRailKey: string | undefined;
}) {
  const label = frontier.kind === 'start' ? 'Start biome' : 'Continue route';
  return (
    <div className="biome-rail-stop biome-frontier-stop" data-pending="frontier">
      <FocusButton marker={frontier.marker} selected={selectedRailKey === frontier.marker.focusKey}>
        <span className="visually-hidden">Next step </span>
        <RailPending glyph="+" label={frontier.kind === 'start' ? 'Start biome' : 'Continue'} />
        <span className="visually-hidden">
          {label} {assessmentLabel(frontier.marker)}
        </span>
      </FocusButton>
    </div>
  );
}

function HubRailVisit({
  biomeKey,
  selectedRailKey,
  visit,
}: {
  readonly biomeKey: string;
  readonly selectedRailKey: string | undefined;
  readonly visit: Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }>['visits'][number];
}) {
  const selected = selectedRailKey === visit.marker.focusKey;
  return (
    <li
      className="biome-hub-rail-visit"
      data-plan-end={visit.planEnd}
      data-visit={visit.visitIndex}
    >
      <FocusButton marker={visit.marker} presentationMarker={visit.visitMarker} selected={selected}>
        <RailHeading label={visit.label} marker={visit.visitMarker} planEnd={visit.planEnd} />
        <RailSelectedTarget biomeKey={biomeKey} selectedTarget={visit.room} />
        <RailTargetIcons biomeKey={biomeKey} target={visit.room} />
      </FocusButton>
      <RailPlanEnd planEnd={visit.planEnd} />
      {visit.sideVisits.length === 0 ? null : (
        <ol aria-label={`${visit.label} side rooms`} className="biome-hub-rail-side-visits">
          {visit.sideVisits.map((sideVisit) => {
            const sideSelected = selectedRailKey === sideVisit.marker.focusKey;
            return (
              <li
                className="biome-hub-rail-side-visit"
                data-plan-end={sideVisit.planEnd}
                key={sideVisit.key}
              >
                <FocusButton
                  marker={sideVisit.marker}
                  presentationMarker={sideVisit.visitMarker}
                  selected={sideSelected}
                >
                  <RailHeading
                    label={sideVisit.label}
                    marker={sideVisit.visitMarker}
                    planEnd={sideVisit.planEnd}
                  />
                  <RailSelectedTarget biomeKey={biomeKey} selectedTarget={sideVisit.room} />
                  <RailTargetIcons biomeKey={biomeKey} target={sideVisit.room} />
                </FocusButton>
                <RailPlanEnd planEnd={sideVisit.planEnd} />
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function HubRailGroup({
  biomeKey,
  entry,
  selectedRailKey,
}: {
  readonly biomeKey: string;
  readonly entry: Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }>;
  readonly selectedRailKey: string | undefined;
}) {
  const selected = selectedRailKey === entry.marker.focusKey;
  const assessment = assessmentLabel(entry.marker);
  return (
    <div className="biome-rail-stop biome-hub-rail-group" data-kind="hubDecision">
      <FocusButton
        accessibleLabel={`Hub, ${entry.visits.length} of ${entry.node.requiredVisitCount} visits, ${assessment}`}
        marker={entry.marker}
        selected={selected}
      >
        <span className="biome-rail-selection">
          <ArtworkIcon className="biome-rail-reward-icon" source={roomKindIcon(entry.roomIcon)} />
          Hub ·{' '}
          <span className="biome-rail-count">
            {entry.visits.length} of {entry.node.requiredVisitCount} visits
          </span>
        </span>
        <span aria-hidden="true" className="biome-rail-icons">
          <ArtworkIcon className="biome-rail-icons-room" source={roomKindIcon(entry.roomIcon)} />
          <span className="biome-rail-icons-count">
            {entry.visits.length}/{entry.node.requiredVisitCount}
          </span>
        </span>
      </FocusButton>
      {entry.visits.length === 0 ? null : (
        <ol aria-label="Hub visits" className="biome-hub-rail-visits">
          {entry.visits.map((visit) => (
            <HubRailVisit
              biomeKey={biomeKey}
              key={visit.key}
              selectedRailKey={selectedRailKey}
              visit={visit}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function RailEntry({
  biomeKey,
  entry,
  selectedRailKey,
}: {
  readonly biomeKey: string;
  readonly entry: WorkspaceRailEntry;
  readonly selectedRailKey: string | undefined;
}) {
  switch (entry.kind) {
    case 'node':
      return <RailNode biomeKey={biomeKey} entry={entry} selectedRailKey={selectedRailKey} />;
    case 'hubGroup':
      return <HubRailGroup biomeKey={biomeKey} entry={entry} selectedRailKey={selectedRailKey} />;
    case 'frontier':
      return <RailFrontier frontier={entry.frontier} selectedRailKey={selectedRailKey} />;
  }
}

/** The Boss and Postboss after the rail's rooms, as rail stops of their own. */
function RailCompletionNode({
  node,
  selected,
}: {
  readonly node: WorkspaceBiome['completionOutline'][number];
  readonly selected: boolean;
}) {
  const roleLabel = node.room.kind === 'PostBoss' ? 'Postboss' : 'Boss';
  const focusMarker =
    node.room.judgment?.marker ??
    node.room.figurine?.marker ??
    node.room.keepsakeSelection?.marker ??
    node.marker;
  const planEnd = node.planEnd?.relation;
  const railMarker = node.railMarker ?? node.marker;
  return (
    <div className="biome-rail-stop" data-kind="completion" data-plan-end={planEnd}>
      <FocusButton
        focusMarker={focusMarker}
        marker={node.marker}
        presentationMarker={railMarker}
        selected={selected}
      >
        <RailHeading label={roleLabel} marker={railMarker} planEnd={planEnd} />
        <RailRoom icon={node.room.roomIcon} label={node.room.label} />
        <RailIcons room={node.room.roomIcon} />
      </FocusButton>
      <RailPlanEnd planEnd={planEnd} />
    </div>
  );
}

/**
 * Projection-driven workbench for every biome.  It intentionally has
 * no catalog or authored-plan prop: structural facts and room-local state come
 * exclusively from the Slice 3a workspace envelope and semantic interactions.
 */
export function BiomeWorkspace({
  biome,
  focusByOwner,
  interactions,
  repairBanner,
  runStateLaunchers,
  railPinPreference,
}: BiomeWorkspaceProps) {
  const runStateTarget = useAppSelector((state) => state.editorSession.runStateTarget);
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const semanticNavigationRevision = useAppSelector(
    (state) => state.editorSession.semanticNavigationRevision,
  );
  const findingOrigin =
    selectedFinding !== null && ownsBiome(selectedFinding.origin, biome, focusByOwner)
      ? selectedFinding.origin
      : undefined;
  const scopedFocusedOwner =
    focusedOwner !== null && ownsBiome(focusedOwner, biome, focusByOwner)
      ? focusedOwner
      : undefined;
  // A finding may focus a visible containing action while its origin owns the
  // complete inspector, rail, and tab destination. Keep those responsibilities
  // separate so a redirected marker cannot erase the finding's route target.
  const destinationOwner = findingOrigin ?? scopedFocusedOwner;
  const explicitDestination =
    destinationOwner === undefined
      ? undefined
      : focusByOwner.get(semanticAddressKey(destinationOwner));
  const defaultSubject = resolveInspectorSubject(
    biome,
    biome.defaultInspectorDestination ?? undefined,
  );
  const explicitSubject =
    destinationOwner === undefined
      ? undefined
      : resolveInspectorSubject(biome, explicitDestination?.inspectorSubject);
  const subject = explicitSubject ?? defaultSubject;
  // The rail selection comes from whichever destination supplied the inspector.
  const selectedRailKey =
    explicitSubject === undefined
      ? biome.defaultInspectorDestination?.selectedRailKey
      : explicitDestination?.selectedRailKey;
  const inspectorTitle =
    subject?.kind === 'frontier'
      ? 'Next step'
      : subject?.kind === 'node'
        ? structureLabelForNode(biome, subject.node)
        : biome.label;
  const clearTopology =
    biome.entry === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(biome.owner),
        );
  const runState =
    runStateTarget === null || runStateTarget === undefined
      ? undefined
      : runStateLaunchers.get(semanticAddressKey(runStateTarget));
  const selectedNodeKey = subject?.kind === 'node' ? subject.node.key : undefined;
  const selectedStage = biome.occurrenceStages.find((stage) => {
    if (stage.sourceOccurrenceNodeKey === selectedNodeKey) return true;
    if (
      stage.outgoing.kind === 'authoredDecision' &&
      stage.outgoing.decisionNodeKey === selectedNodeKey
    ) {
      return true;
    }
    return (
      subject?.kind === 'frontier' &&
      stage.outgoing.kind === 'frontier' &&
      stage.outgoing.frontier.marker.focusKey === subject.marker.focusKey
    );
  });
  const sourceOccurrenceCandidate =
    selectedStage === undefined
      ? undefined
      : biome.nodes.find((node) => node.key === selectedStage.sourceOccurrenceNodeKey);
  const sourceOccurrence =
    sourceOccurrenceCandidate?.kind === 'occurrenceWorkbench'
      ? sourceOccurrenceCandidate
      : undefined;
  const selectedOutgoing = selectedStage?.outgoing;
  const outgoingDecisionCandidate =
    selectedOutgoing?.kind !== 'authoredDecision'
      ? undefined
      : biome.nodes.find((node) => node.key === selectedOutgoing.decisionNodeKey);
  const outgoingDecision =
    outgoingDecisionCandidate?.kind === 'ordinaryBatch' ||
    outgoingDecisionCandidate?.kind === 'mixedBatch' ||
    outgoingDecisionCandidate?.kind === 'takeoverBatch'
      ? outgoingDecisionCandidate
      : undefined;
  // A biome past the plan end is read-only; its rail and rooms are dimmed.
  const pastPlanEnd = biome.planEnd === 'pastEnd';
  const rendersTitledWorkbench =
    sourceOccurrence !== undefined ||
    (subject?.kind === 'node' &&
      (subject.node.kind === 'occurrenceWorkbench' || subject.node.kind === 'hubDecision'));

  const workspaceRef = useRef<HTMLDivElement>(null);
  const rail = useRailFold(workspaceRef, railPinPreference);
  return (
    <div
      className="biome-workspace"
      data-rail={rail.folded ? 'folded' : 'pinned'}
      data-rail-open={rail.folded && rail.open ? true : undefined}
      ref={workspaceRef}
    >
      {runState === undefined ? null : <RunStateSheet launcher={runState} />}
      <section
        aria-label={`${biome.label} route structure`}
        className="biome-structure-region"
        data-source={biome.source}
        data-status={biome.status}
      >
        <div className="biome-structure-head">
          {repairBanner}
          <header className="biome-structure-heading">
            <div className="biome-structure-title">
              <div className="biome-structure-title-row">
                <ArtworkIcon className="biome-boss-icon" source={biomeIcon(biome.biomeKey)} />
                <h2>{biome.label}</h2>
                {pastPlanEnd || clearTopology === undefined ? null : (
                  <TopologyRemovalAction
                    accessibleLabel={`Clear ${biome.label}`}
                    compact
                    interaction={clearTopology}
                    label="Clear biome"
                  />
                )}
              </div>
            </div>
          </header>
        </div>
        <div
          className="biome-structure-scroll"
          onClickCapture={(event) => {
            // An opened rail closes once a room is chosen from it.
            if ((event.target as Element).closest('.biome-rail-node') !== null) rail.setOpen(false);
          }}
          onMouseLeave={() => rail.setOpen(false)}
        >
          <button
            aria-expanded={!rail.folded || rail.open}
            aria-label={rail.toggleLabel}
            className="biome-rail-pin"
            onClick={rail.toggle}
            type="button"
          >
            {rail.toggleGlyph}
          </button>
          <div className="biome-rail">
            {biome.rail.map((entry) => (
              <RailEntry
                biomeKey={biome.biomeKey}
                entry={entry}
                key={entry.key}
                selectedRailKey={selectedRailKey}
              />
            ))}
            {biome.completionOutline.map((node) => (
              <RailCompletionNode
                key={node.key}
                node={node}
                selected={selectedNodeKey === node.key}
              />
            ))}
          </div>
        </div>
      </section>
      <aside aria-label="Details" className="biome-inspector">
        {rendersTitledWorkbench ? null : (
          <header className="biome-inspector-heading">
            <p className="eyebrow">Details</p>
            <h2>{inspectorTitle}</h2>
          </header>
        )}
        <div className="past-plan-end-content" inert={pastPlanEnd}>
          {biome.entry === undefined ? null : <BiomeFieldControls fields={biome.fields} />}
          <EchoKeepsakeReplayControl biome={biome} interactions={interactions} />
        </div>
        {subject === undefined ? (
          <p className="fixed-room-state">Choose the first room to start this biome.</p>
        ) : subject.kind === 'frontier' && sourceOccurrence === undefined ? (
          biome.frontier?.kind === 'start' || biome.frontier?.kind === 'exitDecision' ? (
            <AuthoringFrontier frontier={biome.frontier} interactions={interactions} />
          ) : null
        ) : (
          <BiomeInspectorNode
            navigationRevision={semanticNavigationRevision}
            pastPlanEnd={pastPlanEnd}
            frontier={biome.frontier}
            interactions={interactions}
            label={inspectorTitle}
            node={subject.kind === 'node' ? subject.node : sourceOccurrence!}
            {...(selectedStage === undefined ? {} : { outgoing: selectedStage.outgoing })}
            {...(outgoingDecision === undefined ? {} : { outgoingDecision })}
            {...(sourceOccurrence === undefined ? {} : { sourceOccurrence })}
            {...(explicitDestination?.hubTab === undefined
              ? {}
              : { hubTab: explicitDestination.hubTab })}
            {...(explicitDestination?.roomTab === undefined
              ? {}
              : { roomTab: explicitDestination.roomTab })}
            doorsRequested={explicitDestination?.timelineDoors === 'doorsOpen'}
            {...(explicitDestination?.sideRoomSlotKey === undefined
              ? {}
              : { sideRoomSlotKey: explicitDestination.sideRoomSlotKey })}
            {...(findingOrigin === undefined
              ? {}
              : { findingNavigationRevision: semanticNavigationRevision })}
          />
        )}
      </aside>
    </div>
  );
}
