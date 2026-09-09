/** One host-owned file target established by Open or the first Save. */
export interface ProfileFileReference {
  readonly fileName: string;
  /** Establishes this already-written/accepted native target for later sessions. */
  activate(): Promise<void>;
  write(json: string): Promise<void>;
}

export interface LoadedProfileFile {
  readonly file: ProfileFileReference;
  readonly json: string;
}

export interface ProfileFileAdapter {
  clearActive(): Promise<void>;
  saveAs(suggestedFileName: string, json: string): Promise<ProfileFileReference | null>;
  load(): Promise<LoadedProfileFile | null>;
  restoreActive(): Promise<ProfileFileRestoreResult>;
}

export type ProfileFileRestoreResult =
  | { readonly status: 'none' }
  | { readonly status: 'loaded'; readonly loaded: LoadedProfileFile }
  | { readonly status: 'failure'; readonly message: string };

export function createUnavailableProfileFileAdapter(): ProfileFileAdapter {
  return Object.freeze({
    clearActive: () => Promise.resolve(),
    saveAs: () => Promise.reject(new Error('Profile saving is unavailable in this environment')),
    load: () => Promise.reject(new Error('Profile loading is unavailable in this environment')),
    restoreActive: () => Promise.resolve(Object.freeze({ status: 'none' as const })),
  });
}
