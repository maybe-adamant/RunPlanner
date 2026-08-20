// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type TraitOfferAddress,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';
import { simulateProject, type SelectedTraitOfferAssessment } from '@run-planner/engine/simulation';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  reachedTraitOffers,
  prepareLegalPomTraitOffers,
  traitCandidateSession,
  supportedTraitOffer,
} from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

type AuthoredTraitsOffer = Extract<AuthoredTraitOffer, { kind: 'traits' }>;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function prepareProperUpbringingFixture() {
  const application = createApplication();
  const original = createGoldenFGHIProject();
  let authored = original;
  const rewriteWithGiver = (
    address: TraitOfferAddress,
    giverKey: string,
    preferredTraitKey: string,
  ) => {
    const value = supportedTraitOffer(authored, address, giverKey, preferredTraitKey);
    if (value === undefined) throw new Error(`Missing supported ${preferredTraitKey} offer`);
    const completedValue =
      value.kind !== 'traits'
        ? value
        : Object.freeze({
            ...value,
            options: Object.freeze(
              value.options.map((option) => {
                return option.traitKey !== 'AllElementalBoon'
                  ? option
                  : Object.freeze({
                      ...option,
                      allTogetherResult: Object.freeze({
                        earth: 'ElementalDamageBoon',
                        fire: 'ElementalBaseDamageBoon',
                        air: 'ElementalDamageFloorBoon',
                        water: 'ElementalHealthBoon',
                      }),
                    });
              }),
            ) as typeof value.options,
          });
    return applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: address,
      value: completedValue,
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
    const prepared = prepareLegalPomTraitOffers(authored);
    authored = prepared.project;
    authored = rewriteWithGiver(
      createTraitOfferAddress(plan.address, plan.role),
      'Hera',
      plan.traitKey,
    );
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
  const activationAddress = createTraitOfferAddress(properReward, 'source');
  const activationValue = supportedTraitOffer(
    authored,
    activationAddress,
    'Hera',
    'ElementalRarityUpgradeBoon',
  );
  if (activationValue === undefined)
    throw new Error('Proper Upbringing supported offer is not available');
  authored = applyProjectCommand(authored, application.catalog, {
    kind: 'ReplaceTraitOffer',
    trait: activationAddress,
    value: activationValue,
  });
  authored = prepareLegalPomTraitOffers(authored).project;
  let stale:
    | {
        readonly address: TraitOfferOwnerAddress;
        readonly trace: SelectedTraitOfferAssessment;
        readonly options: AuthoredTraitsOffer['options'];
        readonly requiredRarity: NonNullable<AuthoredTraitsOffer['options'][number]['rarity']>;
      }
    | undefined;
  const staleSession = traitCandidateSession(authored);
  for (const trace of reachedTraitOffers(authored)) {
    if (semanticAddressKey(trace.address) === semanticAddressKey(activationAddress)) continue;
    if (trace.offer.kind !== 'traits') continue;
    const repaired = supportedTraitOffer(
      authored,
      trace.address,
      trace.offer.giverKey,
      undefined,
      staleSession,
    );
    if (repaired === undefined) continue;
    if (repaired.kind !== 'traits') continue;
    const repairedOptions = repaired.options;
    const requiredRarity = repairedOptions[0]?.rarity;
    if (requiredRarity === undefined || requiredRarity === 'Common') continue;
    const commonIndex = repairedOptions.findIndex((option) => {
      const domain = application.catalog.traits.byKey[option.traitKey]?.rarityDomain;
      return domain?.kind === 'ranked' && domain.freshOfferRarities.includes('Rare');
    });
    if (commonIndex !== 0) continue;
    const staleOptions = repairedOptions.map((option, index) =>
      index === commonIndex ? { ...option, rarity: 'Common' as const } : option,
    ) as unknown as AuthoredTraitsOffer['options'];
    const repairedCandidate = staleSession.evaluate({
      kind: 'traitOffer',
      trait: trace.address,
      value: {
        kind: 'traits',
        giverKey: trace.offer.giverKey,
        options: repairedOptions,
        selectedOptionKey: 'option1',
      },
    });
    if (repairedCandidate.kind !== 'traitOffer' || !repairedCandidate.result.supported) continue;
    const staleProject = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: trace.address,
      value: {
        kind: 'traits',
        giverKey: trace.offer.giverKey,
        options: staleOptions,
        selectedOptionKey: 'option1',
      },
    });
    if (
      !simulateProject(application.catalog, staleProject).findings.some(
        (finding) =>
          finding.code === 'rarityBelowActiveFloor' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(trace.address),
      )
    )
      continue;
    stale = {
      address: trace.address.owner,
      trace,
      options: staleOptions,
      requiredRarity,
    };
    break;
  }
  if (stale === undefined) throw new Error('No downstream stale Common offer found');
  authored = applyProjectCommand(authored, application.catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(stale.address, stale.trace.acquisitionRole),
    value: {
      kind: 'traits',
      giverKey: stale.trace.offer.giverKey,
      options: stale.options,
      selectedOptionKey: 'option1',
    },
  });
  return Object.freeze({ application, authored, stale });
}

describe('Proper Upbringing product loop', () => {
  let prepared!: ReturnType<typeof prepareProperUpbringingFixture>;

  beforeAll(() => {
    prepared = prepareProperUpbringingFixture();
  });

  afterAll(() => {
    prepared.application.dispose();
  });

  it('repairs a stale Common offer after a natural Proper Upbringing activation', async () => {
    const { application, authored, stale } = prepared;
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
    await view.user.click(rarity);
    const repairedRarity = screen
      .getAllByText(stale.requiredRarity)
      .find((element) => element.closest('[cmdk-item]') !== null);
    if (repairedRarity === undefined)
      throw new Error(`Proper Upbringing rarity picker has no ${stale.requiredRarity} choice`);
    await view.user.click(repairedRarity);
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
    const repairedOffer = repairedEvaluation.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.selectedTraitOffers : []))
      .find(
        (offer) =>
          semanticAddressKey(offer.address) ===
          semanticAddressKey(createTraitOfferAddress(stale!.address, stale!.trace.acquisitionRole)),
      );
    if (repairedOffer?.offer.kind !== 'traits')
      throw new Error('repaired offer must contain traits');
    expect(repairedOffer.offer.options[0]?.rarity).toBe(stale.requiredRarity);
  });
});
