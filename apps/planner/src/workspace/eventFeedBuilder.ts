import type { Catalog } from '@run-planner/engine/catalog-schema';

import {
  compileEventProject,
  eventMetadataProblem,
  eventProjectUrl,
  projectFileSha256,
  type AuthoredEventMetadata,
} from './eventDocument';

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

interface BuildOptions {
  readonly catalog: Catalog;
  readonly now: Date;
  readonly checkEnded?: boolean;
}

/** The `schemaVersion` and `schemaRevision` (absent means 0) the project file is saved in. */
function projectSchema(projectJson: string): {
  readonly version: number;
  readonly revision: number;
} {
  const value: unknown = JSON.parse(projectJson);
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const version = record.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('project.runplanner.json names no schemaVersion.');
  }
  const revision = record.schemaRevision ?? 0;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    throw new Error('project.runplanner.json has an invalid schemaRevision.');
  }
  return { version, revision };
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
  const schema = projectSchema(source.projectJson);
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
  const entries: EventFeedEntry[] = [];
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
      const built = await buildEvent(source, options);
      summary.push(built.summary);
      if (built.entry !== undefined) {
        entries.push(built.entry);
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
      events: entries,
    }),
    projects,
    summary,
  };
}
