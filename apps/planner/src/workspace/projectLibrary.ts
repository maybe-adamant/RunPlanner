import {
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

export function mintRandomProjectId(): string {
  return `run-plan-${globalThis.crypto.randomUUID()}`;
}

export type LibraryItem =
  | {
      readonly kind: 'ready';
      readonly key: string;
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
      readonly modifiedMs: number;
      readonly name: string;
      readonly schemaVersion: number;
    }
  | {
      readonly kind: 'unreadable';
      readonly key: string;
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

/** A deleted plan's content, kept in memory so the deletion can be undone. */
export interface DeletedPlan {
  readonly key: string;
  readonly json: string;
}

export interface ProjectLibraryOperations {
  /** Every stored plan; a copy sharing an older plan's identity first takes a new one. */
  list(options?: { readonly openKey?: string }): Promise<readonly LibraryItem[]>;
  /** Reads and loads one plan. */
  read(key: string): Promise<FiledPlan>;
  /** Files a new plan; it must not share an identity with a stored one. */
  create(project: ProjectDocument): Promise<FiledPlan>;
  /** Asks for a file and files a copy of it; null when the user cancels. */
  importChosenFile(): Promise<FiledPlan | null>;
  /** Files a copy; a new identity when asked or when the library holds the file's. */
  importFile(
    file: OutsideProjectFile,
    options?: { readonly newIdentity?: boolean },
  ): Promise<FiledPlan>;
  deletePlan(key: string): Promise<DeletedPlan>;
  undoDelete(deleted: DeletedPlan): Promise<FiledPlan>;
  /** The plan open when the planner last closed, when it is still in the library. */
  readLastOpened(): Promise<FiledPlan | null>;
  rememberOpened(plan: { readonly key: string; readonly projectId: string } | null): Promise<void>;
  /** The file open before the library, until it is offered once or the library holds it. */
  previousFileOffer(): Promise<OutsideProjectFile | null>;
  settlePreviousFileOffer(): Promise<void>;
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
  const { key, modifiedMs, content } = entry;
  if (content.status === 'unreadable') {
    return Object.freeze({ kind: 'unreadable', key, modifiedMs, message: content.message });
  }
  const { summary } = content;
  const name = summary.name ?? projectFileStem(key);
  if (tooNew(summary) && summary.schemaVersion !== null) {
    return Object.freeze({
      kind: 'tooNew',
      key,
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
      modifiedMs,
      message: 'Not a plan file: it has no schema version or project identity.',
    });
  }
  if (summary.schemaVersion < LOADABLE_PROJECT_SCHEMAS.oldest) {
    return Object.freeze({
      kind: 'unreadable',
      key,
      modifiedMs,
      message: `Project schema ${summary.schemaVersion} is older than the planner can open.`,
    });
  }
  return Object.freeze({
    kind: 'ready',
    key,
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
      (await adapter.list())
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
  const create = async (project: ProjectDocument): Promise<FiledPlan> =>
    filed(await adapter.create(encodeProjectDocument(project)), project);
  const importFile = async (
    file: OutsideProjectFile,
    importOptions: { readonly newIdentity?: boolean } = {},
  ): Promise<FiledPlan> => {
    const { project, migrationProvenance } = load(file.json, file.fileName);
    const fresh =
      importOptions.newIdentity === true || (await heldIdentities()).has(project.projectId);
    const copy = fresh ? reidentified(project) : project;
    return filed(await adapter.create(encodeProjectDocument(copy)), copy, migrationProvenance);
  };

  return Object.freeze({
    async list(listOptions: { readonly openKey?: string } = {}): Promise<readonly LibraryItem[]> {
      const items = (await adapter.list()).map(classify);
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
      return Object.freeze(result.sort(byAge));
    },
    read,
    create,
    importFile,
    async importChosenFile(): Promise<FiledPlan | null> {
      const file = await adapter.chooseImportFile();
      return file === null ? null : importFile(file);
    },
    async deletePlan(key: string): Promise<DeletedPlan> {
      const json = await adapter.read(key);
      await adapter.delete(key);
      return Object.freeze({ key, json });
    },
    async undoDelete(deleted: DeletedPlan): Promise<FiledPlan> {
      const { project } = load(deleted.json, deleted.key);
      return filed(await adapter.create(deleted.json), project);
    },
    async readLastOpened(): Promise<FiledPlan | null> {
      const last = (await currentSession()).lastOpened;
      if (last === null) return null;
      const entries = await adapter.list();
      const entry =
        entries.find((candidate) => candidate.key === last.key) ??
        entries.find(
          (candidate) =>
            candidate.content.status === 'summarized' &&
            candidate.content.summary.projectId === last.projectId,
        );
      return entry === undefined ? null : read(entry.key);
    },
    rememberOpened: (plan: { readonly key: string; readonly projectId: string } | null) =>
      updateSession({
        lastOpened:
          plan === null ? null : Object.freeze({ key: plan.key, projectId: plan.projectId }),
      }),
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
  });
}
