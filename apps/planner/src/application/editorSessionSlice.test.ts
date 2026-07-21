import { createBiomeAddress, createProjectAddress } from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { editorSessionReducer, findingSelected, sectionSelected } from './editorSessionSlice';

describe('editor finding navigation', () => {
  it('selects an F finding and routes to its owning transient panel', () => {
    const settings = editorSessionReducer(undefined, sectionSelected('settings'));
    const selection = {
      key: 'finding-key',
      origin: createBiomeAddress('Underworld', 'F'),
    } as const;

    const selected = editorSessionReducer(settings, findingSelected(selection));

    expect(selected).toEqual({
      activeSection: 'underworld',
      activeUnderworldPanel: 'F',
      selectedFinding: selection,
      findingNavigationRevision: 1,
    });
    expect(settings.selectedFinding).toBeNull();
  });

  it('issues a new navigation request when the same finding is selected again', () => {
    const selection = {
      key: 'finding-key',
      origin: createBiomeAddress('Underworld', 'F'),
    } as const;
    const selected = editorSessionReducer(undefined, findingSelected(selection));

    const selectedAgain = editorSessionReducer(selected, findingSelected(selection));

    expect(selectedAgain.selectedFinding).toBe(selection);
    expect(selectedAgain.findingNavigationRevision).toBe(2);
  });

  it('routes a G finding to the Oceanus panel', () => {
    const selection = {
      key: 'g-finding-key',
      origin: createBiomeAddress('Underworld', 'G'),
    } as const;

    const selected = editorSessionReducer(undefined, findingSelected(selection));

    expect(selected.activeSection).toBe('underworld');
    expect(selected.activeUnderworldPanel).toBe('G');
  });

  it('routes an H finding to the Fields of Mourning panel', () => {
    const selection = {
      key: 'h-finding-key',
      origin: createBiomeAddress('Underworld', 'H'),
    } as const;

    const selected = editorSessionReducer(undefined, findingSelected(selection));

    expect(selected.activeSection).toBe('underworld');
    expect(selected.activeUnderworldPanel).toBe('H');
  });

  it('selects a project-root finding without inventing route navigation', () => {
    const settings = editorSessionReducer(undefined, sectionSelected('settings'));
    const selection = { key: 'project-finding-key', origin: createProjectAddress() } as const;

    const selected = editorSessionReducer(settings, findingSelected(selection));

    expect(selected.activeSection).toBe('settings');
    expect(selected.selectedFinding).toBe(selection);
    expect(selected.findingNavigationRevision).toBe(1);
  });
});
