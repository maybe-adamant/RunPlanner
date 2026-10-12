import type { Catalog } from '@run-planner/engine/catalog-schema';
import { decodeExecutionPlan } from '@run-planner/engine/execution-plan';

import type { GameModuleHost } from '../persistence/gameModuleHost';
import { describePublicationBlocker } from '../projections/gamePanel';
import { projectGameSlotSummary } from '../projections/gameSlotSummary';

export type EventSlotOutcome =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'done'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string };

/** Development actions that fill or clear the event slot from a local event file. */
export interface EventSlotOperations {
  importEventFile(): Promise<EventSlotOutcome>;
  clearEvent(): Promise<EventSlotOutcome>;
}

interface CreateEventSlotOperationsOptions {
  readonly catalog: Catalog;
  readonly host: GameModuleHost;
  readonly now?: () => Date;
}

function failed(error: unknown): EventSlotOutcome {
  return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
}

export function createEventSlotOperations(
  options: CreateEventSlotOperationsOptions,
): EventSlotOperations {
  const now = options.now ?? (() => new Date());
  return Object.freeze({
    async importEventFile(): Promise<EventSlotOutcome> {
      try {
        const path = await options.host.pickEventFile();
        if (path === null) return { kind: 'cancelled' };
        const { event, planJson } = await options.host.readEventFile(path);
        // The slot overview describes the plan with this catalog's labels, as a send does.
        const plan = decodeExecutionPlan(JSON.parse(planJson));
        const publication = await options.host.publishEvent(
          planJson,
          projectGameSlotSummary(plan, options.catalog, now()),
          { id: event.id, title: event.title, endsAt: event.endsAt },
        );
        if (publication.status === 'published')
          return { kind: 'done', message: publication.message };
        return {
          kind: 'failed',
          message:
            publication.blockers.length > 0
              ? publication.blockers.map(describePublicationBlocker).join(' ')
              : publication.message,
        };
      } catch (error) {
        return failed(error);
      }
    },
    async clearEvent(): Promise<EventSlotOutcome> {
      try {
        const clearing = await options.host.clearEvent();
        switch (clearing.status) {
          case 'cleared':
          case 'alreadyEmpty':
            return { kind: 'done', message: clearing.message };
          case 'blocked':
            return {
              kind: 'failed',
              message:
                clearing.blockers.length > 0
                  ? clearing.blockers.map(describePublicationBlocker).join(' ')
                  : clearing.message,
            };
          case 'nativeWrite':
            return { kind: 'failed', message: clearing.message };
        }
      } catch (error) {
        return failed(error);
      }
    },
  });
}
