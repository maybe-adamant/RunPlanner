import type { Catalog } from '@run-planner/engine/catalog-schema';
import { decodeExecutionPlan } from '@run-planner/engine/execution-plan';
import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import { encodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

import type {
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
import { describeActiveSlotSetting, describePublicationBlocker } from '../projections/gamePanel';
import { projectGameSlotSummary } from '../projections/gameSlotSummary';
import {
  compileEventPlan,
  encodeEventDocument,
  eventMetadataProblem,
  eventProjectUrl,
  projectFileSha256,
  type AuthoredEventMetadata,
} from './eventDocument';

/** What an event export asks for; the project's URL and hash follow from the open project. */
export type EventExportMetadata = AuthoredEventMetadata;
import type { ProjectOperationResult } from './projectOperations';

/** The notice area's community event entry. */
export type EventNotice =
  | { readonly kind: 'none' }
  | { readonly kind: 'active'; readonly event: CommunityEvent }
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

/** Development builds: fill the event slot from a local event file, or export one. */
export interface EventDevelopmentOperations {
  importEventFile(): Promise<EventSlotOutcome>;
  clearEvent(): Promise<EventSlotOutcome>;
  /**
   * Exports the open project as an event document for this app's build, naming its project
   * file beside the feed with the hash of the project as encoded now; that encoding is the file
   * to publish.
   */
  exportEventFile(metadata: EventExportMetadata): Promise<EventSlotOutcome>;
}

/** A start-up read waits out the host's interval; opening the Game panel retries a failed fetch. */
export type EventSyncTrigger = 'background' | 'panel';

export interface CommunityEventController {
  /** Reads the feed, then writes the active event to the event slot or clears it. */
  sync(trigger?: EventSyncTrigger): Promise<void>;
  dismiss(): void;
  /** Downloads the active event's project and opens it as an unsaved copy. */
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
  readonly openProjectCopy: (json: string) => Promise<ProjectOperationResult>;
  /** Makes a slot active through the game host's one active-slot write. */
  readonly setActiveSlot: (slot: GameActiveSlotNumber) => Promise<GameActiveSlotSetting>;
  /** Re-reads the game status after the event slot or active slot changed. */
  readonly onSlotsChanged?: () => Promise<unknown> | void;
  readonly currentAssembly: () => ProjectEvaluationAssembly | undefined;
  readonly currentProject: () => ProjectDocument | undefined;
  readonly bundledBuildId: () => Promise<string>;
  readonly now?: () => Date;
}

type SyncResult =
  | { readonly kind: 'published'; readonly publication: GamePlanPublication }
  | { readonly kind: 'cleared'; readonly clearing: EventSlotClearing };

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
    const snapshot = await options.host.refreshFeed(retryFailed);
    if (snapshot.active !== null) {
      const { event, planJson } = snapshot.active;
      active = event;
      scheduleEndSync(event);
      // The summary describes this plan with the catalog's labels, as a send does; the host
      // writes only the plan the fingerprint names.
      const plan = decodeExecutionPlan(JSON.parse(planJson));
      const publication = await options.host.publishEvent(
        event.id,
        plan.planFingerprint,
        projectGameSlotSummary(plan, options.catalog, now()),
      );
      publish(options.dismissals.isDismissed(event.id) ? NO_NOTICE : { kind: 'active', event });
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
        return await options.openProjectCopy(await options.host.downloadProject(event.id));
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
            importEventFile: async (): Promise<EventSlotOutcome> => {
              try {
                const path = await development.pickEventFile();
                if (path === null) return { kind: 'cancelled' };
                await development.loadEventFile(path);
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
                    : result.clearing.message,
                );
              } catch (error) {
                return { kind: 'failed', message: errorText(error) };
              }
            },
            exportEventFile: async (metadata: EventExportMetadata): Promise<EventSlotOutcome> => {
              try {
                const problem = eventMetadataProblem(metadata);
                if (problem !== null) return { kind: 'failed', message: problem };
                const assembly = options.currentAssembly();
                const project = options.currentProject();
                if (assembly === undefined || project === undefined) {
                  return { kind: 'failed', message: 'Open a project to export it as an event.' };
                }
                const projectSha256 = await projectFileSha256(encodeProjectDocument(project));
                const document = {
                  ...metadata,
                  projectUrl: eventProjectUrl(metadata.id),
                  projectSha256,
                };
                const json = encodeEventDocument(document, {
                  [await options.bundledBuildId()]: compileEventPlan(
                    options.catalog,
                    assembly,
                    metadata.title,
                  ),
                });
                return (await development.saveEventFile(`${metadata.id}.event.json`, json))
                  ? { kind: 'done', message: `Exported ${metadata.id}.` }
                  : { kind: 'cancelled' };
              } catch (error) {
                return { kind: 'failed', message: errorText(error) };
              }
            },
          }),
  });
}
