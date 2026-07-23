import type { CandidateOptionProjection } from '../../projections/candidateProjection';
import type { WorkspaceContextualResolver } from '../../projections/structuredWorkspace';
import { useRef, useState } from 'react';

interface CandidateOptionState<T> {
  readonly contextual: WorkspaceContextualResolver;
  readonly key: string;
  readonly options: readonly CandidateOptionProjection<T>[];
}

export function useLazyCandidateOptions<T>(
  contextual: WorkspaceContextualResolver,
  key: string,
  load: () => readonly CandidateOptionProjection<T>[],
): {
  readonly activate: () => void;
  readonly options: readonly CandidateOptionProjection<T>[] | undefined;
} {
  const stateRef = useRef<CandidateOptionState<T> | undefined>(undefined);
  const [state, setState] = useState<CandidateOptionState<T>>();
  const options = state?.contextual === contextual && state.key === key ? state.options : undefined;

  const activate = (): void => {
    const existing = stateRef.current;
    if (existing?.contextual === contextual && existing.key === key) {
      if (state !== existing) {
        setState(existing);
      }
      return;
    }
    const next = Object.freeze({ contextual, key, options: load() });
    stateRef.current = next;
    setState(next);
  };

  return { activate, options };
}
