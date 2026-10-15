import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import type {
  GameEventSummary,
  GamePlanPublication,
  GamePlanSlotSummary,
  GamePublicationBlocker,
} from './gameModuleHost';

/** One community event's metadata, as the host verified and validated it. */
export interface CommunityEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rules: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly projectUrl: string;
  /** Lower-case hex SHA-256 of the project file, which the host checks on download. */
  readonly projectSha256: string;
  /** The authored project schema pair the project file is saved in. */
  readonly projectSchemaVersion: number;
  readonly projectSchemaRevision: number;
}

/** The active event's project as the host holds it. */
export type ActiveEventProject =
  /** The project file's text, verified against the event's signed hash. */
  | { readonly kind: 'verified'; readonly json: string }
  /** Saved in a project schema this planner cannot load, so it was not downloaded. */
  | { readonly kind: 'unsupportedSchema' }
  /** The download or its verification failed. */
  | { readonly kind: 'unavailable'; readonly problem: string };

export interface ActiveCommunityEvent {
  readonly event: CommunityEvent;
  readonly project: ActiveEventProject;
}

/** The project schema majors this planner loads, inclusive, and the newest major's revision. */
export interface ProjectSchemaRange {
  readonly oldest: number;
  readonly newest: number;
  readonly newestRevision: number;
}

export interface EventFeedSnapshot {
  /** The active event, or null when there is none. */
  readonly active: ActiveCommunityEvent | null;
  /**
   * Where the verified events came from; `cache` is the last verified feed, kept offline, and
   * `disabled` means no event key is installed, so there are no events.
   */
  readonly source: 'none' | 'network' | 'cache' | 'disabled';
  /** Why the last fetch failed, when it did. */
  readonly problem: string | null;
}

export interface EventSlotClearing {
  /**
   * `alreadyEmpty`: no event slot file and no overview entry. `kept`: without verified event
   * data, the event slot stays until its own event ends.
   */
  readonly status: 'cleared' | 'alreadyEmpty' | 'kept' | 'blocked' | 'nativeWrite';
  readonly message: string;
  readonly blockers: readonly GamePublicationBlocker[];
  /** The event the cleared slot held. */
  readonly clearedEvent: GameEventSummary | null;
  /** The event slot was active, so slot 1 now is. */
  readonly activeSlotMoved: boolean;
  readonly activationProblem: string | null;
  /** Whether slot 1, which takes over from an active event slot, holds a plan. */
  readonly fallbackSlotHasPlan: boolean;
}

/** The host's signed community event feed and the event slot it fills. */
export interface CommunityEventHost {
  /**
   * Fetches the feed unless it was read recently, or at once after a failed fetch when
   * `retryFailed`; offline, the last verified feed stands. The active event's project is
   * downloaded and verified only when `projectSchemas` admits it.
   */
  readonly refreshFeed: (
    retryFailed: boolean,
    projectSchemas: ProjectSchemaRange,
  ) => Promise<EventFeedSnapshot>;
  /**
   * Writes a plan to the event slot for the active event. The host refuses a plan not compiled
   * from the project it verified for that event, and writes its own event metadata.
   */
  readonly publishEvent: (
    eventId: string,
    planJson: string,
    summary: GamePlanSlotSummary,
  ) => Promise<GamePlanPublication>;
  /** Removes the event slot's plan and entry; an active event slot hands over to slot 1. */
  readonly clearEvent: () => Promise<EventSlotClearing>;
  /** A verified event's project file as text. */
  readonly downloadProject: (eventId: string) => Promise<string>;
}

/**
 * Development builds only: a local event folder, `event.json` with `project.runplanner.json`,
 * in place of the feed's event.
 */
export interface CommunityEventDevelopmentHost {
  /** Resolves null when the folder picker is cancelled. */
  readonly pickEventFolder: () => Promise<string | null>;
  readonly loadEventFolder: (path: string) => Promise<CommunityEvent>;
  readonly clearLocalEvent: () => Promise<void>;
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTauriCommunityEventHost(invoke: Invoke = tauriInvoke): CommunityEventHost {
  return Object.freeze({
    refreshFeed: (retryFailed: boolean, projectSchemas: ProjectSchemaRange) =>
      invoke<EventFeedSnapshot>('event_feed_refresh', { retryFailed, projectSchemas }),
    publishEvent: (eventId: string, planJson: string, summary: GamePlanSlotSummary) =>
      invoke<GamePlanPublication>('game_event_publish', { eventId, planJson, summary }),
    clearEvent: () => invoke<EventSlotClearing>('game_event_clear'),
    downloadProject: (eventId: string) => invoke<string>('event_project_download', { eventId }),
  });
}

export interface TauriCommunityEventDevelopmentEnvironment {
  readonly invoke: Invoke;
  readonly chooseEventFolder: () => Promise<string | null>;
}

export function createTauriCommunityEventDevelopmentHost(
  environment: TauriCommunityEventDevelopmentEnvironment = {
    invoke: tauriInvoke,
    chooseEventFolder: () =>
      open({ directory: true, multiple: false, title: 'Import Event Folder' }),
  },
): CommunityEventDevelopmentHost {
  return Object.freeze({
    pickEventFolder: () => environment.chooseEventFolder(),
    loadEventFolder: (path: string) =>
      environment.invoke<CommunityEvent>('game_event_folder_load', { path }),
    clearLocalEvent: () => environment.invoke<void>('game_event_local_clear'),
  });
}

const DISMISSED_EVENTS_KEY = 'run-planner.dismissed-events';
const MAX_DISMISSED_EVENTS = 50;

/** Dismissed event notices by event id, kept in this browser profile; in memory when blocked. */
export function createBrowserEventDismissalPreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
) {
  let session: readonly string[] = [];
  const read = (): readonly string[] => {
    try {
      const parsed: unknown = JSON.parse(storage().getItem(DISMISSED_EVENTS_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return session;
    }
  };
  return Object.freeze({
    isDismissed: (eventId: string) => read().includes(eventId) || session.includes(eventId),
    dismiss: (eventId: string) => {
      session = [...read().filter((id) => id !== eventId), eventId].slice(-MAX_DISMISSED_EVENTS);
      try {
        storage().setItem(DISMISSED_EVENTS_KEY, JSON.stringify(session));
      } catch {
        // The dismissal remains in memory when local storage is restricted.
      }
    },
  });
}
