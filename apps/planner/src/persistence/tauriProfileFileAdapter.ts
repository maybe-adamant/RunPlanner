import type { LoadedProfileFile, ProfileFileAdapter, ProfileFileReference } from './profileFile';

interface ProfileDialogOptions {
  readonly defaultPath?: string;
  readonly filters: readonly {
    readonly extensions: readonly string[];
    readonly name: string;
  }[];
  readonly title: string;
}

export interface TauriProfileFileEnvironment {
  readonly open: (options: ProfileDialogOptions) => Promise<string | null>;
  readonly readTextFile: (path: string) => Promise<string>;
  readonly save: (options: ProfileDialogOptions) => Promise<string | null>;
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

export function createTauriProfileFileAdapter(
  environment: TauriProfileFileEnvironment,
): ProfileFileAdapter {
  const referenceFor = (path: string): ProfileFileReference =>
    Object.freeze({
      fileName: fileNameFromPath(path),
      write: (json: string) => environment.writeTextFile(path, json),
    });

  return Object.freeze({
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
  });
}
