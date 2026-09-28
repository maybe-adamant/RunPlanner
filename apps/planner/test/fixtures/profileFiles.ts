import { encodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

import type { PlannerApplication } from '@planner/composition/createApplication';
import type { ProfileFileAdapter, ProfileFileReference } from '@planner/persistence/profileFile';

/** An in-memory profile file host: Save As takes the next chosen name, or cancels on null. */
export function createFakeProfileFiles() {
  const writes: { fileName: string; json: string }[] = [];
  const chosen: (string | null)[] = [];
  let loaded: { fileName: string; json: string } | null = null;
  const reference = (fileName: string): ProfileFileReference => ({
    fileName,
    activate: () => Promise.resolve(),
    write: (json) => {
      writes.push({ fileName, json });
      return Promise.resolve();
    },
  });
  const adapter: ProfileFileAdapter = {
    supportsSaveAs: true,
    clearActive: () => Promise.resolve(),
    saveAs: (suggestedFileName, json) => {
      const next = chosen.length > 0 ? chosen.shift()! : suggestedFileName;
      if (next === null) return Promise.resolve(null);
      writes.push({ fileName: next, json });
      return Promise.resolve(reference(next));
    },
    load: () =>
      Promise.resolve(
        loaded === null ? null : { file: reference(loaded.fileName), json: loaded.json },
      ),
    restoreActive: () => Promise.resolve({ status: 'none' as const }),
  };
  return {
    adapter,
    writes,
    /** Queues the name the next Save As dialog returns; null cancels it. */
    chooseSaveAs: (fileName: string | null) => chosen.push(fileName),
    /** Opens `project` as a clean, saved file through the ordinary Load path. */
    openSaved: async (
      application: PlannerApplication,
      project: ProjectDocument,
      fileName: string,
    ) => {
      loaded = { fileName, json: encodeProjectDocument(project) };
      const outcome = await application.projectOperations.loadProfile();
      if (outcome.status !== 'success') throw new Error(outcome.message);
    },
  };
}
