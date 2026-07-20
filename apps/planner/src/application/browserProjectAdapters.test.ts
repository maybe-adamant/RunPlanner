// @vitest-environment jsdom

import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBrowserProjectStorage,
  createBrowserProjectTransfer,
} from './browserProjectAdapters';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('browser project adapters', () => {
  it('owns one fixed browser-local project slot', () => {
    const values = new Map<string, string>();
    const browserStorage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const storage = createBrowserProjectStorage(browserStorage);

    expect(storage.read()).toBeNull();
    storage.write('{"project":true}');

    expect(storage.read()).toBe('{"project":true}');
    expect(values.size).toBe(1);
  });

  it('downloads JSON through an ephemeral browser object URL', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:run-planner');
    const revokeObjectURL = vi.fn<(url: string) => void>(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const transfer = createBrowserProjectTransfer({
      Blob,
      URL: { createObjectURL, revokeObjectURL },
      document,
    });

    transfer.download('plan.json', '{"project":true}');

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('application/json');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:run-planner');
    expect(document.querySelector('a')).toBeNull();
  });

  it('uploads selected JSON text and removes its transient file input', async () => {
    const transfer = createBrowserProjectTransfer({
      Blob,
      URL: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() },
      document,
    });

    const upload = transfer.upload();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('upload did not create its file input');
    }
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ text: () => Promise.resolve('{"project":true}') }],
    });
    fireEvent.change(input);

    await expect(upload).resolves.toBe('{"project":true}');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('reports a cancelled file picker without leaving transient DOM state', async () => {
    const transfer = createBrowserProjectTransfer({
      Blob,
      URL: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() },
      document,
    });

    const upload = transfer.upload();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('upload did not create its file input');
    }
    fireEvent(input, new Event('cancel'));

    await expect(upload).resolves.toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
