import type { Catalog } from '@run-planner/engine/catalog-schema';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';

import { loadProjectDocument } from '../persistence/projectDocumentLoader';
import {
  compileEventPlan,
  encodeEventDocument,
  eventMetadataProblem,
  eventPlanDisplayName,
  eventProjectUrl,
  MAX_EVENT_DOCUMENT_BYTES,
  projectFileSha256,
  type AuthoredEventMetadata,
} from './eventDocument';
import { assertPublicProjectAdmission } from './project-admission';

/**
 * Builds the community event feed for publication: each authored event's project compiled for
 * one module build through the same assembly as a send, merged with the plans an earlier
 * verified feed already carries for other builds.
 */

export const EVENT_FEED_FORMAT = 'run-planner-event-feed';
export const EVENT_FEED_FORMAT_VERSION = 1;
/** The host accepts at most 16 plans per event; the current build's plan is one of them. */
const MAX_OLDER_PLANS = 15;
const AUTHORED_KEYS = new Set(['id', 'title', 'description', 'rules', 'startsAt', 'endsAt']);

/** One authored event: its folder name, `event.json` and project file, as text. */
export interface AuthoredEventSource {
  readonly folder: string;
  readonly eventJson: string;
  readonly projectJson: string;
}

export interface EventFeedBuild {
  readonly feedJson: string;
  /** Each listed event's project file, published unchanged beside the feed. */
  readonly projects: readonly { readonly fileName: string; readonly json: string }[];
  /** One line per authored folder: what became of it. */
  readonly summary: readonly string[];
}

interface PublishedEvent {
  readonly id: string;
  readonly projectSha256?: string;
  readonly plans: Readonly<Record<string, unknown>>;
}

/** Folders whose name starts with `_` are templates and never published. */
export function isTemplateFolder(folder: string): boolean {
  return folder.startsWith('_');
}

function authoredMetadata(source: AuthoredEventSource): AuthoredEventMetadata {
  const value: unknown = JSON.parse(source.eventJson);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('event.json must be an object.');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!AUTHORED_KEYS.has(key)) throw new Error(`event.json: unexpected ${key}.`);
  }
  const text = (key: string, optional = false): string | undefined => {
    const field = record[key];
    if (field === undefined && optional) return undefined;
    if (typeof field !== 'string') throw new Error(`event.json: ${key} must be text.`);
    return field;
  };
  const rules = text('rules', true);
  const metadata: AuthoredEventMetadata = {
    id: text('id')!,
    title: text('title')!,
    description: text('description')!,
    ...(rules === undefined ? {} : { rules }),
    startsAt: text('startsAt')!,
    endsAt: text('endsAt')!,
  };
  if (metadata.id !== source.folder) {
    throw new Error('event.json: id must equal its folder name.');
  }
  const problem = eventMetadataProblem(metadata);
  if (problem !== null) throw new Error(`event.json: ${problem}`);
  return metadata;
}

/** The events of an earlier feed by id; the caller has verified its signature. */
function publishedEvents(previousFeedJson: string | null): ReadonlyMap<string, PublishedEvent> {
  if (previousFeedJson === null) return new Map();
  const feed = JSON.parse(previousFeedJson) as { format?: unknown; events?: unknown };
  if (feed.format !== EVENT_FEED_FORMAT || !Array.isArray(feed.events)) {
    throw new Error('The published event feed is not a run-planner-event-feed.');
  }
  return new Map((feed.events as PublishedEvent[]).map((event) => [event.id, event] as const));
}

interface BuildOptions {
  readonly catalog: Catalog;
  readonly buildId: string;
  readonly now: Date;
  readonly checkEnded?: boolean;
}

// Older builds' plans take this event's current title as their display name, which their
// fingerprint does not cover.
function renamedPlan(plan: unknown, title: string): string {
  return JSON.stringify({ ...(plan as object), displayName: eventPlanDisplayName(title) });
}

async function buildEvent(
  source: AuthoredEventSource,
  previous: ReadonlyMap<string, PublishedEvent>,
  options: BuildOptions,
): Promise<{
  readonly summary: string;
  readonly document?: unknown;
  readonly project: { fileName: string; json: string };
}> {
  const metadata = authoredMetadata(source);
  const project = { fileName: `${metadata.id}.runplanner.json`, json: source.projectJson };
  const ended = Date.parse(metadata.endsAt) <= options.now.getTime();
  if (ended && options.checkEnded !== true) {
    return { summary: `${metadata.id}: ended, not published`, project };
  }
  const { project: document } = loadProjectDocument(source.projectJson, options.catalog);
  assertPublicProjectAdmission(options.catalog, document);
  const planJson = compileEventPlan(
    options.catalog,
    simulateProjectAssembly(options.catalog, document),
    metadata.title,
  );
  if (ended) return { summary: `${metadata.id}: ended, valid, not published`, project };
  const projectSha256 = await projectFileSha256(source.projectJson);
  // Plans for other builds stay only while they were compiled from this same project file.
  const earlier = previous.get(metadata.id);
  let older =
    earlier?.projectSha256 === projectSha256
      ? Object.entries(earlier.plans)
          .filter(([buildId]) => buildId !== options.buildId)
          .slice(-MAX_OLDER_PLANS)
      : [];
  const encode = () =>
    encodeEventDocument(
      { ...metadata, projectUrl: eventProjectUrl(metadata.id), projectSha256 },
      {
        ...Object.fromEntries(
          older.map(([buildId, plan]) => [buildId, renamedPlan(plan, metadata.title)]),
        ),
        [options.buildId]: planJson,
      },
    );
  let encoded = encode();
  // The oldest builds' plans give way until the document fits the host's bound.
  while (new TextEncoder().encode(encoded).length > MAX_EVENT_DOCUMENT_BYTES) {
    if (older.length === 0) throw new Error('the event document exceeds the 4 MiB limit.');
    older = older.slice(1);
    encoded = encode();
  }
  const builds = [...older.map(([buildId]) => buildId), options.buildId];
  return {
    summary: `${metadata.id}: ${metadata.startsAt} to ${metadata.endsAt}, builds ${builds.join(', ')}`,
    document: JSON.parse(encoded) as unknown,
    project,
  };
}

export async function buildEventFeed(options: {
  readonly catalog: Catalog;
  readonly sources: readonly AuthoredEventSource[];
  readonly buildId: string;
  readonly previousFeedJson: string | null;
  readonly now: Date;
  /** Compiles ended events too, to validate every authored folder, without listing them. */
  readonly checkEnded?: boolean;
}): Promise<EventFeedBuild> {
  const previous = publishedEvents(options.previousFeedJson);
  const documents: unknown[] = [];
  const projects: { fileName: string; json: string }[] = [];
  const summary: string[] = [];
  const sources = [...options.sources].sort((a, b) =>
    a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0,
  );
  const problems: string[] = [];
  for (const source of sources) {
    if (isTemplateFolder(source.folder)) {
      summary.push(`${source.folder}: template, not published`);
      continue;
    }
    try {
      const built = await buildEvent(source, previous, options);
      summary.push(built.summary);
      if (built.document !== undefined) {
        documents.push(built.document);
        projects.push(built.project);
      }
    } catch (error) {
      problems.push(`${source.folder}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Every folder is checked before any problem fails the build, so all are reported at once.
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return {
    feedJson: JSON.stringify({
      format: EVENT_FEED_FORMAT,
      formatVersion: EVENT_FEED_FORMAT_VERSION,
      events: documents,
    }),
    projects,
    summary,
  };
}
