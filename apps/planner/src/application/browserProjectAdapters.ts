import type {
  ProjectJsonTransferAdapter,
  ProjectPersistenceAdapters,
  ProjectStorageAdapter,
} from './projectPersistence';

const projectStorageKey = 'run-planner.project';

export interface BrowserProjectTransferEnvironment {
  readonly Blob: typeof Blob;
  readonly URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  readonly document: Document;
}

export function createBrowserProjectStorage(storage: Storage): ProjectStorageAdapter {
  return Object.freeze({
    read: () => storage.getItem(projectStorageKey),
    write: (json: string) => storage.setItem(projectStorageKey, json),
  });
}

export function createBrowserProjectTransfer(
  environment: BrowserProjectTransferEnvironment,
): ProjectJsonTransferAdapter {
  return Object.freeze({
    download(fileName: string, json: string): void {
      const blob = new environment.Blob([json], { type: 'application/json' });
      const url = environment.URL.createObjectURL(blob);
      const anchor = environment.document.createElement('a');
      anchor.download = fileName;
      anchor.href = url;
      anchor.hidden = true;
      environment.document.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        environment.URL.revokeObjectURL(url);
      }
    },
    upload(): Promise<string | null> {
      return new Promise((resolve, reject) => {
        const input = environment.document.createElement('input');
        input.accept = '.json,application/json';
        input.hidden = true;
        input.type = 'file';
        let settled = false;
        const finish = (result: string | null, error?: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          input.remove();
          if (error === undefined) {
            resolve(result);
          } else {
            reject(error);
          }
        };
        input.addEventListener(
          'change',
          () => {
            const file = input.files?.[0];
            if (file === undefined) {
              finish(null);
              return;
            }
            void file.text().then(
              (json) => finish(json),
              (error: unknown) => finish(null, error),
            );
          },
          { once: true },
        );
        input.addEventListener('cancel', () => finish(null), { once: true });
        environment.document.body.append(input);
        try {
          input.click();
        } catch (error) {
          finish(null, error);
        }
      });
    },
  });
}

export function createBrowserProjectPersistenceAdapters(): ProjectPersistenceAdapters {
  return Object.freeze({
    storage: createBrowserProjectStorage(globalThis.localStorage),
    transfer: createBrowserProjectTransfer({
      Blob: globalThis.Blob,
      URL: globalThis.URL,
      document: globalThis.document,
    }),
  });
}
