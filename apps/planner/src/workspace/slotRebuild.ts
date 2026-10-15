import {
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { encodeExecutionPlan } from '@run-planner/engine/execution-plan';

import type {
  GameModuleInstallResult,
  GameModuleStatus,
  GamePlanSlotNumber,
  GameSlotRebuildHost,
} from '../persistence/gameModuleHost';
import { decodeSlotSource, encodeSlotSource, type SlotSource } from '../persistence/slotSource';
import { describePublicationBlocker } from '../projections/gamePanel';
import { projectGameSlotSummary } from '../projections/gameSlotSummary';
import { compileProjectFile, type ProjectFileCompilation } from './projectFileCompilation';

/**
 * What became of one outdated slot:
 * - `rebuilt`: compiled from its stored source and written again;
 * - `failed`: its source, saved under another schema pair, no longer builds or could not be
 *   written; it stays outdated until its project is opened and sent again;
 * - `defect`: its source, saved under this planner's schema pair, no longer builds, which the
 *   same-version invariant rules out; it stays outdated and belongs in a bug report;
 * - `noSource`: it was sent before slots kept their source, so it can only be sent again.
 */
export type SlotRebuildOutcome =
  | { readonly slot: GamePlanSlotNumber; readonly kind: 'rebuilt' }
  | { readonly slot: GamePlanSlotNumber; readonly kind: 'failed'; readonly reason: string }
  | {
      readonly slot: GamePlanSlotNumber;
      readonly kind: 'defect';
      readonly reason: string;
      /** The compiler's own error, carried only into bug reports. */
      readonly error: string;
    }
  | { readonly slot: GamePlanSlotNumber; readonly kind: 'noSource' };

export interface SlotRebuildReport {
  readonly outcomes: readonly SlotRebuildOutcome[];
  /** Why nothing was rebuilt at all, such as a module that still needs an update. */
  readonly problem: string | null;
}

export interface SlotRebuildController {
  /** Rebuilds every outdated slot that has a stored source, when the module admits plans. */
  rebuild(status: GameModuleStatus): Promise<SlotRebuildReport>;
  /** After an install or update, rebuilds the slots it outdated; null when none needed it. */
  afterInstall(result: GameModuleInstallResult): Promise<SlotRebuildReport | null>;
  /** The last report, for the Game panel and bug reports. */
  getSnapshot(): SlotRebuildReport | null;
  subscribe(listener: () => void): () => void;
}

interface CreateSlotRebuildControllerOptions {
  readonly catalog: Catalog;
  readonly host: GameSlotRebuildHost;
  /** Internal-stage run modifiers take part only in a development build. */
  readonly devBuild: boolean;
  readonly now?: () => Date;
  readonly onSlotsChanged?: () => void;
}

const REBUILD_FAILED = 'Couldn’t rebuild after the update — open the project and resend.';
const REBUILD_DEFECT =
  'Couldn’t rebuild a plan this planner should still build — create a bug report.';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The slots a rebuild considers: outdated slots, with or without a stored source. */
export function outdatedSlots(status: GameModuleStatus) {
  return status.inspection?.planSlots.filter((slot) => slot.state === 'stale') ?? [];
}

// The schema pair a source's project was saved under; an absent revision is 0.
function savedUnderCurrentPair(projectJson: string): boolean {
  const record = JSON.parse(projectJson) as Record<string, unknown>;
  return (
    record.schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION &&
    (record.schemaRevision ?? 0) === PROJECT_DOCUMENT_SCHEMA_REVISION
  );
}

export function createSlotRebuildController(
  options: CreateSlotRebuildControllerOptions,
): SlotRebuildController {
  const now = options.now ?? (() => new Date());
  const listeners = new Set<() => void>();
  let snapshot: SlotRebuildReport | null = null;
  const publish = <Report extends SlotRebuildReport | null>(report: Report): Report => {
    snapshot = report;
    for (const listener of listeners) listener();
    return report;
  };

  const rebuildSlot = async (slot: GamePlanSlotNumber): Promise<SlotRebuildOutcome> => {
    let source: SlotSource;
    try {
      const stored = await options.host.readSlotSource(slot);
      if (stored === null) return { slot, kind: 'noSource' };
      source = decodeSlotSource(stored);
    } catch (error) {
      return {
        slot,
        kind: 'failed',
        reason: `Couldn’t read its stored source: ${errorText(error)}`,
      };
    }
    let compiled: ProjectFileCompilation;
    try {
      compiled = compileProjectFile(options.catalog, source.projectJson, {
        ...(source.displayName === undefined ? {} : { displayName: source.displayName }),
        internalRunModifiers: source.internalRunModifiers && options.devBuild,
      });
    } catch (error) {
      // Only a project saved under this planner's schema pair that no longer builds is a defect.
      return savedUnderCurrentPair(source.projectJson)
        ? { slot, kind: 'defect', reason: REBUILD_DEFECT, error: errorText(error) }
        : { slot, kind: 'failed', reason: REBUILD_FAILED };
    }
    try {
      // The rebuilt slot keeps the document as migrated, so the next rebuild starts from it.
      const publication = await options.host.rebuildSlot(
        slot,
        encodeExecutionPlan(compiled.plan),
        encodeSlotSource({
          ...(source.displayName === undefined ? {} : { displayName: source.displayName }),
          internalRunModifiers: source.internalRunModifiers,
          projectJson: encodeProjectDocument(compiled.project),
        }),
        projectGameSlotSummary(compiled.plan, options.catalog, now()),
      );
      if (publication.status === 'published') return { slot, kind: 'rebuilt' };
      const reason =
        publication.blockers.length > 0
          ? publication.blockers.map(describePublicationBlocker).join(' ')
          : publication.message;
      return { slot, kind: 'failed', reason };
    } catch (error) {
      return { slot, kind: 'failed', reason: `Couldn’t write it: ${errorText(error)}` };
    }
  };

  const rebuildAll = async (status: GameModuleStatus): Promise<SlotRebuildReport> => {
    if (status.publicationBlockers.length > 0) {
      return publish({
        outcomes: [],
        problem: status.publicationBlockers.map(describePublicationBlocker).join(' '),
      });
    }
    const outcomes: SlotRebuildOutcome[] = [];
    for (const slot of outdatedSlots(status)) {
      outcomes.push(
        slot.hasSource ? await rebuildSlot(slot.slot) : { slot: slot.slot, kind: 'noSource' },
      );
    }
    if (outcomes.some((outcome) => outcome.kind === 'rebuilt')) options.onSlotsChanged?.();
    return publish({ outcomes: Object.freeze(outcomes), problem: null });
  };

  // One rebuild at a time: a request while one runs shares its result.
  let running: Promise<SlotRebuildReport> | null = null;
  const rebuild = (status: GameModuleStatus): Promise<SlotRebuildReport> => {
    running ??= rebuildAll(status).finally(() => {
      running = null;
    });
    return running;
  };

  return Object.freeze({
    rebuild,
    async afterInstall(result: GameModuleInstallResult) {
      if (result.outcome !== 'installed') return null;
      if (!outdatedSlots(result.status).some((slot) => slot.hasSource)) {
        // A report from before the install no longer describes the slots.
        if (snapshot !== null) publish(null);
        return null;
      }
      return rebuild(result.status);
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  });
}
