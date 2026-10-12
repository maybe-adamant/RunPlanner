import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
  EXECUTION_DISPLAY_NAME_MAX,
} from '@run-planner/engine/execution-plan';

/**
 * A community event document, `run-planner-event` version 1: the object a local event file
 * holds and the event feed lists. The host decodes and validates it; this builds it.
 */
export interface EventDocumentMetadata {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rules?: string;
  /** UTC ISO 8601, such as "2026-10-12T00:00:00Z". */
  readonly startsAt: string;
  readonly endsAt: string;
  readonly projectUrl?: string;
  /** Lower-case hex SHA-256 of the project file published at `projectUrl`. */
  readonly projectSha256?: string;
}

export const EVENT_DOCUMENT_FORMAT = 'run-planner-event';
export const EVENT_DOCUMENT_FORMAT_VERSION = 1;

/**
 * Compiles an event's project through the same execution-plan assembly as a send. The plan
 * is named by the event's title.
 */
export function compileEventPlan(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  title: string,
): string {
  return encodeExecutionPlan(
    compileExecutionPlan({
      product: assembleExecutionProduct({ assembly, catalog }),
      displayName: Array.from(title.trim()).slice(0, EXECUTION_DISPLAY_NAME_MAX).join(''),
    }),
  );
}

/** The event document with each build's plan embedded as encoded. */
export function encodeEventDocument(
  metadata: EventDocumentMetadata,
  plans: Readonly<Record<string, string>>,
): string {
  if (Object.keys(plans).length === 0) throw new Error('An event needs a plan for a build.');
  return JSON.stringify({
    format: EVENT_DOCUMENT_FORMAT,
    formatVersion: EVENT_DOCUMENT_FORMAT_VERSION,
    id: metadata.id,
    title: metadata.title,
    description: metadata.description,
    ...(metadata.rules === undefined ? {} : { rules: metadata.rules }),
    startsAt: metadata.startsAt,
    endsAt: metadata.endsAt,
    ...(metadata.projectUrl === undefined ? {} : { projectUrl: metadata.projectUrl }),
    ...(metadata.projectSha256 === undefined ? {} : { projectSha256: metadata.projectSha256 }),
    plans: Object.fromEntries(
      Object.entries(plans).map(([buildId, planJson]) => [buildId, JSON.parse(planJson)]),
    ),
  });
}

/** The URL an event's project file has beside the feed. */
export function eventProjectUrl(id: string): string {
  return `https://github.com/maybe-adamant/RunPlanner/releases/download/events/${id}.runplanner.json`;
}

/** Lower-case hex SHA-256 of a project file's text, as the event document records it. */
export async function projectFileSha256(json: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
