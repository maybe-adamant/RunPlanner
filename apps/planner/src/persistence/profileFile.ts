export type ProfileSaveResult = 'cancelled' | 'saved';

export interface LoadedProfileFile {
  readonly fileName: string;
  readonly json: string;
}

export interface ProfileFileAdapter {
  save(suggestedFileName: string, json: string): Promise<ProfileSaveResult>;
  load(): Promise<LoadedProfileFile | null>;
}

export function createUnavailableProfileFileAdapter(): ProfileFileAdapter {
  return Object.freeze({
    save: () => Promise.reject(new Error('Profile saving is unavailable in this environment')),
    load: () => Promise.reject(new Error('Profile loading is unavailable in this environment')),
  });
}
