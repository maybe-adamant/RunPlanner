// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '../application/createApplication';
import type { ProjectPersistenceAdapters } from '../application/projectPersistence';
import { renderPlannerForInteraction } from '../testing/renderPlanner';

afterEach(cleanup);

function configuredBiomeCount(
  application: ReturnType<typeof renderPlannerForInteraction>['application'],
) {
  return application.store.getState().projectWorkspace.history.present.routes[0]?.biomes.length;
}

describe('planner history interaction', () => {
  it('binds visible history controls to semantic project history', async () => {
    const { application, user } = renderPlannerForInteraction();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });

    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', true);

    await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');

    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);

    await user.click(undo);

    expect(configuredBiomeCount(application)).toBe(0);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', false);

    await user.click(redo);

    expect(configuredBiomeCount(application)).toBe(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);
  });

  it('supports Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z', shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { metaKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'y' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);
  });

  it('leaves native text and content-editable undo behavior untouched', async () => {
    const { application, user } = renderPlannerForInteraction({
      companion: (
        <>
          <input aria-label="Project name draft" defaultValue="Draft" />
          <div
            aria-label="Project notes draft"
            contentEditable
            role="textbox"
            suppressContentEditableWarning
          >
            Notes
          </div>
        </>
      ),
    });
    await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');

    const input = screen.getByRole('textbox', { name: 'Project name draft' });
    expect(fireEvent.keyDown(input, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);

    const editable = screen.getByRole('textbox', { name: 'Project notes draft' });
    expect(fireEvent.keyDown(editable, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
  });

  it('keeps navigation outside authored history', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.click(screen.getByRole('button', { name: 'Surface' }));

    expect(application.store.getState().editorSession.activeSection).toBe('surface');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });
});

describe('project file interaction', () => {
  it('saves, replaces, and reloads the project through the visible file controls', async () => {
    let storedJson: string | null = null;
    const adapters: ProjectPersistenceAdapters = {
      storage: {
        read: () => storedJson,
        write: (json) => {
          storedJson = json;
        },
      },
      transfer: {
        download: () => {},
        upload: () => Promise.resolve(null),
      },
    };
    const application = createApplication({ projectPersistence: adapters });
    const { user } = renderPlannerForInteraction({ application });

    await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');
    const savedEvaluation = application.store.getState().projectWorkspace.evaluation;
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Saved this project in the browser.')).toBeTruthy();
    expect(storedJson).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(configuredBiomeCount(application)).toBe(0);
    expect(screen.getByText('Created a new project.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(configuredBiomeCount(application)).toBe(1);
    expect(screen.getByText('Loaded the saved browser project.')).toBeTruthy();
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
    expect(application.store.getState().projectWorkspace.history.future).toEqual([]);
    expect(application.store.getState().projectWorkspace.evaluation).toEqual(savedEvaluation);
  });

  it('presents a load failure and retains the current workspace', async () => {
    const application = createApplication({
      projectPersistence: {
        storage: {
          read: () => '{not json',
          write: () => {},
        },
        transfer: {
          download: () => {},
          upload: () => Promise.resolve(null),
        },
      },
    });
    const workspace = application.store.getState().projectWorkspace;
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(screen.getByRole('alert').textContent).toBe('Load failed: $: must be valid JSON');
    expect(application.store.getState().projectWorkspace).toBe(workspace);
  });
});
