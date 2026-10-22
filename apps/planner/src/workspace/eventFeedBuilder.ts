import type { Catalog } from '@run-planner/engine/catalog-schema';

import {
  compileEventProject,
  eventMetadataProblem,
  eventProjectUrl,
  type AuthoredEventMetadata,
} from './eventDocument';
import { buildFeedFolders, projectFileSchema, projectFileSha256 } from './feedBuild';

/**
 * Builds the community event feed for publication: each authored event's metadata with its
 * project file's URL, hash and schema. Every project is compiled as the planner compiles it,
 * only to refuse one that would not play.
 */

export const EVENT_FEED_FORMAT = 'run-planner-event-feed';
export const EVENT_FEED_FORMAT_VERSION = 2;
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

/** One event as the feed lists it. */
export interface EventFeedEntry extends AuthoredEventMetadata {
  readonly projectUrl: string;
  /** Lower-case hex SHA-256 of the project file published at `projectUrl`. */
  readonly projectSha256: string;
  /** The authored project schema pair the project file is saved in. */
  readonly projectSchemaVersion: number;
  /** Omitted at 0, since earlier planners refuse an event naming it. */
  readonly projectSchemaRevision?: number;
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

interface BuildOptions {
  readonly catalog: Catalog;
  readonly now: Date;
  readonly checkEnded?: boolean;
}

async function buildEvent(
  source: AuthoredEventSource,
  options: BuildOptions,
): Promise<{
  readonly summary: string;
  readonly entry?: EventFeedEntry;
  readonly project: { fileName: string; json: string };
}> {
  const metadata = authoredMetadata(source);
  const project = { fileName: `${metadata.id}.runplanner.json`, json: source.projectJson };
  const ended = Date.parse(metadata.endsAt) <= options.now.getTime();
  if (ended && options.checkEnded !== true) {
    return { summary: `${metadata.id}: ended, not published`, project };
  }
  const schema = projectFileSchema(source.projectJson, 'project.runplanner.json');
  compileEventProject(options.catalog, source.projectJson, metadata.title);
  if (ended) return { summary: `${metadata.id}: ended, valid, not published`, project };
  return {
    summary: `${metadata.id}: ${metadata.startsAt} to ${metadata.endsAt}, schema ${schema.version}.${schema.revision}`,
    entry: {
      ...metadata,
      projectUrl: eventProjectUrl(metadata.id),
      projectSha256: await projectFileSha256(source.projectJson),
      projectSchemaVersion: schema.version,
      ...(schema.revision === 0 ? {} : { projectSchemaRevision: schema.revision }),
    },
    project,
  };
}

export async function buildEventFeed(options: {
  readonly catalog: Catalog;
  readonly sources: readonly AuthoredEventSource[];
  readonly now: Date;
  /** Compiles ended events too, to validate every authored folder, without listing them. */
  readonly checkEnded?: boolean;
}): Promise<EventFeedBuild> {
  const { results, summary } = await buildFeedFolders(options.sources, async (source) => {
    const built = await buildEvent(source, options);
    return {
      summary: built.summary,
      result: built.entry === undefined ? null : { entry: built.entry, project: built.project },
    };
  });
  const entries = results.map((built) => built.entry);
  const projects = results.map((built) => built.project);
  return {
    feedJson: JSON.stringify({
      format: EVENT_FEED_FORMAT,
      formatVersion: EVENT_FEED_FORMAT_VERSION,
      events: entries,
    }),
    projects,
    summary,
  };
}
