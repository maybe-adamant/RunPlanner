// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  createCirceResolutionAddress,
  createEchoPomTargetAddress,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';

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
  WorkspaceInteractionCatalog,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { TraitOfferEditor } from './TraitOfferEditor';
import {
  createGoldenFGHIProject,
  createRepresentativeNProject,
  goldenFBiome,
  goldenFStartId,
} from '@run-planner/test-fixtures';

afterEach(cleanup);

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
    if (interaction === undefined || interaction.value.kind !== 'traits')
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
        arcanaChoices: Object.freeze([
          Object.freeze({ label: 'The Sorceress', value: 'ArcanaSorceress' }),
          Object.freeze({ label: 'The Titan', value: 'ArcanaTitan' }),
        ]),
        effect,
        outerAvailable: true,
        requiredCount: effect === 'promoteArcana' ? 2 : 1,
        vowChoices: Object.freeze([Object.freeze({ label: 'Vow of Rivals', value: 'VowRivals' })]),
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

      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.queryAllByText(label)).toHaveLength(1);
      if (effect === 'disableFear') {
        await user.selectOptions(screen.getByLabelText(label), 'VowRivals');
      } else if (effect === 'activateArcana') {
        await user.selectOptions(screen.getByLabelText(label), 'ArcanaSorceress');
      } else {
        await user.click(screen.getByLabelText('The Sorceress'));
        await user.click(screen.getByLabelText('The Titan'));
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
                          choices: Object.freeze([
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

    await user.selectOptions(screen.getByLabelText('Pom Pom Pom target'), 'ApolloWeaponBoon');
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]).toMatchObject({
      traitKey: 'EchoDoubleLevelBoon',
      echoPomTarget: 'ApolloWeaponBoon',
    });
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
    const project = createRepresentativeNProject({
      openSlotKeys: [
        'combat11',
        'combat10',
        'combat09',
        'combat05',
        'story',
        'combat02',
        'combat01',
        'miniBoss01',
        'combat23',
      ],
      visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const initialWorkspace = application.selectStructuredWorkspace(application.store.getState());
    const initial = [...initialWorkspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.key === 'Medea',
    );
    if (initial === undefined || initial.value.kind !== 'traits')
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
    if (interaction === undefined) throw new Error('trait offer interaction is missing');
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
    if (interaction === undefined || interaction.value.kind !== 'traits')
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
        return Object.freeze({
          hasTargetPicker: ownsTarget,
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

  it('renders only materialized rows and clamps the selected key when removing the trailing row', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value.kind === 'traits',
    );
    if (base === undefined || base.value.kind !== 'traits') {
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
      nextTraitOfferDraft: () => undefined,
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

    expect(screen.getByLabelText('option1 trait')).toBeTruthy();
    expect(screen.getByLabelText('option2 trait')).toBeTruthy();
    expect(screen.queryByLabelText('option3 trait')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Remove last option' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect((screen.getByRole('button', { name: 'Add option' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.click(screen.getByRole('button', { name: 'Remove last option' }));
    expect((screen.getByLabelText('Selected') as HTMLInputElement).checked).toBe(true);
    application.dispose();
  });

  it('uses engine-backed append and fallback drafts without rendering fallback child controls', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value.kind === 'traits',
    );
    if (base === undefined || base.value.kind !== 'traits') {
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
    const append = vi.fn(() => two);
    const starting = vi.fn(() => one);
    const interaction = Object.freeze({
      ...base,
      value: one,
      load: (draft = one) => base.load(draft),
      nextTraitOfferDraft: append,
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

    const fallback = screen.getByRole('button', { name: 'Select Fallback Gold' });
    const firstTrait = screen.getByLabelText('option1 trait');
    expect(
      fallback.compareDocumentPosition(firstTrait) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(append).toHaveBeenCalledWith(one);
    expect(screen.getByLabelText('option2 trait')).toBeTruthy();
    await user.click(fallback);
    expect(screen.getByText('Fallback Gold')).toBeTruthy();
    expect(screen.queryByLabelText('option1 trait')).toBeNull();
    expect(screen.queryByLabelText('Death Defiance condition met')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Return to traits' }));
    expect(starting).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('option1 trait')).toBeTruthy();
    application.dispose();
  });
});
