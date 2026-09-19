// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  pickerModel,
  unavailablePickerModel,
} from '@planner-test/support/trait-offer-editor.test-support';
import {
  applyProjectCommand,
  createAllTogetherSetAddress,
  createIncomingRewardAddress,
  semanticAddressKey,
  createCirceResolutionAddress,
  createNaturalSelectionResultAddress,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredCirceResolution,
} from '@run-planner/engine/authored-project';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectUndoRequested,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import { TraitOfferDialog, TraitOfferEditor } from '@planner/ui/editor/rewards/TraitOfferEditor';
import { TraitOfferCirceResolution } from '@planner/ui/editor/rewards/TraitOfferCirceResolution';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);

describe('selected outcomes', () => {
  it('resets an incomplete Circe Arcana draft when the resolution effect changes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const arcanaPicker = pickerModel([
      Object.freeze({ label: 'The Sorceress', value: 'ArcanaSorceress' }),
      Object.freeze({ label: 'The Titan', value: 'ArcanaTitan' }),
    ]);
    const vowPicker = pickerModel([Object.freeze({ label: 'Vow of Rivals', value: 'VowRivals' })]);
    const option = Object.freeze({ traitKey: 'RandomArcanaTrait' });
    const activation = Object.freeze({
      arcanaPicker,
      arcanaPickerFor: () => arcanaPicker,
      branchAgreement: true,
      effect: 'activateArcana' as const,
      outerAvailable: true,
      requiredCount: 2,
      vowPicker,
      vowPickerFor: () => vowPicker,
    });
    const fear = Object.freeze({ ...activation, effect: 'disableFear' as const, requiredCount: 1 });
    const { rerender } = render(
      <TraitOfferCirceResolution
        controlId="circe-effect-switch"
        domain={activation}
        onSelect={onSelect}
        option={option}
      />,
    );
    await user.click(screen.getByLabelText('Red Citrine Arcana'));
    await user.click(screen.getByText('The Sorceress'));
    rerender(
      <TraitOfferCirceResolution
        controlId="circe-effect-switch"
        domain={fear}
        onSelect={onSelect}
        option={option}
      />,
    );
    await user.click(screen.getByLabelText('Black Night Vow'));
    await user.click(screen.getByText('Vow of Rivals'));
    expect(onSelect).toHaveBeenLastCalledWith({ kind: 'disableFear', vowKeys: ['VowRivals'] });
  });

  it('starts All Together unresolved and applies one complete four-role draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
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
    let allTogetherLoadableCount = 0;
    const allTogetherSets = (Object.keys(domains) as (keyof typeof domains)[]).map((setKey) => {
      const address = createAllTogetherSetAddress(base.owner, 'option1', setKey);
      return Object.freeze({
        child: Object.freeze({
          kind: 'allTogetherSet' as const,
          address,
          marker: Object.freeze({
            address,
            assessment: 'assessed' as const,
            findingCount: 0,
            focusKey: `test-all-together-${setKey}`,
          }),
          optionKey: 'option1' as const,
          traitKey: 'AllElementalBoon',
          setKey,
          authoredComplete: false,
        }),
        forOffer: () => {
          allTogetherLoadableCount += 1;
          return Object.freeze({
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
          });
        },
        update: (
          draft: AuthoredTraitOfferTraits,
          result: import('@run-planner/engine/authored-project').AuthoredAllTogetherResult,
        ) => ({
          ...draft,
          options: Object.freeze([
            { ...draft.options[0]!, allTogetherResult: result },
            ...draft.options.slice(1),
          ]) as AuthoredTraitOfferTraits['options'],
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
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          children: Object.freeze([]),
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
            ? {
                children: Object.freeze(
                  allTogetherSets.map((child) =>
                    Object.freeze({
                      ...child,
                      child: Object.freeze({
                        ...child.child,
                        authoredComplete: draft.options[0]?.allTogetherResult !== undefined,
                      }),
                    }),
                  ),
                ),
              }
            : {}),
        }),
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[base.key, interaction]]),
    }) as unknown as WorkspaceInteractionCatalog;
    const user = userEvent.setup();
    const { rerender } = render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={base.owner}
          interactions={interactions as WorkspaceInteractionCatalog}
          onCommit={vi.fn()}
        />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(allTogetherLoadableCount).toBe(4);
    const rerenderCommit = vi.fn();
    rerender(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={base.owner}
          interactions={interactions as WorkspaceInteractionCatalog}
          onCommit={rerenderCommit}
        />
      </Provider>,
    );
    expect(allTogetherLoadableCount).toBe(4);
    await user.click(screen.getByRole('button', { name: 'Choose all grants' }));
    await user.click(await screen.findByText('Rallying Cry'));
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(await screen.findByText('Slow Cooker'));
    await user.click(await screen.findByText('Air Quality'));
    await user.click(await screen.findByText('Water Fitness'));
    expect(rerenderCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Apply complete outcome' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(rerenderCommit).toHaveBeenCalledTimes(1);
    expect(
      (rerenderCommit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits).options[0]?.allTogetherResult,
    ).toEqual({
      earth: 'ElementalOlympianDamageBoon',
      fire: 'ElementalBaseDamageBoon',
      air: 'ElementalDamageFloorBoon',
      water: 'ElementalHealthBoon',
    });
    application.dispose();
  });

  it('walks and saves all eight Natural Selection positions, then focuses the exact child', async () => {
    const application = createApplication();
    const project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('Natural Selection editor fixture is missing');
    const targetKeys = [
      'ApolloWeaponBoon',
      'ApolloSpecialBoon',
      'ApolloCastBoon',
      'ApolloSprintBoon',
    ];
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: base.giver.key,
      options: Object.freeze([
        Object.freeze({ traitKey: 'GoodStuffBoon', rarity: 'Duo' as const }),
        Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Epic' as const }),
        Object.freeze({ traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const result = createNaturalSelectionResultAddress(base.owner, 'option1');
    const seenPrefixes: string[][] = [];
    const natural = {
      child: Object.freeze({
        kind: 'naturalSelectionResult' as const,
        address: result,
        marker: Object.freeze({
          address: result,
          assessment: 'assessed' as const,
          findingCount: 0,
          focusKey: 'test-natural-selection',
        }),
        optionKey: 'option1' as const,
        traitKey: 'GoodStuffBoon',
        slotCount: 8,
        authoredComplete: false,
      }),
      forOffer: (draft: AuthoredTraitOfferTraits) => ({
        load: () => {
          const targets = [...(draft.options[0]?.naturalSelectionTargets ?? [])];
          seenPrefixes.push(targets);
          const next = targetKeys;
          return Object.freeze({
            complete: targets.length >= 8,
            nextTargetTraitKeys: Object.freeze(next),
            picker: pickerModel(next.map((traitKey) => ({ label: traitKey, value: traitKey }))),
            supported: true,
          });
        },
      }),
      intentFor: (offer: AuthoredTraitOffer) => base.intentFor(offer),
      traitLabel: (traitKey: string) => traitKey,
      update: (
        draft: AuthoredTraitOfferTraits,
        targets: NonNullable<
          import('@run-planner/engine/authored-project').AuthoredEchoLastRunBoonOption['naturalSelectionTargets']
        >,
      ) => ({
        ...draft,
        options: Object.freeze([
          { ...draft.options[0]!, naturalSelectionTargets: targets },
          ...draft.options.slice(1),
        ]) as AuthoredTraitOfferTraits['options'],
      }),
    };
    const interaction = Object.freeze({
      ...base,
      value,
      load: () =>
        Object.freeze([
          Object.freeze({
            value,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          children: Object.freeze([]),
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          ...(draft.kind === 'traits' && optionKey === 'option1'
            ? {
                children: Object.freeze([
                  Object.freeze({
                    ...natural,
                    child: Object.freeze({
                      ...natural.child,
                      authoredComplete: draft.options[0]?.naturalSelectionTargets !== undefined,
                    }),
                  }),
                ]),
              }
            : {}),
        }),
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[base.key, interaction]]),
    }) as unknown as WorkspaceInteractionCatalog;
    application.store.dispatch(semanticOwnerNavigated(result));
    const historyDepth = application.store.getState().projectWorkspace.history!.past.length;
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={interactions} target={base.owner} />
      </Provider>,
    );

    await waitFor(() =>
      expect(document.activeElement?.id).toBe(semanticOwnerControlElementId(result)),
    );
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(screen.getByRole('button', { name: 'Choose all targets' }));
    const authoredTargets = Array.from({ length: 8 }, (_, index) => targetKeys[index % 4]!);
    for (const targetKey of authoredTargets) {
      await user.click(screen.getByRole('option', { name: targetKey }));
    }
    expect(screen.getAllByRole('button', { name: /Position \d+:/ })).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(seenPrefixes).toContainEqual(authoredTargets.slice(0, 7));
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyDepth + 1,
    );
    application.store.dispatch(authoredProjectUndoRequested());
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(historyDepth);
    application.dispose();
  });

  it('keeps an engine-backed early-exhausted Natural Selection result compact and saveable', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('Natural Selection editor fixture is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: base.giver.key,
      options: Object.freeze([
        Object.freeze({ traitKey: 'GoodStuffBoon', rarity: 'Duo' as const }),
        Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Epic' as const }),
        Object.freeze({ traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const result = createNaturalSelectionResultAddress(base.owner, 'option1');
    const natural = {
      child: Object.freeze({
        kind: 'naturalSelectionResult' as const,
        address: result,
        marker: Object.freeze({
          address: result,
          assessment: 'assessed' as const,
          findingCount: 1,
          focusKey: 'test-natural-selection-early',
        }),
        optionKey: 'option1' as const,
        traitKey: 'GoodStuffBoon',
        slotCount: 8,
        authoredComplete: false,
      }),
      forOffer: (draft: AuthoredTraitOfferTraits) => ({
        load: () => {
          const targets = draft.options[0]?.naturalSelectionTargets ?? [];
          const next = targets.length >= 2 ? [] : ['ApolloWeaponBoon'];
          return Object.freeze({
            complete: targets.length >= 2,
            picker: pickerModel(next.map((traitKey) => ({ label: traitKey, value: traitKey }))),
          });
        },
      }),
      traitLabel: (traitKey: string) => traitKey,
      update: (
        draft: AuthoredTraitOfferTraits,
        targets: NonNullable<
          import('@run-planner/engine/authored-project').AuthoredEchoLastRunBoonOption['naturalSelectionTargets']
        >,
      ) => ({
        ...draft,
        options: Object.freeze([
          { ...draft.options[0]!, naturalSelectionTargets: targets },
          ...draft.options.slice(1),
        ]) as AuthoredTraitOfferTraits['options'],
      }),
    };
    const interaction = Object.freeze({
      ...base,
      value,
      load: () =>
        Object.freeze([
          Object.freeze({
            value,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          children: Object.freeze([]),
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          ...(draft.kind === 'traits' && optionKey === 'option1'
            ? {
                children: Object.freeze([
                  Object.freeze({
                    ...natural,
                    child: Object.freeze({
                      ...natural.child,
                      authoredComplete: draft.options[0]?.naturalSelectionTargets !== undefined,
                    }),
                  }),
                ]),
              }
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
    await user.click(screen.getByRole('button', { name: 'Choose all targets' }));
    await user.click(screen.getByRole('option', { name: 'ApolloWeaponBoon' }));
    await user.click(screen.getByRole('option', { name: 'ApolloWeaponBoon' }));
    expect(screen.getAllByRole('button', { name: /Position \d+:/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Position 3:/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(
      (commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits).options[0]?.naturalSelectionTargets,
    ).toEqual(['ApolloWeaponBoon', 'ApolloWeaponBoon']);
    application.dispose();
  });

  it('reopens a retained-invalid Natural position, preserves it as disabled, and saves one replacement offer', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('Natural Selection editor fixture is missing');
    const retained = 'ApolloWeaponBoon';
    const replacement = 'PoseidonWeaponBoon';
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: base.giver.key,
      options: Object.freeze([
        Object.freeze({
          traitKey: 'GoodStuffBoon',
          rarity: 'Duo' as const,
          naturalSelectionTargets: Object.freeze([retained]),
        }),
        Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Epic' as const }),
        Object.freeze({ traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const result = createNaturalSelectionResultAddress(base.owner, 'option1');
    const invalidRetainedPicker = Object.freeze({
      selected: Object.freeze({
        key: retained,
        label: 'Apollo Attack',
        value: retained,
        state: 'impossible' as const,
        selected: true,
        disabled: true,
        status: 'Current · unavailable',
      }),
      sections: Object.freeze([
        Object.freeze({
          key: 'selected-invalid',
          kind: 'selectedInvalid' as const,
          label: 'Current selection',
          collapsible: false,
          items: Object.freeze([
            Object.freeze({
              key: retained,
              label: 'Apollo Attack',
              value: retained,
              state: 'impossible' as const,
              selected: true,
              disabled: true,
            }),
          ]),
        }),
        Object.freeze({
          key: 'available',
          kind: 'category' as const,
          label: 'Available',
          collapsible: false,
          items: Object.freeze([
            Object.freeze({
              key: replacement,
              label: 'Poseidon Attack',
              value: replacement,
              state: 'possible' as const,
              selected: false,
              disabled: false,
            }),
          ]),
        }),
      ]),
    });
    const natural = {
      child: Object.freeze({
        kind: 'naturalSelectionResult' as const,
        address: result,
        marker: Object.freeze({
          address: result,
          assessment: 'assessed' as const,
          findingCount: 1,
          focusKey: 'test-natural-selection-retained',
        }),
        optionKey: 'option1' as const,
        traitKey: 'GoodStuffBoon',
        slotCount: 8,
        authoredComplete: false,
      }),
      forOffer: (draft: AuthoredTraitOfferTraits, retainedTargetKey?: string) => ({
        load: () => {
          const targets = draft.options[0]?.naturalSelectionTargets ?? [];
          return Object.freeze({
            complete: targets.length > 0,
            picker:
              targets.length === 0 && retainedTargetKey === retained
                ? invalidRetainedPicker
                : pickerModel([{ label: 'Poseidon Attack', value: replacement }]),
          });
        },
      }),
      traitLabel: (traitKey: string) =>
        ({
          ApolloWeaponBoon: 'Apollo Attack',
          PoseidonWeaponBoon: 'Poseidon Attack',
        })[traitKey] ?? traitKey,
      update: (
        draft: AuthoredTraitOfferTraits,
        targets: NonNullable<
          import('@run-planner/engine/authored-project').AuthoredEchoLastRunBoonOption['naturalSelectionTargets']
        >,
      ) => ({
        ...draft,
        options: Object.freeze([
          { ...draft.options[0]!, naturalSelectionTargets: targets },
          ...draft.options.slice(1),
        ]) as AuthoredTraitOfferTraits['options'],
      }),
    };
    const interaction = Object.freeze({
      ...base,
      value,
      load: () =>
        Object.freeze([
          Object.freeze({
            value,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          children: Object.freeze([]),
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          ...(draft.kind === 'traits' && optionKey === 'option1'
            ? {
                children: Object.freeze([
                  Object.freeze({
                    ...natural,
                    child: Object.freeze({
                      ...natural.child,
                      authoredComplete: draft.options[0]?.naturalSelectionTargets !== undefined,
                    }),
                  }),
                ]),
              }
            : {}),
        }),
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[base.key, interaction]]),
    }) as unknown as WorkspaceInteractionCatalog;
    const commit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor address={base.owner} interactions={interactions} onCommit={commit} />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Position 1: Apollo Attack' }));
    expect(
      screen.getByRole('button', { name: 'Position 1: Apollo Attack (retained)' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'Apollo Attack' }).getAttribute('aria-disabled'),
    ).toBe('true');
    await user.click(screen.getByRole('option', { name: 'Poseidon Attack' }));
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(
      (commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits).options[0]?.naturalSelectionTargets,
    ).toEqual([replacement]);
    application.dispose();
  });

  it('renders the selected Ransom preview from its derived assessment', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('Ransom editor fixture is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: base.giver.key,
      options: Object.freeze([
        Object.freeze({ traitKey: 'SuperSacrificeBoonZeus', rarity: 'Duo' as const }),
        Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'DemeterCastBoon', rarity: 'Common' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const interaction = Object.freeze({
      ...base,
      value,
      load: () =>
        Object.freeze([
          Object.freeze({
            value,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      feedbackFor: (draft: AuthoredTraitOffer) =>
        draft.kind !== 'traits' || draft.selectedOptionKey !== 'option1'
          ? Object.freeze([])
          : Object.freeze([
              Object.freeze({
                kind: 'ransom' as const,
                assessment: Object.freeze({
                  branchAgreement: true as const,
                  buffedTraitKeys: Object.freeze(['ZeusWeaponBoon']),
                  levelBonus: 4,
                  removedCount: 1,
                  removedTraitKeys: Object.freeze(['HeraWeaponBoon']),
                }),
              }),
            ]),
      traitLabel: (traitKey: string) =>
        ({ HeraWeaponBoon: 'Hera Attack', ZeusWeaponBoon: 'Zeus Attack' })[traitKey] ?? traitKey,
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[base.key, interaction]]),
    });
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={base.owner}
          interactions={interactions as WorkspaceInteractionCatalog}
          onCommit={() => undefined}
        />
      </Provider>,
    );
    expect(screen.getByRole('group', { name: 'Ransom preview' }).textContent).toContain(
      'Removes 1 opposing traits and grants +4 levels to Zeus Attack',
    );
    expect(screen.getByText('Removed: Hera Attack')).toBeTruthy();
    const selectedRadios = screen.getAllByRole('radio');
    await user.click(selectedRadios[1]!);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Ransom preview' })).toBeNull());
    await user.click(selectedRadios[0]!);
    expect(
      await screen.findByText('Removes 1 opposing traits and grants +4 levels to Zeus Attack'),
    ).toBeTruthy();
    application.dispose();
  });

  it('renders only the branch-variation message for a selected Ransom', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    );
    if (base === undefined) throw new Error('Ransom editor fixture is missing');
    const value: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: base.giver.key,
      options: Object.freeze([
        Object.freeze({ traitKey: 'SuperSacrificeBoonZeus', rarity: 'Duo' as const }),
        Object.freeze({ traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'DemeterCastBoon', rarity: 'Common' as const }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const interaction = Object.freeze({
      ...base,
      value,
      load: () =>
        Object.freeze([
          Object.freeze({
            value,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                supported: true,
              }),
            }),
          }),
        ]),
      feedbackFor: () =>
        Object.freeze([
          Object.freeze({
            kind: 'ransom' as const,
            assessment: Object.freeze({ branchAgreement: false as const }),
          }),
        ]),
      traitLabel: (traitKey: string) => traitKey,
    });
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={base.owner}
          interactions={
            Object.freeze({
              ...workspace.interactions,
              traitOffers: new Map([[base.key, interaction]]),
            }) as unknown as WorkspaceInteractionCatalog
          }
          onCommit={() => undefined}
        />
      </Provider>,
    );
    expect(screen.getByRole('group', { name: 'Ransom preview' }).textContent).toContain(
      'Ransom result differs across current route branches.',
    );
    expect(screen.queryByText(/Removes .* opposing traits/)).toBeNull();
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
      const workspace = application.selectStructuredWorkspace(application.store.getState())!;
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
        vowPickerFor: () =>
          pickerModel([Object.freeze({ label: 'Vow of Rivals', value: 'VowRivals' })]),
      });
      const circeChild = Object.freeze({
        ...control,
        kind: 'circeResolution' as const,
        traitKey: 'CirceTest',
        authoredComplete: true,
      });
      const interaction = Object.freeze({
        ...base,
        optionDomain: (value: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
          Object.freeze({
            children:
              value.kind !== 'traits' || value.selectedOptionKey !== optionKey
                ? Object.freeze([])
                : Object.freeze([
                    Object.freeze({
                      child: Object.freeze({
                        ...circeChild,
                        authoredComplete: value.options[0]?.circeResolution !== undefined,
                      }),
                      update: (
                        offer: AuthoredTraitOfferTraits,
                        resolution: AuthoredCirceResolution,
                      ) =>
                        Object.freeze({
                          ...offer,
                          options: Object.freeze([
                            Object.freeze({ ...offer.options[0]!, circeResolution: resolution }),
                            ...offer.options.slice(1),
                          ]) as AuthoredTraitOfferTraits['options'],
                        }),
                      forOffer: () => Object.freeze({ load: () => domain }),
                    }),
                  ]),
            load: () =>
              Object.freeze({
                candidates: Object.freeze([]),
                preferredOptionFor: () => undefined,
                rarityPickerFor: () => undefined,
                traitPicker: Object.freeze({ sections: Object.freeze([]) }),
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

      expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
        'disabled',
        true,
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
      expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
        'disabled',
        false,
      );
      await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
      const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
      const resolution = saved.options[0]?.circeResolution;
      expect(resolution).toBeDefined();
      if (effect === 'disableFear') {
        expect(resolution).toEqual({ kind: 'disableFear', vowKeys: ['VowRivals'] });
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
      Object.freeze({ kind: 'disableFear' as const, vowKeys: Object.freeze(['VowRivals']) }),
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
      const workspace = application.selectStructuredWorkspace(application.store.getState())!;
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
        vowPickerFor: () => unavailablePickerModel('Vow of Rivals', 'VowRivals'),
      });
      const circeChild = Object.freeze({
        ...control,
        kind: 'circeResolution' as const,
        traitKey: 'CirceTest',
        authoredComplete: true,
      });
      const interaction = Object.freeze({
        ...base,
        value,
        optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
          Object.freeze({
            children:
              draft.kind !== 'traits' || draft.selectedOptionKey !== optionKey
                ? Object.freeze([])
                : Object.freeze([
                    Object.freeze({
                      child: Object.freeze({
                        ...circeChild,
                        authoredComplete: draft.options[0]?.circeResolution !== undefined,
                      }),
                      update: (
                        offer: AuthoredTraitOfferTraits,
                        selected: AuthoredCirceResolution,
                      ) =>
                        Object.freeze({
                          ...offer,
                          options: Object.freeze([
                            Object.freeze({ ...offer.options[0]!, circeResolution: selected }),
                            ...offer.options.slice(1),
                          ]) as AuthoredTraitOfferTraits['options'],
                        }),
                      forOffer: () => Object.freeze({ load: () => domain }),
                    }),
                  ]),
            load: () =>
              Object.freeze({
                candidates: Object.freeze([]),
                preferredOptionFor: () => undefined,
                rarityPickerFor: () => undefined,
                traitPicker: Object.freeze({ sections: Object.freeze([]) }),
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
      } else if (effect !== 'activateArcana') {
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
        await userEvent
          .setup()
          .click(screen.getByRole('button', { name: 'Record no Arcana activation' }));
        expect(screen.queryByText(retainedText)).toBeNull();
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
});
