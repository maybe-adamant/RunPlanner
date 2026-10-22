import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import type { GameStatusController } from '@planner/persistence/gameModuleHost';
import type { ReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import { projectEventPlaysNext } from '@planner/projections/gamePanel';
import { releaseUpdateNoticeShown } from '@planner/projections/releaseUpdate';
import type { CommunityEventController, EventNotice } from '@planner/workspace/communityEvents';
import { ReleaseUpdateNotice } from './ReleaseUpdates';

const IDLE_UPDATE = { kind: 'idle' } as const;
const NO_EVENT: EventNotice = { kind: 'none' };
const noSubscription = () => () => undefined;
const idleUpdate = () => IDLE_UPDATE;
const noEvent = () => NO_EVENT;
const noStatus = () => false;

function eventEnds(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Every label shares one grid cell, so the control keeps the widest one's width. */
function StableLabel({
  current,
  labels,
}: {
  readonly current: string;
  readonly labels: readonly string[];
}) {
  return (
    <span className="stable-label">
      {labels.map((label) =>
        label === current ? (
          <span key={label}>{label}</span>
        ) : (
          <span aria-hidden="true" data-stable-hidden="" key={label}>
            {label}
          </span>
        ),
      )}
    </span>
  );
}

const COPY_LABELS = ['Copy link', 'Copied', 'Copy failed'] as const;
const OPEN_LABELS = ['Open project', 'Opening…'] as const;
const ACTIVE_LABELS = ['Set as active', 'Active'] as const;
const COPY_FEEDBACK_MS = 2_000;

function EventNoticeBar({
  actions,
  children,
  className = 'release-update-notice event-notice',
  headline,
  label = 'Community event',
  status = false,
}: {
  readonly actions: ReactNode;
  readonly className?: string;
  readonly label?: string;
  readonly children?: ReactNode;
  /** One line, truncated with an ellipsis. */
  readonly headline: { readonly text: string; readonly ends?: string };
  readonly status?: boolean;
}) {
  return (
    <aside aria-label={label} className={className} {...(status ? { role: 'status' } : {})}>
      <div className="event-notice-body">
        <div className="event-notice-headline">
          <span className="event-notice-title">{headline.text}</span>
          {headline.ends === undefined ? null : (
            <span className="event-notice-ends">
              {' · ends '}
              <time dateTime={headline.ends}>{eventEnds(headline.ends)}</time>
            </span>
          )}
        </div>
        {children}
      </div>
      <div className="release-update-actions">{actions}</div>
    </aside>
  );
}

function ActiveEventNotice({
  controller,
  notice,
  playsNext,
}: {
  readonly controller: CommunityEventController;
  readonly notice: Extract<EventNotice, { kind: 'active' }>;
  /** Whether the game module plays the event slot's plan next, as last read. */
  readonly playsNext: boolean;
}) {
  const { event } = notice;
  const [details, setDetails] = useState(false);
  const [pending, setPending] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [copy, setCopy] = useState<(typeof COPY_LABELS)[number]>('Copy link');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (copy === 'Copy link') return;
    const timer = setTimeout(() => setCopy('Copy link'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copy]);
  const openProject = async () => {
    setPending(true);
    setMessage(null);
    try {
      const result = await controller.openProject();
      if (result.status === 'failure') setMessage(`Couldn’t open the project: ${result.message}`);
    } finally {
      setPending(false);
    }
  };
  const play = async () => {
    setPlaying(true);
    setMessage(null);
    try {
      const problem = await controller.playEvent();
      if (problem !== null) setMessage(`Not made active: ${problem}`);
    } finally {
      setPlaying(false);
    }
  };
  const copyLink = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(event.projectUrl);
      setCopy('Copied');
    } catch {
      setCopy('Copy failed');
    }
  };
  const detailsId = `event-details-${event.id}`;
  return (
    <EventNoticeBar
      className="event-card"
      actions={
        <>
          {/* One element in both states, so focus stays when the event becomes the next run. */}
          {notice.problem === null ? (
            <button
              aria-disabled={playsNext || playing || undefined}
              aria-live="polite"
              className={`secondary-action action-compact${playsNext ? ' event-notice-plays' : ''}`}
              onClick={() => {
                if (!playsNext && !playing) void play();
              }}
              type="button"
            >
              <StableLabel
                current={playsNext ? 'Active' : 'Set as active'}
                labels={ACTIVE_LABELS}
              />
            </button>
          ) : null}
          <button
            aria-controls={details ? detailsId : undefined}
            aria-expanded={details}
            className="quiet-action action-compact"
            onClick={() => setDetails((open) => !open)}
            type="button"
          >
            Details
          </button>
          <button
            className="quiet-action action-compact"
            disabled={pending}
            onClick={() => void openProject()}
            type="button"
          >
            <StableLabel current={pending ? 'Opening…' : 'Open project'} labels={OPEN_LABELS} />
          </button>
          <button
            aria-live="polite"
            className="quiet-action action-compact"
            onClick={() => void copyLink()}
            type="button"
          >
            <StableLabel current={copy} labels={COPY_LABELS} />
          </button>
          <button
            className="quiet-action action-compact"
            onClick={controller.dismiss}
            type="button"
          >
            Dismiss
          </button>
        </>
      }
      headline={{ text: `Event: ${event.title}`, ends: event.endsAt }}
    >
      {details && (
        <div className="event-notice-details" id={detailsId}>
          <p className="event-notice-details-title">{event.title}</p>
          <p>{event.description}</p>
          {event.rules === null ? null : <p>{event.rules}</p>}
        </div>
      )}
      {notice.problem === null ? null : <p>{notice.problem}</p>}
      {message === null ? null : <p role="alert">{message}</p>}
    </EventNoticeBar>
  );
}

function EndedEventNotice({
  controller,
  notice,
}: {
  readonly controller: CommunityEventController;
  readonly notice: Extract<EventNotice, { kind: 'ended' }>;
}) {
  return (
    <EventNoticeBar
      actions={
        <button className="quiet-action action-compact" onClick={controller.dismiss} type="button">
          Dismiss
        </button>
      }
      headline={{
        text: notice.title === null ? 'The event ended.' : `Event ended: ${notice.title}.`,
      }}
      status
    >
      <p>
        {notice.fallbackSlotHasPlan
          ? 'The next run uses Slot 1 — choose another slot on the Game tab or in game.'
          : 'The next run has no plan until you choose a slot.'}
      </p>
    </EventNoticeBar>
  );
}

function useEventNotice(communityEvents: CommunityEventController | undefined) {
  const eventSnapshot = communityEvents?.getSnapshot ?? noEvent;
  return useSyncExternalStore(
    communityEvents?.subscribe ?? noSubscription,
    eventSnapshot,
    eventSnapshot,
  );
}

/** The active community event on the Game tab, or nothing. */
export function CommunityEventCard({
  communityEvents,
  gameStatus,
}: {
  readonly communityEvents: CommunityEventController;
  /** The game status, which names the slot played next. */
  readonly gameStatus?: GameStatusController;
}) {
  const event = useEventNotice(communityEvents);
  const statusSnapshot = gameStatus?.getSnapshot;
  const eventPlaysNext =
    statusSnapshot === undefined ? noStatus : () => projectEventPlaysNext(statusSnapshot().status);
  const playsNext = useSyncExternalStore(
    gameStatus?.subscribe ?? noSubscription,
    eventPlaysNext,
    eventPlaysNext,
  );
  if (event.kind !== 'active') return null;
  return (
    <ActiveEventNotice
      controller={communityEvents}
      key={event.event.id}
      notice={event}
      playsNext={playsNext}
    />
  );
}

/** One notice at a time across the app: an app update first, then an ended event. */
export function NoticeArea({
  communityEvents,
  releaseUpdates,
}: {
  readonly communityEvents: CommunityEventController | undefined;
  readonly releaseUpdates: ReleaseUpdateController | undefined;
}) {
  const updateSnapshot = releaseUpdates?.getSnapshot ?? idleUpdate;
  const update = useSyncExternalStore(
    releaseUpdates?.subscribe ?? noSubscription,
    updateSnapshot,
    updateSnapshot,
  );
  const event = useEventNotice(communityEvents);
  // The area is one content layer above the window backdrop, whichever notice it holds.
  if (releaseUpdates !== undefined && releaseUpdateNoticeShown(update)) {
    return (
      <div className="notice-area">
        <ReleaseUpdateNotice controller={releaseUpdates} />
      </div>
    );
  }
  if (communityEvents === undefined || event.kind !== 'ended') return null;
  return (
    <div className="notice-area">
      <EndedEventNotice controller={communityEvents} notice={event} />
    </div>
  );
}
