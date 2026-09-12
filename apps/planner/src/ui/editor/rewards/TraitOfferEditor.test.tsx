// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createExitSelectionAddress,
  createEncounterPhaseAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  createTraitAcquisitionTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type AuthoredChaosTraitOffer,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import { candidateSupport } from '@planner/projections/candidateProjection';
import {
  authoredProjectUndoRequested,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import type {
  StructuredWorkspaceProjection,
  WorkspaceInteractionCatalog,
  WorkspaceTraitOfferControl,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { TraitOfferDialog, TraitOfferEditor, TraitOfferLauncher } from './TraitOfferEditor';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNQueensRansomProject,
  nBiome,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { loadSurfacePSteadyGrowthShrineFrontierCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createReachableNaturalChaosProject,
  reachedEchoProject,
} from '@planner-test/support/structured-workspace/interaction-binding.test-support';

afterEach(cleanup);

function findTraitOfferControl(
  workspace: StructuredWorkspaceProjection,
  address: import('@run-planner/engine/authored-project').TraitOfferAddress,
): WorkspaceTraitOfferControl {
  const key = semanticAddressKey(address);
  for (const biome of workspace.route.biomes)
    for (const node of biome.nodes) {
      const rooms =
        node.kind === 'occurrenceWorkbench'
          ? [node.room]
          : node.kind === 'ordinaryBatch' ||
              node.kind === 'mixedBatch' ||
              node.kind === 'takeoverBatch'
            ? node.targets.map((target) => target.room)
            : [];
      for (const room of rooms)
        for (const reward of room.rewardControls)
          for (const control of reward.traitOffers ?? [])
            if (semanticAddressKey(control.address) === key) return control;
    }
  throw new Error('Trait offer control is not projected');
}

describe('trait offer editor entry and dialog', () => {
  it.each(['noProc', 'proc'] as const)(
    'saves an initial Stone %s decision with the complete offer',
    async (kind) => {
      const application = createApplication();
      const reward = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
      const address = createTraitOfferAddress(reward, 'source');
      let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'UnpickedBoonKeepsake',
      });
      project = applyProjectCommand(project, application.catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      });
      project = applyProjectCommand(project, application.catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      });
      application.store.dispatch(authoredProjectReplaced(project));
      const workspace = application.selectStructuredWorkspace(application.store.getState())!;
      expect(workspace.interactions.traitOffers.get(semanticAddressKey(address))?.value).toBeNull();
      const before = application.store.getState();
      const user = userEvent.setup();
      const view = render(
        <Provider store={application.store}>
          <TraitOfferDialog interactions={workspace.interactions} target={address} />
        </Provider>,
      );
      const checkbox = await screen.findByRole('checkbox', { name: 'Concave Stone Activated' });
      expect(checkbox).toHaveProperty('checked', false);
      expect(
        screen.getByRole('group', { name: 'Concave Stone outcome' }).querySelector('legend')
          ?.textContent,
      ).toBe('Concave Stone · Chance: 75%');
      expect(screen.queryByRole('button', { name: 'Concave Stone target' })).toBeNull();
      if (kind === 'proc') await user.click(checkbox);
      // Opening and editing the Stone child must not publish a partial command.
      expect(application.store.getState()).toBe(before);
      await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
      const savedWorkspace = application.selectStructuredWorkspace(application.store.getState())!;
      const saved = savedWorkspace.interactions.traitOffers.get(semanticAddressKey(address))?.value;
      expect(saved?.kind).toBe('traits');
      if (saved?.kind !== 'traits') throw new Error('saved offer missing');
      expect(saved.concaveStoneResult).toEqual(
        kind === 'proc' ? { kind, optionKey: 'option2' } : undefined,
      );
      view.unmount();
      render(
        <Provider store={application.store}>
          <TraitOfferDialog interactions={savedWorkspace.interactions} target={address} />
        </Provider>,
      );
      expect(
        await screen.findByRole('checkbox', { name: 'Concave Stone Activated' }),
      ).toHaveProperty('checked', kind === 'proc');
      application.dispose();
    },
  );

  it('repairs Stone residual Bridal Glow using the primary boon and preserves both selections on save', async () => {
    const application = createApplication();
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1));
    const address = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'UnpickedBoonKeepsake',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: address,
      value: {
        kind: 'traits',
        giverKey: 'Hera',
        selectedOptionKey: 'option1',
        options: [
          { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
          { traitKey: 'BoonDecayBoon', rarity: 'Common' },
          { traitKey: 'HeraCastBoon', rarity: 'Common' },
        ],
        concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
      },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    expect(
      [...workspace.findingsByRepairTarget.values()]
        .flat()
        .map((finding) => semanticAddressKey(finding.origin)),
    ).toContain(semanticAddressKey(createTraitAcquisitionTargetAddress(address, 'option2')));
    const user = userEvent.setup();
    const view = render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={workspace.interactions} target={address} />
      </Provider>,
    );
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      true,
    );
    const stone = await screen.findByRole('group', { name: 'Concave Stone outcome' });
    const stoneTarget = within(stone).getByRole('button', { name: 'Concave Stone target' });
    const childTarget = within(stone).getByRole('button', { name: 'option2 acquisition target' });
    expect(
      stoneTarget.compareDocumentPosition(childTarget) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    await user.click(childTarget);
    const primaryLabel = application.catalog.traits.byKey.HeraSpecialBoon!.label;
    await user.click(await screen.findByRole('option', { name: new RegExp(primaryLabel) }));
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    const savedWorkspace = application.selectStructuredWorkspace(application.store.getState())!;
    const saved = savedWorkspace.interactions.traitOffers.get(semanticAddressKey(address))?.value;
    expect(saved).toMatchObject({
      selectedOptionKey: 'option1',
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    });
    if (saved?.kind !== 'traits') throw new Error('saved Stone offer missing');
    expect(saved.options[1]?.targetTraitKey).toBe('HeraSpecialBoon');
    expect(saved.options[0]?.targetTraitKey).toBeUndefined();
    view.unmount();
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={savedWorkspace.interactions} target={address} />
      </Provider>,
    );
    expect(
      (await screen.findByRole('button', { name: 'option2 acquisition target' })).textContent,
    ).toContain(primaryLabel);
    application.dispose();
  });

  it('repairs a retained Echo target beside an incomplete row, saves, and reopens the nested choice', async () => {
    const application = createApplication();
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
        'Encounter',
      ),
      'selection',
    );
    const project = applyProjectCommand(reachedEchoProject(), application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        selectedOptionKey: 'option1',
        options: [
          {
            traitKey: 'EchoLastRunBoon',
            echoLastRunBoon: {
              selectedOptionKey: 'option1',
              options: [
                {
                  giverKey: 'Hera',
                  traitKey: 'BoonDecayBoon',
                  rarity: 'Common',
                  targetTraitKey: 'DiminishingDodgeBoon',
                },
              ],
            },
          },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ],
      },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const user = userEvent.setup();
    const view = render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={workspace.interactions} target={trait} />
      </Provider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Edit choice' }));
    const targetName = 'Boon Boon Boon selected trait target';
    expect(screen.getByRole('button', { name: targetName })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await user.click(screen.getAllByRole('radio')[2]!);
    await user.click(screen.getByRole('button', { name: 'Remove last option' }));
    expect(screen.getAllByRole('radio')[1]).toHaveProperty('checked', true);
    await user.click(screen.getByRole('button', { name: 'Remove last option' }));
    expect(screen.getAllByRole('radio')[0]).toHaveProperty('checked', true);
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(screen.getByRole('button', { name: targetName }));
    const retainedLabel = application.catalog.traits.byKey.DiminishingDodgeBoon!.label;
    const retained = screen
      .getAllByRole('option')
      .find((item) => item.textContent?.includes(retainedLabel));
    expect(retained?.getAttribute('aria-disabled')).toBe('true');
    const chooseEnabled = async () => {
      const enabled = screen
        .getAllByRole('option')
        .find(
          (item) =>
            item.getAttribute('aria-disabled') !== 'true' && !(item as HTMLOptionElement).disabled,
        );
      if (enabled === undefined) throw new Error('real Echo domain has no enabled repair choice');
      await user.click(enabled);
    };
    await chooseEnabled();
    const repairedLabel = screen.getByRole('button', { name: targetName }).textContent;
    await user.click(screen.getByRole('button', { name: 'Boon Boon Boon outcome 2' }));
    await chooseEnabled();
    const rarity = screen.queryByRole('button', { name: 'Boon Boon Boon outcome 2 rarity' });
    if (rarity !== null) {
      await user.click(rarity);
      await chooseEnabled();
    }
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    const reopened = application.selectStructuredWorkspace(application.store.getState())!;
    const saved = reopened.interactions.traitOffers.get(semanticAddressKey(trait))?.value;
    if (saved?.kind !== 'traits') throw new Error('saved Echo offer missing');
    expect(saved.options[0]?.echoLastRunBoon?.options).toHaveLength(2);
    expect(saved.options[0]?.echoLastRunBoon?.options[0]?.targetTraitKey).not.toBe(
      'DiminishingDodgeBoon',
    );
    view.unmount();
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={reopened.interactions} target={trait} />
      </Provider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Edit choice' }));
    expect(screen.getByRole('button', { name: targetName }).textContent).toBe(repairedLabel);
    expect(screen.getByRole('button', { name: 'Boon Boon Boon outcome 2' })).toBeTruthy();
    application.dispose();
  });

  it.each(['All Together', 'Natural Selection'] as const)(
    'repairs and persists a real Echo %s choice through the dialog',
    async (effect) => {
      const application = createApplication();
      const trait = createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenHBiome,
          { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
          'Encounter',
        ),
        'selection',
      );
      const project = applyProjectCommand(reachedEchoProject(), application.catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: {
          kind: 'traits',
          giverKey: 'Echo',
          selectedOptionKey: 'option1',
          options: [
            {
              traitKey: 'EchoLastRunBoon',
              echoLastRunBoon: {
                selectedOptionKey: 'option1',
                options: [
                  effect === 'All Together'
                    ? { giverKey: 'Hera', traitKey: 'AllElementalBoon', rarity: 'Legendary' }
                    : { giverKey: 'Demeter', traitKey: 'GoodStuffBoon', rarity: 'Duo' },
                ],
              },
            },
            { traitKey: 'DiminishingDodgeBoon' },
            { traitKey: 'DiminishingHealthAndManaBoon' },
          ],
        },
      });
      application.store.dispatch(authoredProjectReplaced(project));
      const workspace = application.selectStructuredWorkspace(application.store.getState())!;
      const user = userEvent.setup();
      const view = render(
        <Provider store={application.store}>
          <TraitOfferDialog interactions={workspace.interactions} target={trait} />
        </Provider>,
      );
      await user.click(await screen.findByRole('button', { name: 'Edit choice' }));
      expect(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' })).toHaveProperty(
        'disabled',
        true,
      );
      const chooseEnabled = async () => {
        const options = await screen.findAllByRole('option');
        const enabled = options.find(
          (item) =>
            item.getAttribute('aria-disabled') !== 'true' && !(item as HTMLOptionElement).disabled,
        );
        if (enabled === undefined) throw new Error('real Echo domain has no repair choice');
        await user.click(enabled);
      };
      if (effect === 'All Together') {
        await user.click(screen.getByRole('button', { name: 'Choose all grants' }));
        for (let index = 0; index < 4; index++) await chooseEnabled();
      } else {
        await user.click(screen.getByRole('button', { name: 'Choose all targets' }));
        for (let index = 1; index <= 8; index++) {
          await screen.findByText(`Target ${index} of 8`);
          await chooseEnabled();
        }
      }
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' })).toHaveProperty(
          'disabled',
          false,
        ),
      );
      await user.click(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' }));
      await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
      const saved = application.store.getState().projectWorkspace.history!.present;
      const reloaded = decodeProjectDocument(
        JSON.parse(encodeProjectDocument(saved)),
        application.catalog,
      );
      application.store.dispatch(authoredProjectReplaced(reloaded));
      const reopened = application.selectStructuredWorkspace(application.store.getState())!;
      const offer = reopened.interactions.traitOffers.get(semanticAddressKey(trait))?.value;
      if (offer?.kind !== 'traits') throw new Error('missing reloaded Echo offer');
      const payload = offer.options[0]?.echoLastRunBoon?.options[0];
      expect(offer.selectedOptionKey).toBe('option1');
      expect(offer.options[0]?.echoLastRunBoon?.selectedOptionKey).toBe('option1');
      const evaluated = simulateProjectAssembly(
        application.catalog,
        reloaded,
      ).evaluation.route.biomes.find((biome) => biome.biomeKey === 'H');
      if (evaluated === undefined || !('rewards' in evaluated))
        throw new Error('Echo room not evaluated');
      if (effect === 'All Together') {
        expect(payload?.allTogetherResult).toBeDefined();
        for (const key of Object.values(payload!.allTogetherResult!)) {
          if (key !== null)
            expect(
              evaluated.rewards.branches.every(
                (branch) => branch.traitHistory?.equippedTraits[key] !== undefined,
              ),
            ).toBe(true);
        }
      } else {
        expect(payload?.naturalSelectionTargets).toHaveLength(8);
        expect(
          evaluated.rewards.branches.every(
            (branch) => branch.traitHistory?.equippedTraits.GoodStuffBoon !== undefined,
          ),
        ).toBe(true);
      }
      view.unmount();
      render(
        <Provider store={application.store}>
          <TraitOfferDialog interactions={reopened.interactions} target={trait} />
        </Provider>,
      );
      await user.click(await screen.findByRole('button', { name: 'Edit choice' }));
      expect(
        await screen.findByRole('group', {
          name: effect === 'All Together' ? 'Elemental grants' : 'Natural Selection targets',
        }),
      ).toBeTruthy();
      const nestedOwner = screen.getByRole('region', { name: 'Boon Boon Boon choice' });
      expect(
        [...document.querySelectorAll('[id]')].filter((node) => node.id === nestedOwner.id),
      ).toHaveLength(1);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' })).toHaveProperty(
          'disabled',
          false,
        ),
      );
      application.dispose();
    },
  );

  it.each(['All Together', 'Natural Selection'] as const)(
    'repairs and reloads a real Stone %s residual through its compound editor',
    async (effect) => {
      const application = createApplication();
      let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'UnpickedBoonKeepsake',
      });
      const prerequisites =
        effect === 'All Together'
          ? ([
              ['Hera', ['HeraWeaponBoon', 'HeraSpecialBoon', 'HeraCastBoon']],
              ['Hera', ['BoonDecayBoon', 'HeraManaBoon', 'HeraSprintBoon']],
              ['Hera', ['DamageSharePotencyBoon', 'HeraManaBoon', 'HeraSprintBoon']],
            ] as const)
          : ([
              ['Poseidon', ['PoseidonWeaponBoon', 'PoseidonSpecialBoon', 'PoseidonCastBoon']],
              ['Demeter', ['DemeterSpecialBoon', 'DemeterCastBoon', 'DemeterSprintBoon']],
              ['Demeter', ['PlantHealthBoon', 'DemeterCastBoon', 'DemeterSprintBoon']],
            ] as const);
      const sites = [goldenFStartId, goldenFOccurrenceId(2, 1), goldenFOccurrenceId(4, 1)];
      for (const [index, [giverKey, traits]] of prerequisites.entries()) {
        const reward = createIncomingRewardAddress(goldenFBiome, sites[index]!);
        project = applyProjectCommand(project, application.catalog, {
          kind: 'ReplaceIncomingReward',
          reward,
          value: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: `${giverKey}Upgrade` },
          },
        });
        project = applyProjectCommand(project, application.catalog, {
          kind: 'ReplaceTraitOffer',
          trait: createTraitOfferAddress(reward, 'source'),
          value: {
            kind: 'traits',
            giverKey,
            selectedOptionKey: 'option1',
            options: [
              {
                traitKey: traits[0],
                rarity: 'Common',
                ...(traits[0] === 'BoonDecayBoon' ? { targetTraitKey: 'HeraWeaponBoon' } : {}),
              },
              { traitKey: traits[1], rarity: 'Common' },
              { traitKey: traits[2], rarity: 'Common' },
            ],
          },
        });
      }
      const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1));
      const trait = createTraitOfferAddress(reward, 'source');
      const giverKey = effect === 'All Together' ? 'Hera' : 'Demeter';
      project = applyProjectCommand(project, application.catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: `${giverKey}Upgrade` },
        },
      });
      project = applyProjectCommand(project, application.catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: {
          kind: 'traits',
          giverKey,
          selectedOptionKey: 'option1',
          concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
          options:
            effect === 'All Together'
              ? [
                  { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
                  { traitKey: 'AllElementalBoon', rarity: 'Legendary' },
                  { traitKey: 'HeraCastBoon', rarity: 'Common' },
                ]
              : [
                  { traitKey: 'DemeterCastBoon', rarity: 'Common' },
                  { traitKey: 'GoodStuffBoon', rarity: 'Duo' },
                  { traitKey: 'DemeterManaBoon', rarity: 'Common' },
                ],
        },
      });
      application.store.dispatch(authoredProjectReplaced(project));
      const workspace = application.selectStructuredWorkspace(application.store.getState())!;
      const user = userEvent.setup();
      const view = render(
        <Provider store={application.store}>
          <TraitOfferDialog interactions={workspace.interactions} target={trait} />
        </Provider>,
      );
      expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
        'disabled',
        true,
      );
      await user.click(
        await screen.findByRole('button', {
          name: effect === 'All Together' ? 'Choose all grants' : 'Choose all targets',
        }),
      );
      for (let index = 0; index < (effect === 'All Together' ? 4 : 8); index++) {
        if (effect === 'Natural Selection') await screen.findByText(`Target ${index + 1} of 8`);
        const choices = await screen.findAllByRole('option');
        const enabled = choices.find(
          (item) =>
            item.getAttribute('aria-disabled') !== 'true' && !(item as HTMLOptionElement).disabled,
        );
        if (enabled === undefined)
          throw new Error(`real Stone ${effect} domain has no repair choice`);
        await user.click(enabled);
      }
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
          'disabled',
          false,
        ),
      );
      await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
      const saved = application.store.getState().projectWorkspace.history!.present;
      const reloaded = decodeProjectDocument(
        JSON.parse(encodeProjectDocument(saved)),
        application.catalog,
      );
      application.store.dispatch(authoredProjectReplaced(reloaded));
      const reopened = application.selectStructuredWorkspace(application.store.getState())!;
      const offer = reopened.interactions.traitOffers.get(semanticAddressKey(trait))?.value;
      if (offer?.kind !== 'traits') throw new Error('missing Stone offer after reload');
      expect(offer.selectedOptionKey).toBe('option1');
      expect(offer.concaveStoneResult).toEqual({ kind: 'proc', optionKey: 'option2' });
      const payload = offer.options[1]!;
      const evaluated = simulateProjectAssembly(
        application.catalog,
        reloaded,
      ).evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
      if (evaluated === undefined || !('rewards' in evaluated))
        throw new Error('Stone room not evaluated');
      expect(evaluated.rewards.branches.length).toBeGreaterThan(0);
      if (effect === 'All Together') {
        expect(payload.allTogetherResult).toBeDefined();
        for (const key of Object.values(payload.allTogetherResult!)) {
          if (key !== null)
            expect(
              evaluated.rewards.branches.every(
                (branch) => branch.traitHistory?.equippedTraits[key] !== undefined,
              ),
            ).toBe(true);
        }
      } else {
        expect(payload.naturalSelectionTargets).toHaveLength(8);
        expect(
          evaluated.rewards.branches.every(
            (branch) => branch.traitHistory?.equippedTraits.GoodStuffBoon !== undefined,
          ),
        ).toBe(true);
      }
      view.unmount();
      render(
        <Provider store={application.store}>
          <TraitOfferDialog interactions={reopened.interactions} target={trait} />
        </Provider>,
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
          'disabled',
          false,
        ),
      );
      // Clearing the proc must not delete retained residual detail or the primary.
      await user.click(screen.getByRole('checkbox', { name: 'Concave Stone Activated' }));
      await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
      const dormant = application
        .selectStructuredWorkspace(application.store.getState())!
        .interactions.traitOffers.get(semanticAddressKey(trait))?.value;
      expect(dormant).toMatchObject({
        selectedOptionKey: 'option1',
        concaveStoneResult: { kind: 'noProc' },
      });
      if (dormant?.kind !== 'traits') throw new Error('missing dormant Stone offer');
      expect(dormant.options[1]).toEqual(payload);
      application.dispose();
    },
  );

  it('repairs and persists a real missing targeted outcome through the prepared Hera interaction', async () => {
    const application = createApplication();
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, nOccurrenceIds.preHub),
      'source',
    );
    const baseline = loadSurfaceNQueensRansomProject();
    application.store.dispatch(authoredProjectReplaced(baseline));
    const baselineInteraction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(trait));
    if (baselineInteraction?.value?.kind !== 'traits') throw new Error('Hera offer is missing');
    const project = applyProjectCommand(baseline, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Hera',
        options: [
          { traitKey: 'BoonDecayBoon', rarity: 'Common' },
          baselineInteraction.value.options[1]!,
          baselineInteraction.value.options[2]!,
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const interaction = workspace.interactions.traitOffers.get(semanticAddressKey(trait));
    if (interaction === undefined) throw new Error('Hera interaction is missing');
    const user = userEvent.setup();
    const view = render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={workspace.interactions} target={trait} />
      </Provider>,
    );
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(screen.getByRole('button', { name: 'option1 acquisition target' }));
    const target = screen
      .getAllByRole('option')
      .find(
        (option) =>
          !(option as HTMLOptionElement).disabled &&
          option.getAttribute('aria-disabled') !== 'true',
      );
    if (target === undefined) throw new Error('prepared targeted domain has no repair candidate');
    await user.click(target);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    const saved = findTraitOfferControl(
      application.selectStructuredWorkspace(application.store.getState())!,
      trait,
    );
    const targets = saved.children.filter((child) => child.kind === 'traitAcquisitionTarget');
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ authoredComplete: true, targetTraitKey: 'ZeusWeaponBoon' });
    view.unmount();
    const reopened = application.selectStructuredWorkspace(application.store.getState())!;
    const reopenedControl = findTraitOfferControl(reopened, trait);
    render(
      <Provider store={application.store}>
        <TraitOfferLauncher control={reopenedControl} interactions={reopened.interactions} />
        <TraitOfferDialog interactions={reopened.interactions} target={trait} />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: /Edit Trait/ }));
    expect(
      screen.getByRole('button', { name: 'option1 acquisition target' }).textContent,
    ).not.toContain('Choose an equipped trait');
    application.dispose();
  });

  it('starts an invalid offer over from a fresh legal draft before saving', async () => {
    const application = createApplication();
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Surface', 'O'),
        createOccurrenceId('052399e3-429f-4f4b-aa50-c6a25fac0f60'),
      ),
      'source',
    );
    const invalid: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits' as const,
      giverKey: 'Zeus',
      options: Object.freeze([
        Object.freeze({ traitKey: 'LightningDebuffGeneratorBoon', rarity: 'Rare' as const }),
        Object.freeze({ traitKey: 'SpawnKillBoon', rarity: 'Legendary' as const }),
        Object.freeze({ traitKey: 'SprintEchoBoon', rarity: 'Duo' as const }),
      ] as const),
      selectedOptionKey: 'option2' as const,
      rarificationActions: Object.freeze([]),
    });
    const project = applyProjectCommand(
      loadSurfacePSteadyGrowthShrineFrontierCheckpoint(),
      application.catalog,
      { kind: 'ReplaceTraitOffer', trait, value: invalid },
    );
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const commit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={trait} interactions={workspace.interactions} onCommit={commit} />
      </Provider>,
    );

    const startOver = await screen.findByRole('button', { name: 'Start over' });
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(startOver);
    expect(commit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(commit).toHaveBeenCalledTimes(1);
    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits | undefined;
    expect(saved).toMatchObject({ kind: 'traits', giverKey: 'Zeus' });
    expect(saved?.options).toHaveLength(3);
    expect(saved).not.toEqual(invalid);
    application.dispose();
  });

  it('edits the real reached SpellDrop with one focused candidate query and supports Undo', async () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({ observeEvaluationWork: (event) => events.push(event) });
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const project = applyProjectCommand(createGoldenFGHProject(), application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(9, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const address = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    expect(workspace.interactions.traitOffers.has(semanticAddressKey(address))).toBe(true);
    const initialInteraction = workspace.interactions.traitOffers.get(semanticAddressKey(address));
    if (initialInteraction === undefined) throw new Error('SpellDrop interaction is missing');
    const initialControl = findTraitOfferControl(workspace, address);
    if (initialControl.offer?.kind !== 'traits') throw new Error('SpellDrop offer is missing');
    const initialSelected = initialControl.offer.options[0];
    if (initialSelected === undefined) throw new Error('SpellDrop first option is missing');
    render(
      <Provider store={application.store}>
        <TraitOfferLauncher control={initialControl} interactions={workspace.interactions} />
      </Provider>,
    );
    const initialLauncher = screen.getByRole('button', { name: /Edit Spell/ });
    expect(initialLauncher.textContent).toBe(
      `Edit Spell - ${initialInteraction.traitLabel(initialSelected.traitKey)}`,
    );
    cleanup();
    events.length = 0;
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={workspace.interactions} target={address} />
      </Provider>,
    );
    expect(events).toEqual([{ kind: 'queryBatch', queryCount: 1 }]);
    expect(screen.getByText('Spell 1 · Crescent Moonglow')).toBeTruthy();
    expect(screen.getByText('+0 Path of Stars')).toBeTruthy();
    expect(screen.getByText('Spell 2 · Half Moonglow')).toBeTruthy();
    expect(screen.getByText('+1 Path of Stars')).toBeTruthy();
    expect(screen.getByText('Spell 3 · Full Moonglow')).toBeTruthy();
    expect(screen.getByText('+2 Path of Stars')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: `Customize Hex · ${initialInteraction.traitLabel(initialSelected.traitKey)}`,
      }),
    ).toBeTruthy();
    expect(screen.queryByText('Selected trait outcome')).toBeNull();
    expect(
      screen.queryByText(
        'Choose the Rare and Epic identities present in this layout. The linked God Sent talent is derived by chronology.',
      ),
    ).toBeNull();
    const godSent = screen.getByText('God Sent:', { selector: 'strong' }).closest('.hex-god-sent');
    expect(godSent?.textContent).not.toContain(' + ');
    expect(screen.queryByRole('button', { name: 'Rarify' })).toBeNull();
    expect(screen.queryByText(/^Rarity:/)).toBeNull();
    expect(screen.queryByRole('status', { name: 'Offer feedback' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add option' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Fallback Gold' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
    expect(screen.queryByText('Offer State')).toBeNull();

    const historyDepth = application.store.getState().projectWorkspace.history!.past.length;
    const option2 = screen.getAllByRole('radio', { name: 'Selected' })[1];
    if (option2 === undefined) throw new Error('Spell option 2 selector is missing');
    const user = userEvent.setup();
    await user.click(option2);
    await user.click(screen.getByRole('button', { name: 'Hex talent layout' }));
    await user.click(screen.getByRole('option', { name: 'Maze' }));
    await user.click(screen.getByRole('button', { name: 'Rare Hex nodes' }));
    expect(screen.getByText('Rare node 1 of 3')).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Splendor' }));
    expect(screen.getByText('Rare node 2 of 3')).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Contingency' }));
    expect(screen.getByText('Rare node 3 of 3')).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Savagery' }));
    expect(screen.queryByText('Rare node 3 of 3')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Epic Hex nodes' }));
    expect(screen.getByText('Epic node 1 of 2')).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Resonance' }));
    expect(screen.getByText('Epic node 2 of 2')).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Horror' }));
    expect(screen.queryByText('Epic node 2 of 2')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyDepth + 1,
    );
    const changedOccurrence = application.store
      .getState()
      .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    const changed =
      changedOccurrence?.state.kind === 'counted' && changedOccurrence.state.reward !== null
        ? changedOccurrence.state.reward.traitOffersByAcquisitionRole?.self
        : undefined;
    expect(changed).toMatchObject({
      selectedOptionKey: 'option2',
      hexTree: {
        layoutKey: 'Maze',
        rareTalentKeys: expect.arrayContaining(['TransformSpecialTalent']),
      },
    });
    cleanup();
    const changedWorkspace = application.selectStructuredWorkspace(application.store.getState())!;
    const changedInteraction = changedWorkspace.interactions.traitOffers.get(
      semanticAddressKey(address),
    );
    if (changedInteraction === undefined)
      throw new Error('changed SpellDrop interaction is missing');
    const changedControl = findTraitOfferControl(changedWorkspace, address);
    if (changedControl.offer?.kind !== 'traits')
      throw new Error('changed SpellDrop offer is missing');
    const changedSelected = changedControl.offer.options[1];
    if (changedSelected === undefined) throw new Error('SpellDrop second option is missing');
    render(
      <Provider store={application.store}>
        <TraitOfferLauncher control={changedControl} interactions={changedWorkspace.interactions} />
      </Provider>,
    );
    const changedLauncher = screen.getByRole('button', { name: /Edit Spell/ });
    expect(changedLauncher.textContent).toBe(
      `Edit Spell - ${changedInteraction.traitLabel(changedSelected.traitKey)}`,
    );
    application.store.dispatch(authoredProjectUndoRequested());
    const restoredOccurrence = application.store
      .getState()
      .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    const restored =
      restoredOccurrence?.state.kind === 'counted' && restoredOccurrence.state.reward !== null
        ? restoredOccurrence.state.reward.traitOffersByAcquisitionRole?.self
        : undefined;
    expect(restored).toMatchObject({ selectedOptionKey: 'option1' });
    application.dispose();
  });

  it('starts an invalid Chaos offer over with its specialized pair draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createReachableNaturalChaosProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind === 'chaos',
    );
    if (base === undefined || base.chaos === undefined)
      throw new Error('Chaos trait interaction is missing');
    const startingDraft = base.chaos.startingDraft();
    if (startingDraft === undefined) throw new Error('Chaos starting draft is missing');
    const invalid: AuthoredChaosTraitOffer = Object.freeze({
      ...startingDraft,
      curseOptions: Object.freeze([
        Object.freeze({ curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 }),
        startingDraft.curseOptions[1],
        startingDraft.curseOptions[2],
      ]) as AuthoredChaosTraitOffer['curseOptions'],
      selectedOptionKey: 'option1',
      selectedCurseValues: Object.freeze({}),
    });
    const seed = base.load(startingDraft)[0];
    if (seed?.evaluation.kind !== 'traitOffer')
      throw new Error('Chaos candidate evaluation is missing');
    const impossible = Object.freeze({
      ...seed,
      value: invalid,
      evaluation: Object.freeze({
        ...seed.evaluation,
        result: Object.freeze({ ...seed.evaluation.result, supported: false }),
      }),
    });
    const interaction: WorkspaceTraitOfferInteraction = Object.freeze({
      ...base,
      value: invalid,
      load: (value: AuthoredTraitOffer = invalid) =>
        value === invalid ? Object.freeze([impossible]) : base.load(value),
    });
    expect(candidateSupport(interaction.load(invalid)[0])).toBe('impossible');
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as WorkspaceInteractionCatalog;
    const commit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={interaction.owner}
          interactions={interactions}
          onCommit={commit}
        />
      </Provider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Start over' }));
    expect(commit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Chaos outcome' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save Chaos outcome' }));
    expect(commit).toHaveBeenCalledTimes(1);
    const saved = commit.mock.calls[0]?.[0] as AuthoredChaosTraitOffer | undefined;
    expect(saved?.kind).toBe('chaos');
    expect(saved?.curseOptions).toHaveLength(3);
    expect(saved).not.toEqual(invalid);
    if (saved === undefined) throw new Error('fresh Chaos draft was not saved');
    expect(candidateSupport(base.load(saved)[0])).not.toBe('impossible');
    application.dispose();
  });

  it('shows Hex layout customization for an unresolved Spell draft before its first save', async () => {
    const application = createApplication();
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const address = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    const selected = applyProjectCommand(createGoldenFGHProject(), application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(9, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const raw = JSON.parse(encodeProjectDocument(selected)) as {
      route: {
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: {
            occurrences: Array<{
              occurrenceId: string;
              state: { reward?: { traitOffersByAcquisitionRole?: { self?: unknown } } };
            }>;
          } | null;
        }>;
      };
    };
    const rawOccurrence = raw.route.biomes
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    if (rawOccurrence?.state.reward?.traitOffersByAcquisitionRole === undefined) {
      throw new Error('SpellDrop fixture has no self child to unset');
    }
    rawOccurrence.state.reward.traitOffersByAcquisitionRole.self = null;
    const project = decodeProjectDocument(raw, application.catalog);
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const interaction = workspace.interactions.traitOffers.get(semanticAddressKey(address));
    if (interaction === undefined) throw new Error('unresolved SpellDrop interaction is missing');
    expect(interaction.value).toBeNull();
    const control = findTraitOfferControl(workspace, address);

    render(
      <Provider store={application.store}>
        <FindingTargetScope findings={workspace.findingsByRepairTarget}>
          <TraitOfferLauncher control={control} interactions={workspace.interactions} />
        </FindingTargetScope>
      </Provider>,
    );
    expect(
      screen
        .getByRole('button', { name: /spell is not selected/ })
        .getAttribute('data-trait-status'),
    ).toBe('unspecified');
    expect(
      screen
        .getByRole('button', { name: /spell is not selected/ })
        .getAttribute('data-has-findings'),
    ).toBe('false');
    cleanup();

    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={workspace.interactions} target={address} />
      </Provider>,
    );

    expect(await screen.findByRole('button', { name: 'Hex talent layout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rare Hex nodes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Epic Hex nodes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rare Hex node 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Epic Hex node 1' })).toBeNull();
    application.dispose();
  });

  it('uses the Calling Card candidate to append ordered row actions through Heroic without mutating base rarity', async () => {
    const application = createApplication();
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const address = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RarifyKeepsake',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const interaction = workspace.interactions.traitOffers.get(semanticAddressKey(address));
    if (interaction === undefined || interaction.value?.kind !== 'traits')
      throw new Error('Calling Card Apollo interaction is missing');
    const commit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={address}
          interactions={workspace.interactions}
          onCommit={commit}
        />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Rarify' })[0]).toHaveProperty(
        'disabled',
        false,
      ),
    );
    const rarify = screen.getAllByRole('button', { name: 'Rarify' })[0]!;
    expect(rarify.classList.contains('secondary-action')).toBe(true);
    await user.click(rarify);
    const save = screen.getByRole('button', { name: 'Save trait offer' });
    expect(save).toHaveProperty('disabled', false);
    await user.click(save);

    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]?.rarity).toBe('Common');
    expect(saved.rarificationActions).toEqual(['option1']);
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    const effectiveSummary = screen.getAllByLabelText('Effective trait values')[0];
    if (effectiveSummary === undefined) {
      throw new Error('effective trait summary is missing');
    }
    expect(effectiveSummary.textContent).toContain('Effective rarityHeroic');
    expect(effectiveSummary.textContent).toContain('Effective level');
    expect(screen.getAllByRole('button', { name: 'Rarify' })[0]).toHaveProperty('disabled', true);
    application.dispose();
  });

  it('shows the exact offer-local rarity checks and replacement pressure', async () => {
    const application = createApplication();
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const address = createTraitOfferAddress(reward, 'source');
    const project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={address} interactions={workspace.interactions} />
      </Provider>,
    );

    const summary = await screen.findByText('Offer State');
    await user.click(summary);
    const state = screen.getByRole('region', { name: 'Offer generation state' });
    expect(state.textContent).toContain('Rare');
    expect(state.textContent).toContain('Epic');
    expect(state.textContent).toContain('Duo');
    expect(state.textContent).toContain('Legendary');
    expect(state.textContent).toContain('Replacement chance10%');
    expect(state.textContent).toContain('Eligible replacement traits');
    expect(state.textContent).toContain('Required by shortage');
    expect(screen.getByText(/ordered roll checks, not final outcome odds/)).toBeTruthy();
    application.dispose();
  });

  it('refreshes offer state from the live unsaved draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value?.kind === 'traits' && candidate.value.options.length === 3,
    );
    if (base === undefined || base.value?.kind !== 'traits') {
      throw new Error('three-row trait interaction is missing');
    }
    const value = base.value;
    const interaction = Object.freeze({
      ...base,
      load: (draft: AuthoredTraitOffer = value) => {
        const forced = draft.kind === 'traits' && draft.selectedOptionKey === 'option2';
        return Object.freeze([
          Object.freeze({
            value: draft,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([
                  Object.freeze({
                    assessments: Object.freeze([]),
                    composition: Object.freeze({
                      applies: true,
                      legal: true,
                      findings: Object.freeze([]),
                    }),
                    offerGenerationState: Object.freeze({
                      rarity: Object.freeze({
                        kind: 'orderedChecks' as const,
                        values: Object.freeze({
                          Rare: 0.2,
                          Epic: 0.05,
                          Heroic: 0,
                          Duo: 0,
                          Legendary: 0,
                        }),
                        rollOrder: Object.freeze([
                          'Common',
                          'Rare',
                          'Epic',
                          'Duo',
                          'Legendary',
                        ] as const),
                      }),
                      replacementRollChance: forced ? 1 : 0.1,
                      eligibleReplacementCount: 1,
                      maximumReplacementCount: 1,
                      requiredReplacementCount: forced ? 1 : 0,
                      shortageRequiredReplacementCount: 0,
                      forcedRollRequiredReplacementCount: forced ? 1 : 0,
                    }),
                    persephoneLevelBonusMaximums: Object.freeze([]),
                    effectiveLevels: Object.freeze([]),
                  }),
                ]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]);
      },
    }) satisfies WorkspaceTraitOfferInteraction;
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as WorkspaceInteractionCatalog;
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={interactions} />
      </Provider>,
    );

    await user.click(await screen.findByText('Offer State'));
    expect(screen.getByRole('region', { name: 'Offer generation state' }).textContent).toContain(
      'Replacement chance10%',
    );
    await user.click(screen.getAllByRole('radio', { name: 'Selected' })[1]!);
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Offer generation state' }).textContent).toContain(
        'Replacement chance100%',
      ),
    );
    expect(screen.getByRole('region', { name: 'Offer generation state' }).textContent).toContain(
      'Required replacements1',
    );
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(0);
    application.dispose();
  });

  it('repairs a required Rejected row, keeps that row unavailable, and saves one undoable offer edit', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value?.kind === 'traits' && candidate.value.options.length === 3,
    );
    if (base === undefined || base.value?.kind !== 'traits')
      throw new Error('three-row trait interaction is missing');
    const { rejectedOptionKey: _rejectedOptionKey, ...withoutRejected } = base.value;
    void _rejectedOptionKey;
    const value = Object.freeze({
      ...withoutRejected,
      selectedOptionKey: 'option1' as const,
      rarificationActions: Object.freeze([]),
    });
    const interaction = Object.freeze({
      ...base,
      value,
      rejectedBlockDomain: () =>
        Object.freeze({
          required: true,
          canClear: false,
          needsRepair: true,
          optionKeys: Object.freeze(['option2', 'option3'] as const),
        }),
      load: (draft: AuthoredTraitOffer = value) => {
        const supported = draft.kind === 'traits' && draft.rejectedOptionKey === 'option2';
        return Object.freeze([
          Object.freeze({
            value: draft,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                callingCard: Object.freeze([
                  Object.freeze({
                    effectiveRarities: Object.freeze([]),
                    invalidActionIndexes: Object.freeze([]),
                    rarifiableOptionKeys: Object.freeze(['option1', 'option2', 'option3'] as const),
                  }),
                ]),
                chaosOfferRules: Object.freeze([
                  Object.freeze({
                    rejectedBlockRequired: true,
                    rejectedBlockableOptionKeys: Object.freeze(['option2', 'option3'] as const),
                    rejectedBlockNeedsRepair: !supported,
                  }),
                ]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                supported,
              }),
            }),
          }),
        ]);
      },
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    });
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={interactions} target={interaction.owner} />
      </Provider>,
    );

    expect(screen.getByRole('group', { name: 'Rejected blocked row' })).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save trait offer' });
    expect(save).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('radio', { name: 'Block Option 2' }));
    expect(screen.getAllByRole('button', { name: 'Rarify' })[1]).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('radio', { name: 'Blocked by Rejected' })[0]).toHaveProperty(
      'disabled',
      true,
    );
    expect(save).toHaveProperty('disabled', false);
    await user.click(save);
    const saved = findTraitOfferControl(
      application.selectStructuredWorkspace(application.store.getState())!,
      interaction.owner,
    );
    expect(saved.offer).toMatchObject({ rejectedOptionKey: 'option2' });
    application.store.dispatch(authoredProjectUndoRequested());
    const restored = findTraitOfferControl(
      application.selectStructuredWorkspace(application.store.getState())!,
      interaction.owner,
    );
    expect(restored.offer).not.toMatchObject({ rejectedOptionKey: 'option2' });
    application.dispose();
  });

  it('refreshes an open editor when an external persisted Persephone result changes', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value?.kind === 'traits',
    );
    if (base === undefined || base.value?.kind !== 'traits') {
      throw new Error('traits interaction is missing');
    }
    const initialValue = Object.freeze({
      ...base.value,
      options: Object.freeze([
        Object.freeze({ ...base.value.options[0], persephoneLevelBonus: 1 }),
        base.value.options[1],
        base.value.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const updatedValue = Object.freeze({
      ...initialValue,
      options: Object.freeze([
        Object.freeze({ ...initialValue.options[0], persephoneLevelBonus: 5 }),
        initialValue.options[1],
        initialValue.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const interactionFor = (value: AuthoredTraitOfferTraits) =>
      Object.freeze({
        ...base,
        value,
        load: (draft: AuthoredTraitOffer = value) =>
          Object.freeze([
            Object.freeze({
              value: draft,
              evaluation: Object.freeze({
                kind: 'traitOffer' as const,
                result: Object.freeze({
                  assessments: Object.freeze([]),
                  branches: Object.freeze([]),
                  effectiveLevels: Object.freeze([6, 4, 2]),
                  findings: Object.freeze([]),
                  persephoneLevelBonusMaximums: Object.freeze([5, undefined, undefined]),
                  supported: true,
                }),
              }),
            }),
          ]),
      });
    const interactionsFor = (value: AuthoredTraitOfferTraits): WorkspaceInteractionCatalog =>
      Object.freeze({
        ...workspace.interactions,
        traitOffers: new Map([[base.key, interactionFor(value)]]),
      }) as unknown as WorkspaceInteractionCatalog;
    const user = userEvent.setup();
    const initialInteractions = interactionsFor(initialValue);
    const view = render(
      <Provider store={application.store}>
        <TraitOfferEditor address={base.owner} interactions={initialInteractions} />
      </Provider>,
    );

    const bonus = screen.getByRole('combobox', { name: 'option1 Persephone level bonus' });
    expect((bonus as HTMLSelectElement).value).toBe('1');
    await user.selectOptions(bonus, '2');
    expect((bonus as HTMLSelectElement).value).toBe('2');

    view.rerender(
      <Provider store={application.store}>
        <TraitOfferEditor address={base.owner} interactions={interactionsFor(updatedValue)} />
      </Provider>,
    );
    expect(
      (
        screen.getByRole('combobox', {
          name: 'option1 Persephone level bonus',
        }) as HTMLSelectElement
      ).value,
    ).toBe('5');
    application.dispose();
  });
});
