import type {
  LibrarySession,
  OutsideProjectFile,
  ProjectLibraryAdapter,
  ProjectLibraryEntry,
  ProjectLibraryListing,
} from './projectLibrary';

export interface TauriProjectLibraryEnvironment {
  readonly invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  /** The native open dialog; resolves the chosen path, or null when cancelled. */
  readonly openDialog: (options: {
    readonly title: string;
    readonly filters: { readonly name: string; readonly extensions: string[] }[];
  }) => Promise<string | null>;
  readonly readTextFile: (path: string) => Promise<string>;
}

function fileNameFromPath(path: string): string {
  const fileName = path.replaceAll('\\', '/').split('/').at(-1)?.trim();
  if (fileName === undefined || fileName.length === 0) {
    throw new Error('The chosen path does not name a file');
  }
  return fileName;
}

/** The library folder in the documents directory, through the desktop host's commands. */
export function createTauriProjectLibraryAdapter(
  environment: TauriProjectLibraryEnvironment,
): ProjectLibraryAdapter {
  const { invoke } = environment;
  return Object.freeze({
    supportsReveal: true,
    list: () => invoke<ProjectLibraryListing>('project_library_list'),
    read: (key: string) => invoke<string>('project_library_read', { key }),
    create: (json: string, folder: string) =>
      invoke<ProjectLibraryEntry>('project_library_create', { json, folder }),
    movePlan: (key: string, folder: string) =>
      invoke<ProjectLibraryEntry>('project_library_move', { key, folder }),
    async createFolder(folder: string): Promise<void> {
      await invoke('project_library_folder_create', { folder });
    },
    async moveFolder(from: string, to: string): Promise<void> {
      await invoke('project_library_folder_move', { from, to });
    },
    async deleteFolder(folder: string): Promise<void> {
      await invoke('project_library_folder_delete', { folder });
    },
    write: (key: string, json: string) =>
      invoke<ProjectLibraryEntry>('project_library_write', { key, json }),
    async delete(key: string): Promise<void> {
      await invoke('project_library_delete', { key });
    },
    async preserveOriginal(key: string): Promise<void> {
      await invoke('project_library_preserve_original', { key });
    },
    async reveal(): Promise<void> {
      await invoke('project_library_reveal');
    },
    async chooseImportFile(): Promise<OutsideProjectFile | null> {
      const path = await environment.openDialog({
        filters: [{ name: 'Run Planner project', extensions: ['json'] }],
        title: 'Import a Run Planner plan',
      });
      if (path === null) return null;
      return { fileName: fileNameFromPath(path), json: await environment.readTextFile(path) };
    },
    previousActiveFile: () => invoke<OutsideProjectFile | null>('project_library_previous_active'),
    readSession: () => invoke<LibrarySession>('project_library_session_read'),
    async writeSession(session: LibrarySession): Promise<void> {
      await invoke('project_library_session_write', { session });
    },
  });
}
