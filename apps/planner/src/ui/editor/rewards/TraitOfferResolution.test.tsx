// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  pickerModel,
  unavailablePickerModel,
} from '@planner-test/support/trait-offer-editor.test-support';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
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

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
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

afterEach(cleanup);

describe('resolution outcomes', () => {
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
                persephoneLevelBonusMaximums: Object.freeze([]),
                effectiveLevels: Object.freeze([]),
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
});
