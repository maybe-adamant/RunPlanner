import {
  createProjectHistory,
  encodeProjectDocument,
  reidentifyProjectHistory,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { profileFileStem } from '../persistence/profileFile';
import {
  LOADABLE_PROJECT_SCHEMAS,
  loadProjectDocument,
} from '../persistence/projectDocumentLoader';
import type {
  OutsideProjectFile,
  ProjectLibraryAdapter,
  ProjectLibraryEntry,
  ProjectLibrarySummary,
} from '../persistence/projectLibrary';
import { assertPublicProjectAdmission } from './project-admission';
import { mintRandomProjectId } from './projectOperations';

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

export type LibraryImportResult =
  | { readonly status: 'imported'; readonly item: LibraryItem; readonly reidentified: boolean }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failure'; readonly message: string };

export interface ProjectLibraryOperations {
  /** Every stored plan; a copy sharing an older plan's identity first takes a new one. */
  list(): Promise<readonly LibraryItem[]>;
  /** Imports a file the user picks as a new library plan. */
  importChosenFile(): Promise<LibraryImportResult>;
  /** The previously open file, when it exists and is not in the library yet. */
  previousActiveImportOffer(): Promise<OutsideProjectFile | null>;
  importFile(file: OutsideProjectFile): Promise<LibraryImportResult>;
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
  const name = summary.name ?? profileFileStem(key);
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

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createProjectLibraryOperations(
  options: CreateProjectLibraryOperationsOptions,
): ProjectLibraryOperations {
  const { adapter, catalog } = options;
  const mintProjectId = options.mintProjectId ?? mintRandomProjectId;

  const load = (json: string, fileName: string): ProjectDocument => {
    const { project } = loadProjectDocument(json, catalog, {
      legacyName: profileFileStem(fileName),
    });
    assertPublicProjectAdmission(catalog, project);
    return project;
  };
  const reidentified = (project: ProjectDocument): ProjectDocument =>
    reidentifyProjectHistory(createProjectHistory(project), mintProjectId()).present;

  const reidentifyCopy = async (item: LibraryItem): Promise<LibraryItem> => {
    try {
      const project = reidentified(load(await adapter.read(item.key), item.key));
      return classify(await adapter.write(item.key, encodeProjectDocument(project)));
    } catch {
      // A copy the planner cannot open keeps its identity until it can.
      return item;
    }
  };

  const list = async (): Promise<readonly LibraryItem[]> => {
    const items = (await adapter.list()).map(classify);
    const holders = new Set<string>();
    const result: LibraryItem[] = [];
    for (const item of [...items].sort(byAge)) {
      if (item.kind !== 'ready' || !holders.has(item.projectId)) {
        if (item.kind === 'ready') holders.add(item.projectId);
        result.push(item);
        continue;
      }
      result.push(await reidentifyCopy(item));
    }
    return Object.freeze(result);
  };

  const importFile = async (file: OutsideProjectFile): Promise<LibraryImportResult> => {
    try {
      const project = load(file.json, file.fileName);
      const present = (await adapter.list()).map(classify);
      const taken = present.some(
        (item) => item.kind === 'ready' && item.projectId === project.projectId,
      );
      const filed = taken ? reidentified(project) : project;
      const entry = await adapter.create(encodeProjectDocument(filed));
      return Object.freeze({ status: 'imported', item: classify(entry), reidentified: taken });
    } catch (error) {
      return Object.freeze({
        status: 'failure',
        message: `Could not import ${file.fileName}: ${errorDetail(error)}`,
      });
    }
  };

  return Object.freeze({
    list,
    importFile,
    async importChosenFile(): Promise<LibraryImportResult> {
      let file: OutsideProjectFile | null;
      try {
        file = await adapter.chooseImportFile();
      } catch (error) {
        return Object.freeze({
          status: 'failure',
          message: `Could not import: ${errorDetail(error)}`,
        });
      }
      return file === null ? Object.freeze({ status: 'cancelled' }) : importFile(file);
    },
    async previousActiveImportOffer(): Promise<OutsideProjectFile | null> {
      const file = await adapter.previousActiveFile();
      if (file === null) return null;
      let projectId: unknown;
      try {
        projectId = (JSON.parse(file.json) as { projectId?: unknown }).projectId;
      } catch {
        return file;
      }
      const present = (await adapter.list()).map(classify);
      const imported = present.some(
        (item) => item.kind === 'ready' && item.projectId === projectId,
      );
      return imported ? null : file;
    },
  });
}
