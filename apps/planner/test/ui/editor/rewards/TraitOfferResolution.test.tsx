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
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  completeAuthoredEchoLastRunBoonDraft,
  updateAuthoredTraitCarrierChild,
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredEchoLastRunBoonOffer,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import {
  nextEchoLastRunBoonDraft,
  previousEchoLastRunBoonDraft,
} from '@run-planner/engine/simulation';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import type {
  WorkspaceEchoLastRunBoonDraftRow,
  WorkspaceInteractionCatalog,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { TraitOfferEditor } from '@planner/ui/editor/rewards/TraitOfferEditor';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);

describe('resolution outcomes', () => {
  it('renders the bound greatest-level Echo Pom domain and saves its exact target', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
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
      kind: 'echoPomTarget' as const,
      traitKey: 'EchoDoubleLevelBoon',
      authoredComplete: true,
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
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          children: Object.freeze(
            draft.kind !== 'traits' || draft.selectedOptionKey !== optionKey
              ? []
              : [
                  Object.freeze({
                    child: control,
                    update: (offer: AuthoredTraitOfferTraits, value: string | null) =>
                      updateAuthoredTraitCarrierChild(offer, {
                        kind: 'echoPomTarget',
                        child: control,
                        value,
                      }),
                    intentFor: () =>
                      Object.freeze({
                        command: Object.freeze({
                          kind: 'ReplaceTraitOffer' as const,
                          trait: base.owner,
                          value: draft,
                        }),
                      }),
                    targetLabel: (target: string | null) =>
                      target === 'ApolloWeaponBoon' ? 'Nova Strike' : String(target),
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
                ],
          ),
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
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
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
      kind: 'echoLastRunBoon' as const,
      traitKey: 'EchoLastRunBoon',
      authoredComplete: false,
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
      Object.freeze({ giverKey: 'Hera', traitKey: 'AllElementalBoon' }),
      Object.freeze({ giverKey: 'Demeter', traitKey: 'GoodStuffBoon' }),
    ]);
    const echoDomainLoads = vi.fn();
    const interaction = Object.freeze({
      ...base,
      value,
      optionDomain: (draft: AuthoredTraitOffer, optionKey: 'option1' | 'option2' | 'option3') =>
        Object.freeze({
          load: () =>
            Object.freeze({
              candidates: Object.freeze([]),
              preferredOptionFor: () => undefined,
              rarityPickerFor: () => undefined,
              traitPicker: Object.freeze({ sections: Object.freeze([]) }),
            }),
          children: Object.freeze(
            draft.kind !== 'traits' || draft.selectedOptionKey !== optionKey
              ? []
              : [
                  Object.freeze({
                    child: Object.freeze({
                      ...control,
                      authoredComplete:
                        'echoLastRunBoon' in draft.options[0]! &&
                        draft.options[0].echoLastRunBoon !== undefined,
                    }),
                    update: (
                      offer: AuthoredTraitOfferTraits,
                      value: AuthoredEchoLastRunBoonOffer,
                    ) =>
                      updateAuthoredTraitCarrierChild(offer, {
                        kind: 'echoLastRunBoon',
                        child: control,
                        value,
                      }),
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
                        const carrierForDraft = (
                          rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                          selectedIndex: number,
                        ) => ({
                          load: () => {
                            const selectedRow = rows[selectedIndex];
                            if (selectedRow?.identity?.traitKey === 'GoodStuffBoon') {
                              const placed = (selectedRow.naturalSelectionTargets ?? []).length > 0;
                              return {
                                kind: 'naturalSelection' as const,
                                slotCount: 2,
                                complete: placed,
                                supported: true,
                                rows: [
                                  {
                                    picker: pickerModel([
                                      { label: 'Nova Strike', value: 'ApolloWeaponBoon' },
                                      { label: 'Heaven Strike', value: 'ZeusWeaponBoon' },
                                    ]),
                                    requiresEarlierRow: false,
                                  },
                                  placed
                                    ? {
                                        picker: pickerModel([]),
                                        requiresEarlierRow: false,
                                        forcedTraitKey: 'ZeusWeaponBoon',
                                      }
                                    : { picker: pickerModel([]), requiresEarlierRow: true },
                                ],
                                ...(placed
                                  ? {
                                      completedTargets: ['ApolloWeaponBoon', 'ZeusWeaponBoon'],
                                      levelsLabel: 'Nova Strike ×1 · Heaven Strike ×1',
                                    }
                                  : {}),
                                traitLabel: (traitKey: string) =>
                                  traitKey === 'ApolloWeaponBoon'
                                    ? 'Nova Strike'
                                    : traitKey === 'ZeusWeaponBoon'
                                      ? 'Heaven Strike'
                                      : traitKey,
                              };
                            }
                            const result = selectedRow?.allTogetherResult;
                            const sets = [
                              ['earth', 'Earth Grant'],
                              ['fire', 'Fire Grant'],
                              ['air', 'Air Grant'],
                              ['water', 'Water Grant'],
                            ] as const;
                            return {
                              kind: 'allTogether' as const,
                              complete: sets.every(([setKey]) =>
                                Object.hasOwn(result ?? {}, setKey),
                              ),
                              sets: sets.map(([setKey, label]) => ({
                                setKey,
                                picker: pickerModel([
                                  Object.freeze({ label, value: `${setKey}Trait` }),
                                ]),
                                resultLabel: (result: string | null) =>
                                  result === `${setKey}Trait` ? label : String(result),
                              })),
                            };
                          },
                        });
                        return {
                          nextDraft: (
                            rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                            selectedIndex: number,
                          ) => {
                            const next = nextEchoLastRunBoonDraft(
                              identities.map((identity) => ({
                                option: { ...identity, rarity: 'Common' as const },
                                support: 'possible' as const,
                                branchSupport: [true],
                                targetRequired: false,
                                targetCandidates: [],
                              })),
                              rows.map(({ identity, ...payload }) => ({ ...payload, ...identity })),
                              selectedIndex,
                            );
                            return next === undefined
                              ? undefined
                              : { rows: [...rows, {}], selectedIndex: next.selectedIndex };
                          },
                          previousDraft: (
                            rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                            selectedIndex: number,
                          ) => {
                            const previous = previousEchoLastRunBoonDraft(rows, selectedIndex);
                            return previous === undefined
                              ? undefined
                              : {
                                  rows: rows.slice(0, previous.rows.length),
                                  selectedIndex: previous.selectedIndex,
                                };
                          },
                          completeDraft: (
                            rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                            selectedIndex: number,
                          ) =>
                            completeAuthoredEchoLastRunBoonDraft(
                              rows.map(({ identity, ...payload }) => ({ ...payload, ...identity })),
                              selectedIndex,
                            ),
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
                          effectiveLevelFor: () => 1,
                          traitLabel: (traitKey: string) => traitKey,
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
                                : identity.traitKey === 'AllElementalBoon'
                                  ? 'Hera · All Together'
                                  : identity.traitKey === 'GoodStuffBoon'
                                    ? 'Demeter · Natural Selection'
                                    : 'Aphrodite · Romantic Spark',
                          summaryFor: (nested: AuthoredEchoLastRunBoonOffer) => {
                            const selected = nested.options[optionIndex(nested.selectedOptionKey)];
                            return selected?.traitKey === 'BoonDecayBoon'
                              ? 'Hera · Bridal Glow · Heroic'
                              : selected?.traitKey === 'AllElementalBoon'
                                ? 'Hera · All Together · Legendary'
                                : selected?.traitKey === 'GoodStuffBoon'
                                  ? 'Demeter · Natural Selection · Duo'
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
                                sections: Object.freeze([
                                  ...invalid.sections,
                                  ...available.sections,
                                ]),
                              });
                            }
                            return pickerModel(
                              identity.traitKey === 'HighHealthOffenseBoon'
                                ? [
                                    Object.freeze({ label: 'Common', value: 'Common' as const }),
                                    Object.freeze({ label: 'Rare', value: 'Rare' as const }),
                                  ]
                                : identity.traitKey === 'AllElementalBoon'
                                  ? [
                                      Object.freeze({
                                        label: 'Legendary',
                                        value: 'Legendary' as const,
                                      }),
                                    ]
                                  : identity.traitKey === 'GoodStuffBoon'
                                    ? [
                                        Object.freeze({
                                          label: 'Duo',
                                          value: 'Duo' as const,
                                        }),
                                      ]
                                    : [
                                        Object.freeze({
                                          label:
                                            identity.traitKey === 'SprintEchoBoon'
                                              ? 'Duo'
                                              : 'Heroic',
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
                          carrierKindFor: (identity: {
                            readonly giverKey: string;
                            readonly traitKey: string;
                          }) =>
                            identity.traitKey === 'AllElementalBoon'
                              ? ('allTogether' as const)
                              : identity.traitKey === 'GoodStuffBoon'
                                ? ('naturalSelection' as const)
                                : undefined,
                          carrierForDraft,
                          naturalSelectionForDraft: (
                            rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                            selectedIndex: number,
                          ) => ({
                            load: () => {
                              const carrier = carrierForDraft(rows, selectedIndex).load();
                              return carrier.kind === 'naturalSelection' ? carrier : undefined;
                            },
                          }),
                          traitPickerFor: () =>
                            pickerModel(
                              identities.map((identity) =>
                                Object.freeze({
                                  label:
                                    identity.traitKey === 'HighHealthOffenseBoon'
                                      ? 'Aphrodite · Heart Breaker'
                                      : identity.traitKey === 'BoonDecayBoon'
                                        ? 'Hera · Bridal Glow'
                                        : identity.traitKey === 'AllElementalBoon'
                                          ? 'Hera · All Together'
                                          : identity.traitKey === 'GoodStuffBoon'
                                            ? 'Demeter · Natural Selection'
                                            : 'Aphrodite · Romantic Spark',
                                  value: identity,
                                }),
                              ),
                            ),
                        };
                      },
                    }),
                  }),
                ],
          ),
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
          onCommit={commit}
        />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Boon Boon Boon choice' }).textContent).toBe(
      'Choose a boon',
    );
    expect(screen.queryByRole('region', { name: 'Boon Boon Boon choice' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Boon Boon Boon choice' }));
    expect(screen.getByRole('heading', { name: 'Boon Boon Boon choice' })).toBeDefined();
    expect(rendered.container.querySelectorAll('input[name$="-selected"]')).toHaveLength(1);
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 1'));
    await user.click(await screen.findByText('Aphrodite · Heart Breaker'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Boon Boon Boon choice' }));
    expect(screen.getByLabelText('Boon Boon Boon outcome 1').textContent).toContain(
      'Choose a trait',
    );
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 1'));
    await user.click(await screen.findByText('Aphrodite · Heart Breaker'));
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 1 rarity'));
    await user.click(await screen.findByText('Common'));
    expect(screen.getByLabelText('Effective trait values').textContent).toBe(
      'Effective rarityCommonEffective level1',
    );
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 2'));
    await user.click(await screen.findByText('Hera · Bridal Glow'));
    expect(screen.queryByLabelText('Boon Boon Boon outcome 2 rarity')).toBeNull();
    const nestedRadios = rendered.container.querySelectorAll('input[name$="-selected"]');
    expect(nestedRadios).toHaveLength(2);
    await user.click(nestedRadios[1]!);
    await user.click(screen.getByLabelText('Boon Boon Boon selected trait target'));
    await user.click(await screen.findByText('Melting Point'));
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 3'));
    await user.click(await screen.findByText('Hera · All Together'));
    const selectedAfterAppend = rendered.container.querySelectorAll('input[name$="-selected"]');
    await user.click(selectedAfterAppend[2]!);
    for (const set of ['Earth', 'Fire', 'Air', 'Water']) {
      await user.click(screen.getByRole('button', { name: `All Together ${set}` }));
      await user.click(await screen.findByRole('option', { name: `${set} Grant` }));
    }
    await user.click(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' }));
    expect(screen.getByRole('button', { name: 'Boon Boon Boon choice' })).toBeDefined();
    // The nested Save writes into the offer draft; only the offer's Save commits.
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Boon Boon Boon choice' }));
    await user.click(screen.getByLabelText('Boon Boon Boon outcome 1'));
    await user.click(await screen.findByText('Demeter · Natural Selection'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
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
          {
            giverKey: 'Hera',
            traitKey: 'AllElementalBoon',
            rarity: 'Legendary',
            allTogetherResult: {
              earth: 'earthTrait',
              fire: 'fireTrait',
              air: 'airTrait',
              water: 'waterTrait',
            },
          },
        ],
        selectedOptionKey: 'option3',
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
            onCommit={commit}
          />
        </Provider>
      </StrictMode>
    );
    const retainedRendered = render(retainedInvalidEditor());
    await screen.findByText('Aphrodite · Heart Breaker · Rare');
    expect(echoDomainLoads).toHaveBeenCalledTimes(loadsBeforeOuterSummary + 1);
    retainedRendered.rerender(retainedInvalidEditor());
    expect(echoDomainLoads).toHaveBeenCalledTimes(loadsBeforeOuterSummary + 1);
    await user.click(screen.getByRole('button', { name: 'Boon Boon Boon choice' }));
    expect(screen.getByLabelText('Boon Boon Boon outcome 1 rarity').textContent).toContain('Rare');
    expect(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' })).toHaveProperty(
      'disabled',
      true,
    );
    retainedRendered.unmount();

    const naturalValue: AuthoredTraitOfferTraits = Object.freeze({
      ...value,
      options: Object.freeze([
        Object.freeze({
          traitKey: 'EchoLastRunBoon',
          echoLastRunBoon: Object.freeze({
            options: Object.freeze([
              Object.freeze({
                giverKey: 'Demeter',
                traitKey: 'GoodStuffBoon',
                rarity: 'Duo' as const,
              }),
            ] as const),
            selectedOptionKey: 'option1' as const,
          }),
        }),
        value.options[1],
        value.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const naturalInteraction = Object.freeze({ ...interaction, value: naturalValue });
    const naturalInteractions: WorkspaceInteractionCatalog = Object.freeze({
      ...interactions,
      traitOffers: new Map([[naturalInteraction.key, naturalInteraction]]),
    });
    commit.mockClear();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={naturalInteraction.owner}
          interactions={naturalInteractions}
          onCommit={commit}
        />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Boon Boon Boon choice' }));
    expect(screen.getByRole('button', { name: 'Natural Selection 2nd core' }).title).toBe(
      'Choose the 1st core first',
    );
    await user.click(screen.getByRole('button', { name: 'Natural Selection 1st core' }));
    await user.click(await screen.findByRole('option', { name: 'Nova Strike' }));
    // The forced last core completes the first pass, so the draft takes the whole allocation.
    expect(screen.getByLabelText('Natural Selection 2nd core').textContent).toBe('Heaven Strike');
    expect(screen.getByLabelText('Natural Selection levels').textContent).toBe(
      'Nova Strike ×1 · Heaven Strike ×1',
    );
    await user.click(screen.getByRole('button', { name: 'Save Boon Boon Boon choice' }));
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(commit).toHaveBeenCalledTimes(1);
    const naturalSaved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(naturalSaved.options[0]).toMatchObject({
      traitKey: 'EchoLastRunBoon',
      echoLastRunBoon: {
        options: [
          {
            giverKey: 'Demeter',
            traitKey: 'GoodStuffBoon',
            rarity: 'Duo',
            naturalSelectionTargets: ['ApolloWeaponBoon', 'ZeusWeaponBoon'],
          },
        ],
        selectedOptionKey: 'option1',
      },
    });
    application.dispose();
  });
});
