// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyProjectCommand,
  semanticAddressKey,
  createTraitAcquisitionTargetAddress,
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
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNStoryBoardProject } from '@run-planner/test-fixtures/surface';

afterEach(cleanup);

describe('ordinary offer shell', () => {
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

  it('does not render a generic Death Defiance control in an offer draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('trait offer interaction is missing');
    const interaction = base;
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    }) as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={interaction.owner}
          interactions={interactions}
          onCommit={vi.fn()}
        />
      </Provider>,
    );

    expect(screen.queryByLabelText('Death Defiance condition met')).toBeNull();
    application.dispose();
  });

  it('keeps a preferred Medea draft saveable without an obsolete condition control', async () => {
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
      },
    });
    application.store.dispatch(authoredProjectReplaced(invalidProject));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = workspace.interactions.traitOffers.get(initial.key);
    if (interaction === undefined) throw new Error('edited Medea trait interaction is missing');
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={workspace.interactions} />
      </Provider>,
    );

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
        if (value.kind !== 'traits') throw new Error('traits expected');
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
