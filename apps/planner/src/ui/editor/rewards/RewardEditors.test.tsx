// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  type ProjectCandidateEvaluation,
  type ProjectCandidateQuery,
} from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CandidateOptionProjection,
  CandidateProjectionService,
} from '../../../projections/candidateProjection';
import { createContextualOptionResolver } from '../../../projections/contextualOptions';
import { createContextualPickerProjection } from '../../../projections/contextualPicker';
import {
  prepareRewardDomain,
  projectRewardDomain,
  rewardDomainOffers,
  type ProjectedRewardDomain,
} from '../../../projections/rewardDomainProjection';
import { createRewardPickerProjection } from '../../../projections/rewardPicker';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';

const biome = createBiomeAddress('Underworld', 'F');
const reward = createIncomingRewardAddress(biome, createOccurrenceId('reward-editor'));
const project = createProjectDocument(catalog, {
  projectId: 'reward-editor',
  name: 'Reward editor',
  configuredBiomeCounts: { Underworld: 1 },
});
const rewardPicker = createRewardPickerProjection(
  catalog,
  createContextualPickerProjection(createContextualOptionResolver(catalog)),
);

afterEach(cleanup);

function unavailable(query: ProjectCandidateQuery): ProjectCandidateEvaluation {
  return {
    context: 'unavailable',
    query,
    reason: 'upstreamIncomplete',
    evidence: { kind: 'upstreamIncomplete', upstreamBiomeKey: 'F' },
  };
}

function projected<T>(
  values: readonly T[],
  queries: readonly ProjectCandidateQuery[],
): readonly CandidateOptionProjection<T>[] {
  return values.map((value, index) => ({ value, evaluation: unavailable(queries[index]!) }));
}

const candidateProjection: CandidateProjectionService = {
  prepareRewardDomain: (rewardTypes, selected) =>
    prepareRewardDomain(catalog, rewardTypes, selected),
  countedRewardTypes: (_project, _owner, _binding, selectedRewardType) => [selectedRewardType],
  rewardDomain: async (_project, _owner, rewardTypes, selected) => {
    const prepared = prepareRewardDomain(catalog, rewardTypes, selected);
    return projectRewardDomain(
      prepared,
      rewardDomainOffers(prepared).map((offer) => ({
        value: offer,
        evaluation: {
          context: 'evaluated',
          query: { kind: 'incomingReward', reward, value: offer },
          support: 'impossible',
          findings: [],
          evidence: {
            candidate: offer,
            relevantFindingCodes: ['rewardBagEntryUnavailable'],
            exclusions: [{ kind: 'bag', storeKey: 'RunProgress' }],
          },
        },
      })),
    );
  },
  biomeFields: (_project, owner, values) =>
    projected(
      values,
      values.map((value) => ({ kind: 'biomeField', field: owner, value })),
    ),
  startRooms: (_project, owner, rooms) =>
    projected(
      rooms,
      rooms.map((room) => ({ kind: 'startRoom', owner, gameName: room.gameName })),
    ),
  roomTargets: (_project, target, rooms) =>
    projected(
      rooms,
      rooms.map((room) => ({ kind: 'roomTarget', target, gameName: room.gameName })),
    ),
  batchRewardStores: (_project, rewardStore, storeKeys) =>
    projected(
      storeKeys,
      storeKeys.map((storeKey) => ({ kind: 'batchRewardStore', rewardStore, storeKey })),
    ),
  incomingRewards: (_project, owner, offers) =>
    projected(
      offers,
      offers.map((value) => ({ kind: 'incomingReward', reward: owner, value })),
    ),
  localRewards: (_project, owner, offers) =>
    projected(
      offers,
      offers.map((value) => ({ kind: 'localReward', reward: owner, value })),
    ),
  fieldsCageOutcomes: (_project, continuation, outcomes) =>
    projected(
      outcomes,
      outcomes.map((cageOutcome) => ({
        kind: 'fieldsCageOutcome',
        continuation,
        cageOutcome,
      })),
    ),
  shipEncounterCounts: (_project, occurrence, values) =>
    projected(
      values,
      values.map((encounterCount) => ({
        kind: 'shipEncounterCount',
        occurrence,
        encounterCount,
      })),
    ),
  rewardWheelOfferCounts: (_project, wheel, values) =>
    projected(
      values,
      values.map((offerCount) => ({ kind: 'rewardWheelOfferCount', wheel, offerCount })),
    ),
  rewardWheelStores: (_project, wheel, storeKeys) =>
    projected(
      storeKeys,
      storeKeys.map((storeKey) => ({ kind: 'rewardWheelStore', wheel, storeKey })),
    ),
  rewardWheelOffers: (_project, offer, values) =>
    projected(
      values,
      values.map((value) => ({ kind: 'rewardWheelOffer', offer, value })),
    ),
  rewardWheelPicks: (_project, wheel, values) =>
    projected(
      values,
      values.map((pickedOfferIndex) => ({ kind: 'rewardWheelPicked', wheel, pickedOfferIndex })),
    ),
  hubSlots: (_project, slot, occurrenceId, values) =>
    projected(
      values,
      values.map((open) => ({ kind: 'hubSlot', slot, open, occurrenceId })),
    ),
  hubVisits: (_project, visit, hubSlotKeys) =>
    projected(
      hubSlotKeys,
      hubSlotKeys.map((hubSlotKey) => ({ kind: 'hubVisit', visit, hubSlotKey })),
    ),
  sideRoomGenerations: (_project, sideRoom, values) =>
    projected(
      values,
      values.map((generation) => ({ kind: 'sideRoomGeneration', sideRoom, generation })),
    ),
  sideRoomEntryOrders: (_project, group, values) =>
    projected(
      values,
      values.map((enteredSlotKeys) => ({ kind: 'sideRoomEntryOrder', group, enteredSlotKeys })),
    ),
  shopOffers: (_project, owner, offers) =>
    projected(
      offers,
      offers.map((value) => ({ kind: 'shopOffer', offer: owner, value })),
    ),
  shopPurchases: (_project, owner, values) =>
    projected(
      values,
      values.map((purchased) => ({ kind: 'shopPurchase', purchase: owner, purchased })),
    ),
};

function supportOnly(
  ...supportedOffers: readonly ResolvedRewardOffer[]
): CandidateProjectionService {
  const supportedKeys = new Set(supportedOffers.map((offer) => JSON.stringify(offer)));
  return {
    ...candidateProjection,
    rewardDomain: async (_project, _owner, rewardTypes, offer) => {
      const prepared = prepareRewardDomain(catalog, rewardTypes, offer);
      return projectRewardDomain(
        prepared,
        rewardDomainOffers(prepared).map((candidate) => ({
          value: candidate,
          evaluation: {
            context: 'evaluated',
            query: { kind: 'incomingReward', reward, value: candidate },
            support: supportedKeys.has(JSON.stringify(candidate))
              ? ('possible' as const)
              : ('impossible' as const),
            findings: [],
            evidence: {
              candidate,
              relevantFindingCodes: [],
              exclusions: [{ kind: 'devotionPair' as const }],
            },
          },
        })),
      );
    },
  };
}

describe('reward editor projections', () => {
  it('renders one compact summary without leaking game source names', () => {
    const markup = renderToStaticMarkup(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={candidateProjection}
        idPrefix="trial"
        onReplace={() => undefined}
        offer={{
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        }}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['Devotion']}
      />,
    );

    expect(markup).toContain('Trial · Apollo / Zeus');
    expect(markup).not.toContain('Chosen God');
    expect(markup).not.toContain('ApolloUpgrade');
    expect(markup).not.toContain('ZeusUpgrade');
  });

  it('renders the producer-resolved reward domain instead of the binding union', async () => {
    const room = catalog.rooms.byKey.F_Combat02;
    if (room?.incomingReward.kind !== 'countedChoice') {
      throw new Error('F_Combat02 counted reward binding is missing');
    }
    const boon = room.incomingReward.defaultOffersByStore.RunProgress!;
    const maxHealth = { rewardType: 'MaxHealthDrop' } as const;
    const countedRewardTypes = vi.fn(() => ['Boon', 'MaxHealthDrop'] as const);
    const producerProjection: CandidateProjectionService = {
      ...supportOnly(boon, maxHealth),
      countedRewardTypes,
    };
    const owner = { kind: 'incomingReward' as const, address: reward };
    const user = userEvent.setup();
    render(
      <CountedRewardEditor
        binding={room.incomingReward}
        candidateOwner={owner}
        candidateProjection={producerProjection}
        offer={boon}
        idPrefix="combat-02"
        onReplace={() => undefined}
        project={project}
        rewardPicker={rewardPicker}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Boon')).toBeTruthy();
    expect(within(listbox).getByText('Max Health')).toBeTruthy();
    expect(within(listbox).queryByText('Ashes')).toBeNull();
    expect(countedRewardTypes).toHaveBeenCalledWith(project, owner, room.incomingReward, 'Boon');
  });

  it('renders the typed explanation for a selected-invalid reward', async () => {
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={candidateProjection}
        idPrefix="invalid-reward"
        onReplace={() => undefined}
        offer={{ rewardType: 'MaxHealthDrop' }}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['MaxHealthDrop']}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));

    expect(
      await screen.findAllByText('No reachable reward-pool state supports this reward.'),
    ).toHaveLength(2);
  });

  it('keeps a pending interaction open and exposes an explicit cancel action', async () => {
    const pendingProjection: CandidateProjectionService = {
      ...candidateProjection,
      rewardDomain: () => new Promise<ProjectedRewardDomain>(() => undefined),
    };
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={pendingProjection}
        idPrefix="pending-reward"
        onReplace={() => undefined}
        offer={{ rewardType: 'MaxHealthDrop' }}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['MaxHealthDrop']}
      />,
    );

    const control = screen.getByLabelText('Reward');
    await user.click(control);
    expect(control.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Evaluating reward type choices');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(control.getAttribute('aria-expanded')).toBe('false');
  });

  it('commits a payload-free reward immediately after its type is chosen', async () => {
    const maxHealth = { rewardType: 'MaxHealthDrop' } as const;
    const onReplace = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={supportOnly(maxHealth)}
        idPrefix="primitive"
        offer={{
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        }}
        onReplace={onReplace}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['Boon', 'MaxHealthDrop']}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(screen.getByRole('listbox')).getByText('Max Health'));

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith(maxHealth);
  });

  it('commits one complete Boon through keyboard-focused compound steps', async () => {
    const apollo = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    const onReplace = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={supportOnly(apollo)}
        idPrefix="boon"
        offer={{
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        }}
        onReplace={onReplace}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['Boon']}
      />,
    );

    const trigger = screen.getByLabelText('Reward');
    trigger.focus();
    await user.keyboard('{Enter}');
    const rewardSearch = await screen.findByRole('combobox', {
      name: 'Reward type choices',
    });
    expect(document.activeElement).toBe(rewardSearch);
    await user.keyboard('Boon{Enter}');
    expect(onReplace).not.toHaveBeenCalled();
    const godSearch = await screen.findByRole('combobox', { name: 'God choices' });
    expect(document.activeElement).toBe(godSearch);
    await user.keyboard('Apollo{Enter}');

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith(apollo);
  });

  it('ignores a stale projection failure after the project identity changes', async () => {
    let rejectProjection!: (reason?: unknown) => void;
    const staleProjection: CandidateProjectionService = {
      ...candidateProjection,
      rewardDomain: () =>
        new Promise<ProjectedRewardDomain>((_resolve, reject) => {
          rejectProjection = reject;
        }),
    };
    const user = userEvent.setup();
    const renderEditor = (currentProject: ProjectDocument) => (
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={staleProjection}
        idPrefix="stale-project"
        offer={{ rewardType: 'MaxHealthDrop' }}
        onReplace={() => undefined}
        project={currentProject}
        rewardPicker={rewardPicker}
        rewardTypes={['MaxHealthDrop']}
      />
    );
    const view = render(renderEditor(project));
    await user.click(screen.getByLabelText('Reward'));

    const replacement = createProjectDocument(catalog, {
      projectId: 'replacement-project',
      name: 'Replacement project',
      configuredBiomeCounts: { Underworld: 1 },
    });
    view.rerender(renderEditor(replacement));
    await act(async () => {
      rejectProjection(new Error('stale projection'));
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
  });

  it('ignores a stale projection failure after the producer context changes', async () => {
    let rejectProjection!: (reason?: unknown) => void;
    const staleProjection: CandidateProjectionService = {
      ...candidateProjection,
      rewardDomain: () =>
        new Promise<ProjectedRewardDomain>((_resolve, reject) => {
          rejectProjection = reject;
        }),
    };
    const replacementReward = createIncomingRewardAddress(
      biome,
      createOccurrenceId('replacement-reward-editor'),
    );
    const renderEditor = (candidateAddress: typeof reward, rewardTypes: readonly string[]) => (
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: candidateAddress }}
        candidateProjection={staleProjection}
        idPrefix="stale-context"
        offer={{ rewardType: 'MaxHealthDrop' }}
        onReplace={() => undefined}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={rewardTypes}
      />
    );
    const user = userEvent.setup();
    const view = render(renderEditor(reward, ['MaxHealthDrop']));
    await user.click(screen.getByLabelText('Reward'));

    view.rerender(renderEditor(replacementReward, ['MaxHealthDrop', 'Boon']));
    await act(async () => {
      rejectProjection(new Error('stale projection'));
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
  });

  it('does not resurrect a completed stale interaction when its context returns', async () => {
    let resolveProjection!: (domain: ProjectedRewardDomain) => void;
    const staleProjection: CandidateProjectionService = {
      ...candidateProjection,
      rewardDomain: () =>
        new Promise<ProjectedRewardDomain>((resolve) => {
          resolveProjection = resolve;
        }),
    };
    const selected = { rewardType: 'MaxHealthDrop' } as const;
    const prepared = prepareRewardDomain(catalog, ['MaxHealthDrop'], selected);
    const projectedDomain = projectRewardDomain(
      prepared,
      rewardDomainOffers(prepared).map((value) => ({
        value,
        evaluation: unavailable({ kind: 'incomingReward', reward, value }),
      })),
    );
    const replacementReward = createIncomingRewardAddress(
      biome,
      createOccurrenceId('returning-reward-editor'),
    );
    const renderEditor = (candidateAddress: typeof reward) => (
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: candidateAddress }}
        candidateProjection={staleProjection}
        idPrefix="returning-context"
        offer={selected}
        onReplace={() => undefined}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['MaxHealthDrop']}
      />
    );
    const user = userEvent.setup();
    const view = render(renderEditor(reward));
    await user.click(screen.getByLabelText('Reward'));

    view.rerender(renderEditor(replacementReward));
    await act(async () => {
      resolveProjection(projectedDomain);
      await Promise.resolve();
    });
    view.rerender(renderEditor(reward));

    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Reward type')).toBeNull();
  });

  it('labels a Blind Box source as an eventual result', async () => {
    const blindBox = {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={supportOnly(blindBox)}
        idPrefix="blind-box"
        offer={blindBox}
        onReplace={() => undefined}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['BlindBoxLoot']}
      />,
    );

    const trigger = screen.getByLabelText('Reward');
    expect(trigger.textContent).toContain('Mystery Boon · Apollo (eventual)');
    await user.click(trigger);
    await screen.findByText('Reward type');
    await user.click(within(screen.getByRole('listbox')).getByText('Mystery Boon'));

    expect(await screen.findByText('Eventual God')).toBeTruthy();
  });

  it('commits one complete Devotion offer only after both Gods are chosen', async () => {
    const selected = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'AphroditeUpgrade',
        spurnedSource: 'AresUpgrade',
      },
    };
    const supporting = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    };
    const onReplace = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={supportOnly(supporting)}
        idPrefix="devotion"
        onReplace={onReplace}
        offer={selected}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['Devotion']}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(screen.getByRole('listbox')).getByText('Trial'));
    await screen.findByText('Chosen God');
    await user.click(within(screen.getByRole('listbox')).getByText('Apollo'));

    expect(onReplace).not.toHaveBeenCalled();
    await screen.findByText('Spurned God');
    expect(within(screen.getByRole('listbox')).getByText('Ares')).toBeTruthy();
    expect(within(screen.getByRole('listbox')).getByText('Current · unavailable')).toBeTruthy();
    await user.click(within(screen.getByRole('listbox')).getByText('Zeus'));

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith({
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    });
  });

  it('allows the authored spurned God to become the new chosen God', async () => {
    const supported = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'AresUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    };
    const onReplace = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={supportOnly(supported)}
        idPrefix="devotion-swap"
        onReplace={onReplace}
        offer={{
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'AphroditeUpgrade',
            spurnedSource: 'AresUpgrade',
          },
        }}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['Devotion']}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(screen.getByRole('listbox')).getByText('Trial'));
    await screen.findByText('Chosen God');
    await user.click(within(screen.getByRole('listbox')).getByText('Ares'));
    await screen.findByText('Spurned God');
    await user.click(within(screen.getByRole('listbox')).getByText('Zeus'));

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith(supported);
  });

  it('cancels partial Devotion progress without authoring a replacement', async () => {
    const supporting = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    };
    const onReplace = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: reward }}
        candidateProjection={supportOnly(supporting)}
        idPrefix="cancel-devotion"
        offer={{
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'AphroditeUpgrade',
            spurnedSource: 'AresUpgrade',
          },
        }}
        onReplace={onReplace}
        project={project}
        rewardPicker={rewardPicker}
        rewardTypes={['Devotion']}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(screen.getByRole('listbox')).getByText('Trial'));
    await screen.findByText('Chosen God');
    await user.click(within(screen.getByRole('listbox')).getByText('Apollo'));
    await screen.findByText('Spurned God');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onReplace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Reward').textContent).toContain('Trial · Aphrodite / Ares');
  });
});
