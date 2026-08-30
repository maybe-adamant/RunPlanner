/** One host-owned file target established by Open or the first Save. */
export interface ProfileFileReference {
  readonly fileName: string;
  write(json: string): Promise<void>;
}

export interface LoadedProfileFile {
  readonly file: ProfileFileReference;
  readonly json: string;
}

export interface ProfileFileAdapter {
  saveAs(suggestedFileName: string, json: string): Promise<ProfileFileReference | null>;
  load(): Promise<LoadedProfileFile | null>;
}

export function createUnavailableProfileFileAdapter(): ProfileFileAdapter {
  return Object.freeze({
    saveAs: () => Promise.reject(new Error('Profile saving is unavailable in this environment')),
    load: () => Promise.reject(new Error('Profile loading is unavailable in this environment')),
  });
}
