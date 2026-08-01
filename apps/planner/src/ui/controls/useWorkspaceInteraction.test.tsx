// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  useWorkspaceInteractionController,
  type WorkspaceLoadableInteraction,
} from './useWorkspaceInteraction';

describe('useWorkspaceInteractionController', () => {
  it('invalidates a deferred load and its cache when the observed interaction changes', async () => {
    const resolutions: ((value: string) => void)[] = [];
    const interactionA: WorkspaceLoadableInteraction<string> = Object.freeze({
      load: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolutions.push(resolve);
          }),
      ),
    });
    const interactionB: WorkspaceLoadableInteraction<string> = Object.freeze({
      load: vi.fn(() => Promise.resolve('B')),
    });
    type Props = {
      readonly interaction: WorkspaceLoadableInteraction<string> | undefined;
    };
    const initialProps: Props = { interaction: interactionA };
    const view = renderHook(
      ({ interaction }: Props) => {
        const controller = useWorkspaceInteractionController<string>();
        return Object.freeze({ controller, snapshot: controller.observe(interaction) });
      },
      { initialProps },
    );

    act(() => {
      expect(view.result.current.controller.activate(interactionA)).toBeUndefined();
    });
    expect(interactionA.load).toHaveBeenCalledTimes(1);
    expect(view.result.current.snapshot.pending).toBe(true);

    view.rerender({ interaction: interactionB });
    expect(view.result.current.snapshot).toEqual({ pending: false, result: undefined });
    view.rerender({ interaction: undefined });
    await act(async () => {
      resolutions[0]?.('stale A');
      await Promise.resolve();
    });

    view.rerender({ interaction: interactionA });
    expect(view.result.current.snapshot).toEqual({ pending: false, result: undefined });
    act(() => {
      expect(view.result.current.controller.activate(interactionA)).toBeUndefined();
    });
    expect(interactionA.load).toHaveBeenCalledTimes(2);
    expect(view.result.current.snapshot).toEqual({ pending: true, result: undefined });
  });

  it('retains a completed per-interaction result across an observed interaction swap', () => {
    const interactionA: WorkspaceLoadableInteraction<string> = Object.freeze({
      load: vi.fn(() => 'A'),
    });
    const interactionB: WorkspaceLoadableInteraction<string> = Object.freeze({
      load: vi.fn(() => 'B'),
    });
    type Props = {
      readonly interaction: WorkspaceLoadableInteraction<string>;
    };
    const view = renderHook(
      ({ interaction }: Props) => {
        const controller = useWorkspaceInteractionController<string>();
        return Object.freeze({ controller, snapshot: controller.observe(interaction) });
      },
      { initialProps: { interaction: interactionA } },
    );

    act(() => {
      expect(view.result.current.controller.activate(interactionA)).toBe('A');
    });
    expect(view.result.current.snapshot).toEqual({ pending: false, result: 'A' });
    view.rerender({ interaction: interactionB });
    view.rerender({ interaction: interactionA });
    act(() => {
      expect(view.result.current.controller.activate(interactionA)).toBe('A');
    });
    expect(interactionA.load).toHaveBeenCalledTimes(1);
    expect(view.result.current.snapshot).toEqual({ pending: false, result: 'A' });
  });
});
