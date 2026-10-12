import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

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
  readonly projectUrl: string | null;
  /** Lower-case hex SHA-256 of the project file, which the host checks on download. */
  readonly projectSha256: string | null;
}

/** An event and its execution plan for this app's game module build, as published. */
export interface CommunityEventPlan {
  readonly event: CommunityEvent;
  readonly planJson: string;
}

export interface EventFeedSnapshot {
  /** The active event for this app's game module build, or null when there is none. */
  readonly active: CommunityEventPlan | null;
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
   * `retryFailed`; offline, the last verified feed stands.
   */
  readonly refreshFeed: (retryFailed: boolean) => Promise<EventFeedSnapshot>;
  /**
   * Writes the active verified event to the event slot. Only the display summary is supplied;
   * the host refuses when its active event or plan is not the one named.
   */
  readonly publishEvent: (
    eventId: string,
    planFingerprint: string,
    summary: GamePlanSlotSummary,
  ) => Promise<GamePlanPublication>;
  /** Removes the event slot's plan and entry; an active event slot hands over to slot 1. */
  readonly clearEvent: () => Promise<EventSlotClearing>;
  /** Downloads a verified event's project file as text. */
  readonly downloadProject: (eventId: string) => Promise<string>;
}

/** Development builds only: a local event file in place of the feed's event, and export. */
export interface CommunityEventDevelopmentHost {
  /** Resolves null when the file picker is cancelled. */
  readonly pickEventFile: () => Promise<string | null>;
  readonly loadEventFile: (path: string) => Promise<CommunityEventPlan>;
  readonly clearLocalEvent: () => Promise<void>;
  /** Asks where to save; resolves false when cancelled. */
  readonly saveEventFile: (defaultFileName: string, json: string) => Promise<boolean>;
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTauriCommunityEventHost(invoke: Invoke = tauriInvoke): CommunityEventHost {
  return Object.freeze({
    refreshFeed: (retryFailed: boolean) =>
      invoke<EventFeedSnapshot>('event_feed_refresh', { retryFailed }),
    publishEvent: (eventId: string, planFingerprint: string, summary: GamePlanSlotSummary) =>
      invoke<GamePlanPublication>('game_event_publish', { eventId, planFingerprint, summary }),
    clearEvent: () => invoke<EventSlotClearing>('game_event_clear'),
    downloadProject: (eventId: string) => invoke<string>('event_project_download', { eventId }),
  });
}

export interface TauriCommunityEventDevelopmentEnvironment {
  readonly invoke: Invoke;
  readonly chooseEventFile: () => Promise<string | null>;
  readonly chooseSavePath: (defaultFileName: string) => Promise<string | null>;
  readonly writeTextFile: (path: string, contents: string) => Promise<void>;
}

const EVENT_FILE_FILTER = { extensions: ['json'], name: 'Run Planner event' };

export function createTauriCommunityEventDevelopmentHost(
  environment: TauriCommunityEventDevelopmentEnvironment = {
    invoke: tauriInvoke,
    chooseEventFile: () =>
      open({
        directory: false,
        filters: [EVENT_FILE_FILTER],
        multiple: false,
        title: 'Import Event File',
      }),
    chooseSavePath: (defaultPath: string) =>
      save({ defaultPath, filters: [EVENT_FILE_FILTER], title: 'Export Event File' }),
    writeTextFile,
  },
): CommunityEventDevelopmentHost {
  return Object.freeze({
    pickEventFile: () => environment.chooseEventFile(),
    loadEventFile: (path: string) =>
      environment.invoke<CommunityEventPlan>('game_event_file_load', { path }),
    clearLocalEvent: () => environment.invoke<void>('game_event_local_clear'),
    saveEventFile: async (defaultFileName: string, json: string) => {
      const path = await environment.chooseSavePath(defaultFileName);
      if (path === null) return false;
      await environment.writeTextFile(path, json);
      return true;
    },
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
