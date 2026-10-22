/**
 * What the community event and plan catalog builders share: authored folders checked one by one
 * with every problem reported at once, the text and slug rules the host decoders apply, and the
 * schema and hash of each project file published beside a feed.
 */

/** Lower-case letters, digits and single hyphens, as event ids, entry slugs and tags are. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Unicode format characters (category Cf) and the line and paragraph separators, which the
// host refuses in every feed text.
const INVISIBLE = /[\p{Cf}\u2028\u2029]/u;
// Control characters; multiline text may hold line breaks.
const CONTROL = /\p{Cc}/u;
const CONTROL_EXCEPT_BREAKS = /[^\P{Cc}\n\r]/u;

export function validSlug(text: string, maxChars: number): boolean {
  return SLUG.test(text) && text.length <= maxChars;
}

/** Text the host accepts: non-blank, bounded, and without control or format characters. */
export function validFeedText(text: string, maxChars: number, multiline: boolean): boolean {
  return (
    text.trim() !== '' &&
    Array.from(text).length <= maxChars &&
    !INVISIBLE.test(text) &&
    !(multiline ? CONTROL_EXCEPT_BREAKS : CONTROL).test(text)
  );
}

/** Folders whose name starts with `_` are templates and never published. */
export function isTemplateFolder(folder: string): boolean {
  return folder.startsWith('_');
}

/** The `schemaVersion` and `schemaRevision` (absent means 0) a project file is saved in. */
export function projectFileSchema(
  projectJson: string,
  fileName: string,
): { readonly version: number; readonly revision: number } {
  const value: unknown = JSON.parse(projectJson);
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const version = record.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(`${fileName} names no schemaVersion.`);
  }
  const revision = record.schemaRevision ?? 0;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    throw new Error(`${fileName} has an invalid schemaRevision.`);
  }
  return { version, revision };
}

/** Lower-case hex SHA-256 of a project file, as a feed records it; text is hashed as UTF-8. */
export async function projectFileSha256(content: string | Uint8Array): Promise<string> {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds each authored folder in name order, skipping templates. Every folder is checked before
 * any problem fails the build, so all are reported at once.
 */
export async function buildFeedFolders<S extends { readonly folder: string }, R>(
  sources: readonly S[],
  build: (source: S) => Promise<{ readonly summary: string; readonly result: R | null }>,
): Promise<{ readonly results: readonly R[]; readonly summary: readonly string[] }> {
  const results: R[] = [];
  const summary: string[] = [];
  const problems: string[] = [];
  const sorted = [...sources].sort((a, b) =>
    a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0,
  );
  for (const source of sorted) {
    if (isTemplateFolder(source.folder)) {
      summary.push(`${source.folder}: template, not published`);
      continue;
    }
    try {
      const built = await build(source);
      summary.push(built.summary);
      if (built.result !== null) results.push(built.result);
    } catch (error) {
      problems.push(`${source.folder}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return { results, summary };
}
