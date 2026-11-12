import { FeatureRollSlots } from './commerce/FeatureRollInteract';
import { StopNotice } from './StopNotice';
import { ArtworkChip } from '../rewards/TimelineChip';
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { EncounterOutcomeChoice } from '@run-planner/engine/simulation';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceEncounterEvents,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceNotReachedEntry,
  type WorkspaceShipPhasePresentation,
} from '@planner/projections/structured-workspace';
import {
  findingRevealEvent,
  useFindingAnchor,
  useFindingMark,
} from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
export { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
import { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
export { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { LifecycleBoundaryRow } from './RoomLifecycleBoundaryRow';
import { boundarySpokenLabel } from './lifecycleBoundaryLabel';
import { TimelineRow } from './TimelineRow';
import { LiveRow } from './LiveActions';
import { TimelineMapStageContext, type TimelineMapStage } from './timelineMapStage';
import { RowRewardName } from './RowRewardName';
import { RowNpcName } from './RowNpcName';
import { npcPortrait } from '@planner/ui/artwork/npcs/npcArtwork';
import { RoomActionAcquisitionRow } from './RoomActionAcquisitionRow';
import {
  RoomActionArtificerOutput,
  RoomActionInlineEditors,
  RoomActionInlineReward,
  RoomActionVerb,
} from './RoomActionInlineEditors';
import { RoomActionRemovalControl } from './RoomActionOrderingControls';
import { roomActionReorderPositions } from './room-action-placement';
import { TimelineReorderHandle, TimelineReorderStatus } from './TimelineReorderHandle';
import { useTimelineReorder } from './useTimelineReorder';
import { DoorRerollRowReward } from './RoomRerolls';
import { UnlockedDoor } from './DecisionWorkbench';
import { UnlockExitFightControl } from './UnlockExitFightControl';
import { RewardWheelWorkbench, SelectWheelRow } from './locals/RewardWheelWorkbench';
import { doorsOpenToggle, wheelOfferChips } from './doorSummary';
import { NemesisEventPending, NemesisInteractionSentence } from './NemesisEventEditor';
import { StygianWellTwistChips } from './commerce/StygianWellTwist';
import { TravelDealLine } from './commerce/PurchaseRowControls';
import { SpawnCopyChips, SpawnedLootRow } from './SpawnedLootRow';
import { FightGoldAmount, GoldAmount, PurchaseCost } from './commerce/GoldAmount';
import { hintProps } from '@planner/ui/controls/hint';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { rerollDieArtwork } from '@planner/ui/artwork/rerolls/rerollArtwork';
import { roomActionIcon } from '@planner/ui/artwork/roomArtwork';
import { pickupSourceBadgeIcon } from '@planner/ui/artwork/sourceBadgeArtwork';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import {
  DoorsOpenBanner,
  DoorsOpenControls,
  DoorsOpenDetailRow,
  type TimelineDoors,
} from './TimelineDoors';
/** Room-owned boundary additions: editors on the boundary row and rows that follow it. */
export interface TimelineBoundaryContent {
  readonly editors?: ReactNode;
  readonly rows?: ReactNode;
}

/** A Mystery Boon whose source the row authors: its picker replaces the name after the verb. */
function inlineMysteryBoonOfferVerb(row: WorkspaceRoomActions['rows'][number]) {
  const mystery =
    row.rewardPayload?.showOffer === true &&
    (row.rewardPayload.control.offer?.rewardType ??
      row.rewardPayload.control.authoringSeed?.rewardType) === 'BlindBoxLoot';
  return mystery ? row.labelParts : undefined;
}

/**
 * The engine lists outcome choices only for an entered room. Unentered, every outcome
 * control its phase carries shows, so a retained value stays clearable; Anomaly cleared
 * belongs to the room's entry and waits for it.
 */
const unenteredOutcomeChoices = (
  Object.entries({
    aetos: true,
    gorgonCondition: true,
    nemesisBet: true,
    nemesisEvent: true,
    anomalyCleared: false,
  } satisfies Record<EncounterOutcomeChoice, boolean>) as [EncounterOutcomeChoice, boolean][]
).flatMap(([choice, shown]) => (shown ? [choice] : []));

/**
 * Authored rows past the room's stop, dimmed in Timeline order until the walk reaches them;
 * collapsed and inert until opened. Navigation to a control in it opens it.
 */
function NotReachedGroup({
  children,
  count,
}: {
  readonly children: ReactNode;
  readonly count: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return undefined;
    // Opens at once, so the landing control can take focus in the same navigation.
    const reveal = () => {
      list.removeAttribute('inert');
      setExpanded(true);
    };
    list.addEventListener(findingRevealEvent, reveal);
    return () => list.removeEventListener(findingRevealEvent, reveal);
  }, []);
  return (
    <section aria-label="Not reached yet" className="room-action-not-reached">
      <div className="local-reward-heading">
        <h5>
          <button
            aria-controls={listId}
            aria-expanded={expanded}
            className="room-action-not-reached-toggle"
            onClick={() => setExpanded((open) => !open)}
            type="button"
          >
            <span aria-hidden="true" className="timeline-banner-toggle-caret">
              {expanded ? '▾' : '▸'}
            </span>
            Not reached yet
            <span className="room-action-not-reached-count">{count}</span>
          </button>
        </h5>
      </div>
      <ol className="room-action-list" id={listId} inert={!expanded} ref={listRef}>
        {children}
      </ol>
    </section>
  );
}

export function RoomActionsWorkbench({
  actions,
  children,
  doors,
  encounterPhases,
  idPrefix,
  interactions,
  renderEncounterControls,
  renderRowContent,
  renderBoundaryContent,
  mode,
}: {
  readonly actions?: WorkspaceRoomActions;
  readonly children?: ReactNode;
  /** The room's doors, on the Timeline that opens them. */
  readonly doors?: TimelineDoors | undefined;
  readonly encounterPhases?: readonly WorkspaceEncounterPhase[];
  readonly idPrefix?: string;
  readonly interactions: WorkspaceInteractionCatalog;
  /** Encounter/reward owner supplies a banner's encounter controls without a reverse import. */
  readonly renderEncounterControls?: (controls: WorkspaceEncounterEvents) => ReactNode;
  /** Consumer-owned leaf editor for one exact shared timeline row. */
  readonly renderRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderBoundaryContent?: (
    boundary: WorkspaceRoomLifecycleBoundary,
  ) => TimelineBoundaryContent | undefined;
  readonly mode:
    | { readonly kind: 'roomTimeline' }
    | {
        readonly kind: 'shipPhase';
        readonly phase: WorkspaceShipPhasePresentation;
        /** Every Ship phase, to name the phase a move crosses into. */
        readonly phases: readonly WorkspaceShipPhasePresentation[];
      }
    | {
        readonly kind: 'shipRepairs';
        readonly rows: readonly WorkspaceRoomActions['rows'][number][];
      };
}) {
  const executeIntent = useCommandIntent();
  const findingAnchor = useFindingAnchor();
  const findingMark = useFindingMark();
  const reorder = useTimelineReorder();
  const { attachRoot } = reorder;
  const [announcement, setAnnouncement] = useState('');
  // A Ship opens its doors in its last phase; every other room on its one Timeline.
  const roomDoors =
    mode.kind === 'roomTimeline' ||
    (mode.kind === 'shipPhase' && mode.phase.key === mode.phases.at(-1)?.key)
      ? doors
      : undefined;
  // A Ship phase that a wheel follows opens it like doors: its offers, then its pick.
  const phaseWheel = mode.kind === 'shipPhase' ? mode.phase.wheel : undefined;
  const [collapsedWheels, setCollapsedWheels] = useState<ReadonlySet<string>>(() => new Set());
  const wheelHoldsFindings =
    phaseWheel !== undefined &&
    [phaseWheel.marker, ...phaseWheel.offers.map((offer) => offer.control.marker)].some(
      (marker) => findingMark(marker.address)['data-has-findings'],
    );
  const wheelDoors: TimelineDoors | undefined =
    phaseWheel === undefined || actions === undefined
      ? undefined
      : {
          noun: 'offer' as const,
          detailId: `wheel-${actions.interactionKey}-${phaseWheel.key}-detail`,
          summary: { chips: wheelOfferChips(phaseWheel, 'first'), label: 'Offer summary' },
          detail: (
            <RewardWheelWorkbench
              inTimeline
              interactions={interactions}
              occurrence={actions.owner}
              wheel={phaseWheel}
            />
          ),
          expanded: wheelHoldsFindings || !collapsedWheels.has(phaseWheel.key),
          ...(wheelHoldsFindings
            ? {}
            : {
                onExpandedChange: (expanded: boolean) =>
                  setCollapsedWheels((collapsed) => {
                    const next = new Set(collapsed);
                    if (expanded) next.delete(phaseWheel.key);
                    else next.add(phaseWheel.key);
                    return next;
                  }),
              }),
        };
  // A room whose walk stops in it has not reached its doors, unless it stops at their opening,
  // which keeps its doors and Leave row to repair; a saved end keeps its last row.
  const doorsWait = actions?.timeline.doorsWait === true;
  const doorsTail = (timeline: readonly WorkspaceRoomLifecycleTimelineEntry[]): ReactNode => {
    const hasDoorsOpenRow = timeline.some(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'doorsOpened',
    );
    return roomDoors === undefined ? null : doorsWait ? (
      roomDoors.endsPlan === true ? (
        roomDoors.leave
      ) : null
    ) : (
      <>
        {hasDoorsOpenRow || roomDoors.doorsOpenRow === false ? null : (
          <DoorsOpenBanner doors={roomDoors} />
        )}
        <TimelineMapStageContext.Provider value="left">
          {roomDoors.leave}
        </TimelineMapStageContext.Provider>
      </>
    );
  };
  // The map opens at the room's doors, or on a Ship tab at the wheel it shows: its own
  // marker and every row ranked after it stand on the open map.
  const mapOpening = (
    timeline: readonly WorkspaceRoomLifecycleTimelineEntry[],
  ): { readonly afterRank: number | undefined; readonly wheelKey?: string } => {
    if (phaseWheel === undefined) return { afterRank: actions?.timeline.doorsAfterRank };
    const wheelsOpen = timeline.find(
      (entry) =>
        entry.kind === 'boundary' &&
        entry.boundary.kind === 'wheelsOpen' &&
        entry.boundary.wheelKey === phaseWheel.key,
    );
    return {
      afterRank: wheelsOpen?.kind === 'boundary' ? wheelsOpen.dropIndex : undefined,
      wheelKey: phaseWheel.key,
    };
  };
  const entryMapStage = (
    entry: WorkspaceRoomLifecycleTimelineEntry,
    opening: ReturnType<typeof mapOpening>,
  ): TimelineMapStage => {
    switch (entry.kind) {
      case 'boundary':
        return (
          opening.wheelKey === undefined
            ? entry.boundary.kind === 'doorsOpened'
            : entry.boundary.kind === 'wheelsOpen' && entry.boundary.wheelKey === opening.wheelKey
        )
          ? 'open'
          : 'closed';
      case 'spawned':
        return opening.wheelKey !== undefined && entry.moment === 'wheelsOpen' ? 'open' : 'closed';
      case 'action':
      case 'automaticEffect':
        return opening.afterRank !== undefined && entry.rank > opening.afterRank
          ? 'open'
          : 'closed';
    }
  };
  const mapStageKey = (entry: WorkspaceRoomLifecycleTimelineEntry): string => {
    switch (entry.kind) {
      case 'boundary':
        return `stage:${entry.boundary.key}`;
      case 'action':
        return `stage:${entry.actionKey}`;
      case 'spawned':
        return `stage:spawned:${entry.key}`;
      case 'automaticEffect':
        return `stage:${workspaceInteractionKey(entry.address)}`;
    }
  };
  const withMapStage = (
    timeline: readonly WorkspaceRoomLifecycleTimelineEntry[],
    render: (entry: WorkspaceRoomLifecycleTimelineEntry) => ReactNode[],
  ): ReactNode[] => {
    const opening = mapOpening(timeline);
    return timeline.flatMap((entry) => {
      const nodes = render(entry);
      return nodes.length === 0
        ? []
        : [
            <TimelineMapStageContext.Provider
              key={mapStageKey(entry)}
              value={entryMapStage(entry, opening)}
            >
              {nodes}
            </TimelineMapStageContext.Provider>,
          ];
    });
  };
  if (actions === undefined && mode.kind === 'roomTimeline') {
    if ((encounterPhases === undefined || idPrefix === undefined) && roomDoors === undefined)
      return null;
    return (
      <section aria-label="Room Timeline" className="room-actions-workbench">
        {(encounterPhases ?? [])
          .filter((phase) => phase.timelineAnchor !== undefined)
          .map((phase) => (
            <Fragment key={workspaceInteractionKey(phase.address)}>
              {renderEncounterControls?.({
                phase,
                start: true,
                choices: unenteredOutcomeChoices,
              })}
            </Fragment>
          ))}
        {roomDoors === undefined ? null : (
          <>
            <div className="room-timeline-main">
              <ol aria-label="Room timeline" className="room-action-list">
                {doorsTail([])}
              </ol>
            </div>
          </>
        )}
      </section>
    );
  }
  const interaction =
    actions === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.roomActions, actions.interactionKey);
  const apply = (proposalKey: string): void => {
    const proposal = interaction?.proposals.find((candidate) => candidate.key === proposalKey);
    if (interaction === undefined || proposal?.structurallyAuthorable !== true) return;
    executeIntent(interaction.intentFor(proposalKey));
  };
  const renderSupplement = (
    supplement: Extract<
      WorkspaceRoomLifecycleTimelineEntry,
      { readonly kind: 'boundary' | 'action' }
    >['supplement'],
  ): ReactNode => {
    if (supplement === undefined) return null;
    // A Nemesis interaction is its row's own sentence; her event's result follows it.
    const events = 'kind' in supplement ? supplement.events : supplement;
    return events === undefined ? null : (renderEncounterControls?.(events) ?? null);
  };
  const shipPhases = mode.kind === 'shipPhase' ? mode.phases : undefined;
  const phaseOf =
    shipPhases === undefined
      ? undefined
      : (rowKey: string) =>
          shipPhases.find((phase) =>
            phase.timeline.some((entry) => entry.kind === 'action' && entry.actionKey === rowKey),
          )?.label;
  const visibleTimeline =
    mode.kind === 'roomTimeline'
      ? (actions?.timeline.entries ?? [])
      : mode.kind === 'shipPhase'
        ? mode.phase.timeline
        : [];
  const reorderBanners = visibleTimeline.flatMap((entry) =>
    entry.kind === 'boundary'
      ? [
          {
            key: entry.boundary.key,
            label: boundarySpokenLabel(entry.label, entry.fieldsCage),
            kind: entry.boundary.kind,
            dropIndex: entry.dropIndex,
          },
        ]
      : [],
  );
  // Each encounter phase groups its Encounter line, its end and the pickups that follow.
  const phaseByKey = new Map<string, number>();
  {
    let phase: number | undefined;
    let count = 0;
    for (const entry of visibleTimeline) {
      if (entry.kind === 'boundary') {
        if (entry.beginsEncounter === true || entry.boundary.kind === 'roomEntered')
          phase = count++;
        else if (
          entry.boundary.kind !== 'encounterStarted' &&
          entry.boundary.kind !== 'encounterEnd' &&
          entry.boundary.kind !== 'bossDefeated'
        )
          phase = undefined;
        if (phase !== undefined) phaseByKey.set(entry.boundary.key, phase);
      } else if (entry.kind === 'action' && phase !== undefined) {
        phaseByKey.set(entry.actionKey, phase);
      }
    }
  }
  const endedPhaseKeys = new Set(
    visibleTimeline.flatMap((entry) =>
      entry.kind === 'boundary' && entry.boundary.kind === 'encounterEnd'
        ? [entry.boundary.phaseKey]
        : [],
    ),
  );
  const renderBoundary = (
    entry: Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>,
  ) => {
    const content = renderBoundaryContent?.(entry.boundary);
    const boundary = entry.boundary;
    const doorsOpen = boundary.kind === 'doorsOpened' && !doorsWait ? roomDoors : undefined;
    const modifiers = [
      renderSupplement(entry.supplement),
      content?.editors,
      doorsOpen === undefined ? undefined : <DoorsOpenControls doors={doorsOpen} />,
    ].filter((node) => node !== null && node !== undefined && node !== false);
    // A fight's gold sits on its end banner, or where a boss phase has none, on its defeat;
    // a Nemesis bet the phase settles is summed into it. A room's urn gold shows as it is entered.
    const fightGold =
      boundary.kind === 'encounterEnd' ||
      (boundary.kind === 'bossDefeated' && !endedPhaseKeys.has(boundary.phaseKey))
        ? actions?.phaseFightGold?.find((fight) => fight.phaseKey === boundary.phaseKey)?.gold
        : boundary.kind === 'roomEntered'
          ? actions?.entryGold
          : undefined;
    const bannerControls = modifiers;
    const bannerMoney = fightGold === undefined ? undefined : <FightGoldAmount gold={fightGold} />;
    return (
      <Fragment key={entry.boundary.key}>
        <LifecycleBoundaryRow
          boundary={entry.boundary}
          {...(phaseByKey.get(entry.boundary.key) === undefined
            ? {}
            : { phase: phaseByKey.get(entry.boundary.key)! })}
          {...(bannerControls.length === 0
            ? {}
            : {
                controls: bannerControls.map((node, index) => (
                  <Fragment key={index}>{node}</Fragment>
                )),
              })}
          money={
            bannerMoney === undefined ? undefined : (
              <span className="timeline-banner-gold">{bannerMoney}</span>
            )
          }
          label={entry.label}
          toggle={doorsOpen === undefined ? undefined : doorsOpenToggle(doorsOpen)}
          {...(entry.fieldsCage === undefined ? {} : { fieldsCage: entry.fieldsCage })}
          {...(entry.beginsEncounter === true ? { beginsEncounter: true } : {})}
          {...(entry.supplement?.identityLabel !== undefined
            ? {
                identity: {
                  label: entry.supplement.identityLabel,
                  owner: entry.supplement.phase.address,
                },
              }
            : {})}
        />
        {content?.rows}
        {doorsOpen?.expanded === true && doorsOpen.detail !== undefined ? (
          <DoorsOpenDetailRow id={doorsOpen.detailId}>{doorsOpen.detail}</DoorsOpenDetailRow>
        ) : null}
      </Fragment>
    );
  };
  const renderSpawned = (
    entry: Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'spawned' }>,
  ) => (
    <SpawnedLootRow
      groups={entry.groups}
      key={`spawned:${entry.key}`}
      label={entry.label}
      rows={actions?.rows ?? []}
      {...(entry.unlocks ? { unlocks: true } : {})}
    />
  );
  // The wheel's offers show where they roll, at Wheels open. It is taken at its choice, or
  // beside its offers while the choice has no place of its own.
  const wheelChoiceAnchored = (timeline: readonly WorkspaceRoomLifecycleTimelineEntry[]) =>
    phaseWheel !== undefined &&
    timeline.some((entry) => isWheelChoiceAnchor(entry, phaseWheel.key));
  const isWheelChoiceAnchor = (entry: WorkspaceRoomLifecycleTimelineEntry, wheelKey: string) => {
    if (entry.kind !== 'action' || entry.presentation !== 'rewardWheelAnchor') return false;
    const row = actions?.rows.find((candidate) => candidate.key === entry.actionKey);
    return row?.reference.kind === 'chooseRewardWheel' && row.reference.wheelKey === wheelKey;
  };
  const renderRow = (
    row: WorkspaceRoomActions['rows'][number],
    supplement?: Extract<
      WorkspaceRoomLifecycleTimelineEntry,
      { readonly kind: 'action' }
    >['supplement'],
    // A row past the stop is not reordered until the walk reaches it.
    waiting = false,
  ) => {
    if (actions === undefined) return null;
    const nemesisInteraction =
      supplement?.kind === 'nemesisInteraction'
        ? interactions.nemesisEvents.get(workspaceInteractionKey(supplement.owner))
        : undefined;
    const proposals = row.proposalKeys.flatMap((key) => {
      const proposal = actions.proposals.find((candidate) => candidate.key === key);
      return proposal === undefined ? [] : [proposal];
    });
    const portrait = npcPortrait(row.labelParts?.npcKey);
    // A Talk row's portrait names the NPC, so the row leads with no second icon.
    // A used object is named by its own chip after the verb, so it leads with no icon.
    const objectChip =
      row.labelParts?.object === true
        ? roomActionIcon(
            row.reference,
            row.address.biomeKey,
            row.sourceFamily,
            row.challengeSwitchKind,
          )
        : undefined;
    const icon =
      portrait === undefined && objectChip === undefined
        ? roomActionIcon(
            row.reference,
            row.address.biomeKey,
            row.sourceFamily,
            row.challengeSwitchKind,
          )
        : undefined;
    const mysteryVerb = inlineMysteryBoonOfferVerb(row);
    // A press on a door reads as its verb, then the door and its new reward as chips.
    const reference = row.reference;
    const pressedWheelPhase =
      reference.kind === 'reroll' &&
      reference.target.kind === 'wheelOffer' &&
      mode.kind === 'shipPhase'
        ? mode.phases.find(
            (phase) =>
              reference.target.kind === 'wheelOffer' &&
              phase.wheel?.key === reference.target.wheelKey,
          )
        : undefined;
    const doorPress =
      reference.kind !== 'reroll'
        ? undefined
        : reference.target.kind !== 'wheelOffer'
          ? doors?.rerolls
          : pressedWheelPhase?.wheelRerolls;
    const pressChips =
      pressedWheelPhase?.wheel !== undefined
        ? wheelOfferChips(pressedWheelPhase.wheel, 'first')
        : doors?.chips;
    // A pressed locked door shows as the Doors open row shows it.
    const unlockedDoorChip =
      reference.kind === 'unlockExit'
        ? doors?.summary?.chips.find((chip) => chip.key === reference.exitKey)
        : undefined;
    const actionAccent = row.stale
      ? undefined
      : row.participation === 'optional'
        ? row.participationOwnedByOverview && row.rank !== null
          ? 'room'
          : 'optional'
        : row.requiredScope;
    const removeRow = (): void => {
      const removable = proposals.find(
        (proposal) => proposal.kind === 'remove' || proposal.kind === 'unplace',
      );
      if (row.purchaseRemoval !== undefined) {
        executeIntent(row.purchaseRemoval);
        return;
      }
      if (removable?.structurallyAuthorable === true) apply(removable.key);
    };
    const sourceBadge = pickupSourceBadgeIcon(row.sourceFamily, row.challengeSwitchKind);
    // The row's name: a reward's icon, an NPC's portrait, or its words.
    const rowName =
      row.labelParts === undefined ? null : row.labelParts.traitKey !== undefined ? (
        <ArtworkChip icon={traitIcon(row.labelParts.traitKey)} label={row.labelParts.name} />
      ) : objectChip !== undefined ? (
        <ArtworkChip icon={objectChip} label={row.labelParts.name} />
      ) : (
        <strong
          {...(row.labelParts.origin === undefined || row.labelParts.reward !== undefined
            ? {}
            : {
                // A name without an icon carries its origin itself, on hover and focus.
                ...hintProps(row.labelParts.origin),
                'aria-label': row.labelParts.name,
                className: 'timeline-row-origin',
                role: 'group',
                tabIndex: 0,
              })}
        >
          {row.labelParts.reward === undefined ? (
            portrait === undefined ? (
              row.labelParts.name
            ) : (
              <RowNpcName name={row.labelParts.name} portrait={portrait} />
            )
          ) : (
            <RowRewardName
              boosted={row.labelParts.reward.boosted}
              {...(row.labelParts.reward.itemKey === undefined
                ? {}
                : { itemKey: row.labelParts.reward.itemKey })}
              name={row.labelParts.name}
              offer={row.labelParts.reward.offer}
              {...(row.labelParts.origin === undefined ? {} : { origin: row.labelParts.origin })}
              {...(row.labelParts.place === undefined ? {} : { place: row.labelParts.place })}
              {...(sourceBadge === undefined ? {} : { sourceBadge })}
            />
          )}
          {row.travelDeal ? <span className="visually-hidden"> · Travel Deal offer</span> : null}
        </strong>
      );
    return (
      <Fragment key={row.key}>
        <TimelineRow
          data-action-accent={actionAccent}
          data-door-press={doorPress === undefined ? undefined : ''}
          data-blocking-product={row.blockingProduct}
          data-reorder-anchor={row.rank === null ? undefined : row.key}
          data-phase={phaseByKey.get(row.key)}
          data-in-order={row.rank === null ? 'false' : 'true'}
          data-room-action-key={row.key}
          {...findingAnchor(row.address)}
          tabIndex={-1}
          kind="action"
          handle={
            row.rank !== null && !waiting ? (
              <TimelineReorderHandle
                findingMark={findingMark(row.address, 'move')}
                item={{
                  key: row.key,
                  label: row.label,
                  positions: roomActionReorderPositions(
                    actions.rows,
                    row,
                    proposals,
                    phaseOf,
                    reorderBanners,
                  ),
                  onMove: apply,
                }}
                session={reorder}
              />
            ) : null
          }
          label={
            <>
              {icon === undefined ? null : (
                <span className="timeline-row-icon">
                  <ArtworkIcon className="artwork-label-icon" source={icon} />
                  {row.travelDeal ? (
                    <ArtworkIcon
                      className="corner-badge timeline-slot-badge timeline-travel-deal-badge"
                      source={traitIcon('RestockBoon')}
                    />
                  ) : row.slot === undefined ? null : (
                    <span aria-hidden="true" className="corner-badge timeline-slot-badge">
                      {row.slot}
                    </span>
                  )}
                </span>
              )}
              {doorPress !== undefined ? (
                <strong>Reroll</strong>
              ) : row.unlockDoorLabel !== undefined ? (
                <strong>Unlock</strong>
              ) : nemesisInteraction !== undefined && nemesisInteraction.value !== null ? (
                <NemesisInteractionSentence
                  findingMark={(control) => findingMark(row.address, control)}
                  interaction={nemesisInteraction}
                />
              ) : row.labelParts === undefined ? (
                // A reroll's object icon and die already say what it does.
                row.featureRoll === undefined ? (
                  <strong>{row.label}</strong>
                ) : (
                  <span className="visually-hidden">{row.label}</span>
                )
              ) : (
                <>
                  {row.labelParts.verb === undefined ? null : (
                    <RoomActionVerb
                      interactions={interactions}
                      row={row}
                      verb={row.labelParts.verb}
                    />
                  )}
                  {mysteryVerb === undefined ? (
                    row.stygianWellTwist === undefined ? (
                      rowName
                    ) : (
                      <StygianWellTwistChips
                        bought={rowName}
                        interactions={interactions}
                        label={row.label}
                        twist={row.stygianWellTwist}
                      />
                    )
                  ) : (
                    <>
                      <RowRewardName name="Mystery Boon" offer={{ rewardType: 'BlindBoxLoot' }} />
                      <span aria-hidden="true" className="row-reward-arrow">
                        →
                      </span>
                      <span className="visually-hidden">resolved to</span>
                      <RoomActionInlineReward interactions={interactions} row={row} />
                    </>
                  )}
                  {row.labelParts.tag === undefined ||
                  // A Ship phase tab already names the wheel's phase.
                  (mode.kind === 'shipPhase' &&
                    row.reference.kind === 'interactWheelReward') ? null : (
                    <span className="timeline-row-tag">{row.labelParts.tag}</span>
                  )}
                </>
              )}
              {row.roll === undefined ? null : (
                <span
                  {...hintProps(`Roll ${row.roll}`, undefined, `Roll ${row.roll}`)}
                  aria-label={`Roll ${row.roll}`}
                  className="timeline-row-icon timeline-roll-die"
                  role="img"
                >
                  <img alt="" className="artwork-label-icon" src={rerollDieArtwork} />
                  <span aria-hidden="true" className="corner-badge timeline-slot-badge">
                    {row.roll}
                  </span>
                </span>
              )}
              {row.featureRoll === undefined ? null : (
                // A reroll's restocked slots follow its die on the label's line.
                <FeatureRollSlots
                  feature={row.featureRoll.feature}
                  interactions={interactions}
                  label={row.label}
                  slots={row.featureRoll.slots}
                />
              )}
              <RoomActionArtificerOutput interactions={interactions} row={row} />
              {row.slot === undefined ? null : (
                <span className="visually-hidden">{` · slot ${row.slot}`}</span>
              )}
              {/* The row's accent and its section show these; only its name says them. */}
              {row.stale ? <span className="visually-hidden"> stale</span> : null}
              {row.rank === null && row.participation === 'required' ? (
                <span className="visually-hidden"> required</span>
              ) : null}
            </>
          }
          editors={
            <>
              {row.unlockDoorLabel !== undefined ? (
                <span className="room-reroll-row-inline">
                  <UnlockedDoor
                    {...(unlockedDoorChip === undefined ? {} : { chip: unlockedDoorChip })}
                    label={row.unlockDoorLabel}
                  />
                  {row.unlockExitEncounter === undefined ? null : (
                    <UnlockExitFightControl
                      encounter={row.unlockExitEncounter}
                      interactions={interactions}
                    />
                  )}
                </span>
              ) : doorPress === undefined ? (
                renderRowContent?.(row)
              ) : (
                <DoorRerollRowReward
                  {...(pressChips === undefined ? {} : { chips: pressChips })}
                  interactions={interactions}
                  rerolls={doorPress}
                  rowKey={row.key}
                />
              )}
              <RoomActionInlineEditors interactions={interactions} row={row} />
              <RoomActionAcquisitionRow
                hideOffer={mysteryVerb !== undefined}
                interactions={interactions}
                row={row}
              />
              {nemesisInteraction?.value === null ? <NemesisEventPending /> : null}
              {renderSupplement(supplement)}
              {/* Sea Star's copy follows the pickup and its decisions. */}
              <SpawnCopyChips
                copies={
                  actions.spawnCopies?.filter((copy) => copy.sourceActionKey === row.key) ?? []
                }
                rows={actions.rows}
              />
            </>
          }
          money={
            row.fightGold !== undefined ? (
              <span className="purchase-cost">
                {row.goldGained === undefined ? null : (
                  <GoldAmount
                    amount={row.goldGained}
                    className={`timeline-gold-gained${row.goldGained.loss ? ' timeline-gold-lost' : ''}`}
                  />
                )}
                <FightGoldAmount gold={row.fightGold} />
              </span>
            ) : row.goldGained === undefined || row.price !== undefined ? (
              <PurchaseCost
                {...(row.affordability === undefined ? {} : { affordability: row.affordability })}
                {...(row.price === undefined ? {} : { price: row.price })}
              />
            ) : (
              <GoldAmount
                amount={row.goldGained}
                className={`timeline-gold-gained${row.goldGained.loss ? ' timeline-gold-lost' : ''}`}
              />
            )
          }
          removal={
            <RoomActionRemovalControl
              findingMark={findingMark(row.address, 'delete')}
              onRemove={removeRow}
              proposals={proposals}
              row={row}
              showRemoval={
                row.reference.kind !== 'interactKeepsakeRack' &&
                row.reference.kind !== 'interactEris' &&
                (!row.participationOwnedByOverview ||
                  row.stale ||
                  row.purchaseRemoval !== undefined)
              }
            />
          }
        />
        {row.travelDealLine === undefined ? null : (
          <TravelDealLine interactions={interactions} line={row.travelDealLine} />
        )}
        {actions.actionSpawns
          ?.filter((spawn) => spawn.sourceActionKey === row.key)
          .map((spawn) => (
            <SpawnedLootRow
              groups={spawn.groups}
              key={spawn.key}
              label={spawn.label}
              rows={actions.rows}
              source
            />
          ))}
      </Fragment>
    );
  };
  const renderAutomaticEffect = (
    entry: Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'automaticEffect' }>,
  ): ReactNode[] => {
    if (entry.effect === 'steadyGrowth') {
      const control = actions?.steadyGrowth?.find(
        (candidate) =>
          workspaceInteractionKey(candidate.address) === workspaceInteractionKey(entry.address),
      );
      return control === undefined
        ? []
        : [
            <SteadyGrowthEffectRow
              control={control}
              interactions={interactions}
              key={workspaceInteractionKey(control.address)}
            />,
          ];
    }
    const control = actions?.transcendentEmbryo?.find(
      (candidate) =>
        workspaceInteractionKey(candidate.address) === workspaceInteractionKey(entry.address),
    );
    return control === undefined
      ? []
      : [
          <TranscendentEmbryoEffectRow
            control={control}
            interactions={interactions}
            key={workspaceInteractionKey(control.address)}
          />,
        ];
  };
  // Past the stop: each authored row, and the authored encounter events of an unreached banner.
  const renderNotReached = (entry: WorkspaceNotReachedEntry): ReactNode[] => {
    if (entry.kind === 'automaticEffect') return renderAutomaticEffect(entry);
    if (entry.kind === 'events')
      return [
        <TimelineRow
          editors={renderSupplement(entry.supplement)}
          key={entry.key}
          kind="action"
          label={<strong>{entry.label}</strong>}
        />,
      ];
    const row = actions?.rows.find((candidate) => candidate.key === entry.actionKey);
    return row === undefined
      ? []
      : [<Fragment key={entry.actionKey}>{renderRow(row, entry.supplement, true)}</Fragment>];
  };
  const liveRow =
    actions?.live === undefined ? null : (
      <LiveRow
        announce={setAnnouncement}
        biomeKey={actions.owner.biomeKey}
        interactions={interactions}
        live={actions.live}
      />
    );
  if (mode.kind !== 'roomTimeline') {
    return (
      <section aria-label="Ship combat structure" className="ship-combat-editor">
        <section
          aria-label={actions === undefined ? undefined : 'Room Timeline'}
          className="room-actions-workbench"
          {...(actions === undefined ? {} : findingAnchor(actions.owner))}
          tabIndex={-1}
        >
          <p aria-live="polite" className="visually-hidden">
            {announcement}
          </p>
          <div className="ship-phase-list" ref={attachRoot}>
            {(mode.kind === 'shipPhase' ? [mode.phase] : []).map((phase) => {
              const choiceAnchored = wheelChoiceAnchored(phase.timeline);
              const selectWheel =
                phaseWheel === undefined
                  ? []
                  : [
                      <SelectWheelRow
                        interactions={interactions}
                        key={`select:${phaseWheel.key}`}
                        wheel={phaseWheel}
                      />,
                    ];
              const renderPhaseTimelineEntry = (
                entry: WorkspaceRoomLifecycleTimelineEntry,
              ): ReactNode[] => {
                if (
                  entry.kind === 'boundary' &&
                  entry.boundary.kind === 'wheelsOpen' &&
                  phaseWheel?.key === entry.boundary.wheelKey &&
                  wheelDoors !== undefined
                )
                  return [
                    <DoorsOpenBanner doors={wheelDoors} key="wheel-open" label={entry.label} />,
                    ...(choiceAnchored ? [] : selectWheel),
                  ];
                // The wheel is taken as the next phase starts.
                if (phaseWheel !== undefined && isWheelChoiceAnchor(entry, phaseWheel.key))
                  return selectWheel;
                if (entry.kind === 'boundary') return [renderBoundary(entry)];
                if (entry.kind === 'spawned') return [renderSpawned(entry)];
                if (entry.kind === 'automaticEffect') return renderAutomaticEffect(entry);
                if (entry.presentation !== 'row') return [];
                const row = actions?.rows.find((candidate) => candidate.key === entry.actionKey);
                return row === undefined
                  ? []
                  : [<Fragment key={entry.actionKey}>{renderRow(row, entry.supplement)}</Fragment>];
              };
              return (
                <section
                  aria-label={`${phase.label} ship phase`}
                  className="ship-phase"
                  key={phase.key}
                >
                  <div className="room-timeline-main">
                    {phase.waitsOn !== undefined ||
                    (phase.actionRows.length === 0 && phase.timeline.length === 0) ? null : (
                      <ol aria-label={`${phase.label} timeline`} className="room-action-list">
                        {withMapStage(phase.timeline, renderPhaseTimelineEntry)}
                        {phase.holdsLive === true ? liveRow : null}
                        {doorsTail(phase.timeline)}
                      </ol>
                    )}
                    {phase.waitsOn === undefined ? null : (
                      <>
                        <StopNotice at={phase.waitsOn} />
                        {doorsTail([]) === null ? null : (
                          <ol aria-label={`${phase.label} timeline`} className="room-action-list">
                            {doorsTail([])}
                          </ol>
                        )}
                      </>
                    )}
                    {phase.notReached === undefined || phase.notReached.length === 0 ? null : (
                      <NotReachedGroup count={phase.notReached.length}>
                        {phase.notReached.flatMap(renderNotReached)}
                      </NotReachedGroup>
                    )}
                  </div>
                </section>
              );
            })}
            {mode.kind !== 'shipRepairs' || mode.rows.length === 0 ? null : (
              <section aria-label="Ship action repairs" className="ship-action-repairs">
                <div className="local-reward-heading">
                  <h4>Inactive actions</h4>
                </div>
                <ol aria-label="Inactive Ship actions" className="room-action-list">
                  {mode.rows.map((row) => renderRow(row))}
                </ol>
              </section>
            )}
          </div>
          <TimelineReorderStatus session={reorder} />
        </section>
      </section>
    );
  }
  if (actions === undefined) return null;
  const actionByKey = new Map(actions.rows.map((row) => [row.key, row]));
  const renderTimelineEntry = (entry: WorkspaceRoomLifecycleTimelineEntry): ReactNode[] => {
    if (entry.kind === 'boundary') {
      return [renderBoundary(entry)];
    }
    if (entry.kind === 'spawned') return [renderSpawned(entry)];
    if (entry.kind === 'automaticEffect') return renderAutomaticEffect(entry);
    if (entry.presentation !== 'row') return [];
    const row = actionByKey.get(entry.actionKey);
    return row === undefined
      ? []
      : [<Fragment key={entry.actionKey}>{renderRow(row, entry.supplement)}</Fragment>];
  };
  const timelineRows = withMapStage(actions.timeline.entries, renderTimelineEntry);
  return (
    <section
      aria-label="Room Timeline"
      className="room-actions-workbench"
      {...findingAnchor(actions.owner)}
      tabIndex={-1}
    >
      <div className="room-timeline-main">
        <p aria-live="polite" className="visually-hidden">
          {announcement}
        </p>
        {actions.timeline.waitsOn === undefined ? (
          <ol aria-label="Room timeline" className="room-action-list" ref={attachRoot}>
            {timelineRows}
            {liveRow}
            {doorsTail(actions.timeline.entries)}
          </ol>
        ) : (
          <>
            <StopNotice at={actions.timeline.waitsOn} />
            {doorsTail([]) === null && liveRow === null ? null : (
              <ol aria-label="Room timeline" className="room-action-list" ref={attachRoot}>
                {liveRow}
                {doorsTail([])}
              </ol>
            )}
          </>
        )}
        {(actions.timeline.notReached?.length ?? 0) === 0 ? null : (
          <NotReachedGroup count={actions.timeline.notReached?.length ?? 0}>
            {(actions.timeline.notReached ?? []).flatMap(renderNotReached)}
          </NotReachedGroup>
        )}
        {children}
        {actions.repairRows.length === 0 ? null : (
          <section aria-label="Timeline repairs" className="room-action-repairs">
            <div className="local-reward-heading">
              <h5>Timeline repairs</h5>
            </div>
            <ol aria-label="Timeline repairs" className="room-action-list">
              {actions.repairRows.map((row) => renderRow(row))}
            </ol>
          </section>
        )}
        <TimelineReorderStatus session={reorder} />
      </div>
    </section>
  );
}
