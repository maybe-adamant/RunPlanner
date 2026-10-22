// @vitest-environment jsdom

import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createBrowserProjectLibraryAdapter } from '@planner/persistence/browserProjectLibraryAdapter';
import { createMemoryIndexedDb } from '@planner-test/support/memoryIndexedDb';
import {
  describeProjectLibraryContract,
  libraryPlanJson,
} from '@planner-test/support/projectLibraryContract';

let indexedDb = createMemoryIndexedDb();
let clock = 1_000;

beforeEach(() => {
  indexedDb = createMemoryIndexedDb();
  clock = 1_000;
});

afterEach(() => {
  document.body.replaceChildren();
});

function createAdapter() {
  return createBrowserProjectLibraryAdapter({
    document,
    indexedDB: () => indexedDb,
    now: () => clock,
  });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('no file input was created');
  return input;
}

describeProjectLibraryContract('Browser', () => createAdapter());

describe('Browser project library', () => {
  it('stamps each write with the time it was made', async () => {
    const library = createAdapter();
    const created = await library.create(libraryPlanJson('plan-a', 'First'), '');
    expect(created.modifiedMs).toBe(1_000);
    clock = 5_000;
    expect((await library.write(created.key, libraryPlanJson('plan-a', 'Edited'))).modifiedMs).toBe(
      5_000,
    );
  });

  it('imports a file picked through a transient file input', async () => {
    const library = createAdapter();
    expect(library.supportsReveal).toBe(false);
    const chosen = library.chooseImportFile();
    const input = fileInput();
    expect(input.accept).toContain('.runplanner.json');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: 'plan.runplanner.json', text: () => Promise.resolve('{"plan":true}') }],
    });
    fireEvent.change(input);
    await expect(chosen).resolves.toEqual({
      fileName: 'plan.runplanner.json',
      json: '{"plan":true}',
    });
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('reports a cancelled or unreadable pick without leaving the input', async () => {
    const library = createAdapter();
    const cancelled = library.chooseImportFile();
    fireEvent(fileInput(), new Event('cancel'));
    await expect(cancelled).resolves.toBeNull();

    const unreadable = library.chooseImportFile();
    const input = fileInput();
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: 'bad.runplanner.json', text: () => Promise.reject(new Error('denied')) }],
    });
    fireEvent.change(input);
    await expect(unreadable).rejects.toThrow('denied');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('has no folder and no file from before the library', async () => {
    const library = createAdapter();
    await expect(library.previousActiveFile()).resolves.toBeNull();
    await expect(library.reveal()).rejects.toThrow(/not a folder/);
  });
});
