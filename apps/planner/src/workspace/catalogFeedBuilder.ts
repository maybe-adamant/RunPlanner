import type { Catalog } from '@run-planner/engine/catalog-schema';

import {
  buildFeedFolders,
  projectFileSchema,
  projectFileSha256,
  validFeedText,
  validSlug,
} from './feedBuild';
import { compileProjectFile } from './projectFileCompilation';

/**
 * Builds the plan catalog index for publication: each entry's metadata with its plan's route,
 * biome count, schema, URL and hash. Every plan is loaded and compiled as the planner would,
 * only to refuse one it could not open or send.
 */

export const CATALOG_FEED_FORMAT = 'run-planner-catalog-feed';
export const CATALOG_FEED_FORMAT_VERSION = 1;
/** The repository whose `catalog` release publishes the index; renaming it is this one edit. */
export const CATALOG_REPOSITORY = 'maybe-adamant/RunPlanner-Catalog';

const ENTRY_KEYS = ['title', 'description', 'category', 'tags', 'author'] as const;
const MAX_SLUG_CHARS = 64;
const MAX_TITLE_CHARS = 80;
const MAX_DESCRIPTION_CHARS = 200;
const MAX_AUTHOR_CHARS = 64;
const MAX_TAGS = 8;
const MAX_TAG_CHARS = 24;
const MAX_CATEGORIES = 16;
const MAX_CATEGORY_LABEL_CHARS = 40;
const MAX_PLAN_BYTES = 1_048_576;
const PLAN_FILE = 'plan.runplanner.json';

/** One authored entry: its folder name (the slug), `entry.json` text and plan file bytes. */
export interface AuthoredCatalogSource {
  readonly folder: string;
  readonly entryJson: string;
  readonly planBytes: Uint8Array;
}

export interface CatalogCategory {
  readonly id: string;
  readonly label: string;
}

/** One entry as the index lists it. */
export interface CatalogFeedEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly author: string;
  readonly routeKey: string;
  readonly biomeCount: number;
  readonly planSchemaVersion: number;
  /** Omitted at 0. */
  readonly planSchemaRevision?: number;
  readonly planUrl: string;
  /** Lower-case hex SHA-256 of the plan file published at `planUrl`. */
  readonly planSha256: string;
}

export interface CatalogFeedBuild {
  readonly feedJson: string;
  /** Each listed entry's plan file, published byte for byte beside the index. */
  readonly plans: readonly { readonly fileName: string; readonly bytes: Uint8Array }[];
  /** One line per authored folder: what became of it. */
  readonly summary: readonly string[];
}

/** The URL an entry's plan file has beside the index. */
export function catalogPlanUrl(slug: string): string {
  return `https://github.com/${CATALOG_REPOSITORY}/releases/download/catalog/${slug}.runplanner.json`;
}

/** A category label as a tag would spell it, such as "fresh-file" for "Fresh File". */
function labelTag(label: string): string {
  return label.trim().split(/\s+/).join('-').toLowerCase();
}

function objectOf(text: string, fileName: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${fileName} must be an object.`);
  }
  return value as Record<string, unknown>;
}

/** The categories in `categories.json`, in their listed order. */
export function parseCatalogCategories(categoriesJson: string): readonly CatalogCategory[] {
  const record = objectOf(categoriesJson, 'categories.json');
  if (
    Object.keys(record).some((key) => key !== 'categories') ||
    !Array.isArray(record.categories)
  ) {
    throw new Error('categories.json must hold only a categories list.');
  }
  const categories = record.categories as unknown[];
  if (categories.length === 0 || categories.length > MAX_CATEGORIES) {
    throw new Error(`categories.json must list 1 to ${MAX_CATEGORIES} categories.`);
  }
  const ids = new Set<string>();
  return categories.map((value) => {
    const category =
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const { id, label } = category;
    if (
      Object.keys(category).some((key) => key !== 'id' && key !== 'label') ||
      typeof id !== 'string' ||
      typeof label !== 'string' ||
      !validSlug(id, MAX_TAG_CHARS) ||
      !validFeedText(label, MAX_CATEGORY_LABEL_CHARS, false)
    ) {
      throw new Error(
        `categories.json: each category is an id (a slug of at most ${MAX_TAG_CHARS} characters) and a one-line label of at most ${MAX_CATEGORY_LABEL_CHARS} characters.`,
      );
    }
    if (ids.has(id)) throw new Error(`categories.json lists ${id} more than once.`);
    ids.add(id);
    return { id, label };
  });
}

interface AuthoredEntry {
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly author: string;
}

function authoredEntry(entryJson: string, categories: readonly CatalogCategory[]): AuthoredEntry {
  const record = objectOf(entryJson, 'entry.json');
  for (const key of Object.keys(record)) {
    if (!(ENTRY_KEYS as readonly string[]).includes(key)) {
      throw new Error(`entry.json: unexpected ${key}.`);
    }
  }
  const text = (key: string, maxChars: number): string => {
    const field = record[key];
    if (typeof field !== 'string' || !validFeedText(field, maxChars, false)) {
      throw new Error(
        `entry.json: ${key} is one non-blank line of at most ${maxChars} characters, without control or invisible formatting characters.`,
      );
    }
    return field;
  };
  const title = text('title', MAX_TITLE_CHARS);
  const description = text('description', MAX_DESCRIPTION_CHARS);
  const author = text('author', MAX_AUTHOR_CHARS);
  const category = categories.find((candidate) => candidate.id === record.category);
  if (category === undefined) {
    throw new Error('entry.json: category must be an id from categories.json.');
  }
  const tags = record.tags;
  if (
    !Array.isArray(tags) ||
    tags.length > MAX_TAGS ||
    new Set(tags).size !== tags.length ||
    !tags.every(
      (tag) =>
        typeof tag === 'string' &&
        validSlug(tag, MAX_TAG_CHARS) &&
        tag !== category.id &&
        tag !== labelTag(category.label),
    )
  ) {
    throw new Error(
      `entry.json: tags lists at most ${MAX_TAGS} distinct tags, each lower-case letters, digits and single hyphens of at most ${MAX_TAG_CHARS} characters, never the category.`,
    );
  }
  return { title, description, category: category.id, tags: tags as string[], author };
}

async function buildEntry(
  source: AuthoredCatalogSource,
  catalog: Catalog,
  categories: readonly CatalogCategory[],
): Promise<{ readonly summary: string; readonly entry: CatalogFeedEntry }> {
  if (!validSlug(source.folder, MAX_SLUG_CHARS)) {
    throw new Error(
      `The folder name is the entry's slug: lower-case letters, digits and single hyphens, at most ${MAX_SLUG_CHARS} characters.`,
    );
  }
  const authored = authoredEntry(source.entryJson, categories);
  if (source.planBytes.length > MAX_PLAN_BYTES) {
    throw new Error(`${PLAN_FILE} exceeds ${MAX_PLAN_BYTES} bytes.`);
  }
  let planJson: string;
  try {
    // A byte order mark is kept, so a plan the app could not parse is refused here.
    planJson = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(source.planBytes);
  } catch {
    throw new Error(`${PLAN_FILE} is not UTF-8 text.`);
  }
  const schema = projectFileSchema(planJson, PLAN_FILE);
  const { project } = compileProjectFile(catalog, planJson, { legacyName: authored.title });
  const routeKey = project.route.routeKey;
  const biomeCount = project.route.biomes.length;
  return {
    summary: `${source.folder}: ${authored.category}, ${routeKey} ${biomeCount} ${biomeCount === 1 ? 'biome' : 'biomes'}, schema ${schema.version}.${schema.revision}`,
    entry: {
      id: source.folder,
      ...authored,
      routeKey,
      biomeCount,
      planSchemaVersion: schema.version,
      ...(schema.revision === 0 ? {} : { planSchemaRevision: schema.revision }),
      planUrl: catalogPlanUrl(source.folder),
      planSha256: await projectFileSha256(source.planBytes),
    },
  };
}

export async function buildCatalogFeed(options: {
  readonly catalog: Catalog;
  readonly categoriesJson: string;
  readonly sources: readonly AuthoredCatalogSource[];
}): Promise<CatalogFeedBuild> {
  const categories = parseCatalogCategories(options.categoriesJson);
  const { results, summary } = await buildFeedFolders(options.sources, async (source) => {
    const built = await buildEntry(source, options.catalog, categories);
    return { summary: built.summary, result: { entry: built.entry, bytes: source.planBytes } };
  });
  return {
    feedJson: JSON.stringify({
      format: CATALOG_FEED_FORMAT,
      formatVersion: CATALOG_FEED_FORMAT_VERSION,
      categories,
      entries: results.map((built) => built.entry),
    }),
    plans: results.map((built) => ({
      fileName: `${built.entry.id}.runplanner.json`,
      bytes: built.bytes,
    })),
    summary,
  };
}
