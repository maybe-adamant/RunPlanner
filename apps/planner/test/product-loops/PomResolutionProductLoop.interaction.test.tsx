// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createShopOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import {
  loadUnderworldFMidshopPomFrontierProject,
  fMidshopPomShopId,
  goldenFBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPProject, pBiome, pOccurrenceIds } from '@run-planner/test-fixtures/surface';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { PomResolutionDialog } from '@planner/ui/editor/rewards/PomResolutionEditor';

afterEach(cleanup);

describe('Pom resolution product loop', () => {
  it('publishes the purchased Midshop Pom before its next decision is authored', () => {
    const application = createApplication();
    const project = loadUnderworldFMidshopPomFrontierProject();
    const offer = createShopOfferAddress(goldenFBiome, fMidshopPomShopId, 'Minor');
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    if (workspace === undefined) throw new Error('workspace projection is unavailable');
    expect(
      [...workspace.interactions.levelResolutions.values()].find(
        (interaction) => semanticAddressKey(interaction.owner.owner) === semanticAddressKey(offer),
      ),
    ).toMatchObject({ value: { kind: 'random', targetTraitKey: null } });
    application.dispose();
  });

  it('publishes and saves a purchased random Shop Pom only at its exact offer', async () => {
    const application = createApplication();
    let project = loadSurfaceNOPProject();
    const offer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Minor');
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'StoreRewardRandomStack' },
    });
    project = replaceTestShopOfferActions(
      project,
      application.catalog,
      createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
      ['Minor'],
    );
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    if (workspace === undefined) throw new Error('workspace projection is unavailable');
    const interaction = [...workspace.interactions.levelResolutions.values()].find(
      (candidate) =>
        candidate.owner.owner.kind === 'shopOffer' &&
        semanticAddressKey(candidate.owner.owner) === semanticAddressKey(offer),
    );
    if (interaction?.value.kind !== 'random') {
      throw new Error('purchased random Shop Pom is not projected');
    }
    render(
      <Provider store={application.store}>
        <PomResolutionDialog interactions={workspace.interactions} target={interaction.owner} />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Recorded random Pom target' }));
    const target = screen
      .getAllByRole('option')
      .find((candidate) => candidate.getAttribute('aria-disabled') !== 'true');
    if (target === undefined) throw new Error('random Shop Pom has no eligible target');
    await user.click(target);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    const saved = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.levelResolutions.get(interaction.key)?.value;
    expect(saved).toMatchObject({ kind: 'random' });
    if (saved?.kind !== 'random') throw new Error('random Shop Pom save was not retained');
    expect(saved.targetTraitKey).not.toBeNull();
    application.dispose();
  });
});
