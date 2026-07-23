import { useEffect, useRef, useState } from 'react';

export interface WorkspaceLoadableInteraction<Result> {
  readonly load: () => Result | Promise<Result>;
}

interface InteractionState<Result> {
  readonly error?: Error;
  readonly interaction: WorkspaceLoadableInteraction<Result>;
  readonly pending: boolean;
  readonly result?: Result;
}

function isPromise<Result>(value: Result | Promise<Result>): value is Promise<Result> {
  return typeof (value as Promise<Result>)?.then === 'function';
}

export function useWorkspaceInteraction<Result>(
  interaction: WorkspaceLoadableInteraction<Result>,
): {
  readonly activate: () => void;
  readonly pending: boolean;
  readonly result: Result | undefined;
} {
  const cacheRef = useRef(new WeakMap<object, Result>());
  const requestIdRef = useRef(0);
  const stateRef = useRef<InteractionState<Result> | undefined>(undefined);
  const [state, setState] = useState<InteractionState<Result>>();
  useEffect(() => {
    requestIdRef.current += 1;
  }, [interaction]);

  const current = state?.interaction === interaction ? state : undefined;
  if (current?.error !== undefined) {
    throw current.error;
  }

  const activate = (): void => {
    const existing = stateRef.current;
    if (
      existing?.interaction === interaction &&
      (existing.pending || existing.result !== undefined)
    ) {
      if (state !== existing) {
        setState(existing);
      }
      return;
    }
    const cached = cacheRef.current.get(interaction);
    if (cached !== undefined) {
      const next = Object.freeze({ interaction, pending: false, result: cached });
      stateRef.current = next;
      setState(next);
      return;
    }
    const requestId = ++requestIdRef.current;
    let loaded: Result | Promise<Result>;
    try {
      loaded = interaction.load();
    } catch (error: unknown) {
      const next = Object.freeze({
        error: error instanceof Error ? error : new Error(String(error)),
        interaction,
        pending: false,
      });
      stateRef.current = next;
      setState(next);
      return;
    }
    if (!isPromise(loaded)) {
      cacheRef.current.set(interaction, loaded);
      const next = Object.freeze({ interaction, pending: false, result: loaded });
      stateRef.current = next;
      setState(next);
      return;
    }
    const pending = Object.freeze({ interaction, pending: true });
    stateRef.current = pending;
    setState(pending);
    void loaded.then(
      (result) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        cacheRef.current.set(interaction, result);
        const next = Object.freeze({ interaction, pending: false, result });
        stateRef.current = next;
        setState(next);
      },
      (error: unknown) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        const next = Object.freeze({
          error: error instanceof Error ? error : new Error(String(error)),
          interaction,
          pending: false,
        });
        stateRef.current = next;
        setState(next);
      },
    );
  };

  return {
    activate,
    pending: current?.pending ?? false,
    result: current?.result,
  };
}
