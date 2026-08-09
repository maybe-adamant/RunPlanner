// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import {
  simulateProject,
  traitCandidates,
  type ReachedTraitOfferEvaluation,
} from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Proper Upbringing product loop', () => {
  it('repairs a stale Common offer after a natural Proper Upbringing activation', async () => {
    const application = createApplication();
    const original = createGoldenFGHIProject();
    let authored = original;
    let prepared: ReturnType<typeof simulateProject>;
    const locateTrace = (
      evaluation: ReturnType<typeof simulateProject>,
      address: ReachedTraitOfferEvaluation['address'],
      role: string,
    ) =>
      evaluation.routes
        .flatMap((route) => route.biomes)
        .flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : []))
        .flatMap((branch) => branch.traitEvaluations ?? [])
        .find(
          (trace) =>
            semanticAddressKey(trace.address) === semanticAddressKey(address) &&
            trace.acquisitionRole === role,
        );
    const rewriteWithGiver = (
      trace: ReachedTraitOfferEvaluation,
      giverKey: string,
      preferredTraitKey: string,
    ) => {
      const context = { ...trace.context, resolvedProviderKey: giverKey };
      const candidates = traitCandidates(
        application.catalog,
        giverKey,
        trace.before,
        context,
      ).filter(
        (candidate) =>
          candidate.available &&
          (candidate.rarity === undefined ||
            candidate.rarity === 'Common' ||
            candidate.rarity === 'Rare' ||
            candidate.rarity === 'Epic' ||
            candidate.rarity === 'Legendary'),
      );
      const uniqueCandidates = candidates.filter(
        (candidate, index, all) =>
          all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
      );
      const preferred = uniqueCandidates.find(
        (candidate) => candidate.traitKey === preferredTraitKey,
      );
      if (preferred === undefined) throw new Error(`Missing ${preferredTraitKey} candidate`);
      const options = [
        preferred,
        ...uniqueCandidates.filter((candidate) => candidate.traitKey !== preferredTraitKey),
      ].slice(0, 3);
      if (options.length !== 3) throw new Error(`Insufficient ${giverKey} candidates`);
      return applyProjectCommand(authored, application.catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(
          trace.address as TraitOfferOwnerAddress,
          trace.acquisitionRole,
        ),
        value: {
          giverKey,
          options: options.map((candidate) => ({
            traitKey: candidate.traitKey,
            ...(candidate.rarity === undefined ? {} : { rarity: candidate.rarity }),
          })) as [
            { readonly traitKey: string; readonly rarity?: TraitRarity },
            { readonly traitKey: string; readonly rarity?: TraitRarity },
            { readonly traitKey: string; readonly rarity?: TraitRarity },
          ],
          selectedOptionKey: 'option1',
        },
      });
    };
    const heraOfferPlan = [
      {
        address: createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1)),
        role: 'source',
        traitKey: 'HeraCastBoon',
      },
      {
        address: createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1)),
        role: 'source',
        traitKey: 'OmegaHeraProjectileBoon',
      },
      {
        address: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
        role: 'source',
        traitKey: 'DamageSharePotencyBoon',
      },
      {
        address: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(6, 1)),
        role: 'source',
        traitKey: 'HeraSprintBoon',
      },
      {
        address: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(7, 1)),
        role: 'source',
        traitKey: 'AllElementalBoon',
      },
    ] as const;
    for (const plan of heraOfferPlan) {
      authored = applyProjectCommand(authored, application.catalog, {
        kind: 'ReplaceIncomingReward',
        reward: plan.address,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
      });
      prepared = simulateProject(application.catalog, authored);
      const trace = locateTrace(prepared, plan.address, plan.role);
      if (trace === undefined)
        throw new Error(`Hera preparation offer was not reached: ${plan.role}`);
      authored = rewriteWithGiver(trace, 'Hera', plan.traitKey);
    }
    const properReward = createIncomingRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-miniboss01'),
    );
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward: properReward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    prepared = simulateProject(application.catalog, authored);
    const activationTrace = prepared.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : []))
      .flatMap((branch) => branch.traitEvaluations ?? [])
      .find(
        (trace) =>
          trace.offer.giverKey === 'Hera' &&
          (['Earth', 'Air', 'Fire', 'Water'] as const).every(
            (element) => (trace.before.elementCounts[element] ?? 0) >= 2,
          ),
      );
    if (activationTrace === undefined) throw new Error('No prepared activation frontier found');
    const activationCandidates = traitCandidates(
      application.catalog,
      'Hera',
      activationTrace.before,
      { ...activationTrace.context, resolvedProviderKey: 'Hera' },
    ).filter(
      (candidate) =>
        candidate.available &&
        (candidate.rarity === undefined ||
          candidate.rarity === 'Common' ||
          candidate.rarity === 'Rare' ||
          candidate.rarity === 'Epic'),
    );
    const proper = activationCandidates.find(
      (candidate) => candidate.traitKey === 'ElementalRarityUpgradeBoon',
    );
    if (proper === undefined) throw new Error('Proper Upbringing is not naturally offerable');
    const uniqueActivationCandidates = activationCandidates.filter(
      (candidate, index, all) =>
        all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
    );
    const activationAlternatives = uniqueActivationCandidates.filter(
      (candidate) => candidate.traitKey !== proper.traitKey,
    );
    const activationOptions = [proper, activationAlternatives[0], activationAlternatives[1]];
    if (activationOptions[1] === undefined || activationOptions[2] === undefined)
      throw new Error('Proper Upbringing alternatives are missing');
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        activationTrace.address as TraitOfferOwnerAddress,
        activationTrace.acquisitionRole,
      ),
      value: {
        giverKey: 'Hera',
        options: activationOptions.map((candidate) => ({
          traitKey: candidate!.traitKey,
          ...(candidate!.rarity === undefined
            ? { rarity: 'Common' as const }
            : { rarity: candidate!.rarity }),
        })) as [
          { readonly traitKey: string; readonly rarity: 'Common' | 'Rare' | 'Epic' },
          { readonly traitKey: string; readonly rarity: 'Common' | 'Rare' | 'Epic' },
          { readonly traitKey: string; readonly rarity: 'Common' | 'Rare' | 'Epic' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const activated = simulateProject(application.catalog, authored);
    let stale:
      | {
          readonly address: TraitOfferOwnerAddress;
          readonly trace: ReachedTraitOfferEvaluation;
          readonly options: readonly [
            { readonly traitKey: string; readonly rarity: 'Common' },
            { readonly traitKey: string; readonly rarity: 'Rare' | 'Epic' },
            { readonly traitKey: string; readonly rarity: 'Rare' | 'Epic' },
          ];
        }
      | undefined;
    for (const route of activated.routes) {
      for (const biome of route.biomes) {
        if (!('rewards' in biome)) continue;
        for (const branch of biome.rewards.branches) {
          for (const trace of branch.traitEvaluations ?? []) {
            if (
              trace.before.minimumScalableGodTraitRarity !== 'Rare' ||
              semanticAddressKey(trace.address) === semanticAddressKey(activationTrace.address)
            )
              continue;
            const candidates = traitCandidates(
              application.catalog,
              trace.offer.giverKey,
              trace.before,
              trace.context,
            );
            const common = candidates.find(
              (candidate) =>
                candidate.available === false &&
                candidate.rarity === 'Common' &&
                candidate.assessment.findings.length > 0 &&
                candidate.assessment.findings.every(
                  (finding) => finding.code === 'rarityBelowActiveFloor',
                ),
            );
            const higher = candidates
              .filter(
                (candidate) =>
                  candidate.available &&
                  (candidate.rarity === 'Rare' || candidate.rarity === 'Epic') &&
                  candidate.traitKey !== common?.traitKey,
              )
              .filter(
                (candidate, index, all) =>
                  all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
              );
            const first = higher[0];
            const second = higher[1];
            const firstRarity = first?.rarity;
            const secondRarity = second?.rarity;
            if (
              common === undefined ||
              first === undefined ||
              second === undefined ||
              (firstRarity !== 'Rare' && firstRarity !== 'Epic') ||
              (secondRarity !== 'Rare' && secondRarity !== 'Epic')
            )
              continue;
            const repairedAddress = createTraitOfferAddress(
              trace.address as TraitOfferOwnerAddress,
              trace.acquisitionRole,
            );
            const staleOptions = [
              { traitKey: common.traitKey, rarity: 'Common' as const },
              { traitKey: first.traitKey, rarity: firstRarity },
              { traitKey: second.traitKey, rarity: secondRarity },
            ] as const;
            const repairedOptions = [
              { traitKey: common.traitKey, rarity: 'Rare' as const },
              { traitKey: first.traitKey, rarity: firstRarity },
              { traitKey: second.traitKey, rarity: secondRarity },
            ] as const;
            const repairedProject = applyProjectCommand(authored, application.catalog, {
              kind: 'ReplaceTraitOffer',
              trait: repairedAddress,
              value: {
                giverKey: trace.offer.giverKey,
                options: repairedOptions,
                selectedOptionKey: 'option1',
              },
            });
            if (
              simulateProject(application.catalog, repairedProject).findings.some(
                (finding) =>
                  finding.code === 'rarityBelowActiveFloor' &&
                  semanticAddressKey(finding.origin) === semanticAddressKey(repairedAddress),
              )
            )
              continue;
            stale = {
              address: trace.address as TraitOfferOwnerAddress,
              trace,
              options: staleOptions,
            };
            break;
          }
          if (stale !== undefined) break;
        }
        if (stale !== undefined) break;
      }
      if (stale !== undefined) break;
    }
    if (stale === undefined) throw new Error('No downstream stale Common offer found');
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(stale.address, stale.trace.acquisitionRole),
      value: {
        giverKey: stale.trace.offer.giverKey,
        options: stale.options,
        selectedOptionKey: 'option1',
      },
    });
    application.store.dispatch(authoredProjectReplaced(authored));
    const staleFinding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) =>
          finding.code === 'rarityBelowActiveFloor' &&
          semanticAddressKey(finding.origin) ===
            semanticAddressKey(
              createTraitOfferAddress(stale!.address, stale!.trace.acquisitionRole),
            ),
      );
    expect(staleFinding).toBeDefined();

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = document.getElementById(
      `trait-launcher-${semanticAddressKey(createTraitOfferAddress(stale.address, stale.trace.acquisitionRole))}`,
    );
    if (launcher === null) throw new Error('stale Common trait launcher is missing');
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        within(dialog).getAllByText(/Rarity is below the active floor/).length,
      ).toBeGreaterThan(0),
    );
    const rarity = within(dialog).getByLabelText('option1 rarity');
    await view.user.selectOptions(rarity, 'Rare');
    await view.user.click(within(dialog).getByRole('button', { name: 'Save trait offer' }));
    await waitFor(() =>
      expect(
        application.store
          .getState()
          .projectWorkspace.assembly.evaluation.findings.some(
            (finding) =>
              finding.code === 'rarityBelowActiveFloor' &&
              semanticAddressKey(finding.origin) ===
                semanticAddressKey(
                  createTraitOfferAddress(stale!.address, stale!.trace.acquisitionRole),
                ),
          ),
      ).toBe(false),
    );
    const repairedEvaluation = application.store.getState().projectWorkspace.assembly.evaluation;
    const repairedEvent = repairedEvaluation.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : []))
      .flatMap((branch) => branch.traitHistory?.events ?? [])
      .find(
        (event) =>
          semanticAddressKey(event.owner) === semanticAddressKey(stale!.address) &&
          event.acquisitionRole === stale!.trace.acquisitionRole,
      );
    const selectedIndex = repairedEvent?.selectedOptionKey === 'option1' ? 0 : 1;
    expect(repairedEvent?.options[selectedIndex]?.rarity).toBe('Rare');
    application.dispose();
  });
});
