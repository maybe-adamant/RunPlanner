// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';
import { simulateProject, type SelectedTraitOfferAssessment } from '@run-planner/engine/simulation';
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
  reachedTraitOffers,
  traitCandidateSession,
  supportedTraitOffer,
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
    const locateTrace = (address: TraitOfferOwnerAddress, role: string) =>
      reachedTraitOffers(authored).find(
        (trace) =>
          semanticAddressKey(trace.address.owner) === semanticAddressKey(address) &&
          trace.acquisitionRole === role,
      );
    const rewriteWithGiver = (
      trace: SelectedTraitOfferAssessment,
      giverKey: string,
      preferredTraitKey: string,
    ) => {
      const address = createTraitOfferAddress(trace.address.owner, trace.acquisitionRole);
      const value = supportedTraitOffer(authored, address, giverKey, preferredTraitKey);
      if (value === undefined) throw new Error(`Missing supported ${preferredTraitKey} offer`);
      return applyProjectCommand(authored, application.catalog, {
        kind: 'ReplaceTraitOffer',
        trait: address,
        value,
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
      const trace = locateTrace(plan.address, plan.role);
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
    const activationTrace = reachedTraitOffers(authored).find(
      (trace) =>
        semanticAddressKey(trace.address.owner) === semanticAddressKey(properReward) &&
        trace.acquisitionRole === 'source',
    );
    if (activationTrace === undefined) throw new Error('No prepared activation frontier found');
    const activationValue = supportedTraitOffer(
      authored,
      activationTrace.address,
      'Hera',
      'ElementalRarityUpgradeBoon',
    );
    if (activationValue === undefined)
      throw new Error('Proper Upbringing supported offer is not available');
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: activationTrace.address,
      value: activationValue,
    });
    let stale:
      | {
          readonly address: TraitOfferOwnerAddress;
          readonly trace: SelectedTraitOfferAssessment;
          readonly options: AuthoredTraitOffer['options'];
        }
      | undefined;
    const staleSession = traitCandidateSession(authored);
    for (const trace of reachedTraitOffers(authored)) {
      if (semanticAddressKey(trace.address) === semanticAddressKey(activationTrace.address))
        continue;
      const rankedOptions = trace.offer.options.map((option) => {
        const domain = application.catalog.traits.byKey[option.traitKey]?.rarityDomain;
        if (domain?.kind !== 'ranked' || !domain.freshOfferRarities.includes('Rare')) {
          return undefined;
        }
        return option;
      });
      const commonIndex = rankedOptions.findIndex((option) => option !== undefined);
      if (commonIndex !== 0) continue;
      const repairedOptions = trace.offer.options.map((option) => {
        const domain = application.catalog.traits.byKey[option.traitKey]?.rarityDomain;
        if (domain?.kind !== 'ranked' || !domain.freshOfferRarities.includes('Rare')) return option;
        return { ...option, rarity: option.rarity === 'Common' ? 'Rare' : option.rarity };
      }) as unknown as AuthoredTraitOffer['options'];
      const staleOptions = repairedOptions.map((option, index) =>
        index === commonIndex ? { ...option, rarity: 'Common' as const } : option,
      ) as unknown as AuthoredTraitOffer['options'];
      const repairedCandidate = staleSession.evaluate({
        kind: 'traitOffer',
        trait: trace.address,
        value: {
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
      };
      break;
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
