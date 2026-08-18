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

interface WorkspaceInteractionSnapshot<Result> {
  readonly pending: boolean;
  readonly result: Result | undefined;
}

/**
 * The single React-side loader adapter. Dynamic capabilities such as an
 * activation-scoped Hub opening attempt can be retained by their component
 * and passed here without calling their loader in feature UI.
 */
export function useWorkspaceInteractionController<Result>(): {
  readonly activate: (interaction: WorkspaceLoadableInteraction<Result>) => Result | undefined;
  readonly observe: (
    interaction: WorkspaceLoadableInteraction<Result> | undefined,
  ) => WorkspaceInteractionSnapshot<Result>;
} {
  const cacheRef = useRef(new WeakMap<object, Result>());
  const committedInteractionRef = useRef<WorkspaceLoadableInteraction<Result> | undefined>(
    undefined,
  );
  const renderedInteractionRef = useRef<WorkspaceLoadableInteraction<Result> | undefined>(
    undefined,
  );
  const requestIdRef = useRef(0);
  const stateRef = useRef<InteractionState<Result> | undefined>(undefined);
  const [, setState] = useState<InteractionState<Result>>();

  const registerInteraction = (
    interaction: WorkspaceLoadableInteraction<Result> | undefined,
  ): void => {
    if (committedInteractionRef.current === interaction) return;
    committedInteractionRef.current = interaction;
    requestIdRef.current += 1;
    if (stateRef.current?.interaction !== interaction) stateRef.current = undefined;
  };

  useEffect(() => {
    registerInteraction(renderedInteractionRef.current);
  });

  const observe = (
    interaction: WorkspaceLoadableInteraction<Result> | undefined,
  ): WorkspaceInteractionSnapshot<Result> => {
    renderedInteractionRef.current = interaction;
    const current =
      interaction !== undefined && stateRef.current?.interaction === interaction
        ? stateRef.current
        : undefined;
    if (current?.error !== undefined) {
      throw current.error;
    }
    return Object.freeze({
      pending: current?.pending ?? false,
      result: current?.result,
    });
  };

  const activate = (interaction: WorkspaceLoadableInteraction<Result>): Result | undefined => {
    // Register before loading so the state update caused by this activation
    // cannot make the next committed render invalidate its own request.
    renderedInteractionRef.current = interaction;
    registerInteraction(interaction);
    const existing = stateRef.current;
    if (
      existing?.interaction === interaction &&
      (existing.pending || existing.result !== undefined)
    ) {
      setState(existing);
      return existing.result;
    }
    const cached = cacheRef.current.get(interaction);
    if (cached !== undefined) {
      const next = Object.freeze({ interaction, pending: false, result: cached });
      stateRef.current = next;
      setState(next);
      return cached;
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
      return undefined;
    }
    if (!isPromise(loaded)) {
      cacheRef.current.set(interaction, loaded);
      const next = Object.freeze({ interaction, pending: false, result: loaded });
      stateRef.current = next;
      setState(next);
      return loaded;
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
    return undefined;
  };

  return { activate, observe };
}

export function useWorkspaceInteraction<Result>(
  interaction: WorkspaceLoadableInteraction<Result>,
): {
  /**
   * Loads the interaction on demand.  Synchronous interactions return their
   * result so a native pointer or keyboard action can both validate and apply
   * its semantic command in one gesture; asynchronous interactions remain a
   * deliberately non-committing first activation.
   */
  readonly activate: () => Result | undefined;
  readonly pending: boolean;
  readonly result: Result | undefined;
} {
  const controller = useWorkspaceInteractionController<Result>();
  const current = controller.observe(interaction);

  return {
    activate: () => controller.activate(interaction),
    pending: current.pending,
    result: current.result,
  };
}

/**
 * Observes a capability that is intentionally absent when the rendered owner
 * has no meaningful interaction (for example, a singleton ranked order).
 */
export function useOptionalWorkspaceInteraction<Result>(
  interaction: WorkspaceLoadableInteraction<Result> | undefined,
): {
  readonly activate: () => Result | undefined;
  readonly pending: boolean;
  readonly result: Result | undefined;
} {
  const controller = useWorkspaceInteractionController<Result>();
  const current = controller.observe(interaction);

  return {
    activate: () => (interaction === undefined ? undefined : controller.activate(interaction)),
    pending: current.pending,
    result: current.result,
  };
}
