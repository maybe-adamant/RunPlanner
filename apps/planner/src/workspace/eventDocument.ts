import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  encodeExecutionPlan,
  EXECUTION_DISPLAY_NAME_MAX,
} from '@run-planner/engine/execution-plan';

import { validFeedText, validSlug } from './feedBuild';
import { compileProjectFile } from './projectFileCompilation';

/** The fields an event's author writes in `event.json`; the host decodes and validates them. */
export interface AuthoredEventMetadata {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rules?: string;
  /** UTC ISO 8601, such as "2026-10-12T00:00:00Z". */
  readonly startsAt: string;
  readonly endsAt: string;
}

const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
const MAX_ID_CHARS = 64;
const MAX_TITLE_CHARS = 80;
const MAX_TEXT_CHARS = 2000;

/** A real UTC calendar instant from year 2000, as comparable parts; null otherwise. */
function instant(text: string): readonly number[] | null {
  const match = ISO_INSTANT.exec(text);
  if (match === null) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const nanos = Number((match[7] ?? '').padEnd(9, '0'));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const valid =
    year >= 2000 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour < 24 &&
    minute < 60 &&
    second < 60;
  return valid ? [year, month, day, hour, minute, second, nanos] : null;
}

function compareInstants(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The refusal the host's decoder would give this metadata, worded for its author. */
export function eventMetadataProblem(metadata: AuthoredEventMetadata): string | null {
  if (!validSlug(metadata.id, MAX_ID_CHARS)) {
    return 'An event id uses lower-case letters, digits and single hyphens, at most 64 characters.';
  }
  if (!validFeedText(metadata.title, MAX_TITLE_CHARS, false)) {
    return 'An event title is one non-blank line of at most 80 characters, without control or invisible formatting characters.';
  }
  const texts = [metadata.description, ...(metadata.rules === undefined ? [] : [metadata.rules])];
  if (!texts.every((text) => validFeedText(text, MAX_TEXT_CHARS, true))) {
    return 'An event description, and its rules when given, are non-blank text of at most 2000 characters, without control or invisible formatting characters.';
  }
  const starts = instant(metadata.startsAt);
  const ends = instant(metadata.endsAt);
  if (starts === null || ends === null) {
    return 'Event times must be real UTC ISO 8601 instants from 2000, such as 2026-10-12T00:00:00Z.';
  }
  if (compareInstants(ends, starts) <= 0) {
    return 'An event must end after it starts.';
  }
  return null;
}

/** The plan's display name for an event: its title, bounded as plan names are. */
function eventPlanDisplayName(title: string): string {
  return Array.from(title.trim()).slice(0, EXECUTION_DISPLAY_NAME_MAX).join('');
}

/** Compiles an event's project file as a public project sent would be, named by its title. */
export function compileEventProject(catalog: Catalog, projectJson: string, title: string): string {
  return encodeExecutionPlan(
    compileProjectFile(catalog, projectJson, { displayName: eventPlanDisplayName(title) }).plan,
  );
}

/** The repository whose `events` release publishes the feed; renaming it is this one edit. */
export const EVENTS_REPOSITORY = 'maybe-adamant/RunPlanner-Events';

/** The URL an event's project file has beside the feed. */
export function eventProjectUrl(id: string): string {
  return `https://github.com/${EVENTS_REPOSITORY}/releases/download/events/${id}.runplanner.json`;
}
