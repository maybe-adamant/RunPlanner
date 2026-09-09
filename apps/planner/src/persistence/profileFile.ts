/** One host-owned file target established by Open, first Save, or Save As. */
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
  /** Whether this host can choose a distinct target from ordinary Save. */
  readonly supportsSaveAs: boolean;
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
    supportsSaveAs: false,
    saveAs: () => Promise.reject(new Error('Profile saving is unavailable in this environment')),
    load: () => Promise.reject(new Error('Profile loading is unavailable in this environment')),
    restoreActive: () => Promise.resolve(Object.freeze({ status: 'none' as const })),
  });
}
