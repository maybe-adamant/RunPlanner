import type { LoadedProfileFile, ProfileFileAdapter, ProfileFileReference } from './profileFile';

export interface BrowserProfileFileEnvironment {
  readonly Blob: typeof Blob;
  readonly URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  readonly document: Document;
}

export function createBrowserProfileFileAdapter(
  environment: BrowserProfileFileEnvironment,
): ProfileFileAdapter {
  const download = (fileName: string, json: string): void => {
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
  };
  const referenceFor = (fileName: string): ProfileFileReference =>
    Object.freeze({
      fileName,
      write(json: string): Promise<void> {
        download(fileName, json);
        return Promise.resolve();
      },
    });

  return Object.freeze({
    saveAs(suggestedFileName: string, json: string): Promise<ProfileFileReference> {
      download(suggestedFileName, json);
      return Promise.resolve(referenceFor(suggestedFileName));
    },
    load(): Promise<LoadedProfileFile | null> {
      return new Promise((resolve, reject) => {
        const input = environment.document.createElement('input');
        input.accept = '.runplanner.json,.json,application/json';
        input.hidden = true;
        input.type = 'file';
        let settled = false;
        const finish = (result: LoadedProfileFile | null, error?: unknown) => {
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
              (json) => finish(Object.freeze({ file: referenceFor(file.name), json })),
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
