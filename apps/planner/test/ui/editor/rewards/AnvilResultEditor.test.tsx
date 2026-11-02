// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createEchoGoldIAnvilDuplicateProject,
  echoGoldIPrebossShopId,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import { Provider } from 'react-redux';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import { dialogFinding, renderInHeaderDialog } from '@planner-test/support/editor-dialog';
import { projectAnvilResultPickers } from '@planner/projections/contextual/anvilResultPickers';
import type { WorkspaceAcquisitionConversionInteraction } from '@planner/projections/structured-workspace';

import {
  AnvilResultEditor,
  AnvilResultLauncher,
} from '@planner/ui/editor/rewards/AnvilResultEditor';

type AnvilInteraction = NonNullable<WorkspaceAcquisitionConversionInteraction['anvil']>;

function anvilInteraction(
  input: Omit<AnvilInteraction, 'pickersFor' | 'traitLabel' | 'assess' | 'launcher'> &
    Partial<Pick<AnvilInteraction, 'traitLabel' | 'assess' | 'launcher'>>,
): AnvilInteraction {
  const domain = {
    ...input,
    launcher: input.launcher ?? { label: 'Edit Anvil' },
    assess: input.assess ?? (() => ({ legal: true, issues: [] })),
    traitLabel: input.traitLabel ?? ((traitKey: string) => traitKey),
  };
  return { ...domain, pickersFor: (draft) => projectAnvilResultPickers(domain, draft) };
}

afterEach(cleanup);

describe('Anvil result editor', () => {
  it('authors one removal followed by two distinct additions in three contextual pickers', async () => {
    const onCommit = vi.fn();
    const interaction = anvilInteraction({
      contextReached: true,
      value: null,
      removedTraitKeys: ['OldHammer'],
      addedTraitKeysFor: (removed, prior) =>
        removed !== 'OldHammer'
          ? []
          : prior.length === 0
            ? ['FirstHammer']
            : prior[0] === 'FirstHammer'
              ? ['SecondHammer']
              : [],
      traitLabel: (traitKey) =>
        ({ OldHammer: 'Old Hammer', FirstHammer: 'First Hammer', SecondHammer: 'Second Hammer' })[
          traitKey
        ] ?? traitKey,
      intentFor: () => {
        throw new Error('the pure editor must not bind commands');
      },
    });
    const user = userEvent.setup();
    const view = renderInHeaderDialog(
      <AnvilResultEditor interaction={interaction} onCommit={onCommit} />,
    );
    // An incomplete draft names its next choice and cannot be saved.
    expect(dialogFinding(document.body)).toBe('Choose the removed Hammer');
    expect(screen.getByRole('button', { name: 'Save Anvil result' })).toHaveProperty(
      'disabled',
      true,
    );

    expect(
      (screen.getByRole('button', { name: 'Added Hammer 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Added Hammer 2' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Removed Hammer' }));
    await user.click(screen.getByRole('option', { name: 'Old Hammer' }));
    await user.click(screen.getByRole('button', { name: 'Added Hammer 1' }));
    await user.click(screen.getByRole('option', { name: 'First Hammer' }));
    await user.click(screen.getByRole('button', { name: 'Added Hammer 2' }));
    await user.click(screen.getByRole('option', { name: 'Second Hammer' }));
    await user.click(screen.getByRole('button', { name: 'Save Anvil result' }));

    expect(onCommit).toHaveBeenCalledWith({
      kind: 'anvilOfFates',
      removedTraitKey: 'OldHammer',
      addedTraitKeys: ['FirstHammer', 'SecondHammer'],
    });
    view.application.dispose();
  });

  it('shows the authored findings at rest and an edited draft its own assessment', async () => {
    const authored = {
      kind: 'anvilOfFates' as const,
      removedTraitKey: 'OldHammer',
      addedTraitKeys: ['FirstHammer', 'SecondHammer'] as const,
    };
    const interaction = anvilInteraction({
      contextReached: true,
      value: authored,
      removedTraitKeys: ['OldHammer'],
      addedTraitKeysFor: (_removed, prior) =>
        prior.length === 0 ? ['FirstHammer', 'SecondHammer'] : ['SecondHammer', 'ThirdHammer'],
      assess: (result) => ({
        legal: false,
        issues: result.addedTraitKeys.includes('ThirdHammer')
          ? [
              {
                kind: 'additionUnavailable' as const,
                key: 'additionUnavailable:ThirdHammer',
                traitKey: 'ThirdHammer',
              },
            ]
          : [],
      }),
      traitLabel: (traitKey) => traitKey.replace('Hammer', ' Hammer'),
      intentFor: () => {
        throw new Error('the pure editor must not bind commands');
      },
    });
    const user = userEvent.setup();
    const view = renderInHeaderDialog(
      <AnvilResultEditor
        findingEntries={[['authored', 'Reward unavailable']]}
        interaction={interaction}
        onCommit={vi.fn()}
      />,
    );
    expect(dialogFinding(document.body)).toBe('Reward unavailable');
    await user.click(screen.getByRole('button', { name: 'Added Hammer 2' }));
    await user.click(screen.getByRole('option', { name: 'Third Hammer' }));
    expect(dialogFinding(document.body)).toBe('Added Hammer unavailable: Third Hammer');
    // A complete draft that introduces a finding cannot be saved.
    expect(screen.getByRole('button', { name: 'Save Anvil result' })).toHaveProperty(
      'disabled',
      true,
    );
    view.application.dispose();
  });

  it('saves only a draft that differs from the saved result', async () => {
    const interaction = anvilInteraction({
      contextReached: true,
      value: {
        kind: 'anvilOfFates',
        removedTraitKey: 'OldHammer',
        addedTraitKeys: ['FirstHammer', 'SecondHammer'],
      },
      removedTraitKeys: ['OldHammer'],
      addedTraitKeysFor: (_removed, prior) =>
        prior.length === 0 ? ['FirstHammer', 'SecondHammer'] : ['SecondHammer', 'ThirdHammer'],
      intentFor: () => {
        throw new Error('the pure editor must not bind commands');
      },
    });
    const user = userEvent.setup();
    const view = renderInHeaderDialog(
      <AnvilResultEditor interaction={interaction} onCommit={vi.fn()} />,
    );
    const save = () => screen.getByRole('button', { name: 'Save Anvil result' });
    expect(save()).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Added Hammer 2' }));
    await user.click(screen.getByRole('option', { name: 'ThirdHammer' }));
    expect(save()).toHaveProperty('disabled', false);
    await user.click(screen.getByRole('button', { name: 'Added Hammer 2' }));
    await user.click(screen.getByRole('option', { name: 'SecondHammer' }));
    expect(save()).toHaveProperty('disabled', true);
    view.application.dispose();
  });

  it('closes its open dialog and clears the session target when the context is lost', async () => {
    const application = createApplication();
    const owner = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(
            { kind: 'biome', routeKey: 'Underworld', biomeKey: 'I' },
            createOccurrenceId('anvil-shop'),
          ),
          'roomExit',
        ),
        'anvil',
      ),
      'self',
    );
    const interaction = (contextReached: boolean): AnvilInteraction =>
      anvilInteraction({
        contextReached,
        value: null,
        removedTraitKeys: [],
        addedTraitKeysFor: () => [],
        intentFor: () => {
          throw new Error('closing must not bind commands');
        },
      });
    const launcher = (contextReached: boolean) => (
      <Provider store={application.store}>
        <AnvilResultLauncher interaction={interaction(contextReached)} owner={owner} />
      </Provider>
    );
    const user = userEvent.setup();
    const view = render(launcher(true));
    await user.click(screen.getByRole('button', { name: 'Edit Anvil' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(application.store.getState().editorSession.anvilDialogTarget).toEqual(owner);
    view.rerender(launcher(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(application.store.getState().editorSession.anvilDialogTarget ?? null).toBeNull();
    view.rerender(launcher(true));
    // A later reach needs an explicit reopen.
    expect(screen.queryByRole('dialog')).toBeNull();
    application.dispose();
  });

  it('lists the Anvil owner findings its launcher marks', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createEchoGoldIAnvilDuplicateProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const owner = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId),
          'roomExit',
        ),
        'echoDoubleShopReward',
      ),
      'self',
    );
    const anvil = workspace.interactions.acquisitionConversions.get(
      semanticAddressKey(owner),
    )?.anvil;
    if (anvil === undefined) throw new Error('Gold duplicate Anvil is not bound');
    render(
      <Provider store={application.store}>
        <FindingTargetScope findings={workspace.findingsByRepairTarget}>
          <AnvilResultLauncher interaction={anvil} owner={owner} />
        </FindingTargetScope>
      </Provider>,
    );
    const launcher = screen.getByRole('button', { name: /^Edit Anvil/ });
    // With no result chosen, the description is only the marked findings.
    const marked = launcher.getAttribute('aria-description') ?? '';
    if (marked === '') throw new Error('the missing Anvil result marks no launcher finding');
    await userEvent.setup().click(launcher);
    const first = dialogFinding(document.body)?.replace(/ \(\d+ more\)$/, '');
    expect(first).toBeDefined();
    expect(marked).toContain(first);
    application.dispose();
  });
});
