// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  createEchoLastRunBoonAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createStartingRewardAddress,
  createTraitOfferAddress,
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
import {
  semanticOwnerNavigated,
  traitOfferDialogClosed,
  traitOfferDialogOpened,
} from '@planner/state/editorSessionSlice';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceNaturalSelectionDomain,
} from '@planner/projections/structured-workspace';
import { TraitOfferDialog, TraitOfferEditor } from '@planner/ui/editor/rewards/TraitOfferEditor';
import { TraitOfferCirceResolution } from '@planner/ui/editor/rewards/TraitOfferCirceResolution';
import { TraitOfferSelectedOutcome } from '@planner/ui/editor/rewards/TraitOfferSelectedOutcome';
import {
  AllTogetherOutcomeRows,
  NaturalSelectionOutcomeRows,
} from '@planner/ui/editor/rewards/TraitOfferOutcomeRows';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import {
  FindingTargetScope,
  useFindingAnchor,
  useFindingMark,
} from '@planner/ui/feedback/useFindingTarget';
import {
  echoLastRunOptionControl,
  findingControlKey,
} from '@planner/projections/structured-workspace';
import { LoadedEchoLastRunBoonChoice } from '@planner/ui/editor/rewards/TraitOfferEchoLastRunBoon';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);

const circeKeyLabel = (key: string) =>
  ({ ArcanaSorceress: 'The Sorceress', ArcanaTitan: 'The Titan', VowRivals: 'Vow of Rivals' })[
    key
  ] ?? key;

// Three eligible cores; two placed cores force the third and complete the allocation.
function firstPassDomain(targets: readonly string[]) {
  const eligible = ['A', 'B', 'C'];
  const placed: string[] = [];
  for (const target of targets.slice(0, eligible.length)) {
    if (!eligible.includes(target) || placed.includes(target)) break;
    placed.push(target);
  }
  const rows = eligible.map((_, index) => {
    const available = eligible.filter((key) => !placed.slice(0, index).includes(key));
    const requiresEarlierRow = index > placed.length;
    return {
      picker: pickerModel(available.map((value) => ({ value, label: `Label ${value}` }))),
      requiresEarlierRow,
      ...(!requiresEarlierRow && available.length === 1 ? { forcedTraitKey: available[0]! } : {}),
    };
  });
  const order =
    placed.length >= 2 ? [...placed.slice(0, 2), rows[2]!.forcedTraitKey ?? placed[2]!] : undefined;
  return {
    complete: order !== undefined,
    rows,
    ...(order === undefined
      ? {}
      : { completedTargets: [...order, order[0]!, order[1]!], levelsLabel: 'levels' }),
  };
}

describe('per-row outcome pickers', () => {
  const traitLabel = (key: string) => `Label ${key}`;
  const naturalRows = (
    authored: readonly string[] | undefined,
    onSelect = vi.fn(),
    onClear = vi.fn(),
    loadableFor: (targets: readonly string[]) => {
      load: () => WorkspaceNaturalSelectionDomain | undefined;
    } = (targets) => ({ load: () => firstPassDomain(targets) }),
  ) => (
    <NaturalSelectionOutcomeRows
      authored={authored}
      controlId="natural"
      loadableFor={loadableFor}
      onClear={onClear}
      onSelect={onSelect}
      traitLabel={traitLabel}
    />
  );
  const core = (ordinal: string) =>
    screen.getByRole('button', { name: `Natural Selection ${ordinal} core` });

  it('holds first-pass picks locally until the engine completes the allocation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClear = vi.fn();
    render(naturalRows(undefined, onSelect, onClear));
    expect(core('2nd').title).toBe('Choose the 1st core first');
    await user.click(core('1st'));
    await user.click(screen.getByRole('option', { name: 'Label A' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
    expect(core('1st').textContent).toContain('Label A');
    expect(core('3rd').title).toBe('Choose the 2nd core first');
    await user.click(core('2nd'));
    await user.click(screen.getByRole('option', { name: 'Label B' }));
    expect(onSelect).toHaveBeenCalledWith(['A', 'B', 'C', 'A', 'B']);
  });

  it('shows an authored allocation as its first pass and clears the draft when a row reopens it', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(naturalRows(['A', 'B', 'C', 'A', 'B'], onSelect, onClear));
    expect(core('1st').textContent).toContain('Label A');
    expect(core('2nd').textContent).toContain('Label B');
    expect(screen.getByLabelText('Natural Selection 3rd core').textContent).toBe('Label C');
    expect(screen.getByLabelText('Natural Selection levels').textContent).toBe('levels');
    await user.click(core('1st'));
    await user.click(screen.getByRole('option', { name: 'Label C' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    rerender(naturalRows(undefined, onSelect, onClear));
    expect(core('1st').textContent).toContain('Label C');
    expect(core('2nd').textContent).not.toContain('Label');
  });

  it('seeds a single forced core only into an unresolved draft', () => {
    const single = () => ({
      load: () => ({
        complete: true,
        rows: [{ picker: pickerModel([]), requiresEarlierRow: false, forcedTraitKey: 'A' }],
        completedTargets: ['A', 'A'],
        levelsLabel: 'Label A ×2',
      }),
    });
    const onSelect = vi.fn();
    const { unmount } = render(naturalRows(undefined, onSelect, vi.fn(), single));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(['A', 'A']);
    unmount();
    const retained = vi.fn();
    render(naturalRows(['B'], retained, vi.fn(), single));
    expect(retained).not.toHaveBeenCalled();
  });

  it('marks a Natural Selection finding on its first row, never the group', () => {
    const application = createApplication();
    const owner = createNaturalSelectionResultAddress(
      createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1)),
        'source',
      ),
      'option1',
    );
    const finding = {
      code: 'naturalSelectionResultMissing' as const,
      origin: owner,
      evidence: {},
      phase: 'rewardGeneration' as const,
      severity: 'error' as const,
    };
    function Marked() {
      const anchor = useFindingAnchor();
      const mark = useFindingMark();
      return (
        <NaturalSelectionOutcomeRows
          authored={undefined}
          controlId="natural"
          findingAnchor={anchor(owner)}
          firstRowMark={mark(owner, 'outcomeFirstRow')}
          loadableFor={(targets) => ({ load: () => firstPassDomain(targets) })}
          onClear={() => undefined}
          onSelect={() => undefined}
          traitLabel={traitLabel}
        />
      );
    }
    render(
      <Provider store={application.store}>
        <FindingTargetScope
          findings={new Map([[findingControlKey(owner, 'outcomeFirstRow'), [finding]]])}
        >
          <Marked />
        </FindingTargetScope>
      </Provider>,
    );
    expect(
      [...document.querySelectorAll('[data-has-findings="true"]')].map((element) =>
        element.getAttribute('aria-label'),
      ),
    ).toEqual(['Natural Selection 1st core']);
    application.dispose();
  });

  it('marks an unavailable Boon Boon Boon outcome on its own row picker', async () => {
    const application = createApplication();
    const echoOwner = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
        'Encounter',
      ),
      'selection',
    );
    const unavailable = { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' } as const;
    let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          {
            traitKey: 'EchoLastRunBoon',
            echoLastRunBoon: {
              options: [
                unavailable,
                { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
              ],
              selectedOptionKey: 'option2',
            },
          },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const interaction = workspace.interactions.traitOffers.get(semanticAddressKey(echoOwner));
    if (interaction?.value?.kind !== 'traits') throw new Error('Echo offer is missing');
    const child = createEchoLastRunBoonAddress(echoOwner, 'option1');
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'echoLastRunBoonOptionUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(child),
      );
    if (finding === undefined) throw new Error('Boon Boon Boon finding is missing');
    render(
      <Provider store={application.store}>
        <FindingTargetScope
          findings={
            new Map([[findingControlKey(child, echoLastRunOptionControl(unavailable)), [finding]]])
          }
        >
          <LoadedEchoLastRunBoonChoice
            interaction={interaction}
            offer={interaction.value}
            onBack={() => undefined}
            onComplete={() => undefined}
          />
        </FindingTargetScope>
      </Provider>,
    );
    await screen.findByRole('region', { name: 'Boon Boon Boon choice' });
    expect(
      [...document.querySelectorAll('[data-has-findings="true"]')].map((element) =>
        element.getAttribute('aria-label'),
      ),
    ).toEqual(['Boon Boon Boon outcome 1']);
    application.dispose();
  });

  it('labels authored targets from the projection when the domain publishes no rows', () => {
    render(naturalRows(['A', 'B'], vi.fn(), vi.fn(), () => ({ load: () => undefined })));
    expect(screen.getByText('Label A · Label B')).toBeTruthy();
  });

  it('holds partial All Together rows and saves the complete result, then each row change', async () => {
    const user = userEvent.setup();
    const rows = (['earth', 'fire'] as const).map((setKey) => ({
      controlId: setKey,
      loadable: {
        load: () => ({
          picker: pickerModel([`${setKey}-grant`].map((value) => ({ value, label: value }))),
        }),
      },
      resultLabel: (result: string | null) => `Label ${result}`,
      setKey,
    }));
    const onSelect = vi.fn();
    const view = (
      authored?: import('@run-planner/engine/authored-project').AuthoredAllTogetherResult,
    ) => <AllTogetherOutcomeRows authored={authored} onSelect={onSelect} rows={rows} />;
    const { rerender } = render(view());
    await user.click(screen.getByRole('button', { name: 'All Together Earth' }));
    await user.click(screen.getByRole('option', { name: 'earth-grant' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'All Together Earth' }).textContent).toContain(
      'Label earth-grant',
    );
    await user.click(screen.getByRole('button', { name: 'All Together Fire' }));
    await user.click(screen.getByRole('option', { name: 'fire-grant' }));
    expect(onSelect).toHaveBeenLastCalledWith({ earth: 'earth-grant', fire: 'fire-grant' });
    const authored = {
      earth: 'earth-grant',
      fire: 'fire-grant',
    } as unknown as import('@run-planner/engine/authored-project').AuthoredAllTogetherResult;
    rerender(view(authored));
    await user.click(screen.getByRole('button', { name: 'All Together Fire' }));
    await user.click(screen.getByRole('option', { name: 'fire-grant' }));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});

describe('selected outcomes', () => {
  it('renders Latest Model as one bound picker row per Hammer', async () => {
    const user = userEvent.setup();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    )!;
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Icarus',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'UpgradeHammerBoon' },
        { traitKey: 'OmegaExplodeBoon' },
        { traitKey: 'CastHazardBoon' },
      ],
    };
    const first = 'StaffDoubleAttackTrait';
    const second = 'StaffFastSpecialTrait';
    const child = base
      .optionDomain(value, 'option1')
      .children.find((entry) => entry.child.kind === 'latestModelTargets');
    if (child?.child.kind !== 'latestModelTargets') throw new Error('Latest Model child missing');
    const label = (key: string) => application.catalog.traits.byKey[key]!.label;
    const domainFor = (offer: AuthoredTraitOfferTraits) => ({
      requiredCount: 2,
      branchAgreement: true,
      hammers: [
        {
          picker: pickerModel([{ value: first, label: label(first) }]),
          requiresEarlierRow: false,
          valueByTraitKey: { [first]: [first] as [string] },
        },
        {
          picker: pickerModel([{ value: second, label: label(second) }]),
          requiresEarlierRow: offer.options[0]?.icarusHammerTargets === undefined,
          valueByTraitKey: { [second]: [first, second] as [string, string] },
        },
      ],
    });
    const interaction = {
      ...base,
      optionDomain: (
        offer: AuthoredTraitOfferTraits,
        key: Parameters<typeof base.optionDomain>[1],
      ) => ({
        ...base.optionDomain(offer, key),
        children: [
          {
            ...child,
            forOffer: (offer: AuthoredTraitOfferTraits) => ({ load: () => domainFor(offer) }),
          },
        ],
      }),
    } as typeof base;
    const onUpdate = vi.fn();
    const view = (offer: AuthoredTraitOfferTraits) => (
      <Provider store={application.store}>
        <TraitOfferSelectedOutcome
          interaction={interaction}
          value={offer}
          onUpdate={onUpdate}
          onOpenEchoLastRunBoon={() => undefined}
        />
      </Provider>
    );
    const { rerender } = render(view(value));
    const hammer2 = await screen.findByRole('button', { name: 'Latest Model Hammer 2' });
    expect(hammer2).toHaveProperty('disabled', true);
    expect(hammer2.title).toBe('Choose Hammer 1 first');
    await user.click(screen.getByRole('button', { name: 'Latest Model Hammer 1' }));
    await user.click(screen.getByRole('option', { name: label(first) }));
    const saved = onUpdate.mock.calls.at(-1)![0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]?.icarusHammerTargets).toEqual([first]);
    rerender(view(saved));
    await user.click(screen.getByRole('button', { name: 'Latest Model Hammer 2' }));
    await user.click(screen.getByRole('option', { name: label(second) }));
    expect(onUpdate.mock.calls.at(-1)![0].options[0].icarusHammerTargets).toEqual([first, second]);
  });

  it('keeps a Circe draft across a context change, follows its outcome, and closes with the trait dialog', async () => {
    const application = createApplication();
    const user = userEvent.setup();
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      'source',
    );
    const address = createCirceResolutionAddress(trait, 'option1');
    const arcanaPicker = pickerModel([
      Object.freeze({ label: 'The Sorceress', value: 'ArcanaSorceress' }),
      Object.freeze({ label: 'The Titan', value: 'ArcanaTitan' }),
    ]);
    const domain = () =>
      Object.freeze({
        resultRarity: 'Epic' as const,
        arcanaCards: [
          { key: 'ArcanaSorceress', label: 'The Sorceress', rarity: null },
          { key: 'ArcanaTitan', label: 'The Titan', rarity: null },
        ],
        arcanaPicker,
        arcanaPickerFor: () => arcanaPicker,
        branchAgreement: true,
        effect: 'activateArcana' as const,
        outerAvailable: true,
        requiredCount: 2,
        vowPicker: arcanaPicker,
        vowPickerFor: () => arcanaPicker,
      });
    const view = (
      currentDomain: ReturnType<typeof domain>,
      option: AuthoredTraitOfferTraits['options'][number],
    ) => (
      <Provider store={application.store}>
        <TraitOfferCirceResolution
          keyLabel={circeKeyLabel}
          address={address}
          controlId="circe-lifecycle"
          domain={currentDomain}
          onSelect={() => undefined}
          option={option}
        />
      </Provider>
    );
    const option = Object.freeze({ traitKey: 'RandomArcanaTrait' });
    act(() => application.store.dispatch(traitOfferDialogOpened(trait)));
    const { rerender } = render(view(domain(), option));
    await user.click(screen.getByLabelText('Red Citrine Arcana'));
    expect(application.store.getState().editorSession.circeDialogTarget).toEqual(address);
    await user.click(screen.getByText('The Sorceress'));
    const pressed = () =>
      within(screen.getByRole('dialog'))
        .queryAllByRole('button', { pressed: true })
        .map((card) => card.textContent);
    expect(pressed()).toEqual([expect.stringContaining('The Sorceress')]);

    // A new domain for the same outcome is a context change: the draft stays.
    rerender(view(domain(), option));
    expect(pressed()).toEqual([expect.stringContaining('The Sorceress')]);

    // A changed outcome in the trait draft replaces the Circe draft.
    rerender(
      view(
        domain(),
        Object.freeze({
          ...option,
          circeResolution: { kind: 'activateArcana' as const, arcanaKeys: ['ArcanaTitan'] },
        }),
      ),
    );
    expect(pressed()).toEqual([expect.stringContaining('The Titan')]);

    act(() => application.store.dispatch(traitOfferDialogClosed()));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(application.store.getState().editorSession.circeDialogTarget ?? null).toBeNull();
    application.dispose();
  });

  it('resets an incomplete Circe Arcana draft when the resolution effect changes', async () => {
    const application = createApplication();
    const circeAddress = createCirceResolutionAddress(
      createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
        'source',
      ),
      'option1',
    );
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const arcanaPicker = pickerModel([
      Object.freeze({ label: 'The Sorceress', value: 'ArcanaSorceress' }),
      Object.freeze({ label: 'The Titan', value: 'ArcanaTitan' }),
    ]);
    const vowPicker = pickerModel([Object.freeze({ label: 'Vow of Rivals', value: 'VowRivals' })]);
    const option = Object.freeze({ traitKey: 'RandomArcanaTrait' });
    const activation = Object.freeze({
      resultRarity: 'Epic' as const,
      arcanaCards: [
        { key: 'ArcanaSorceress', label: 'The Sorceress', rarity: null },
        { key: 'ArcanaTitan', label: 'The Titan', rarity: null },
      ],
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
      <Provider store={application.store}>
        <TraitOfferCirceResolution
          keyLabel={circeKeyLabel}
          address={circeAddress}
          controlId="circe-effect-switch"
          domain={activation}
          onSelect={onSelect}
          option={option}
        />
      </Provider>,
    );
    await user.click(screen.getByLabelText('Red Citrine Arcana'));
    await user.click(screen.getByText('The Sorceress'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    rerender(
      <Provider store={application.store}>
        <TraitOfferCirceResolution
          keyLabel={circeKeyLabel}
          address={circeAddress}
          controlId="circe-effect-switch"
          domain={fear}
          onSelect={onSelect}
          option={option}
        />
      </Provider>,
    );
    await user.click(screen.getByLabelText('Black Night Vow'));
    await user.click(screen.getByText('Vow of Rivals'));
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog', { name: 'Black Night Vow' })).toBeNull();
    expect(onSelect).toHaveBeenLastCalledWith({ kind: 'disableFear', vowKeys: ['VowRivals'] });
    application.dispose();
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
        resultLabel: (result: string | null) =>
          result === null
            ? 'No grant'
            : (application.catalog.traits.byKey[result]?.label ?? result),
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
    const grant = async (set: string, label: string) => {
      await user.click(screen.getByRole('button', { name: `All Together ${set}` }));
      await user.click(await screen.findByRole('option', { name: label }));
    };
    // Each set is its own row; the draft takes the result once all four are chosen.
    await grant('Earth', 'Rallying Cry');
    expect(screen.getByRole('button', { name: 'All Together Earth' }).textContent).toContain(
      'Rallying Cry',
    );
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      true,
    );
    await grant('Fire', 'Slow Cooker');
    await grant('Air', 'Air Quality');
    await grant('Water', 'Water Fitness');
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

  it('walks the Natural Selection first pass, saves the completed allocation and focuses the exact child', async () => {
    const application = createApplication();
    const project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
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
    const allocation = Array.from({ length: 8 }, (_, index) => targetKeys[index % 4]!);
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
          // Three placed cores force the fourth and complete the eight-level allocation.
          const placed = targets.slice(0, 3);
          const rows = targetKeys.map((_, index) => {
            const available = targetKeys.filter((key) => !placed.slice(0, index).includes(key));
            const open = index <= placed.length;
            return {
              picker: pickerModel(
                available.map((traitKey) => ({ label: traitKey, value: traitKey })),
              ),
              requiresEarlierRow: !open,
              ...(open && available.length === 1 ? { forcedTraitKey: available[0]! } : {}),
            };
          });
          const complete = placed.length === 3;
          return Object.freeze({
            complete,
            rows,
            ...(complete ? { completedTargets: allocation, levelsLabel: 'allocation' } : {}),
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
    for (const [position, ordinal] of ['1st', '2nd', '3rd'].entries()) {
      await user.click(screen.getByRole('button', { name: `Natural Selection ${ordinal} core` }));
      await user.click(screen.getByRole('option', { name: targetKeys[position]! }));
      // A partial first pass leaves the draft without targets, so Save stays disabled.
      if (position < 2)
        expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
          'disabled',
          true,
        );
    }
    expect(screen.getByLabelText('Natural Selection 4th core').textContent).toBe(targetKeys[3]);
    expect(screen.getByLabelText('Natural Selection levels').textContent).toBe('allocation');
    expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
      'disabled',
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(seenPrefixes).toContainEqual(targetKeys.slice(0, 3));
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyDepth + 1,
    );
    application.store.dispatch(authoredProjectUndoRequested());
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(historyDepth);
    application.dispose();
  });

  it('saves an engine-completed Natural Selection allocation shorter than its levels', async () => {
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
          const placed = (draft.options[0]?.naturalSelectionTargets ?? []).length > 0;
          return Object.freeze({
            complete: placed,
            rows: [
              {
                picker: pickerModel(
                  ['ApolloWeaponBoon', 'ZeusWeaponBoon'].map((value) => ({ label: value, value })),
                ),
                requiresEarlierRow: false,
              },
              placed
                ? {
                    picker: pickerModel([{ label: 'ZeusWeaponBoon', value: 'ZeusWeaponBoon' }]),
                    requiresEarlierRow: false,
                    forcedTraitKey: 'ZeusWeaponBoon',
                  }
                : { picker: pickerModel([]), requiresEarlierRow: true },
            ],
            ...(placed
              ? { completedTargets: ['ApolloWeaponBoon', 'ZeusWeaponBoon', 'ApolloWeaponBoon'] }
              : {}),
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
    await user.click(screen.getByRole('button', { name: 'Natural Selection 1st core' }));
    await user.click(screen.getByRole('option', { name: 'ApolloWeaponBoon' }));
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(
      (commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits).options[0]?.naturalSelectionTargets,
    ).toEqual(['ApolloWeaponBoon', 'ZeusWeaponBoon', 'ApolloWeaponBoon']);
    application.dispose();
  });

  it('seeds the draft with the forced allocation of a single eligible core', async () => {
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
          void draft;
          return Object.freeze({
            complete: true,
            rows: [
              {
                picker: pickerModel([{ label: 'ZeusWeaponBoon', value: 'ZeusWeaponBoon' }]),
                requiresEarlierRow: false,
                forcedTraitKey: 'ZeusWeaponBoon',
              },
            ],
            completedTargets: ['ZeusWeaponBoon', 'ZeusWeaponBoon'],
            levelsLabel: 'ZeusWeaponBoon ×2',
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
    expect(screen.getByLabelText('Natural Selection 1st core').textContent).toBe('ZeusWeaponBoon');
    expect(screen.getByLabelText('Natural Selection levels').textContent).toBe('ZeusWeaponBoon ×2');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save trait offer' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(
      (commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits).options[0]?.naturalSelectionTargets,
    ).toEqual(['ZeusWeaponBoon', 'ZeusWeaponBoon']);
    application.dispose();
  });

  it('shows a retained-invalid Natural target as unavailable and saves the replacement allocation', async () => {
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
      forOffer: (draft: AuthoredTraitOfferTraits) => ({
        load: () => {
          const target = draft.options[0]?.naturalSelectionTargets?.[0];
          return Object.freeze({
            complete: target === replacement,
            rows: [
              {
                picker:
                  target === retained
                    ? invalidRetainedPicker
                    : pickerModel([{ label: 'Poseidon Attack', value: replacement }]),
                requiresEarlierRow: false,
              },
            ],
            ...(target === replacement ? { completedTargets: [replacement] } : {}),
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
    const position1 = screen.getByRole('button', { name: 'Natural Selection 1st core' });
    expect(position1.textContent).toContain('Apollo Attack');
    await user.click(position1);
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
    expect(screen.getByRole('group', { name: 'Ransom preview' }).textContent).toBe(
      'EffectRemoves Hera Attack · +4 levels to Zeus Attack',
    );
    const selectedRadios = screen.getAllByRole('radio');
    await user.click(selectedRadios[1]!);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Ransom preview' })).toBeNull());
    await user.click(selectedRadios[0]!);
    expect(await screen.findByText('Removes Hera Attack · +4 levels to Zeus Attack')).toBeTruthy();
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
    // Branch disagreement is dialog feedback; the preview keeps its static shape.
    const message = screen.getByText('Ransom result differs across current route branches.');
    expect(screen.getByRole('status', { name: 'Offer feedback' }).contains(message)).toBe(true);
    const preview = screen.getByRole('group', { name: 'Ransom preview' });
    expect(preview.contains(message)).toBe(false);
    expect(within(preview).getByLabelText('Not applicable').textContent).toBe('—');
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
        resultRarity:
          effect === 'disableFear'
            ? null
            : effect === 'promoteArcana'
              ? ('Heroic' as const)
              : ('Epic' as const),
        arcanaCards: [
          { key: 'ArcanaSorceress', label: 'The Sorceress', rarity: null },
          { key: 'ArcanaTitan', label: 'The Titan', rarity: null },
        ],
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
                      keyLabel: circeKeyLabel,
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
      }
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      await user.click(
        screen.getByRole('button', {
          name: effect === 'promoteArcana' ? 'Promoted Arcana' : label,
        }),
      );
      const effectDialog = screen.getByRole('dialog');
      expect(within(effectDialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
      const savedSelectionCount = within(effectDialog).getAllByRole('button', {
        pressed: true,
      }).length;
      await user.click(within(effectDialog).getByRole('button', { name: 'Clear' }));
      expect(within(effectDialog).queryAllByRole('button', { pressed: true })).toHaveLength(0);
      expect(
        (within(effectDialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      await user.click(within(effectDialog).getByRole('button', { name: 'Cancel' }));
      expect(document.activeElement).toBe(
        screen.getByRole('button', {
          name: effect === 'promoteArcana' ? 'Promoted Arcana' : label,
        }),
      );
      await user.click(
        screen.getByRole('button', {
          name: effect === 'promoteArcana' ? 'Promoted Arcana' : label,
        }),
      );
      expect(
        within(screen.getByRole('dialog')).getAllByRole('button', { pressed: true }),
      ).toHaveLength(savedSelectionCount);
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
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
      cleanup();
      application.store.dispatch(traitOfferDialogOpened(interaction.owner));
      render(
        <Provider store={application.store}>
          <TraitOfferDialog interactions={interactions} target={interaction.owner} />
        </Provider>,
      );
      const launcher = screen.getByRole('button', {
        name: effect === 'promoteArcana' ? 'Promoted Arcana' : label,
      });
      await user.click(launcher);
      expect(screen.getAllByRole('dialog')).toHaveLength(2);
      const sessionBeforeEscape = application.store.getState().editorSession;
      await user.keyboard('{Escape}');
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      // The nested Escape closes only the Circe draft; the trait dialog stays open.
      const sessionAfterEscape = application.store.getState().editorSession;
      expect(sessionAfterEscape.traitDialogTarget).toBe(sessionBeforeEscape.traitDialogTarget);
      expect(sessionAfterEscape.openDraftEditors).toBe(sessionBeforeEscape.openDraftEditors - 1);
      expect(document.activeElement).toBe(launcher);
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
        resultRarity:
          effect === 'disableFear'
            ? null
            : effect === 'promoteArcana'
              ? ('Heroic' as const)
              : ('Epic' as const),
        arcanaCards: [
          { key: 'ArcanaSorceress', label: 'The Sorceress', rarity: null },
          { key: 'ArcanaTitan', label: 'The Titan', rarity: null },
        ],
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
                      keyLabel: circeKeyLabel,
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
        expect(screen.getAllByText(retainedText).length).toBeGreaterThan(0);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Promoted Arcana' }));
        expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
          true,
        );
      } else if (effect !== 'activateArcana') {
        const retained = screen.getByLabelText(controlLabel);
        expect(retained.textContent).toContain(retainedText);
        expect(retained.getAttribute('aria-invalid')).toBe('true');
      }
      if (effect === 'activateArcana') {
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Red Citrine Arcana' }));
        const popup = screen.getByRole('dialog', { name: 'Red Citrine Arcana' });
        for (const selected of within(popup).getAllByRole('button', { pressed: true })) {
          await user.click(selected);
        }
        await user.click(within(popup).getByRole('button', { name: 'Save' }));
        expect(screen.queryByRole('dialog', { name: 'Red Citrine Arcana' })).toBeNull();
        expect(screen.queryByText(retainedText)).toBeNull();
      }
      // Unavailability is dialog feedback, not text inside the Circe control group.
      const feedback = screen.getByRole('status', { name: 'Offer feedback' });
      const circeGroup = screen
        .getByRole('button', { name: controlLabel })
        .closest<HTMLElement>('.trait-outcome-row');
      expect(circeGroup?.hidden).toBe(false);
      if (!outerAvailable) {
        const message = screen.getByText('This Circe trait has no available outcome here.');
        expect(feedback.contains(message)).toBe(true);
        expect(circeGroup?.contains(message)).toBe(false);
      }
      if (!branchAgreement) {
        const message = within(feedback).getByText(
          'No outcome is supported across every route branch.',
        );
        expect(circeGroup?.contains(message)).toBe(false);
        // An open Circe dialog repeats the reason its Save is disabled.
        if (effect === 'promoteArcana')
          expect(screen.getByRole('status', { name: 'Circe feedback' }).textContent).toContain(
            'No outcome is supported across every route branch.',
          );
      }
      application.dispose();
    },
  );

  it('reports Latest Model branch disagreement in the offer feedback region, not above its picker', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind !== 'hammer',
    )!;
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Icarus',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'UpgradeHammerBoon' },
        { traitKey: 'OmegaExplodeBoon' },
        { traitKey: 'CastHazardBoon' },
      ],
    };
    const child = base
      .optionDomain(value, 'option1')
      .children.find((entry) => entry.child.kind === 'latestModelTargets');
    if (child?.child.kind !== 'latestModelTargets') throw new Error('Latest Model child missing');
    const domain = {
      requiredCount: 2,
      branchAgreement: false,
      hammers: [pickerModel([]), pickerModel([])].map((picker) => ({
        picker,
        requiresEarlierRow: false,
        valueByTraitKey: {},
      })),
    };
    const interaction = {
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
      optionDomain: (
        offer: AuthoredTraitOfferTraits,
        key: Parameters<typeof base.optionDomain>[1],
      ) => ({
        ...base.optionDomain(offer, key),
        children: [{ ...child, forOffer: () => ({ load: () => domain }) }],
      }),
    } as typeof base;
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
    const picker = await screen.findByLabelText('Latest Model Hammer 1');
    expect((picker as HTMLButtonElement).disabled).toBe(true);
    const message = screen.getByText('No target count is supported across every route branch.');
    const feedback = screen.getByRole('status', { name: 'Offer feedback' });
    expect(feedback.contains(message)).toBe(true);
    expect(feedback.textContent).not.toContain('No current findings.');
    expect(screen.getByRole('region', { name: 'Selected trait outcome' }).contains(message)).toBe(
      false,
    );
    application.dispose();
  });

  it('reports an unassessable retained Stone outcome in the offer feedback region and keeps its clear action', async () => {
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
    const base = workspace.interactions.traitOffers.get(semanticAddressKey(address))!;
    // The retained Stone result has no assessable domain in this route context.
    const interaction = {
      ...base,
      optionDomain: (
        offer: AuthoredTraitOfferTraits,
        key: Parameters<typeof base.optionDomain>[1],
      ) => {
        const domain = base.optionDomain(offer, key);
        return {
          ...domain,
          children: domain.children.map((entry) =>
            entry.child.kind === 'concaveStone'
              ? { ...entry, forOffer: () => ({ load: () => undefined }) }
              : entry,
          ),
        };
      },
    } as typeof base;
    const user = userEvent.setup();
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
    const stone = await screen.findByRole('group', { name: 'Concave Stone outcome' });
    const message = await screen.findByText(
      'This retained Stone outcome cannot be assessed in the current route context.',
    );
    expect(screen.getByRole('status', { name: 'Offer feedback' }).contains(message)).toBe(true);
    expect(stone.contains(message)).toBe(false);
    const clear = within(stone).getByRole('button', {
      name: 'Clear retained Concave Stone result',
    });
    await user.click(clear);
    await waitFor(() =>
      expect(
        screen.queryByText(
          'This retained Stone outcome cannot be assessed in the current route context.',
        ),
      ).toBeNull(),
    );
    expect(screen.getByRole('status', { name: 'Offer feedback' }).textContent).toContain(
      'No current findings.',
    );
    application.dispose();
  });
});
