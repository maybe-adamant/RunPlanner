import type { Catalog } from '@run-planner/engine/catalog-schema';
import { decodeExecutionPlan, type ExecutionPlan } from '@run-planner/engine/execution-plan';

import type {
  ActiveCommunityEvent,
  CommunityEvent,
  CommunityEventDevelopmentHost,
  CommunityEventHost,
  EventSlotClearing,
} from '../persistence/communityEventHost';
import type {
  GameActiveSlotNumber,
  GameActiveSlotSetting,
  GamePlanPublication,
} from '../persistence/gameModuleHost';
import { LOADABLE_PROJECT_SCHEMAS } from '../persistence/projectDocumentLoader';
import { describeActiveSlotSetting, describePublicationBlocker } from '../projections/gamePanel';
import { projectGameSlotSummary } from '../projections/gameSlotSummary';
import { compileEventProject } from './eventDocument';
import type { ProjectOperationResult } from './projectOperations';

/** The notice area's community event entry. */
export type EventNotice =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'active';
      readonly event: CommunityEvent;
      /** Why the event slot does not hold this event's plan; null when it does or will. */
      readonly problem: string | null;
    }
  /** The event slot was active when its event ended, so slot 1 now is. */
  | {
      readonly kind: 'ended';
      readonly title: string | null;
      /** Whether slot 1 holds a plan for the next run. */
      readonly fallbackSlotHasPlan: boolean;
    };

export type EventSlotOutcome =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'done'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string };

export interface EventDismissalPreference {
  isDismissed(eventId: string): boolean;
  dismiss(eventId: string): void;
}

/**
 * Development builds: fill the event slot from a local event folder, compiled as a feed event
 * is, or return to the feed's event.
 */
export interface EventDevelopmentOperations {
  importEventFolder(): Promise<EventSlotOutcome>;
  clearEvent(): Promise<EventSlotOutcome>;
}

/** A start-up read waits out the host's interval; opening the Game panel retries a failed fetch. */
export type EventSyncTrigger = 'background' | 'panel';

export interface CommunityEventController {
  /**
   * Reads the feed, then compiles the active event's verified project and writes it to the
   * event slot, or clears the slot when no event is active.
   */
  sync(trigger?: EventSyncTrigger): Promise<void>;
  dismiss(): void;
  /** Downloads the active event's project, adds it to the library as a copy and opens it. */
  openProject(): Promise<ProjectOperationResult>;
  /**
   * Makes the event slot the one the game module plays next, then re-reads the game status.
   * Resolves why it did not take effect, or null when it did.
   */
  playEvent(): Promise<string | null>;
  /** Stops the sync scheduled for the active event's end. */
  dispose(): void;
  getSnapshot(): EventNotice;
  subscribe(listener: () => void): () => void;
  readonly development: EventDevelopmentOperations | undefined;
}

interface CreateCommunityEventControllerOptions {
  readonly catalog: Catalog;
  readonly host: CommunityEventHost;
  readonly development?: CommunityEventDevelopmentHost;
  readonly dismissals: EventDismissalPreference;
  /** Opens a copy of an event's project; an unnamed older one takes the event's title. */
  readonly openProjectCopy: (json: string, title: string) => Promise<ProjectOperationResult>;
  /** Makes a slot active through the game host's one active-slot write. */
  readonly setActiveSlot: (slot: GameActiveSlotNumber) => Promise<GameActiveSlotSetting>;
  /** Re-reads the game status after the event slot or active slot changed. */
  readonly onSlotsChanged?: () => Promise<unknown> | void;
  readonly now?: () => Date;
}

type SyncResult =
  | { readonly kind: 'published'; readonly publication: GamePlanPublication }
  /** The active event's plan could not be written; the event slot is left as it is. */
  | { readonly kind: 'unplayable'; readonly problem: string }
  | { readonly kind: 'cleared'; readonly clearing: EventSlotClearing };

type CompiledEvent =
  | { readonly kind: 'compiled'; readonly planJson: string; readonly plan: ExecutionPlan }
  | { readonly kind: 'failed'; readonly problem: string };

/** The notice for an event saved in a project schema this planner cannot load. */
export const UNSUPPORTED_EVENT_SCHEMA = 'Update the planner to play this event.';
/** The notice while the event's project cannot be downloaded and the event slot lacks its plan. */
export const UNAVAILABLE_EVENT_PROJECT = 'This event’s project could not be downloaded.';

const NO_NOTICE: EventNotice = Object.freeze({ kind: 'none' });
const EVENT_SLOT: GameActiveSlotNumber = 0;
/** The sync at an event's end waits this long past it, so the host's clock agrees it ended. */
const END_SYNC_MARGIN_MS = 5_000;
/** The longest delay a timer can hold; a later end is checked again then. */
const MAX_TIMER_MS = 2 ** 31 - 1;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function publicationProblem(publication: GamePlanPublication): string | null {
  if (publication.status === 'published') return null;
  return publication.blockers.length > 0
    ? publication.blockers.map(describePublicationBlocker).join(' ')
    : publication.message;
}

function clearingProblem(clearing: EventSlotClearing): string | null {
  switch (clearing.status) {
    case 'cleared':
    case 'alreadyEmpty':
    case 'kept':
      return clearing.activationProblem;
    case 'blocked':
      return clearing.blockers.length > 0
        ? clearing.blockers.map(describePublicationBlocker).join(' ')
        : clearing.message;
    case 'nativeWrite':
      return clearing.message;
  }
}

export function createCommunityEventController(
  options: CreateCommunityEventControllerOptions,
): CommunityEventController {
  const now = options.now ?? (() => new Date());
  // The last compilation, by event, title (the plan's name), project hash and catalog; the
  // schema pair is fixed for the process, so a sync only compiles a changed event.
  let compiled: { readonly key: string; readonly result: CompiledEvent } | null = null;
  const compile = (event: CommunityEvent, projectJson: string): CompiledEvent => {
    const key = JSON.stringify([
      event.id,
      event.title,
      event.projectSha256,
      options.catalog.version,
    ]);
    if (compiled?.key !== key) {
      let result: CompiledEvent;
      try {
        const planJson = compileEventProject(options.catalog, projectJson, event.title);
        result = { kind: 'compiled', planJson, plan: decodeExecutionPlan(JSON.parse(planJson)) };
      } catch (error) {
        result = {
          kind: 'failed',
          problem: `This event’s plan could not be built: ${errorText(error)}`,
        };
      }
      compiled = { key, result };
    }
    return compiled.result;
  };
  // A compiled plan, or why the event cannot be played and whether the notice says so; an
  // unavailable project is retried at the next sync.
  const playable = ({
    event,
    project,
  }: ActiveCommunityEvent): CompiledEvent & { readonly shown?: boolean } => {
    switch (project.kind) {
      case 'unsupportedSchema':
        return { kind: 'failed', problem: UNSUPPORTED_EVENT_SCHEMA, shown: true };
      case 'unavailable':
        return { kind: 'failed', problem: project.problem, shown: false };
      case 'verified': {
        const result = compile(event, project.json);
        return result.kind === 'failed' ? { ...result, shown: true } : result;
      }
    }
  };
  let notice: EventNotice = NO_NOTICE;
  let active: CommunityEvent | null = null;
  let inFlight: { readonly run: Promise<SyncResult>; readonly retryFailed: boolean } | null = null;
  let endTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();
  const publish = (next: EventNotice) => {
    notice = Object.freeze(next);
    for (const listener of listeners) listener();
  };

  const runSync = async (retryFailed: boolean): Promise<SyncResult> => {
    const snapshot = await options.host.refreshFeed(retryFailed, LOADABLE_PROJECT_SCHEMAS);
    if (snapshot.active !== null) {
      const { event } = snapshot.active;
      active = event;
      scheduleEndSync(event);
      const result = playable(snapshot.active);
      const noticeOf = (problem: string | null): EventNotice =>
        options.dismissals.isDismissed(event.id) ? NO_NOTICE : { kind: 'active', event, problem };
      if (result.kind === 'failed') {
        // The event slot keeps only this event's own plan; another event's plan is cleared.
        const clearing = await options.host.clearEvent();
        if (clearing.activeSlotMoved) {
          publish({
            kind: 'ended',
            title: clearing.clearedEvent?.title ?? null,
            fallbackSlotHasPlan: clearing.fallbackSlotHasPlan,
          });
        } else {
          const holdsEvent = clearing.status === 'kept';
          publish(
            noticeOf(
              result.shown === true
                ? result.problem
                : holdsEvent
                  ? null
                  : UNAVAILABLE_EVENT_PROJECT,
            ),
          );
        }
        if (clearing.status === 'cleared' || clearing.activeSlotMoved) options.onSlotsChanged?.();
        return { kind: 'unplayable', problem: result.problem };
      }
      // The summary describes this plan with the catalog's labels, as a send does.
      const publication = await options.host.publishEvent(
        event.id,
        result.planJson,
        projectGameSlotSummary(result.plan, options.catalog, now()),
      );
      publish(noticeOf(null));
      options.onSlotsChanged?.();
      return { kind: 'published', publication };
    }
    active = null;
    scheduleEndSync(null);
    // Without verified event data the host keeps the event slot until its own event ends.
    const clearing = await options.host.clearEvent();
    if (clearing.activeSlotMoved) {
      publish({
        kind: 'ended',
        title: clearing.clearedEvent?.title ?? null,
        fallbackSlotHasPlan: clearing.fallbackSlotHasPlan,
      });
    } else if (notice.kind === 'active' && clearing.status !== 'kept') {
      publish(NO_NOTICE);
    }
    if (clearing.status === 'cleared' || clearing.activeSlotMoved) options.onSlotsChanged?.();
    return { kind: 'cleared', clearing };
  };
  // While an event is active, one sync runs just after it ends so the event slot is cleared.
  function scheduleEndSync(event: CommunityEvent | null): void {
    if (endTimer !== null) clearTimeout(endTimer);
    endTimer = null;
    if (disposed) return;
    const remaining = event === null ? Number.NaN : Date.parse(event.endsAt) - now().getTime();
    if (!(remaining > 0)) return;
    const delay = remaining + END_SYNC_MARGIN_MS;
    endTimer = setTimeout(
      () => {
        endTimer = null;
        sync(false).catch(() => {
          // A failed sync leaves the notice as it was; the next sync retries.
        });
      },
      Math.min(delay, MAX_TIMER_MS),
    );
  }
  const start = (retryFailed: boolean, after: Promise<unknown>): Promise<SyncResult> => {
    const run = after
      .catch(() => undefined)
      .then(() => runSync(retryFailed))
      .finally(() => {
        if (inFlight?.run === run) inFlight = null;
      });
    inFlight = { run, retryFailed };
    return run;
  };
  // One sync at a time. A request shares a run in progress that does at least as much; a
  // panel retry after a background run, and a fresh run, start after it instead.
  const sync = (retryFailed: boolean, fresh = false): Promise<SyncResult> => {
    if (inFlight === null) return start(retryFailed, Promise.resolve());
    if (!fresh && (inFlight.retryFailed || !retryFailed)) return inFlight.run;
    return start(retryFailed, inFlight.run);
  };
  // A development change runs a fresh sync, so it never reports a result read before it.
  const outcomeOf = async (done: (result: SyncResult) => string): Promise<EventSlotOutcome> => {
    const result = await sync(false, true);
    const problem =
      result.kind === 'published'
        ? publicationProblem(result.publication)
        : result.kind === 'unplayable'
          ? result.problem
          : clearingProblem(result.clearing);
    return problem === null
      ? { kind: 'done', message: done(result) }
      : { kind: 'failed', message: problem };
  };

  const development = options.development;
  return Object.freeze({
    sync: async (trigger: EventSyncTrigger = 'background') => {
      try {
        await sync(trigger === 'panel');
      } catch {
        // A feed or slot write that fails leaves the notice as it was; the next sync retries.
      }
    },
    dismiss: () => {
      if (notice.kind === 'active') options.dismissals.dismiss(notice.event.id);
      if (notice.kind !== 'none') publish(NO_NOTICE);
    },
    openProject: async (): Promise<ProjectOperationResult> => {
      const event = notice.kind === 'active' ? notice.event : active;
      if (event === null) {
        return { operation: 'openCopy', status: 'failure', message: 'No event is active.' };
      }
      try {
        return await options.openProjectCopy(
          await options.host.downloadProject(event.id),
          event.title,
        );
      } catch (error) {
        return { operation: 'openCopy', status: 'failure', message: errorText(error) };
      }
    },
    playEvent: async (): Promise<string | null> => {
      let problem: string | null;
      try {
        problem = describeActiveSlotSetting(await options.setActiveSlot(EVENT_SLOT));
      } catch (error) {
        problem = errorText(error);
      }
      try {
        await options.onSlotsChanged?.();
      } catch {
        // The header indicator reports a failed status read.
      }
      return problem;
    },
    dispose: () => {
      disposed = true;
      if (endTimer !== null) clearTimeout(endTimer);
      endTimer = null;
    },
    getSnapshot: () => notice,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    development:
      development === undefined
        ? undefined
        : Object.freeze({
            importEventFolder: async (): Promise<EventSlotOutcome> => {
              try {
                const path = await development.pickEventFolder();
                if (path === null) return { kind: 'cancelled' };
                await development.loadEventFolder(path);
                return await outcomeOf((result) =>
                  result.kind === 'published' ? result.publication.message : 'No event.',
                );
              } catch (error) {
                return { kind: 'failed', message: errorText(error) };
              }
            },
            clearEvent: async (): Promise<EventSlotOutcome> => {
              try {
                await development.clearLocalEvent();
                return await outcomeOf((result) =>
                  result.kind === 'published'
                    ? `The feed's event is back: ${result.publication.message}`
                    : result.kind === 'cleared'
                      ? result.clearing.message
                      : 'No event.',
                );
              } catch (error) {
                return { kind: 'failed', message: errorText(error) };
              }
            },
          }),
  });
}
