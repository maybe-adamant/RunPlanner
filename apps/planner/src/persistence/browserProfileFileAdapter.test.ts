// @vitest-environment jsdom

import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserProfileFileAdapter } from './browserProfileFileAdapter';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('browser profile-file adapter', () => {
  it('saves JSON through an ephemeral browser object URL', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:run-planner');
    const revokeObjectURL = vi.fn<(url: string) => void>(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const adapter = createBrowserProfileFileAdapter({
      Blob,
      URL: { createObjectURL, revokeObjectURL },
      document,
    });

    await expect(adapter.save('erebus-route.runplanner.json', '{"project":true}')).resolves.toBe(
      'saved',
    );

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('application/json');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:run-planner');
    expect(document.querySelector('a')).toBeNull();
  });

  it('loads selected profile text and removes its transient file input', async () => {
    const adapter = createBrowserProfileFileAdapter({
      Blob,
      URL: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() },
      document,
    });

    const load = adapter.load();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('load did not create its file input');
    }
    expect(input.accept).toContain('.runplanner.json');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ text: () => Promise.resolve('{"project":true}') }],
    });
    fireEvent.change(input);

    await expect(load).resolves.toBe('{"project":true}');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('reports a cancelled file picker without leaving transient DOM state', async () => {
    const adapter = createBrowserProfileFileAdapter({
      Blob,
      URL: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() },
      document,
    });

    const load = adapter.load();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('load did not create its file input');
    }
    fireEvent(input, new Event('cancel'));

    await expect(load).resolves.toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('rejects an unreadable selected profile and removes its transient input', async () => {
    const adapter = createBrowserProfileFileAdapter({
      Blob,
      URL: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() },
      document,
    });

    const load = adapter.load();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('load did not create its file input');
    }
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ text: () => Promise.reject(new Error('read denied')) }],
    });
    fireEvent.change(input);

    await expect(load).rejects.toThrow('read denied');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
