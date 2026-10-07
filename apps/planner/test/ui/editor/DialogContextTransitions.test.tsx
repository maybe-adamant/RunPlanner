// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  createRouteAddress,
  createTraitOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { loadUnderworldAutomaticBossCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createApplication } from '@planner/composition/createApplication';
import { createFreshFileFProject, freshFileFBiome } from '@run-planner/test-fixtures/fresh-file';
import {
  createEchoGoldIAnvilDuplicateProject,
  createGoldenFGHIProject,
  echoGoldIDuplicateAnvilResult,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  renderOccurrenceWorkbench,
  renderWorkspace,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import {
  anvilResultDialogOpened,
  arcanaActivationDialogOpened,
  levelResolutionDialogOpened,
  semanticOwnerFocused,
  traitOfferDialogOpened,
} from '@planner/state/editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';

afterEach(cleanup);

const apolloToPoseidon = (biome: typeof freshFileFBiome, occurrenceId: string) =>
  authoredProjectCommandDispatched({
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId(occurrenceId)),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });

describe('a dialog whose context is lost closes and needs an explicit reopen', () => {
  it('closes the trait offer dialog and clears its target', async () => {
    const view = renderOccurrenceWorkbench(
      createFreshFileFProject(),
      'FreshFile',
      'F',
      occurrenceById(createOccurrenceId('fresh-3-0')),
    );
    const store = view.application.store;
    const target = createTraitOfferAddress(
      createIncomingRewardAddress(freshFileFBiome, createOccurrenceId('fresh-3-0')),
      'source',
    );
    act(() => store.dispatch(traitOfferDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    // Replacing the first room's boon leaves its trait offer unresolved upstream.
    act(() => store.dispatch(apolloToPoseidon(freshFileFBiome, 'fresh-0-0')));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(store.getState().editorSession.traitDialogTarget ?? null).toBeNull();
    act(() => store.dispatch(authoredProjectUndoRequested()));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => store.dispatch(traitOfferDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('closes the Pom dialog and clears its target', async () => {
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(createOccurrenceId('golden-f-b4-e1')),
    );
    const store = view.application.store;
    const target = createLevelResolutionAddress(
      createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-b4-e1')),
      'self',
    );
    act(() => store.dispatch(levelResolutionDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    act(() => store.dispatch(apolloToPoseidon(goldenFBiome, String(goldenFOccurrenceId(1, 1)))));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(store.getState().editorSession.levelResolutionDialogTarget ?? null).toBeNull();
    act(() => store.dispatch(authoredProjectUndoRequested()));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => store.dispatch(levelResolutionDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('closes the encounter customization dialog', async () => {
    const view = renderOccurrenceWorkbench(
      createFreshFileFProject(),
      'FreshFile',
      'F',
      occurrenceById(createOccurrenceId('fresh-4-0')),
    );
    const store = view.application.store;
    openRoomTab('Room Overview');
    const trigger = () => screen.getByRole('button', { name: 'Customize encounter' });
    await view.user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeTruthy();
    act(() => store.dispatch(apolloToPoseidon(freshFileFBiome, 'fresh-0-0')));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    act(() => store.dispatch(authoredProjectUndoRequested()));
    expect(screen.queryByRole('dialog')).toBeNull();
    await view.user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

const goldContextChange = (routeKey: string) =>
  authoredProjectCommandDispatched({
    kind: 'ReplaceRunModifiers',
    route: createRouteAddress(routeKey),
    value: { enemyGoldDropChanceMultiplier: 2 },
  });

const selectedRadioIndex = (dialog: HTMLElement, suffix: string): number =>
  Array.from(dialog.querySelectorAll<HTMLInputElement>(`input[name$="${suffix}"]`)).findIndex(
    (radio) => radio.checked,
  );

describe('a draft dialog keeps its draft across context changes and follows its authored value', () => {
  it('trait offer', async () => {
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(createOccurrenceId('golden-f-b4-e1')),
    );
    const store = view.application.store;
    const interaction = [...workspaceProjection(view.application).interactions.traitOffers.values()]
      .filter((candidate) => candidate.contextReached && candidate.value?.kind === 'traits')
      .find((candidate) => (candidate.value as AuthoredTraitOfferTraits).options.length === 3);
    if (interaction === undefined) throw new Error('no reached three-option trait offer');
    const value = interaction.value as AuthoredTraitOfferTraits;
    const authoredIndex = ['option1', 'option2', 'option3'].indexOf(value.selectedOptionKey);
    const draftIndex = (authoredIndex + 1) % 3;
    const replacedIndex = (authoredIndex + 2) % 3;
    act(() => store.dispatch(traitOfferDialogOpened(interaction.owner)));
    const dialog = await screen.findByRole('dialog');
    const radios = () => dialog.querySelectorAll<HTMLInputElement>('input[name$="-selected"]');
    await view.user.click(radios()[draftIndex]!);
    expect(selectedRadioIndex(dialog, '-selected')).toBe(draftIndex);

    act(() => store.dispatch(goldContextChange('Underworld')));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(selectedRadioIndex(dialog, '-selected')).toBe(draftIndex);

    const current = workspaceProjection(view.application).interactions.traitOffers.get(
      interaction.key,
    )!;
    expect(current).not.toBe(interaction);
    act(() =>
      store.dispatch(
        authoredProjectCommandDispatched(
          current.intentFor({
            ...value,
            selectedOptionKey: (['option1', 'option2', 'option3'] as const)[replacedIndex]!,
          }).command,
        ),
      ),
    );
    await waitFor(() =>
      expect(selectedRadioIndex(screen.getByRole('dialog'), '-selected')).toBe(replacedIndex),
    );
  });

  it('Pom', async () => {
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(createOccurrenceId('golden-f-b4-e1')),
    );
    const store = view.application.store;
    const owner = createLevelResolutionAddress(
      createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-b4-e1')),
      'self',
    );
    const interaction = workspaceProjection(view.application).interactions.levelResolutions.get(
      semanticAddressKey(owner),
    )!;
    const value = interaction.value;
    if (value.kind !== 'choice' || value.offeredTraitKeys.length < 2)
      throw new Error('fixture Pom must offer two targets');
    const authoredIndex = value.offeredTraitKeys.indexOf(value.selectedTraitKey!);
    const draftIndex = authoredIndex === 0 ? 1 : 0;
    act(() => store.dispatch(levelResolutionDialogOpened(owner)));
    const dialog = await screen.findByRole('dialog');
    const radios = () => dialog.querySelectorAll<HTMLInputElement>('input[name$="-pom-selected"]');
    await view.user.click(radios()[draftIndex]!);

    act(() => store.dispatch(goldContextChange('Underworld')));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(selectedRadioIndex(dialog, '-pom-selected')).toBe(draftIndex);

    const current = workspaceProjection(view.application).interactions.levelResolutions.get(
      semanticAddressKey(owner),
    )!;
    expect(current).not.toBe(interaction);
    act(() =>
      store.dispatch(
        authoredProjectCommandDispatched(
          current.intentFor({ ...value, selectedTraitKey: value.offeredTraitKeys[draftIndex]! })
            .command,
        ),
      ),
    );
    // The authored value now equals the abandoned draft's choice; a second change replaces it.
    act(() =>
      store.dispatch(
        authoredProjectCommandDispatched(
          current.intentFor({ ...value, selectedTraitKey: value.selectedTraitKey }).command,
        ),
      ),
    );
    await waitFor(() =>
      expect(selectedRadioIndex(screen.getByRole('dialog'), '-pom-selected')).toBe(authoredIndex),
    );
  });

  it('Anvil result', async () => {
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
    const view = renderOccurrenceWorkbench(
      createEchoGoldIAnvilDuplicateProject(),
      'Underworld',
      'I',
      occurrenceById(echoGoldIPrebossShopId),
    );
    const store = view.application.store;
    openRoomTab('Room Timeline');
    const label = (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey;
    act(() => store.dispatch(anvilResultDialogOpened(owner)));
    const dialog = await screen.findByRole('dialog');
    await view.user.click(within(dialog).getByRole('button', { name: 'Removed Hammer' }));
    await view.user.click(
      screen.getByRole('option', { name: label(echoGoldIDuplicateAnvilResult.removedTraitKey) }),
    );
    const interaction = () =>
      workspaceProjection(view.application).interactions.acquisitionConversions.get(
        semanticAddressKey(owner),
      )!.anvil!;
    const before = interaction();

    act(() => store.dispatch(goldContextChange('Underworld')));
    expect(interaction()).not.toBe(before);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(within(dialog).getByRole('button', { name: 'Removed Hammer' }).textContent).toContain(
      label(echoGoldIDuplicateAnvilResult.removedTraitKey),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Added Hammer 1' }).textContent,
    ).not.toContain(label(echoGoldIDuplicateAnvilResult.addedTraitKeys[0]));

    act(() =>
      store.dispatch(
        authoredProjectCommandDispatched(
          interaction().intentFor(echoGoldIDuplicateAnvilResult).command,
        ),
      ),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Added Hammer 1' })
          .textContent,
      ).toContain(label(echoGoldIDuplicateAnvilResult.addedTraitKeys[0])),
    );
    expect(store.getState().editorSession.anvilDialogTarget).toEqual(owner);
  });

  it.each([
    ['Judgment', 'judgmentArcana'],
    ['Crystal Figurine', 'figurineArcana'],
  ] as const)('%s Arcana', async (name, kind) => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadUnderworldAutomaticBossCheckpoint()));
    const control = () =>
      [...workspaceProjection(application).interactions[kind].values()].find(
        (candidate) => candidate.owner.biomeKey === 'F',
      )!;
    const owner = control().owner;
    const view = renderWorkspace(
      loadUnderworldAutomaticBossCheckpoint(),
      'Underworld',
      'F',
      application,
    );
    const store = view.application.store;
    // The Boss draw is edited from the inspector timeline of its focused owner.
    act(() => store.dispatch(semanticOwnerFocused(owner)));
    act(() => store.dispatch(arcanaActivationDialogOpened(owner)));
    const dialog = await screen.findByRole('dialog', { name: `${name} editor` });
    const pressed = () =>
      within(screen.getByRole('dialog'))
        .queryAllByRole('button', { pressed: true })
        .map((card) => card.textContent);
    const authored = pressed();
    await waitFor(() =>
      expect(
        within(dialog)
          .getAllByRole<HTMLButtonElement>('button', { pressed: false })
          .some((card) => !card.disabled),
      ).toBe(true),
    );
    if (authored.length > 0) {
      await view.user.click(within(dialog).getAllByRole('button', { pressed: true })[0]!);
    } else {
      const next = within(dialog)
        .getAllByRole<HTMLButtonElement>('button', { pressed: false })
        .find((card) => !card.disabled)!;
      await view.user.click(next);
    }
    const draft = pressed();
    expect(draft).not.toEqual(authored);
    const before = control();

    act(() => store.dispatch(goldContextChange('Underworld')));
    expect(control()).not.toBe(before);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(pressed()).toEqual(draft);

    const replacement = control().value.length > 0 ? [] : [control().choices[0]!.value];
    act(() =>
      store.dispatch(authoredProjectCommandDispatched(control().intentFor(replacement).command)),
    );
    await waitFor(() => expect(pressed()).toHaveLength(replacement.length));
    expect(store.getState().editorSession.arcanaActivationDialogTarget).toEqual(owner);
  });

  it('closes the Judgment dialog when its Boss draw leaves the route', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadUnderworldAutomaticBossCheckpoint()));
    const owner = [...workspaceProjection(application).interactions.judgmentArcana.values()].find(
      (candidate) => candidate.owner.biomeKey === 'F',
    )!.owner;
    const view = renderWorkspace(
      loadUnderworldAutomaticBossCheckpoint(),
      'Underworld',
      'F',
      application,
    );
    const store = view.application.store;
    // The Boss draw is edited from the inspector timeline of its focused owner.
    act(() => store.dispatch(semanticOwnerFocused(owner)));
    act(() => store.dispatch(arcanaActivationDialogOpened(owner)));
    expect(await screen.findByRole('dialog', { name: 'Judgment editor' })).toBeTruthy();
    // Without the manual Judgment Arcana the Boss offers no Judgment draw.
    act(() =>
      store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceManualArcanaSelection',
          route: createRouteAddress('Underworld'),
          arcanaKeys: [],
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(store.getState().editorSession.arcanaActivationDialogTarget ?? null).toBeNull();
  });
});
