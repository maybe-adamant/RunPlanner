// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthoredTraitOffer } from '@run-planner/engine/authored-project';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  prepareTraitOptionDomain,
  type TraitOptionDomainProjection,
} from '@planner/projections/traitDomainProjection';
import type { WorkspaceTraitOfferInteraction } from '@planner/projections/structured-workspace';
import { TraitOfferEditor } from './TraitOfferEditor';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures';

afterEach(cleanup);

describe('trait offer editor', () => {
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
    });
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
    if (interaction === undefined) throw new Error('ranked trait interaction is missing');
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
                  optionDomain: (value: typeof candidate.value) =>
                    Object.freeze({
                      load: () =>
                        value.selectedOptionKey === 'option1' ? staleResult : currentResult,
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
        <TraitOfferEditor address={interaction.owner} interactions={interactions} />
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
      giverKey: 'Hera',
      options: Object.freeze([
        Object.freeze({ traitKey: 'BoonDecayBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HeraWeaponBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HeraSpecialBoon', rarity: 'Common' as const }),
      ]) as typeof base.value.options,
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
                  value.options[0]?.targetTraitKey === undefined
                    ? [
                        Object.freeze({
                          code: 'targetedAcquisitionTargetMissing' as const,
                          traitKey: 'BoonDecayBoon',
                        }),
                      ]
                    : [],
                ),
                supported: value.options[0]?.targetTraitKey !== undefined,
              }),
            }),
          }),
        ]),
      optionDomain: (
        value: AuthoredTraitOffer,
        optionKey: AuthoredTraitOffer['selectedOptionKey'],
      ) => {
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
    });
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

  it('does not render a rarity picker for fixed-Common Icarus offers', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()][0];
    const icarus = application.catalog.traitGivers.byKey.Icarus;
    if (base === undefined || icarus === undefined) {
      throw new Error('Icarus trait editor fixtures are missing');
    }
    const value: AuthoredTraitOffer = Object.freeze({
      giverKey: 'Icarus',
      options: Object.freeze([
        Object.freeze({ traitKey: 'FocusAttackDamageTrait', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'FocusSpecialDamageTrait', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'OmegaExplodeBoon', rarity: 'Common' as const }),
      ]) as AuthoredTraitOffer['options'],
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
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    });

    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={interaction.owner} interactions={interactions} />
      </Provider>,
    );

    expect(screen.getByLabelText('option1 trait')).toBeTruthy();
    expect(screen.queryByLabelText('option1 rarity')).toBeNull();
    application.dispose();
  });
});
