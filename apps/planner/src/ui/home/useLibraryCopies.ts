import { useCallback, useEffect, useState } from 'react';

import type { ProjectOperations } from '@planner/workspace/projectOperations';

const NO_COPIES: Readonly<Record<string, string>> = Object.freeze({});

/** Library copies of catalog entries and recorded runs, read again after each addition. */
export function useLibraryCopies(operations: ProjectOperations) {
  const [copies, setCopies] = useState(NO_COPIES);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    operations.libraryCopies().then(
      (read) => {
        if (live) setCopies(read);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [operations, revision]);
  return { copies, refresh: useCallback(() => setRevision((current) => current + 1), []) };
}
