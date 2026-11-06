import { useEffect, useState, type FocusEvent } from 'react';

import type {
  WorkspaceHubDecisionNode,
  WorkspaceHubSlot,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { hintProps } from '@planner/ui/controls/hint';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { useFindingTarget, type FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { hubMapPosition, type HubMapAnnotation } from '@planner/ui/room-maps/HubMapAnnotations';
import { DoorRewardEditor } from './DoorRewardEditor';
import { HubBoardMap, HubDoorFace } from './hub-map/HubBoardMap';
import { useHubSlotMembership } from './hub-map/useHubSlotMembership';
import { useMapMarkerActivation } from './hub-map/useMapMarkerActivation';

/** How long a newly opened door's row stays highlighted after the rows re-sort. */
const recentRowMilliseconds = 1600;

/** A row or control marked with its owner's findings, without taking its owner's lock. */
function findingMarks(target: FindingTargetProps) {
  return {
    'aria-description': target['aria-description'],
    'data-has-findings': target['data-has-findings'],
    'data-selected-finding': target['data-selected-finding'],
    'data-semantic-owner': target['data-semantic-owner'],
    id: target.id,
    ref: target.ref,
  };
}

/** The first draw's icon: Overview shows the board as it is generated. */
function firstDrawIcon(slot: WorkspaceHubSlot) {
  if (slot.door?.offerRewardSurface.visibility !== 'visible') return undefined;
  const rewards = slot.door.offerRewardSurface.rewards;
  const offer = rewards.length === 1 ? rewards[0]?.offer : undefined;
  return offer === null || offer === undefined ? undefined : offerIcon(offer);
}

function OverviewDoor({
  annotation,
  interactions,
  linked,
  onLink,
  slot,
}: {
  readonly annotation: HubMapAnnotation;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly linked: boolean;
  readonly onLink: (slotKey: string | undefined) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  const membership = useHubSlotMembership({ interactions, slot });
  const pointer = useMapMarkerActivation(
    () => membership.activate(),
    () => membership.prepare(),
  );
  const name = `${slot.open ? 'Close' : 'Open'} ${slot.label}`;
  // An unavailable door stays focusable so its reason is reachable from the keyboard.
  const reason = !membership.disabled
    ? undefined
    : membership.waiting
      ? candidateWaitingHint
      : slot.open
        ? slot.canClose
          ? undefined
          : 'Remove this room from the visit order first.'
        : slot.canOpen
          ? undefined
          : 'The board is full.';
  const icon = slot.open ? firstDrawIcon(slot) : undefined;
  return (
    <button
      aria-busy={membership.pending || undefined}
      aria-disabled={membership.disabled || undefined}
      aria-label={name}
      aria-pressed={slot.open}
      className="hub-map-marker"
      data-category={annotation.category}
      data-hub-slot-key={slot.hubSlotKey}
      data-linked={linked || undefined}
      data-open={slot.open}
      data-room-map-overlay-control
      onBlur={() => onLink(undefined)}
      onFocus={() => {
        onLink(slot.open ? slot.hubSlotKey : undefined);
        if (slot.open) membership.prepare();
      }}
      onPointerEnter={() => onLink(slot.open ? slot.hubSlotKey : undefined)}
      onPointerLeave={() => onLink(undefined)}
      {...pointer}
      style={hubMapPosition(annotation)}
      {...hintProps(reason, undefined, name)}
      type="button"
    >
      <HubDoorFace
        icons={icon === undefined ? [] : [icon]}
        label={annotation.mapLabel}
        {...(slot.open ? {} : { status: 'Closed' })}
      />
    </button>
  );
}

function DoorRow({
  interactions,
  linked,
  onLink,
  recent,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly linked: boolean;
  readonly onLink: (slotKey: string | undefined) => void;
  readonly recent: boolean;
  readonly slot: WorkspaceHubSlot;
}) {
  const findingTarget = useFindingTarget();
  const leave = (event: FocusEvent<HTMLLIElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLink(undefined);
  };
  return (
    <li
      {...findingMarks(findingTarget(slot.marker.address))}
      aria-label={slot.label}
      className="hub-door-row"
      data-hub-slot-key={slot.hubSlotKey}
      data-linked={linked || undefined}
      data-recent={recent || undefined}
      onBlur={leave}
      onFocus={() => onLink(slot.hubSlotKey)}
      onPointerEnter={() => onLink(slot.hubSlotKey)}
      onPointerLeave={() => onLink(undefined)}
      tabIndex={-1}
    >
      <span className="hub-door-row-draw">{slot.drawPosition ?? ''}</span>
      <span className="hub-door-row-room">{slot.label}</span>
      {slot.door === undefined ? (
        <span className="fixed-room-state">No reward</span>
      ) : (
        <DoorRewardEditor
          door={slot.door}
          idPrefix={`hub-${slot.hubSlotKey}`}
          interactions={interactions}
          layout="row"
        />
      )}
    </li>
  );
}

/** Rewards in draw order beside the board, whose doors open and close the slots. */
export function HubOverview({
  hubIdentity,
  interactions,
  node,
}: {
  readonly hubIdentity: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}) {
  const findingTarget = useFindingTarget();
  const [linked, setLinked] = useState<string>();
  const openSlots = node.slots
    .filter((slot) => slot.open)
    .sort(
      (left, right) =>
        (left.drawPosition ?? Number.POSITIVE_INFINITY) -
        (right.drawPosition ?? Number.POSITIVE_INFINITY),
    );
  const openKeys = openSlots.map((slot) => slot.hubSlotKey);
  const openIdentity = `${hubIdentity}|${[...openKeys].sort().join(',')}`;
  const requirement = node.requirements.openRooms;
  // Rewards are drawn once the board is full, so rows wait for its least door count.
  const boardFull = requirement.current >= requirement.min;
  // The door just opened onto a full board, highlighted while its row settles into draw order.
  const [recent, setRecent] = useState<{ readonly identity: string; readonly key?: string }>({
    identity: openIdentity,
  });
  if (recent.identity !== openIdentity) {
    const [previousHub, previousKeys = ''] = recent.identity.split('|');
    const before = new Set(previousKeys.split(',').filter((key) => key !== ''));
    const added =
      previousHub === hubIdentity && before.size >= requirement.min
        ? openKeys.find((key) => !before.has(key))
        : undefined;
    setRecent(
      added === undefined ? { identity: openIdentity } : { identity: openIdentity, key: added },
    );
  }
  useEffect(() => {
    if (recent.key === undefined) return;
    const timer = window.setTimeout(
      () => setRecent((current) => ({ identity: current.identity })),
      recentRowMilliseconds,
    );
    return () => window.clearTimeout(timer);
  }, [recent]);
  // Membership findings land here; a closed door has no row of its own.
  const status = findingTarget(
    node.openSet.address,
    undefined,
    node.owner,
    undefined,
    node.slots.filter((slot) => !slot.open).map((slot) => slot.marker.address),
  );
  const range =
    requirement.min === requirement.max
      ? `${requirement.min}`
      : `${requirement.min}–${requirement.max}`;
  const slotsByKey = new Map(node.slots.map((slot) => [slot.hubSlotKey, slot] as const));
  return (
    <div className="hub-overview-layout">
      <section aria-label="Hub door rewards" className="hub-overview-rewards">
        {!boardFull ? (
          <p
            {...findingMarks(status)}
            className="hub-board-status-line hub-board-placeholder"
            role="status"
            tabIndex={-1}
          >
            {`Open ${range} doors to set rewards · ${requirement.current} open`}
          </p>
        ) : (
          <>
            {requirement.met && !status['data-has-findings'] ? (
              <span {...findingMarks(status)} className="hub-board-status-line" tabIndex={-1} />
            ) : (
              <p
                {...findingMarks(status)}
                className="hub-board-status-line"
                data-met={requirement.met}
                role="status"
                tabIndex={-1}
              >
                {`${requirement.current} doors open`}
              </p>
            )}
            <ol aria-label="Doors in draw order" className="hub-door-rows">
              {openSlots.map((slot) => (
                <DoorRow
                  interactions={interactions}
                  key={slot.hubSlotKey}
                  linked={linked === slot.hubSlotKey}
                  onLink={setLinked}
                  recent={recent.key === slot.hubSlotKey}
                  slot={slot}
                />
              ))}
            </ol>
          </>
        )}
      </section>
      <HubBoardMap
        door={(annotation) => {
          const slot = slotsByKey.get(annotation.hubSlotKey);
          if (slot === undefined || slot.gameName !== annotation.gameName)
            throw new Error(
              `Hub map annotation ${annotation.hubSlotKey} has no matching Hub slot.`,
            );
          return (
            <OverviewDoor
              annotation={annotation}
              interactions={interactions}
              key={annotation.hubSlotKey}
              linked={linked === slot.hubSlotKey}
              onLink={setLinked}
              slot={slot}
            />
          );
        }}
        gameName={node.gameName}
        hubIdentity={hubIdentity}
        label="Ephyra Hub map"
      />
    </div>
  );
}
