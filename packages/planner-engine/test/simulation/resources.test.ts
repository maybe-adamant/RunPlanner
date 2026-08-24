import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress, createOccurrenceAddress } from '@run-planner/engine/authored-project';
import {
  assessResourcePlacement,
  assessTraitOption,
  boonRarityFactsForOffer,
  composeBiomeHistory,
  evaluateBiomeCompleteness,
  evaluateBiomeRewards,
  foldTraitHistoryEvents,
  materializeBiome,
  routeResourceAuthoring,
  simulateProject,
  type TraitHistoryEvent,
} from '@run-planner/engine/simulation';
import {
  loadSurfaceNProject,
  nLocalOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createFGenerationProject, fGenerationBiome } from './support/f-generation-project';
import { initializeTestRewardBranches } from '../support/arcana-fear';

const none = () => ({ Pickaxe: null, Exorcism: null, Shovel: null, Fishing: null }) as const;
const at = (biomeKey: string, occurrenceId: string) => ({
  biomeKey,
  occurrenceId: occurrenceId as never,
});
const enteredAt = (biomeKey: string, occurrenceId: string, gameName: string) => ({
  biomeKey,
  origin: createOccurrenceAddress(
    createBiomeAddress('test-route', biomeKey),
    occurrenceId as never,
  ),
  gameName,
});

describe('selected resource success legality', () => {
  it('counts the N Hub as entered spacing without exposing it as a placement target', () => {
    const project = loadSurfaceNProject();
    const route = project.routes.find((candidate) => candidate.routeKey === 'Surface');
    if (route === undefined) throw new Error('expected Surface fixture route');
    const authoring = routeResourceAuthoring(catalog, route);
    const openingIndex = authoring.entered.findIndex(
      (entry) =>
        entry.origin.kind === 'occurrence' && entry.origin.occurrenceId === nOccurrenceIds.opening,
    );
    const hubIndex = authoring.entered.findIndex((entry) => entry.origin.kind === 'hubRoom');
    const sideRoom = nLocalOccurrenceId('combat05', 'sideDoor2');
    const sideRoomIndex = authoring.entered.findIndex(
      (entry) => entry.origin.kind === 'occurrence' && entry.origin.occurrenceId === sideRoom,
    );

    expect(authoring.entered[hubIndex]).toEqual({
      biomeKey: 'N',
      origin: { kind: 'hubRoom', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' },
      gameName: 'N_Hub',
    });
    expect('occurrenceId' in authoring.entered[hubIndex]!).toBe(false);
    expect([openingIndex, hubIndex, sideRoomIndex]).toEqual([0, 2, 4]);
    expect(
      assessResourcePlacement(catalog, 'Exorcism', at('N', sideRoom), authoring.entered, {
        ...none(),
        Pickaxe: at('N', nOccurrenceIds.opening),
      }).legal,
    ).toBe(true);

    const enteredOccurrenceIds = new Set(
      authoring.entered.flatMap((entry) =>
        entry.origin.kind === 'occurrence' ? [entry.origin.occurrenceId] : [],
      ),
    );
    for (const targets of Object.values(authoring.legalTargetsByFamily)) {
      expect(targets.every((target) => enteredOccurrenceIds.has(target.occurrenceId))).toBe(true);
    }
  });

  it('applies the full target-owned cross-family matrix and N three-room window', () => {
    const entered = [
      enteredAt('N', 'n0', 'N_Combat01'),
      enteredAt('N', 'n1', 'N_Combat02'),
      enteredAt('N', 'n2', 'N_Combat03'),
      enteredAt('N', 'n3', 'N_Combat04'),
    ];
    const selected = { ...none(), Fishing: at('N', 'n0') };
    expect(
      assessResourcePlacement(catalog, 'Pickaxe', at('N', 'n3'), entered, selected).reasons,
    ).toContain('cross-family lookback');
    expect(
      assessResourcePlacement(catalog, 'Pickaxe', at('N', 'n3'), entered, {
        ...none(),
        Fishing: at('N', 'n0'),
      }).legal,
    ).toBe(false);
  });

  it('uses a Chaos target zero lookback while a later ordinary target sees Chaos', () => {
    const entered = [
      enteredAt('F', 'f0', 'F_Combat01'),
      enteredAt('F', 'c0', 'Chaos_01'),
      enteredAt('F', 'f1', 'F_Combat04'),
    ];
    expect(
      assessResourcePlacement(catalog, 'Shovel', at('F', 'c0'), entered, {
        ...none(),
        Pickaxe: at('F', 'f0'),
      }).legal,
    ).toBe(true);
    expect(
      assessResourcePlacement(catalog, 'Shovel', at('F', 'f1'), entered, {
        ...none(),
        Pickaxe: at('F', 'c0'),
      }).legal,
    ).toBe(false);
  });

  it('credits a selected resource at room exit before the next room rarity frontier', () => {
    const before = foldTraitHistoryEvents(catalog, [
      {
        kind: 'elementContribution',
        owner: { kind: 'project' },
        acquisitionRole: 'seed-elements',
        acquisitionPoint: 'test',
        sequence: 1,
        contributions: { Fire: 1, Air: 2, Earth: 2, Water: 2 },
      },
      {
        kind: 'traitOffer',
        owner: { kind: 'project' },
        acquisitionRole: 'seed-proper-upbringing',
        acquisitionPoint: 'test',
        sequence: 2,
        giverKey: 'Hera',
        options: [
          { traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' },
          { traitKey: 'HeraWeaponBoon', rarity: 'Common' },
          { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    ] satisfies readonly TraitHistoryEvent[]);
    expect(before.properUpbringingActive).toBeUndefined();

    const project = createFGenerationProject();
    const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld')!;
    const plan = route.biomes.find((candidate) => candidate.biomeKey === 'F')!;
    const completeness = evaluateBiomeCompleteness(catalog, fGenerationBiome, plan);
    if (completeness.completion !== 'complete') throw new Error('expected complete F fixture');
    const snapshot = materializeBiome(catalog, fGenerationBiome, completeness, route.loadout);
    const history = composeBiomeHistory(catalog, snapshot);
    const host = snapshot.entryRoom;
    if (host === undefined) throw new Error('expected F entry room');
    const hostExitIndex = history.events.findIndex(
      (event) =>
        event.kind === 'roomExited' &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === host.occurrenceId,
    );
    if (hostExitIndex < 0) throw new Error('expected entry room exit');
    const throughHostExit = Object.freeze({
      ...history,
      events: Object.freeze(history.events.slice(0, hostExitIndex + 1)),
    });
    const withoutResource = evaluateBiomeRewards(
      catalog,
      snapshot,
      history,
      1,
      route.loadout,
      initializeTestRewardBranches().map((branch) => ({ ...branch, traitHistory: before })),
    );
    const withResource = evaluateBiomeRewards(
      catalog,
      snapshot,
      history,
      1,
      route.loadout,
      initializeTestRewardBranches().map((branch) => ({ ...branch, traitHistory: before })),
      { ...none(), Pickaxe: at('F', host.occurrenceId) },
    );
    const throughHostWithResource = evaluateBiomeRewards(
      catalog,
      snapshot,
      throughHostExit,
      1,
      route.loadout,
      initializeTestRewardBranches().map((branch) => ({ ...branch, traitHistory: before })),
      { ...none(), Pickaxe: at('F', host.occurrenceId) },
    );
    // The host's already-resolved offer is identical. The added exit effect
    // only changes the later, next-room frontier.
    const hostOffers = (simulation: typeof withResource) =>
      simulation.selectedTraitOffers.filter(
        (selected) =>
          selected.address.owner.kind === 'incomingReward' &&
          selected.address.owner.occurrenceId === host.occurrenceId,
      );
    expect(hostOffers(withResource)).toEqual(hostOffers(withoutResource));
    expect(withoutResource.findings.map((finding) => finding.code)).not.toContain(
      'rarityRollUnavailable',
    );
    expect(withResource.findings.map((finding) => finding.code)).toContain('rarityRollUnavailable');

    // The real selected placement emits at the room-exit boundary. That makes
    // the fourth matching element visible only to the following room's offer.
    const after = throughHostWithResource.branches[0]?.traitHistory;
    if (after === undefined) throw new Error('selected resource did not publish trait history');
    expect(after.events).toContainEqual(
      expect.objectContaining({
        kind: 'elementContribution',
        owner: host.origin,
        acquisitionRole: 'resource:FireEssence',
        acquisitionPoint: 'roomExited',
        contributions: { Fire: 1 },
      }),
    );
    expect(after.properUpbringingActive).toBe(true);
    const nextRoomFacts = boonRarityFactsForOffer(catalog, after, {
      resolvedProviderKey: 'Apollo',
    });
    expect(nextRoomFacts).toBeDefined();
    expect(
      assessTraitOption(
        catalog,
        'ApolloManaBoon',
        after,
        {
          resolvedProviderKey: 'Apollo',
          boonRarityFacts: nextRoomFacts!,
        },
        'Common',
      ).findings,
    ).toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    expect(
      assessTraitOption(
        catalog,
        'ApolloManaBoon',
        after,
        {
          resolvedProviderKey: 'Apollo',
          boonRarityFacts: nextRoomFacts!,
        },
        'Rare',
      ).legal,
    ).toBe(true);
  });

  it('retains an invalid selected placement at its exact room and reports it without granting it', () => {
    const project = createFGenerationProject();
    const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld')!;
    const plan = route.biomes.find((candidate) => candidate.biomeKey === 'F')!;
    const completeness = evaluateBiomeCompleteness(catalog, fGenerationBiome, plan);
    if (completeness.completion !== 'complete') throw new Error('expected complete F fixture');
    const snapshot = materializeBiome(catalog, fGenerationBiome, completeness, route.loadout);
    const host = snapshot.entryRoom;
    if (host === undefined) throw new Error('expected F entry room');
    const placement = at('F', host.occurrenceId);
    const invalidProject = {
      ...project,
      routes: project.routes.map((candidate) =>
        candidate.routeKey !== 'Underworld'
          ? candidate
          : {
              ...candidate,
              resourcePlacements: { ...none(), Pickaxe: placement, Shovel: placement },
            },
      ),
    };
    const evaluated = simulateProject(catalog, invalidProject);
    expect(evaluated.findings).toContainEqual(
      expect.objectContaining({
        code: 'resourcePlacementUnavailable',
        severity: 'error',
        origin: host.origin,
        evidence: expect.objectContaining({ family: 'Shovel' }),
      }),
    );
    const f = evaluated.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (f?.authoring !== 'complete') throw new Error('expected complete F evaluation');
    expect(f.validity).toBe('invalid');
    const underworld = evaluated.routes.find((candidate) => candidate.routeKey === 'Underworld');
    expect(underworld?.status).toBe('invalid');
    expect(underworld?.summary.eligibleForExecutionPlan).toBe(false);
    expect(evaluated.summary.eligibleForExecutionPlan).toBe(false);
    expect(
      f?.rewards.branches
        .flatMap((branch) => branch.traitHistory?.events ?? [])
        .filter(
          (event) =>
            event.kind === 'elementContribution' && event.acquisitionRole === 'resource:Shovel',
        ),
    ).toEqual([]);
  });
});
