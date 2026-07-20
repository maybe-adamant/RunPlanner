import { useState } from 'react';

import type { ProjectOperationResult, ProjectOperations } from '../application/projectOperations';

export function ProjectFileControls({ operations }: { readonly operations: ProjectOperations }) {
  const [result, setResult] = useState<ProjectOperationResult | null>(null);
  const [importing, setImporting] = useState(false);

  const importJson = async () => {
    setImporting(true);
    const nextResult = await operations.importJson();
    setResult(nextResult);
    setImporting(false);
  };

  return (
    <section className="project-file-controls" aria-label="Project file">
      <div className="project-file-actions">
        <button onClick={() => setResult(operations.createNew())} type="button">
          New
        </button>
        <button onClick={() => setResult(operations.save())} type="button">
          Save
        </button>
        <button onClick={() => setResult(operations.load())} type="button">
          Load
        </button>
        <button onClick={() => setResult(operations.exportJson())} type="button">
          Export JSON
        </button>
        <button disabled={importing} onClick={() => void importJson()} type="button">
          {importing ? 'Importing…' : 'Import JSON'}
        </button>
      </div>
      {result !== null && (
        <p
          className="project-operation-result"
          data-status={result.status}
          role={result.status === 'failure' ? 'alert' : 'status'}
        >
          {result.message}
        </p>
      )}
    </section>
  );
}
