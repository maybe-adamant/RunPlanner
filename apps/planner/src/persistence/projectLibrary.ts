/** What the library reads from a stored plan without opening it as a project. */
export interface ProjectLibrarySummary {
  readonly schemaVersion: number | null;
  readonly schemaRevision: number | null;
  readonly projectId: string | null;
  readonly name: string | null;
  readonly routeKey: string | null;
  readonly weaponKey: string | null;
  readonly aspectKey: string | null;
  readonly biomeCount: number | null;
}

export type ProjectLibraryEntryContent =
  | { readonly status: 'summarized'; readonly summary: ProjectLibrarySummary }
  | { readonly status: 'unreadable'; readonly message: string };

/** One stored plan. Its key addresses it in the library and changes when a rename refiles it. */
export interface ProjectLibraryEntry {
  readonly key: string;
  readonly modifiedMs: number;
  readonly content: ProjectLibraryEntryContent;
}

/** A plan file from outside the library, by its own file name. */
export interface OutsideProjectFile {
  readonly fileName: string;
  readonly json: string;
}

/**
 * The host's store of library plans. It files complete documents and never edits their
 * content; a document must carry a project identity and a name to be filed.
 */
export interface ProjectLibraryAdapter {
  /** Whether the library is a folder the system file manager can show. */
  readonly supportsReveal: boolean;
  list(): Promise<readonly ProjectLibraryEntry[]>;
  read(key: string): Promise<string>;
  create(json: string): Promise<ProjectLibraryEntry>;
  /** Replaces the plan; the returned entry carries its key after any rename. */
  write(key: string, json: string): Promise<ProjectLibraryEntry>;
  /** Moves the plan to the recycle bin, from which `restore` brings it back. */
  delete(key: string): Promise<void>;
  restore(key: string): Promise<ProjectLibraryEntry>;
  reveal(): Promise<void>;
  /** Asks the user for a plan file to import; null when they cancel. */
  chooseImportFile(): Promise<OutsideProjectFile | null>;
  /** The file the planner had open before it kept a library, when one is remembered. */
  previousActiveFile(): Promise<OutsideProjectFile | null>;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reads a stored plan's head as the desktop host does, for hosts without a native reader. */
export function summarizeProjectJson(json: string): ProjectLibraryEntryContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return Object.freeze({
      status: 'unreadable' as const,
      message: `Not a plan file: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
  const head = record(parsed);
  if (head === null) {
    return Object.freeze({
      status: 'unreadable' as const,
      message: 'Not a plan file: the content is not a JSON object.',
    });
  }
  const route = record(head.route);
  const loadout = record(route?.loadout);
  return Object.freeze({
    status: 'summarized' as const,
    summary: Object.freeze({
      schemaVersion: nullableNumber(head.schemaVersion),
      schemaRevision: nullableNumber(head.schemaRevision),
      projectId: nullableString(head.projectId),
      name: nullableString(head.name),
      routeKey: nullableString(route?.routeKey),
      weaponKey: nullableString(loadout?.weaponKey),
      aspectKey: nullableString(loadout?.aspectKey),
      biomeCount: Array.isArray(route?.biomes) ? route.biomes.length : null,
    }),
  });
}
