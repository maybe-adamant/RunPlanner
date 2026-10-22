import {
  applyProjectCommand,
  createProjectAddress,
  createProjectHistory,
  encodeProjectDocument,
  reidentifyProjectHistory,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import {
  LOADABLE_PROJECT_SCHEMAS,
  loadProjectDocument,
  type ProjectMigrationProvenance,
} from '../persistence/projectDocumentLoader';
import {
  EMPTY_LIBRARY_SESSION,
  projectFileStem,
  type LibrarySession,
  type OutsideProjectFile,
  type ProjectLibraryAdapter,
  type ProjectLibraryEntry,
  type ProjectLibrarySummary,
} from '../persistence/projectLibrary';
import { assertPublicProjectAdmission } from './project-admission';

const FOLDER_NAME_MAX = 60;
const RESERVED_NAME = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;

/**
 * A folder name as typed, trimmed, or null when it cannot name a folder on every desktop
 * platform: empty, too long, a leading or trailing dot, a separator or reserved character.
 */
export function normalizeFolderName(name: string): string | null {
  const trimmed = name.trim();
  if (
    trimmed.length === 0 ||
    Array.from(trimmed).length > FOLDER_NAME_MAX ||
    trimmed.startsWith('.') ||
    trimmed.endsWith('.') ||
    /[<>:"/\\|?*]/.test(trimmed) ||
    Array.from(trimmed).some((character) => character.charCodeAt(0) < 0x20) ||
    RESERVED_NAME.test(trimmed) ||
    trimmed.toLowerCase().endsWith('.runplanner.json')
  ) {
    return null;
  }
  return trimmed;
}

/** The folder a path sits in, `""` at the top level. */
export function parentFolder(folder: string): string {
  const index = folder.lastIndexOf('/');
  return index < 0 ? '' : folder.slice(0, index);
}

/** A folder path joined with a child name. */
export function childFolder(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`;
}

export function mintRandomProjectId(): string {
  return `run-plan-${globalThis.crypto.randomUUID()}`;
}

export type LibraryItem =
  | {
      readonly kind: 'ready';
      readonly key: string;
      readonly folder: string;
      readonly modifiedMs: number;
      readonly projectId: string;
      /** The plan's name; an older plan without one is named by its file. */
      readonly name: string;
      readonly routeKey: string | null;
      readonly weaponKey: string | null;
      readonly aspectKey: string | null;
      readonly biomeCount: number | null;
    }
  | {
      readonly kind: 'tooNew';
      readonly key: string;
      readonly folder: string;
      readonly modifiedMs: number;
      readonly name: string;
      readonly schemaVersion: number;
    }
  | {
      readonly kind: 'unreadable';
      readonly key: string;
      readonly folder: string;
      readonly modifiedMs: number;
      readonly message: string;
    };

/** A library plan read as a project, ready to open. */
export interface FiledPlan {
  readonly key: string;
  readonly project: ProjectDocument;
  readonly migrationProvenance: readonly ProjectMigrationProvenance[];
  /** The stored file is in an older schema, so its first write rewrites the original. */
  readonly olderOnDisk: boolean;
}

/** Every plan and every folder, nested folders as `/`-separated paths. */
export interface LibraryListing {
  readonly folders: readonly string[];
  readonly items: readonly LibraryItem[];
}

/** A deleted plan's content, kept in memory so the deletion can be undone. */
export interface DeletedPlan {
  readonly key: string;
  readonly folder: string;
  readonly json: string;
}

/** A deleted folder: itself, its subfolders and its plans, kept in memory for undo. */
export interface DeletedFolder {
  readonly folder: string;
  readonly folders: readonly string[];
  readonly plans: readonly DeletedPlan[];
}

/** The files an import filed, and those it could not, each with its reason. */
export interface ImportReport {
  readonly filed: readonly FiledPlan[];
  readonly failed: readonly { readonly fileName: string; readonly message: string }[];
}

export interface ImportFileOptions {
  readonly newIdentity?: boolean;
  readonly folder?: string;
  readonly name?: string;
}

export interface ProjectLibraryOperations {
  /** Whether the library is a folder the system file manager can show. */
  readonly revealable: boolean;
  /** Shows the library folder in the system file manager. */
  reveal(): Promise<void>;
  /** A stored plan's document as it is filed, unloaded. */
  readJson(key: string): Promise<string>;
  /** Every stored plan and folder; a copy sharing an older plan's identity first takes a new one. */
  list(options?: { readonly openKey?: string }): Promise<LibraryListing>;
  /** Reads and loads one plan. */
  read(key: string): Promise<FiledPlan>;
  /** Files a new plan in a folder; it must not share an identity with a stored one. */
  create(project: ProjectDocument, folder: string): Promise<FiledPlan>;
  /** Asks for files and files a copy of each in a folder; empty when the user cancels. */
  importChosenFiles(folder: string): Promise<ImportReport>;
  /**
   * Files a copy; a new identity when asked or when the library holds the file's, and renamed
   * when `name` is given.
   */
  importFile(file: OutsideProjectFile, options?: ImportFileOptions): Promise<FiledPlan>;
  deletePlan(key: string): Promise<DeletedPlan>;
  undoDelete(deleted: DeletedPlan): Promise<FiledPlan>;
  /** Moves a plan to another folder; resolves its new key. */
  movePlan(key: string, folder: string): Promise<string>;
  createFolder(folder: string): Promise<void>;
  moveFolder(from: string, to: string): Promise<void>;
  deleteFolder(folder: string): Promise<DeletedFolder>;
  undoDeleteFolder(deleted: DeletedFolder): Promise<void>;
  /** The file open before the library, until it is offered once or the library holds it. */
  previousFileOffer(): Promise<OutsideProjectFile | null>;
  settlePreviousFileOffer(): Promise<void>;
  /** The `projectId` of the copy each catalog entry was added as, by entry id. */
  catalogCopies(): Promise<Readonly<Record<string, string>>>;
  recordCatalogCopy(entryId: string, projectId: string): Promise<void>;
}

interface CreateProjectLibraryOperationsOptions {
  readonly adapter: ProjectLibraryAdapter;
  readonly catalog: Catalog;
  readonly mintProjectId?: () => string;
}

function tooNew(summary: ProjectLibrarySummary): boolean {
  const version = summary.schemaVersion;
  if (version === null) return false;
  return (
    version > LOADABLE_PROJECT_SCHEMAS.newest ||
    (version === LOADABLE_PROJECT_SCHEMAS.newest &&
      (summary.schemaRevision ?? 0) > LOADABLE_PROJECT_SCHEMAS.newestRevision)
  );
}

function classify(entry: ProjectLibraryEntry): LibraryItem {
  const { key, folder, modifiedMs, content } = entry;
  if (content.status === 'unreadable') {
    return Object.freeze({ kind: 'unreadable', key, folder, modifiedMs, message: content.message });
  }
  const { summary } = content;
  const name = summary.name ?? projectFileStem(key);
  if (tooNew(summary) && summary.schemaVersion !== null) {
    return Object.freeze({
      kind: 'tooNew',
      key,
      folder,
      modifiedMs,
      name,
      schemaVersion: summary.schemaVersion,
    });
  }
  const projectId = summary.projectId?.trim() ?? '';
  if (summary.schemaVersion === null || projectId.length === 0) {
    return Object.freeze({
      kind: 'unreadable',
      key,
      folder,
      modifiedMs,
      message: 'Not a plan file: it has no schema version or project identity.',
    });
  }
  if (summary.schemaVersion < LOADABLE_PROJECT_SCHEMAS.oldest) {
    return Object.freeze({
      kind: 'unreadable',
      key,
      folder,
      modifiedMs,
      message: `Project schema ${summary.schemaVersion} is older than the planner can open.`,
    });
  }
  return Object.freeze({
    kind: 'ready',
    key,
    folder,
    modifiedMs,
    projectId,
    name,
    routeKey: summary.routeKey,
    weaponKey: summary.weaponKey,
    aspectKey: summary.aspectKey,
    biomeCount: summary.biomeCount,
  });
}

/** Oldest first, so the plan that held an identity first keeps it. */
function byAge(left: LibraryItem, right: LibraryItem): number {
  return left.modifiedMs - right.modifiedMs || (left.key < right.key ? -1 : 1);
}

export function createProjectLibraryOperations(
  options: CreateProjectLibraryOperationsOptions,
): ProjectLibraryOperations {
  const { adapter, catalog } = options;
  const mintProjectId = options.mintProjectId ?? mintRandomProjectId;

  const load = (json: string, fileName: string) => {
    const loaded = loadProjectDocument(json, catalog, {
      legacyName: projectFileStem(fileName),
    });
    assertPublicProjectAdmission(catalog, loaded.project);
    return loaded;
  };
  const reidentified = (project: ProjectDocument): ProjectDocument =>
    reidentifyProjectHistory(createProjectHistory(project), mintProjectId()).present;
  const filed = (
    entry: ProjectLibraryEntry,
    project: ProjectDocument,
    migrationProvenance: readonly ProjectMigrationProvenance[] = [],
  ): FiledPlan =>
    Object.freeze({ key: entry.key, project, migrationProvenance, olderOnDisk: false });
  const heldIdentities = async (): Promise<ReadonlySet<string>> =>
    new Set(
      (await adapter.list()).entries
        .map(classify)
        .flatMap((item) => (item.kind === 'ready' ? [item.projectId] : [])),
    );

  const reidentifyCopy = async (item: LibraryItem): Promise<LibraryItem> => {
    try {
      const project = reidentified(load(await adapter.read(item.key), item.key).project);
      return classify(await adapter.write(item.key, encodeProjectDocument(project)));
    } catch {
      // A copy the planner cannot open keeps its identity until it can.
      return item;
    }
  };

  let session: Promise<LibrarySession> | null = null;
  const currentSession = (): Promise<LibrarySession> => {
    session ??= adapter.readSession().catch(() => EMPTY_LIBRARY_SESSION);
    return session;
  };
  const updateSession = (change: Partial<LibrarySession>): Promise<void> => {
    const next = currentSession().then((current) => Object.freeze({ ...current, ...change }));
    session = next;
    return next.then((updated) => adapter.writeSession(updated));
  };

  const read = async (key: string): Promise<FiledPlan> => {
    const { project, migrationProvenance } = load(await adapter.read(key), key);
    return Object.freeze({
      key,
      project,
      migrationProvenance,
      olderOnDisk: migrationProvenance.length > 0,
    });
  };
  const create = async (project: ProjectDocument, folder: string): Promise<FiledPlan> =>
    filed(await adapter.create(encodeProjectDocument(project), folder), project);
  const importFile = async (
    file: OutsideProjectFile,
    importOptions: ImportFileOptions = {},
  ): Promise<FiledPlan> => {
    const loaded = load(file.json, file.fileName);
    const { migrationProvenance } = loaded;
    const project =
      importOptions.name === undefined
        ? loaded.project
        : applyProjectCommand(loaded.project, catalog, {
            kind: 'RenameProject',
            project: createProjectAddress(),
            name: importOptions.name,
          });
    const fresh =
      importOptions.newIdentity === true || (await heldIdentities()).has(project.projectId);
    const copy = fresh ? reidentified(project) : project;
    return filed(
      await adapter.create(encodeProjectDocument(copy), importOptions.folder ?? ''),
      copy,
      migrationProvenance,
    );
  };

  return Object.freeze({
    revealable: adapter.supportsReveal,
    reveal: () => adapter.reveal(),
    readJson: (key: string) => adapter.read(key),
    async list(listOptions: { readonly openKey?: string } = {}): Promise<LibraryListing> {
      const listing = await adapter.list();
      const items = listing.entries.map(classify);
      const holders = new Set<string>();
      const result: LibraryItem[] = [];
      // The open plan keeps its identity, whatever its age.
      const ordered = [...items].sort(
        (left, right) =>
          Number(right.key === listOptions.openKey) - Number(left.key === listOptions.openKey) ||
          byAge(left, right),
      );
      for (const item of ordered) {
        if (item.kind !== 'ready' || !holders.has(item.projectId)) {
          if (item.kind === 'ready') holders.add(item.projectId);
          result.push(item);
          continue;
        }
        result.push(await reidentifyCopy(item));
      }
      return Object.freeze({
        folders: Object.freeze([...listing.folders]),
        items: Object.freeze(result.sort(byAge)),
      });
    },
    read,
    create,
    importFile,
    async importChosenFiles(folder: string): Promise<ImportReport> {
      const filed: FiledPlan[] = [];
      const failed: { readonly fileName: string; readonly message: string }[] = [];
      // One at a time, so a later file sees the identities an earlier one took.
      for (const file of await adapter.chooseImportFiles()) {
        if ('problem' in file) {
          failed.push(Object.freeze({ fileName: file.fileName, message: file.problem }));
          continue;
        }
        try {
          filed.push(await importFile(file, { folder }));
        } catch (error) {
          failed.push(
            Object.freeze({
              fileName: file.fileName,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
      return Object.freeze({ filed: Object.freeze(filed), failed: Object.freeze(failed) });
    },
    async deletePlan(key: string): Promise<DeletedPlan> {
      const json = await adapter.read(key);
      const entry = (await adapter.list()).entries.find((candidate) => candidate.key === key);
      await adapter.delete(key);
      return Object.freeze({ key, folder: entry?.folder ?? '', json });
    },
    async undoDelete(deleted: DeletedPlan): Promise<FiledPlan> {
      const { project } = load(deleted.json, deleted.key);
      return filed(await adapter.create(deleted.json, deleted.folder), project);
    },
    async movePlan(key: string, folder: string): Promise<string> {
      return (await adapter.movePlan(key, folder)).key;
    },
    createFolder: (folder: string) => adapter.createFolder(folder),
    moveFolder: (from: string, to: string) => adapter.moveFolder(from, to),
    async deleteFolder(folder: string): Promise<DeletedFolder> {
      const listing = await adapter.list();
      const inside = (path: string) => path === folder || path.startsWith(`${folder}/`);
      const plans: DeletedPlan[] = [];
      for (const entry of listing.entries.filter((candidate) => inside(candidate.folder))) {
        plans.push(
          Object.freeze({
            key: entry.key,
            folder: entry.folder,
            json: await adapter.read(entry.key),
          }),
        );
      }
      await adapter.deleteFolder(folder);
      return Object.freeze({
        folder,
        folders: Object.freeze(listing.folders.filter(inside)),
        plans: Object.freeze(plans),
      });
    },
    async undoDeleteFolder(deleted: DeletedFolder): Promise<void> {
      for (const folder of [deleted.folder, ...deleted.folders]) await adapter.createFolder(folder);
      for (const plan of deleted.plans) await adapter.create(plan.json, plan.folder);
    },
    async previousFileOffer(): Promise<OutsideProjectFile | null> {
      if ((await currentSession()).previousFileOffered) return null;
      const file = await adapter.previousActiveFile();
      if (file === null) return null;
      let projectId: unknown;
      try {
        projectId = (JSON.parse(file.json) as { projectId?: unknown }).projectId;
      } catch {
        return file;
      }
      return typeof projectId === 'string' && (await heldIdentities()).has(projectId) ? null : file;
    },
    settlePreviousFileOffer: () => updateSession({ previousFileOffered: true }),
    catalogCopies: async () => (await currentSession()).catalogCopies,
    async recordCatalogCopy(entryId: string, projectId: string): Promise<void> {
      const { catalogCopies } = await currentSession();
      await updateSession({
        catalogCopies: Object.freeze({ ...catalogCopies, [entryId]: projectId }),
      });
    },
  });
}
