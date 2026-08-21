// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyProjectCommand,
  createAllTogetherSetAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createIncomingRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  createCirceResolutionAddress,
  createTraitAcquisitionTargetAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createEchoPomTargetAddress,
  createOccurrenceAddress,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredEchoLastRunBoonOffer,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  prepareTraitOptionDomain,
  type TraitOptionDomainProjection,
} from '@planner/projections/traitDomainProjection';
import type {
  WorkspaceEchoLastRunBoonDraftRow,
  WorkspaceInteractionCatalog,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { TraitOfferEditor } from './TraitOfferEditor';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNStoryBoardProject } from '@run-planner/test-fixtures/surface';

afterEach(cleanup);

function pickerModel<T>(entries: readonly { readonly label: string; readonly value: T }[]) {
  return Object.freeze({
    sections: Object.freeze([
      Object.freeze({
        key: 'available',
        kind: 'category' as const,
        label: 'Available',
        collapsible: false,
        items: Object.freeze(
          entries.map((entry, index) =>
            Object.freeze({
              key: String(index),
              label: entry.label,
              value: entry.value,
              state: 'possible' as const,
              selected: false,
              disabled: false,
            }),
          ),
        ),
      }),
    ]),
  });
}

function unavailablePickerModel<T>(
  label: string,
  value: T,
  additional: readonly { readonly label: string; readonly value: T }[] = Object.freeze([]),
) {
  const items = [Object.freeze({ label, value }), ...additional].map((entry) =>
    Object.freeze({
      key: String(entry.value),
      label: entry.label,
      value: entry.value,
      state: 'impossible' as const,
      selected: true,
      disabled: true,
      status: 'Current · unavailable',
      explanation: 'This outcome is not available at the current route frontier.',
    }),
  );
  const selected = items[0]!;
  return Object.freeze({
    selected,
    sections: Object.freeze([
      Object.freeze({
        key: 'selected-invalid',
        kind: 'selectedInvalid' as const,
        label: 'Current selection',
        collapsible: false,
        items: Object.freeze(items),
      }),
    ]),
  });
}

describe('trait offer editor', () => {
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
    const workspace = application.selectStructuredWorkspace(application.store.getState());
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
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    const save = screen.getByRole('button', { name: 'Save trait offer' });
    expect(save).toHaveProperty('disabled', false);
    await user.click(save);

    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]?.rarity).toBe('Common');
    expect(saved.rarificationActions).toEqual(['option1']);
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    expect(screen.getByText('Effective rarity: Heroic')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Rarify' })[0]).toHaveProperty('disabled', true);
    application.dispose();
  });

  it('starts All Together unresolved and applies one complete four-role draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    const hera = application.catalog.traitGivers.byKey.Hera;
    if (base === undefined || hera === undefined) throw new Error('Hera editor fixture is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Hera',
      options: Object.freeze([
        Object.freeze({
          traitKey: 'AllElementalBoon',
          rarity: 'Legendary' as const,
        }),
        Object.freeze({ traitKey: 'HeraManaBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HeraSprintBoon', rarity: 'Common' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const domains = {
      earth: ['ElementalDamageBoon', 'ElementalOlympianDamageBoon'],
      fire: ['ElementalBaseDamageBoon'],
      air: ['ElementalDamageFloorBoon'],
      water: ['ElementalHealthBoon'],
    } as const;
    const allTogetherSets = (Object.keys(domains) as (keyof typeof domains)[]).map((setKey) => {
      const address = createAllTogetherSetAddress(base.owner, 'option1', setKey);
      return Object.freeze({
        control: Object.freeze({
          address,
          marker: Object.freeze({
            address,
            assessment: 'assessed' as const,
            findingCount: 0,
            focusKey: `test-all-together-${setKey}`,
          }),
          optionKey: 'option1' as const,
          setKey,
        }),
        forOffer: () =>
          Object.freeze({
            load: () =>
              Object.freeze({
                picker: pickerModel(
                  domains[setKey].map((traitKey) =>
                    Object.freeze({
                      label: application.catalog.traits.byKey[traitKey]?.label ?? traitKey,
                      value: traitKey,
                    }),
                  ),
                ),
              }),
          }),
      });
    });
    const interaction = Object.freeze({
      ...base,
      choices: Object.freeze(
        hera.traitKeys.map((traitKey) =>
          Object.freeze({
            label: application.catalog.traits.byKey[traitKey]?.label ?? traitKey,
            value: traitKey,
          }),
        ),
      ),
      giver: hera,
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
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          hasTargetPicker: false,
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          ...(draft.kind === 'traits' &&
          draft.selectedOptionKey === optionKey &&
          optionKey === 'option1'
            ? { allTogetherSets: Object.freeze(allTogetherSets) }
            : {}),
        }),
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[base.key, interaction]]),
    });
    const commit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={base.owner}
          interactions={interactions as WorkspaceInteractionCatalog}
          onCommit={commit}
        />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Save trait offer' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Choose all grants' }));
    await user.click(await screen.findByText('Rallying Cry'));
    await user.click(await screen.findByText('Slow Cooker'));
    await user.click(await screen.findByText('Air Quality'));
    await user.click(await screen.findByText('Water Fitness'));
    expect(commit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Apply complete outcome' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(
      (commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits).options[0]?.allTogetherResult,
    ).toEqual({
      earth: 'ElementalOlympianDamageBoon',
      fire: 'ElementalBaseDamageBoon',
      air: 'ElementalDamageFloorBoon',
      water: 'ElementalHealthBoon',
    });
    application.dispose();
  });

  it.each([
    ['activateArcana', 'Red Citrine Arcana', 'The Sorceress'],
    ['promoteArcana', 'Lapis Arcana (2)', 'The Sorceress'],
    ['disableFear', 'Black Night Vow', 'Vow of Rivals'],
  ] as const)(
    'renders and atomically retains the selected Circe %s resolution only',
    async (effect, label, choiceLabel) => {
      const application = createApplication();
      application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
      const workspace = application.selectStructuredWorkspace(application.store.getState());
      const base = [...workspace.interactions.traitOffers.values()].find(
        (candidate) => candidate.giver.providerKind !== 'hammer',
      );
      if (base === undefined) throw new Error('trait offer interaction is missing');
      const control = Object.freeze({
        address: createCirceResolutionAddress(base.owner, 'option1'),
        marker: Object.freeze({
          address: createCirceResolutionAddress(base.owner, 'option1'),
          assessment: 'assessed' as const,
          findingCount: 0,
          focusKey: 'test-circe-resolution',
        }),
        optionKey: 'option1' as const,
      });
      const domain = Object.freeze({
        arcanaPicker: pickerModel([
          Object.freeze({ label: 'The Sorceress', value: 'ArcanaSorceress' }),
          Object.freeze({ label: 'The Titan', value: 'ArcanaTitan' }),
        ]),
        arcanaPickerFor: (selectedKeys: readonly string[]) =>
          pickerModel(
            [
              Object.freeze({ label: 'The Sorceress', value: 'ArcanaSorceress' }),
              Object.freeze({ label: 'The Titan', value: 'ArcanaTitan' }),
            ].filter((entry) => !selectedKeys.includes(entry.value)),
          ),
        branchAgreement: true,
        effect,
        outerAvailable: true,
        requiredCount: effect === 'promoteArcana' ? 2 : 1,
        vowPicker: pickerModel([Object.freeze({ label: 'Vow of Rivals', value: 'VowRivals' })]),
      });
      const interaction = Object.freeze({
        ...base,
        optionDomain: (value: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
          Object.freeze({
            hasTargetPicker: false,
            load: () =>
              Object.freeze({
                candidates: Object.freeze([]),
                preferredOptionFor: () => undefined,
                rarityPickerFor: () => undefined,
                traitPicker: Object.freeze({ sections: Object.freeze([]) }),
              }),
            ...(value.kind !== 'traits' || value.selectedOptionKey !== optionKey
              ? {}
              : {
                  circeResolution: Object.freeze({
                    control,
                    intentFor: () =>
                      Object.freeze({
                        command: Object.freeze({
                          kind: 'ReplaceTraitOffer' as const,
                          trait: base.owner,
                          value,
                        }),
                      }),
                    forOffer: () => Object.freeze({ load: () => domain }),
                  }),
                }),
          }),
      });
      const interactions = Object.freeze({
        ...workspace.interactions,
        traitOffers: new Map([[interaction.key, interaction]]),
      });
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

      if (effect === 'disableFear') {
        await user.click(screen.getByLabelText(label));
        await user.click(await screen.findByText('Vow of Rivals'));
      } else if (effect === 'activateArcana') {
        await user.click(screen.getByLabelText(label));
        await user.click(await screen.findByText('The Sorceress'));
      } else {
        await user.click(screen.getByLabelText('Promoted Arcana'));
        await user.click(await screen.findByText('The Sorceress'));
        await user.click(await screen.findByText('The Titan'));
        await user.click(screen.getByRole('button', { name: 'Apply Lapis outcome' }));
      }
      await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
      const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
      const resolution = saved.options[0]?.circeResolution;
      expect(resolution).toBeDefined();
      if (effect === 'disableFear') {
        expect(resolution).toEqual({ kind: 'disableFear', vowKey: 'VowRivals' });
      } else {
        expect(resolution).toEqual(
          effect === 'activateArcana'
            ? { kind: 'activateArcana', arcanaKeys: ['ArcanaSorceress'] }
            : { kind: 'promoteArcana', arcanaKeys: ['ArcanaSorceress', 'ArcanaTitan'] },
        );
      }
      expect(choiceLabel).toBeTruthy();
      application.dispose();
    },
  );

  it.each([
    [
      'Black Night with no removable Vow',
      'disableFear',
      Object.freeze({ kind: 'disableFear' as const, vowKey: 'VowRivals' }),
      false,
      true,
      0,
      'Black Night Vow',
      'Vow of Rivals',
    ],
    [
      'Red Citrine with an exhausted domain',
      'activateArcana',
      Object.freeze({
        kind: 'activateArcana' as const,
        arcanaKeys: Object.freeze(['ArcanaSorceress']),
      }),
      true,
      true,
      0,
      'Red Citrine Arcana',
      'The Sorceress',
    ],
    [
      'branch-divergent Lapis',
      'promoteArcana',
      Object.freeze({
        kind: 'promoteArcana' as const,
        arcanaKeys: Object.freeze(['ArcanaSorceress', 'ArcanaTitan']),
      }),
      true,
      false,
      2,
      'Promoted Arcana',
      'The Sorceress · The Titan',
    ],
  ] as const)(
    'retains the authored %s outcome through the engine-projected unavailable UI',
    async (
      _case,
      effect,
      resolution,
      outerAvailable,
      branchAgreement,
      requiredCount,
      controlLabel,
      retainedText,
    ) => {
      const application = createApplication();
      application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
      const workspace = application.selectStructuredWorkspace(application.store.getState());
      const base = [...workspace.interactions.traitOffers.values()].find(
        (candidate) => candidate.value?.kind === 'traits',
      );
      if (base?.value?.kind !== 'traits') throw new Error('trait offer fixture is missing');
      const option = base.value.options[0]!;
      const value = Object.freeze({
        ...base.value,
        options: Object.freeze([
          Object.freeze({ ...option, circeResolution: resolution }),
          base.value.options[1],
          base.value.options[2],
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1' as const,
      });
      const address = createCirceResolutionAddress(base.owner, 'option1');
      const control = Object.freeze({
        address,
        marker: Object.freeze({
          address,
          assessment: 'blocked' as const,
          findingCount: 1,
          focusKey: semanticAddressKey(address),
        }),
        optionKey: 'option1' as const,
        value: resolution,
      });
      const arcanaEntries =
        resolution.kind === 'disableFear'
          ? unavailablePickerModel('The Sorceress', 'ArcanaSorceress')
          : unavailablePickerModel(
              'The Sorceress',
              resolution.arcanaKeys[0]!,
              resolution.arcanaKeys.length < 2
                ? Object.freeze([])
                : Object.freeze([{ label: 'The Titan', value: resolution.arcanaKeys[1]! }]),
            );
      const domain = Object.freeze({
        arcanaPicker: arcanaEntries,
        arcanaPickerFor: () => arcanaEntries,
        branchAgreement,
        effect,
        outerAvailable,
        requiredCount,
        vowPicker: unavailablePickerModel('Vow of Rivals', 'VowRivals'),
      });
      const interaction = Object.freeze({
        ...base,
        value,
        optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
          Object.freeze({
            hasTargetPicker: false,
            load: () =>
              Object.freeze({
                candidates: Object.freeze([]),
                preferredOptionFor: () => undefined,
                rarityPickerFor: () => undefined,
                traitPicker: Object.freeze({ sections: Object.freeze([]) }),
              }),
            ...(draft.kind !== 'traits' || draft.selectedOptionKey !== optionKey
              ? {}
              : {
                  circeResolution: Object.freeze({
                    control,
                    intentFor: () =>
                      Object.freeze({
                        command: Object.freeze({
                          kind: 'ReplaceTraitOffer' as const,
                          trait: base.owner,
                          value: draft,
                        }),
                      }),
                    forOffer: () => Object.freeze({ load: () => domain }),
                  }),
                }),
          }),
      });
      const interactions = Object.freeze({
        ...workspace.interactions,
        traitOffers: new Map([[interaction.key, interaction]]),
      });
      render(
        <Provider store={application.store}>
          <TraitOfferEditor address={interaction.owner} interactions={interactions} />
        </Provider>,
      );

      if (effect === 'promoteArcana') {
        expect(screen.getByText(retainedText)).toBeTruthy();
        expect(
          (screen.getByRole('button', { name: 'Apply Lapis outcome' }) as HTMLButtonElement)
            .disabled,
        ).toBe(true);
      } else {
        const retained = screen.getByLabelText(controlLabel);
        expect(retained.textContent).toContain(retainedText);
        expect(retained.getAttribute('aria-invalid')).toBe('true');
      }
      if (effect === 'activateArcana') {
        expect(
          (
            screen.getByRole('button', {
              name: 'Record no Arcana activation',
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false);
      }
      if (!outerAvailable) {
        expect(screen.getByText('This Circe trait has no available outcome here.')).toBeTruthy();
      }
      if (!branchAgreement) {
        expect(screen.getByText('No outcome is supported across every route branch.')).toBeTruthy();
      }
      application.dispose();
    },
  );

  it('renders the bound greatest-level Echo Pom domain and saves its exact target', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('trait offer interaction is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Echo',
      options: Object.freeze([
        Object.freeze({
          traitKey: 'EchoDoubleLevelBoon',
          echoPomTarget: null,
        }),
        Object.freeze({ traitKey: 'DiminishingDodgeBoon' }),
        Object.freeze({ traitKey: 'DiminishingHealthAndManaBoon' }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      deathDefianceConditionMet: false,
    });
    const control = Object.freeze({
      address: createEchoPomTargetAddress(base.owner, 'option1'),
      marker: Object.freeze({
        address: createEchoPomTargetAddress(base.owner, 'option1'),
        assessment: 'assessed' as const,
        findingCount: 0,
        focusKey: 'test-echo-pom-target',
      }),
      optionKey: 'option1' as const,
      value: null,
    });
    const interaction = Object.freeze({
      ...base,
      value,
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          hasTargetPicker: false,
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          ...(draft.kind !== 'traits' || draft.selectedOptionKey !== optionKey
            ? {}
            : {
                echoPomTarget: Object.freeze({
                  control,
                  intentFor: () =>
                    Object.freeze({
                      command: Object.freeze({
                        kind: 'ReplaceTraitOffer' as const,
                        trait: base.owner,
                        value: draft,
                      }),
                    }),
                  forOffer: () =>
                    Object.freeze({
                      load: () =>
                        Object.freeze({
                          picker: pickerModel([
                            Object.freeze({ label: 'Nova Strike', value: 'ApolloWeaponBoon' }),
                            Object.freeze({ label: 'Heaven Strike', value: 'ZeusWeaponBoon' }),
                          ]),
                          emptyNoOpAllowed: false,
                        }),
                    }),
                }),
              }),
        }),
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    });
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

    await user.click(screen.getByLabelText('Pom Pom Pom target'));
    await user.click(await screen.findByText('Nova Strike'));
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]).toMatchObject({
      traitKey: 'EchoDoubleLevelBoon',
      echoPomTarget: 'ApolloWeaponBoon',
    });
    application.dispose();
  });

  it('renders the source-resolved Echo Boon domain and saves its selected nested outcome', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('trait offer interaction is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Echo',
      options: Object.freeze([
        Object.freeze({ traitKey: 'EchoLastRunBoon' }),
        Object.freeze({ traitKey: 'DiminishingDodgeBoon' }),
        Object.freeze({ traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      deathDefianceConditionMet: false,
    });
    const childAddress = createEchoLastRunBoonAddress(base.owner, 'option1');
    const control = Object.freeze({
      address: childAddress,
      marker: Object.freeze({
        address: childAddress,
        assessment: 'assessed' as const,
        findingCount: 0,
        focusKey: 'test-echo-last-run-boon',
      }),
      optionKey: 'option1' as const,
    });
    const identities = Object.freeze([
      Object.freeze({ giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon' }),
      Object.freeze({ giverKey: 'Hera', traitKey: 'BoonDecayBoon' }),
    ]);
    const echoDomainLoads = vi.fn();
    const interaction = Object.freeze({
      ...base,
      value,
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          hasTargetPicker: false,
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          ...(draft.kind !== 'traits' || draft.selectedOptionKey !== optionKey
            ? {}
            : {
                echoLastRunBoon: Object.freeze({
                  control,
                  intentFor: () =>
                    Object.freeze({
                      command: Object.freeze({
                        kind: 'ReplaceTraitOffer' as const,
                        trait: base.owner,
                        value: draft,
                      }),
                    }),
                  forOffer: () => ({
                    load: () => {
                      echoDomainLoads();
                      return {
                        draftSupportFor: (
                          rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                          selectedIndex: number,
                        ) => {
                          const rowSupport = rows.map(
                            (row) =>
                              row.identity !== undefined &&
                              row.rarity !== undefined &&
                              !(
                                row.identity.traitKey === 'HighHealthOffenseBoon' &&
                                row.rarity === 'Rare'
                              ),
                          );
                          const selected = rows[selectedIndex];
                          const selectedTargetSupported =
                            selected?.identity?.traitKey !== 'BoonDecayBoon' ||
                            selected.targetTraitKey !== undefined;
                          const occupied = rows.flatMap((row) =>
                            row.identity === undefined ? [] : [row.identity.traitKey],
                          );
                          const remainingTraitIdentities = identities.filter(
                            (identity) => !occupied.includes(identity.traitKey),
                          );
                          return Object.freeze({
                            rowSupport: Object.freeze(rowSupport),
                            selectedTargetSupported,
                            complete: rowSupport.every(Boolean) && selectedTargetSupported,
                            remainingTraitIdentities,
                            canAppend: rows.length < 3 && remainingTraitIdentities.length > 0,
                          });
                        },
                        effectiveRarityFor: (option: AuthoredEchoLastRunBoonOption) =>
                          option.rarity,
                        labelFor: (identity: {
                          readonly giverKey: string;
                          readonly traitKey: string;
                        }) =>
                          identity.traitKey === 'HighHealthOffenseBoon'
                            ? 'Aphrodite · Heart Breaker'
                            : identity.traitKey === 'BoonDecayBoon'
                              ? 'Hera · Bridal Glow'
                              : 'Aphrodite · Romantic Spark',
                        summaryFor: (nested: AuthoredEchoLastRunBoonOffer) => {
                          const selected =
                            nested.options[nested.selectedOptionKey === 'option1' ? 0 : 1];
                          return selected?.traitKey === 'BoonDecayBoon'
                            ? 'Hera · Bridal Glow · Heroic'
                            : `Aphrodite · Heart Breaker · ${selected?.rarity ?? 'unknown'}`;
                        },
                        rarityPickerFor: (
                          identity: {
                            readonly giverKey: string;
                            readonly traitKey: string;
                          },
                          selected?: TraitRarity,
                        ) => {
                          if (
                            identity.traitKey === 'HighHealthOffenseBoon' &&
                            selected === 'Rare'
                          ) {
                            const invalid = unavailablePickerModel('Rare', 'Rare' as const);
                            const available = pickerModel([
                              Object.freeze({ label: 'Common', value: 'Common' as const }),
                            ]);
                            return Object.freeze({
                              selected: invalid.selected,
                              sections: Object.freeze([...invalid.sections, ...available.sections]),
                            });
                          }
                          return pickerModel(
                            identity.traitKey === 'HighHealthOffenseBoon'
                              ? [
                                  Object.freeze({ label: 'Common', value: 'Common' as const }),
                                  Object.freeze({ label: 'Rare', value: 'Rare' as const }),
                                ]
                              : [
                                  Object.freeze({
                                    label:
                                      identity.traitKey === 'SprintEchoBoon' ? 'Duo' : 'Heroic',
                                    value:
                                      identity.traitKey === 'SprintEchoBoon'
                                        ? ('Duo' as const)
                                        : ('Heroic' as const),
                                  }),
                                ],
                          );
                        },
                        targetPickerFor: () =>
                          pickerModel([
                            Object.freeze({
                              label: 'Melting Point',
                              value: 'HephaestusWeaponBoon',
                            }),
                          ]),
                        targetRequiredFor: (identity: {
                          readonly giverKey: string;
                          readonly traitKey: string;
                        }) => identity.traitKey === 'BoonDecayBoon',
                        traitPickerFor: () =>
                          pickerModel(
                            identities.map((identity) =>
                              Object.freeze({
                                label:
                                  identity.traitKey === 'HighHealthOffenseBoon'
                                    ? 'Aphrodite · Heart Breaker'
                                    : identity.traitKey === 'BoonDecayBoon'
                                      ? 'Hera · Bridal Glow'
                                      : 'Aphrodite · Romantic Spark',
                                value: identity,
                              }),
                            ),
                          ),
                      };
                    },
                  }),
                }),
              }),
        }),
    }) satisfies WorkspaceTraitOfferInteraction;
    const interactions: WorkspaceInteractionCatalog = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    });
    const commit = vi.fn();
    const user = userEvent.setup();
    const rendered = render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={interaction.owner}
          interactions={interactions}
          onChildCommit={commit}
          onCommit={commit}
        />
      </Provider>,
    );

    expect(
      screen.getByText('Choose the boon Echo grants before room chronology continues.'),
    ).toBeDefined();
    expect(
      rendered.container.querySelectorAll('input[name="echo-last-run-selected"]'),
    ).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Choose' }));
    expect(screen.getByText('Echo offer > Boon Boon Boon choice')).toBeDefined();
    expect(
      rendered.container.querySelectorAll('input[name="echo-last-run-selected"]'),
    ).toHaveLength(1);
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 1'));
    await user.click(await screen.findByText('Aphrodite · Heart Breaker'));
    await user.click(screen.getByRole('button', { name: 'Back to Echo offer' }));
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Choose' }));
    expect(screen.getByLabelText('Boon Boon Boon outcome 1').textContent).toContain(
      'Choose provider and trait',
    );
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 1'));
    await user.click(await screen.findByText('Aphrodite · Heart Breaker'));
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 1 rarity'));
    await user.click(await screen.findByText('Common'));
    await user.click(screen.getByRole('button', { name: 'Add outcome' }));
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 2'));
    await user.click(await screen.findByText('Hera · Bridal Glow'));
    expect(screen.queryByLabelText('Boon Boon Boon outcome 2 rarity')).toBeNull();
    const nestedRadios = rendered.container.querySelectorAll(
      'input[name="echo-last-run-selected"]',
    );
    expect(nestedRadios).toHaveLength(2);
    await user.click(nestedRadios[1]!);
    await user.click(screen.getByLabelText('Boon Boon Boon selected trait target'));
    await user.click(await screen.findByText('Melting Point'));
    expect(screen.queryByRole('button', { name: 'Add outcome' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' }));
    expect(screen.getByRole('button', { name: 'Edit choice' })).toBeDefined();
    expect(commit).toHaveBeenCalledTimes(1);
    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]).toMatchObject({
      traitKey: 'EchoLastRunBoon',
      echoLastRunBoon: {
        options: [
          { giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon', rarity: 'Common' },
          {
            giverKey: 'Hera',
            traitKey: 'BoonDecayBoon',
            rarity: 'Heroic',
            targetTraitKey: 'HephaestusWeaponBoon',
          },
        ],
        selectedOptionKey: 'option2',
      },
    });

    rendered.unmount();
    const retainedInvalidValue: AuthoredTraitOfferTraits = Object.freeze({
      ...value,
      options: Object.freeze([
        Object.freeze({
          traitKey: 'EchoLastRunBoon',
          echoLastRunBoon: Object.freeze({
            options: Object.freeze([
              Object.freeze({
                giverKey: 'Aphrodite',
                traitKey: 'HighHealthOffenseBoon',
                rarity: 'Rare' as const,
              }),
            ] as const),
            selectedOptionKey: 'option1' as const,
          }),
        }),
        value.options[1],
        value.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const retainedInvalidInteraction = Object.freeze({
      ...interaction,
      value: retainedInvalidValue,
    });
    const retainedInvalidInteractions: WorkspaceInteractionCatalog = Object.freeze({
      ...interactions,
      traitOffers: new Map([[retainedInvalidInteraction.key, retainedInvalidInteraction]]),
    });
    const loadsBeforeOuterSummary = echoDomainLoads.mock.calls.length;
    const retainedInvalidEditor = () => (
      <StrictMode>
        <Provider store={application.store}>
          <TraitOfferEditor
            address={retainedInvalidInteraction.owner}
            interactions={retainedInvalidInteractions}
            onChildCommit={commit}
          />
        </Provider>
      </StrictMode>
    );
    const retainedRendered = render(retainedInvalidEditor());
    await screen.findByText('Aphrodite · Heart Breaker · Rare');
    expect(echoDomainLoads).toHaveBeenCalledTimes(loadsBeforeOuterSummary + 1);
    retainedRendered.rerender(retainedInvalidEditor());
    expect(echoDomainLoads).toHaveBeenCalledTimes(loadsBeforeOuterSummary + 1);
    await user.click(screen.getByRole('button', { name: 'Edit choice' }));
    expect(screen.getByLabelText('Boon Boon Boon outcome 1 rarity').textContent).toContain('Rare');
    expect(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' })).toHaveProperty(
      'disabled',
      true,
    );
    application.dispose();
  });

  it('shows the Echo generated-pickup summary without nesting payload in the trait', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('trait offer interaction is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Echo',
      options: Object.freeze([
        Object.freeze({ traitKey: 'EchoLastReward' }),
        Object.freeze({ traitKey: 'DiminishingDodgeBoon' }),
        Object.freeze({ traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      deathDefianceConditionMet: false,
    });
    const childAddress = createEchoLastRewardAddress(base.owner, 'option1');
    const control = Object.freeze({
      address: childAddress,
      acquisitionEntry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenFBiome, goldenFStartId),
          'roomExit',
        ),
        'echoLastReward:Encounter:Story_Echo_01:option1',
      ),
      marker: Object.freeze({
        address: childAddress,
        assessment: 'assessed' as const,
        findingCount: 1,
        focusKey: 'test-echo-last-reward',
      }),
      optionKey: 'option1' as const,
      spawnLabel: 'Gold',
    });
    const interaction = Object.freeze({
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
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      echoLastReward: control,
      optionDomain: () =>
        Object.freeze({
          hasTargetPicker: false,
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
        }),
    });
    const interactions: WorkspaceInteractionCatalog = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    });
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

    expect(screen.getByText('Spawns: Gold')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Configure in Room Timeline' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]).toEqual({ traitKey: 'EchoLastReward' });
    application.dispose();
  });

  it('does not evaluate trait eligibility during render', () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => events.push(event),
    });
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (interaction === undefined) throw new Error('trait offer interaction is missing');
    events.length = 0;

    renderToStaticMarkup(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={workspace.interactions} />
      </Provider>,
    );

    expect(events.filter((event) => event?.kind === 'queryBatch')).toEqual([]);
    application.dispose();
  });

  it('renders a capability-provided Death Defiance control in the atomic offer draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('trait offer interaction is missing');
    const interaction = Object.freeze({
      ...base,
      deathDefianceCondition: Object.freeze({ value: false }),
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as WorkspaceInteractionCatalog;
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={interaction.owner}
          interactions={interactions}
          onCommit={onCommit}
        />
      </Provider>,
    );

    const checkbox = screen.getByLabelText('Death Defiance condition met');
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ deathDefianceConditionMet: true }),
    );
    application.dispose();
  });

  it('reevaluates a Medea draft immediately when its Death Defiance condition changes', async () => {
    const application = createApplication();
    const project = loadSurfaceNStoryBoardProject();
    application.store.dispatch(authoredProjectReplaced(project));
    const initialWorkspace = application.selectStructuredWorkspace(application.store.getState());
    const initial = [...initialWorkspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.key === 'Medea',
    );
    if (initial === undefined || initial.value?.kind !== 'traits')
      throw new Error('Medea trait offer interaction is missing');
    const invalidProject = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: initial.owner,
      value: {
        ...initial.value,
        options: [
          { traitKey: 'DeathDefianceRetaliateCurse' },
          initial.value.options[1]!,
          initial.value.options[2]!,
        ] as AuthoredTraitOfferTraits['options'],
        deathDefianceConditionMet: false,
      },
    });
    application.store.dispatch(authoredProjectReplaced(invalidProject));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = workspace.interactions.traitOffers.get(initial.key);
    if (interaction === undefined) throw new Error('edited Medea trait interaction is missing');
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={workspace.interactions} />
      </Provider>,
    );

    expect(await screen.findByText(/deathDefianceConditionMet/)).toBeTruthy();
    await user.click(screen.getByLabelText('Death Defiance condition met'));

    await waitFor(() => expect(screen.queryByText(/deathDefianceConditionMet/)).toBeNull());
    expect(
      (screen.getByRole('button', { name: 'Save trait offer' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    application.dispose();
  });

  it('loads one focused option domain only when its contextual picker opens', async () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => events.push(event),
    });
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (interaction?.value?.kind !== 'traits')
      throw new Error('trait offer interaction is missing');
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={workspace.interactions} />
      </Provider>,
    );
    events.length = 0;
    const trigger = screen.getByLabelText('option1 trait');
    await user.click(trigger);

    const batches = events.filter((event) => event.kind === 'queryBatch');
    const prepared = prepareTraitOptionDomain(
      application.catalog,
      interaction.giver,
      interaction.value,
      'option1',
    );
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(expect.objectContaining({ queryCount: prepared.variants.length }));

    await user.click(trigger);
    await user.click(screen.getByLabelText('option1 rarity'));
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual(batches);
    await user.click(screen.getByLabelText('option1 rarity'));
    await user.click(trigger);
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual(batches);
    application.dispose();
  });

  it('ignores a late focused-domain result after a sibling draft revision', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (interaction === undefined || interaction.value?.kind !== 'traits')
      throw new Error('ranked trait interaction is missing');
    const trait = interaction.value.options[0]?.traitKey;
    if (trait === undefined) throw new Error('trait offer fixture is missing option1');
    const domain = (label: string): TraitOptionDomainProjection =>
      Object.freeze({
        candidates: Object.freeze([]),
        preferredOptionFor: () => undefined,
        rarityPickerFor: () => undefined,
        traitPicker: Object.freeze({
          sections: Object.freeze([
            Object.freeze({
              collapsible: false,
              items: Object.freeze([
                Object.freeze({
                  disabled: false,
                  key: label,
                  label,
                  selected: true,
                  state: 'possible' as const,
                  value: trait,
                }),
              ]),
              key: label,
              kind: 'category' as const,
              label: 'Available',
            }),
          ]),
        }),
      });
    const stale = domain('Old draft trait');
    const current = domain('Current draft trait');
    let resolveStale: (value: TraitOptionDomainProjection) => void = () => undefined;
    let resolveCurrent: (value: TraitOptionDomainProjection) => void = () => undefined;
    const staleResult = new Promise<TraitOptionDomainProjection>((resolve) => {
      resolveStale = resolve;
    });
    const currentResult = new Promise<TraitOptionDomainProjection>((resolve) => {
      resolveCurrent = resolve;
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map<string, WorkspaceTraitOfferInteraction>(
        [...workspace.interactions.traitOffers.entries()].map(([key, candidate]) =>
          candidate !== interaction
            ? [key, candidate]
            : [
                key,
                Object.freeze({
                  ...candidate,
                  optionDomain: (value: AuthoredTraitOffer) =>
                    Object.freeze({
                      load: () =>
                        value.kind === 'traits' && value.selectedOptionKey === 'option1'
                          ? staleResult
                          : currentResult,
                      hasTargetPicker: false,
                    }),
                }),
              ],
        ),
      ),
    });
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={interaction.owner}
          interactions={interactions as WorkspaceInteractionCatalog}
        />
      </Provider>,
    );

    const traitTrigger = screen.getByLabelText('option1 trait');
    await user.click(traitTrigger);
    await user.click(screen.getAllByLabelText('Selected')[1]!);
    await user.click(screen.getByLabelText('option1 trait'));

    await act(async () => resolveStale(stale));
    expect(screen.queryByText('Old draft trait')).toBeNull();
    await act(async () => resolveCurrent(current));
    expect(screen.getByText('Current draft trait')).toBeTruthy();
    application.dispose();
  });

  it('renders the selected targeted acquisition step before loading and saves its exact target', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    const hera = application.catalog.traitGivers.byKey.Hera;
    const targetLabel = application.catalog.traits.byKey.ApolloCastBoon?.label;
    if (base === undefined || hera === undefined || targetLabel === undefined) {
      throw new Error('targeted trait editor fixtures are missing');
    }
    const authored = Object.freeze({
      kind: 'traits',
      giverKey: 'Hera',
      options: Object.freeze([
        Object.freeze({ traitKey: 'BoonDecayBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HeraWeaponBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HeraSpecialBoon', rarity: 'Common' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });
    const interaction = Object.freeze({
      ...base,
      choices: Object.freeze(
        hera.traitKeys.map((traitKey) =>
          Object.freeze({
            label: application.catalog.traits.byKey[traitKey]?.label ?? traitKey,
            value: traitKey,
          }),
        ),
      ),
      giver: hera,
      load: (value: AuthoredTraitOffer = authored) =>
        Object.freeze([
          Object.freeze({
            value,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                findings: Object.freeze(
                  value.kind === 'traits' && value.options[0]?.targetTraitKey === undefined
                    ? [
                        Object.freeze({
                          code: 'targetedAcquisitionTargetMissing' as const,
                          traitKey: 'BoonDecayBoon',
                        }),
                      ]
                    : [],
                ),
                supported:
                  value.kind === 'traits' && value.options[0]?.targetTraitKey !== undefined,
              }),
            }),
          }),
        ]),
      optionDomain: (value: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') => {
        if (value.kind === 'fallbackGold') throw new Error('traits expected');
        const option = value.options[0]!;
        const ownsTarget = optionKey === 'option1' && option.traitKey === 'BoonDecayBoon';
        const targetAddress = createTraitAcquisitionTargetAddress(base.owner, optionKey);
        return Object.freeze({
          hasTargetPicker: ownsTarget,
          ...(ownsTarget
            ? {
                traitAcquisitionTarget: Object.freeze({
                  address: targetAddress,
                  marker: Object.freeze({
                    address: targetAddress,
                    assessment: 'blocked' as const,
                    findingCount: 1,
                    focusKey: semanticAddressKey(targetAddress),
                  }),
                  optionKey,
                  ...(option.targetTraitKey === undefined ? {} : { value: option.targetTraitKey }),
                }),
              }
            : {}),
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              ...(ownsTarget
                ? {
                    targetPicker: Object.freeze({
                      sections: Object.freeze([
                        Object.freeze({
                          collapsible: false,
                          items: Object.freeze([
                            Object.freeze({
                              disabled: false,
                              key: 'ApolloCastBoon',
                              label: targetLabel,
                              selected: option.targetTraitKey === 'ApolloCastBoon',
                              state: 'possible' as const,
                              value: 'ApolloCastBoon',
                            }),
                          ]),
                          key: 'category:available',
                          kind: 'category' as const,
                          label: 'Available',
                        }),
                      ]),
                    }),
                  }
                : {}),
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
        });
      },
      traitLabel: (traitKey: string) =>
        application.catalog.traits.byKey[traitKey]?.label ?? traitKey,
      value: authored,
    }) satisfies WorkspaceTraitOfferInteraction;
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as WorkspaceInteractionCatalog;
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={interaction.owner}
          interactions={interactions}
          onCommit={onCommit}
        />
      </Provider>,
    );

    const target = screen.getByLabelText('option1 acquisition target');
    expect(target.closest('.trait-offer-option')).toBeNull();
    expect(target.closest('[aria-label="Selected trait outcome"]')).not.toBeNull();
    expect(screen.getAllByRole('group', { name: /Option/ })).toHaveLength(3);
    expect(target.textContent).toContain('Choose an equipped trait');
    expect(
      (screen.getByRole('button', { name: 'Save trait offer' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(target);
    await user.click(await screen.findByRole('option', { name: targetLabel }));
    const save = screen.getByRole('button', { name: 'Save trait offer' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({
            traitKey: 'BoonDecayBoon',
            targetTraitKey: 'ApolloCastBoon',
          }),
        ]),
      }),
    );
    application.dispose();
  });

  it('does not render a rarity picker for rarityless Icarus offers', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()][0];
    const icarus = application.catalog.traitGivers.byKey.Icarus;
    if (base === undefined || icarus === undefined) {
      throw new Error('Icarus trait editor fixtures are missing');
    }
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Icarus',
      options: Object.freeze([
        Object.freeze({ traitKey: 'FocusAttackDamageTrait' }),
        Object.freeze({ traitKey: 'FocusSpecialDamageTrait' }),
        Object.freeze({ traitKey: 'OmegaExplodeBoon' }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });
    const interaction = Object.freeze({
      ...base,
      choices: Object.freeze(
        icarus.traitKeys.map((traitKey) =>
          Object.freeze({
            label: application.catalog.traits.byKey[traitKey]?.label ?? traitKey,
            value: traitKey,
          }),
        ),
      ),
      giver: icarus,
      load: () =>
        Object.freeze([
          Object.freeze({
            value,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      optionDomain: () =>
        Object.freeze({
          hasTargetPicker: false,
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
        }),
      value,
    }) satisfies WorkspaceTraitOfferInteraction;
    const interactions: WorkspaceInteractionCatalog = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as unknown as WorkspaceInteractionCatalog;

    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={interaction.owner}
          interactions={interactions as WorkspaceInteractionCatalog}
        />
      </Provider>,
    );

    expect(screen.getByLabelText('option1 trait')).toBeTruthy();
    expect(screen.queryByLabelText('option1 rarity')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Fallback Gold' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove last option' })).toBeNull();
    application.dispose();
  });

  it('renders a fixed high-tier rarity as read-only instead of a picker', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind === 'olympian',
    );
    if (base === undefined) throw new Error('Olympian trait editor fixture is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: base.giver.key,
      options: Object.freeze([
        Object.freeze({ traitKey: 'LightningVulnerabilityBoon', rarity: 'Duo' }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
    });
    const interaction = Object.freeze({
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
                findings: Object.freeze([]),
                supported: draft.kind !== 'fallbackGold',
              }),
            }),
          }),
        ]),
      optionDomain: () =>
        Object.freeze({
          hasTargetPicker: false,
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }) satisfies TraitOptionDomainProjection,
        }),
    }) satisfies WorkspaceTraitOfferInteraction;
    const interactions: WorkspaceInteractionCatalog = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as unknown as WorkspaceInteractionCatalog;

    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={interactions} />
      </Provider>,
    );

    expect(await screen.findByText('Rarity: Duo')).toBeTruthy();
    expect(screen.queryByLabelText('option1 rarity')).toBeNull();
    application.dispose();
  });

  it('omits offer-shape actions when no optional high-tier draft is available', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value?.kind === 'traits',
    );
    if (base === undefined || base.value?.kind !== 'traits') {
      throw new Error('traits interaction is missing');
    }
    const value = Object.freeze({
      ...base.value,
      options: Object.freeze([
        base.value.options[0]!,
        base.value.options[1]!,
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2' as const,
    });
    const interaction = Object.freeze({
      ...base,
      value,
      load: (draft = value) => base.load(draft),
      nextOptionalHighTierDraft: () => undefined,
      previousOptionalHighTierDraft: () => undefined,
    });
    const interactions: WorkspaceInteractionCatalog = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={interactions} />
      </Provider>,
    );

    expect(screen.getByLabelText('option1 trait')).toBeTruthy();
    expect(screen.getByLabelText('option2 trait')).toBeTruthy();
    expect(screen.queryByLabelText('option3 trait')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add option' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove last option' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Fallback Gold' })).toBeNull();
    application.dispose();
  });

  it('uses engine-backed append and fallback drafts without rendering fallback child controls', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value?.kind === 'traits',
    );
    if (base === undefined || base.value?.kind !== 'traits') {
      throw new Error('traits interaction is missing');
    }
    const one = Object.freeze({
      ...base.value,
      options: Object.freeze([base.value.options[0]!]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
    });
    const two = Object.freeze({
      ...one,
      options: Object.freeze([
        one.options[0]!,
        base.value.options[1]!,
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const append = vi.fn((draft: AuthoredTraitOfferTraits) =>
      draft.options.length === 1 ? two : undefined,
    );
    const starting = vi.fn(() => one);
    const interaction = Object.freeze({
      ...base,
      value: one,
      load: (draft: AuthoredTraitOffer = one) =>
        Object.freeze([
          Object.freeze({
            value: draft,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      nextOptionalHighTierDraft: append,
      previousOptionalHighTierDraft: (draft: AuthoredTraitOfferTraits) =>
        draft.options.length === 2 ? one : undefined,
      traitsStartingDraft: starting,
    });
    const interactions: WorkspaceInteractionCatalog = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as unknown as WorkspaceInteractionCatalog;
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={interactions} />
      </Provider>,
    );

    const actions = await screen.findByRole('group', { name: 'Offer shape actions' });
    const fallback = within(actions).getByRole('button', { name: 'Select Fallback Gold' });
    const add = within(actions).getByRole('button', { name: 'Add option' });
    const firstTrait = screen.getByLabelText('option1 trait');
    expect(
      firstTrait.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(add.classList.contains('quiet-action')).toBe(true);
    expect(add.classList.contains('action-compact')).toBe(true);
    expect(fallback.className).toBe(add.className);
    await user.click(add);
    expect(append).toHaveBeenCalledWith(one);
    expect(screen.getByLabelText('option2 trait')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add option' })).toBeNull();
    const remove = await screen.findByRole('button', { name: 'Remove last option' });
    expect(remove.className).toBe(fallback.className);
    await user.click(remove);
    expect(screen.queryByLabelText('option2 trait')).toBeNull();
    expect((screen.getByLabelText('Selected') as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await user.click(screen.getByRole('button', { name: 'Select Fallback Gold' }));
    expect(screen.getByText('Fallback Gold')).toBeTruthy();
    expect(screen.queryByLabelText('option1 trait')).toBeNull();
    expect(screen.queryByLabelText('Death Defiance condition met')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Return to traits' }));
    expect(starting).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('option1 trait')).toBeTruthy();
    application.dispose();
  });
});
