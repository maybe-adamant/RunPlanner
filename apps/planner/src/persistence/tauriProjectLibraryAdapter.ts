import type {
  OutsideProjectFile,
  ProjectLibraryAdapter,
  ProjectLibraryEntry,
} from './projectLibrary';

export interface TauriProjectLibraryEnvironment {
  readonly invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  /** Picks a file through the native dialog and reads it; null when cancelled. */
  readonly chooseFile: () => Promise<OutsideProjectFile | null>;
}

/** The library folder in the documents directory, through the desktop host's commands. */
export function createTauriProjectLibraryAdapter(
  environment: TauriProjectLibraryEnvironment,
): ProjectLibraryAdapter {
  const { invoke } = environment;
  return Object.freeze({
    supportsReveal: true,
    list: () => invoke<readonly ProjectLibraryEntry[]>('project_library_list'),
    read: (key: string) => invoke<string>('project_library_read', { key }),
    create: (json: string) => invoke<ProjectLibraryEntry>('project_library_create', { json }),
    write: (key: string, json: string) =>
      invoke<ProjectLibraryEntry>('project_library_write', { key, json }),
    async delete(key: string): Promise<void> {
      await invoke('project_library_delete', { key });
    },
    restore: (key: string) => invoke<ProjectLibraryEntry>('project_library_restore', { key }),
    async reveal(): Promise<void> {
      await invoke('project_library_reveal');
    },
    chooseImportFile: () => environment.chooseFile(),
    previousActiveFile: () => invoke<OutsideProjectFile | null>('project_library_previous_active'),
  });
}
