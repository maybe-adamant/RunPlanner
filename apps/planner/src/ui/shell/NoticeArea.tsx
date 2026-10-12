import { useState, useSyncExternalStore } from 'react';

import { ModalDialog } from '@planner/ui/controls/ModalDialog';

import type { ReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import {
  releaseUpdateNoticeShown,
  type UpdateInstallLabel,
} from '@planner/projections/releaseUpdate';
import type { CommunityEventController, EventNotice } from '@planner/workspace/communityEvents';
import { ReleaseUpdateNotice } from './ReleaseUpdates';

const IDLE_UPDATE = { kind: 'idle' } as const;
const NO_EVENT: EventNotice = { kind: 'none' };
const noSubscription = () => () => undefined;
const idleUpdate = () => IDLE_UPDATE;
const noEvent = () => NO_EVENT;

function eventEnds(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ActiveEventNotice({
  confirmOpenProject,
  controller,
  notice,
}: {
  readonly confirmOpenProject: boolean;
  readonly controller: CommunityEventController;
  readonly notice: Extract<EventNotice, { kind: 'active' }>;
}) {
  const { event } = notice;
  const [details, setDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const openProject = async () => {
    setConfirming(false);
    setPending(true);
    setMessage(null);
    try {
      const result = await controller.openProject();
      if (result.status === 'failure') setMessage(`Couldn’t open the project: ${result.message}`);
    } finally {
      setPending(false);
    }
  };
  const copyLink = async () => {
    if (event.projectUrl === null) return;
    try {
      await globalThis.navigator.clipboard.writeText(event.projectUrl);
      setMessage('Link copied.');
    } catch {
      setMessage('Couldn’t copy the link.');
    }
  };
  return (
    <aside aria-label="Community event" className="release-update-notice event-notice">
      <div className="event-notice-body">
        <span>
          Event: {event.title} · ends <time dateTime={event.endsAt}>{eventEnds(event.endsAt)}</time>
        </span>
        {details && (
          <div className="event-notice-details" id={`event-details-${event.id}`}>
            <p>{event.description}</p>
            {event.rules === null ? null : <p>{event.rules}</p>}
          </div>
        )}
        {message === null ? null : <p role="status">{message}</p>}
      </div>
      <div className="release-update-actions">
        <button
          aria-controls={details ? `event-details-${event.id}` : undefined}
          aria-expanded={details}
          className="quiet-action action-compact"
          onClick={() => setDetails((open) => !open)}
          type="button"
        >
          Details
        </button>
        {event.projectUrl === null ? null : (
          <>
            <button
              className="secondary-action action-compact"
              disabled={pending}
              onClick={() => {
                if (confirmOpenProject) setConfirming(true);
                else void openProject();
              }}
              type="button"
            >
              {pending ? 'Opening…' : 'Open project'}
            </button>
            <button
              className="quiet-action action-compact"
              onClick={() => void copyLink()}
              type="button"
            >
              Copy link
            </button>
          </>
        )}
        <button className="quiet-action action-compact" onClick={controller.dismiss} type="button">
          Dismiss
        </button>
      </div>
      {confirming && (
        <ModalDialog
          describedBy="event-open-project-message"
          labelledBy="event-open-project-title"
          onCancel={() => setConfirming(false)}
          pending={false}
        >
          <header className="panel-heading">
            <h2 id="event-open-project-title">Replace the open project?</h2>
          </header>
          <p className="game-publication-message" id="event-open-project-message">
            The open project has unsaved changes. Opening the event’s project replaces it with an
            unsaved copy of the event.
          </p>
          <footer className="game-publication-actions">
            <button className="quiet-action" onClick={() => setConfirming(false)} type="button">
              Cancel
            </button>
            <button className="danger-action" onClick={() => void openProject()} type="button">
              Open project
            </button>
          </footer>
        </ModalDialog>
      )}
    </aside>
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
    <aside
      aria-label="Community event"
      className="release-update-notice event-notice"
      role="status"
    >
      <span>
        {notice.title === null ? 'The event ended.' : `Event ended: ${notice.title}.`}{' '}
        {notice.fallbackSlotHasPlan
          ? 'The next run uses Slot 1 — choose another slot in the Game panel or in game.'
          : 'The next run has no plan until you choose a slot.'}
      </span>
      <div className="release-update-actions">
        <button className="quiet-action action-compact" onClick={controller.dismiss} type="button">
          Dismiss
        </button>
      </div>
    </aside>
  );
}

/** One notice at a time: an app update first, otherwise the community event. */
export function NoticeArea({
  communityEvents,
  confirmOpenProject = false,
  installLabel,
  releaseUpdates,
}: {
  readonly communityEvents: CommunityEventController | undefined;
  /** Opening an event's project first asks to replace an open project with unsaved work. */
  readonly confirmOpenProject?: boolean;
  readonly installLabel: UpdateInstallLabel;
  readonly releaseUpdates: ReleaseUpdateController | undefined;
}) {
  const updateSnapshot = releaseUpdates?.getSnapshot ?? idleUpdate;
  const update = useSyncExternalStore(
    releaseUpdates?.subscribe ?? noSubscription,
    updateSnapshot,
    updateSnapshot,
  );
  const eventSnapshot = communityEvents?.getSnapshot ?? noEvent;
  const event = useSyncExternalStore(
    communityEvents?.subscribe ?? noSubscription,
    eventSnapshot,
    eventSnapshot,
  );
  if (releaseUpdates !== undefined && releaseUpdateNoticeShown(update)) {
    return <ReleaseUpdateNotice controller={releaseUpdates} installLabel={installLabel} />;
  }
  if (communityEvents === undefined) return null;
  switch (event.kind) {
    case 'none':
      return null;
    case 'active':
      return (
        <ActiveEventNotice
          confirmOpenProject={confirmOpenProject}
          controller={communityEvents}
          key={event.event.id}
          notice={event}
        />
      );
    case 'ended':
      return <EndedEventNotice controller={communityEvents} notice={event} />;
  }
}
