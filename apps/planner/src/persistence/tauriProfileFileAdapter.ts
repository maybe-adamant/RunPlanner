import type {
  LoadedProfileFile,
  ProfileFileAdapter,
  ProfileFileReference,
  ProfileFileRestoreResult,
} from './profileFile';

interface ProfileDialogOptions {
  readonly defaultPath?: string;
  readonly filters: readonly {
    readonly extensions: readonly string[];
    readonly name: string;
  }[];
  readonly title: string;
}

export interface TauriProfileFileEnvironment {
  readonly activate: (path: string) => Promise<void>;
  readonly clearActive: () => Promise<void>;
  readonly open: (options: ProfileDialogOptions) => Promise<string | null>;
  readonly readTextFile: (path: string) => Promise<string>;
  readonly restoreActive: () => Promise<{
    readonly fileName: string;
    readonly json: string;
  } | null>;
  readonly save: (options: ProfileDialogOptions) => Promise<string | null>;
  readonly writeActive: (json: string) => Promise<void>;
  readonly writeTextFile: (path: string, json: string) => Promise<void>;
}

const profileFilters = Object.freeze([
  Object.freeze({ name: 'Run Planner project', extensions: Object.freeze(['json']) }),
]);

function fileNameFromPath(path: string): string {
  const fileName = path.replaceAll('\\', '/').split('/').at(-1)?.trim();
  if (fileName === undefined || fileName.length === 0) {
    throw new Error('Native profile path must identify a file');
  }
  return fileName;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createTauriProfileFileAdapter(
  environment: TauriProfileFileEnvironment,
): ProfileFileAdapter {
  const referenceFor = (path: string): ProfileFileReference =>
    Object.freeze({
      activate: () => environment.activate(path),
      fileName: fileNameFromPath(path),
      write: (json: string) => environment.writeTextFile(path, json),
    });
  const restoredReference = (fileName: string): ProfileFileReference =>
    Object.freeze({
      activate: () => Promise.resolve(),
      fileName,
      write: (json: string) => environment.writeActive(json),
    });

  return Object.freeze({
    clearActive: () => environment.clearActive(),
    supportsSaveAs: true,
    async saveAs(suggestedFileName: string, json: string): Promise<ProfileFileReference | null> {
      const path = await environment.save({
        defaultPath: suggestedFileName,
        filters: profileFilters,
        title: 'Save Run Planner project',
      });
      if (path === null) return null;
      const file = referenceFor(path);
      await file.write(json);
      return file;
    },
    async load(): Promise<LoadedProfileFile | null> {
      const path = await environment.open({
        filters: profileFilters,
        title: 'Open Run Planner project',
      });
      if (path === null) return null;
      const json = await environment.readTextFile(path);
      return Object.freeze({ file: referenceFor(path), json });
    },
    async restoreActive(): Promise<ProfileFileRestoreResult> {
      try {
        const restored = await environment.restoreActive();
        if (restored === null) return Object.freeze({ status: 'none' as const });
        return Object.freeze({
          status: 'loaded' as const,
          loaded: Object.freeze({
            file: restoredReference(restored.fileName),
            json: restored.json,
          }),
        });
      } catch (error) {
        return Object.freeze({
          status: 'failure' as const,
          message: `Could not restore the active profile: ${errorDetail(error)}`,
        });
      }
    },
  });
}
