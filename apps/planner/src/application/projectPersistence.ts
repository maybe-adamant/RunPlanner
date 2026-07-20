export interface ProjectStorageAdapter {
  read(): string | null;
  write(json: string): void;
}

export interface ProjectJsonTransferAdapter {
  download(fileName: string, json: string): void;
  upload(): Promise<string | null>;
}

export interface ProjectPersistenceAdapters {
  readonly storage: ProjectStorageAdapter;
  readonly transfer: ProjectJsonTransferAdapter;
}

export function createMemoryProjectStorage(
  initialJson: string | null = null,
): ProjectStorageAdapter {
  let json = initialJson;
  return {
    read: () => json,
    write: (nextJson) => {
      json = nextJson;
    },
  };
}

export function createUnavailableProjectTransfer(): ProjectJsonTransferAdapter {
  return {
    download: () => {
      throw new Error('JSON download is unavailable in this environment');
    },
    upload: () => Promise.reject(new Error('JSON upload is unavailable in this environment')),
  };
}

export function createDefaultProjectPersistenceAdapters(): ProjectPersistenceAdapters {
  return Object.freeze({
    storage: createMemoryProjectStorage(),
    transfer: createUnavailableProjectTransfer(),
  });
}
