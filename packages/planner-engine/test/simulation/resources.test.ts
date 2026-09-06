import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  type ResourcePlacement,
  type ResourcePlacements,
} from '@run-planner/engine/authored-project';
import {
  assessResourcePlacement,
  assessTraitOption,
  boonRarityFactsForOffer,
  composeBiomeHistory,
  deriveResourceExecutionPolicy,
  evaluateBiomeCompleteness,
  evaluateBiomeRewards,
  foldTraitHistoryEvents,
  materializeBiome,
  routeResourceAuthoring,
  simulateProject,
  type ResourceEnteredRoom,
  type RouteResourceAuthoring,
  type TraitHistoryEvent,
} from '@run-planner/engine/simulation';
import {
  loadSurfaceNProject,
  loadSurfaceNResourcesProject,
  nLocalOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  createFGenerationProject,
  fGenerationBiome,
  fGenerationStartId,
} from './support/f-generation-project';
import { initializeTestRewardBranches } from '../support/arcana-fear';

const none = (): ResourcePlacements => ({
  Pickaxe: null,
  Exorcism: null,
  Shovel: null,
  Fishing: null,
});
const at = (biomeKey: string, occurrenceId: string): ResourcePlacement => ({
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

const resourceFamilies = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
const emptyElementCounts = Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 });

function directResourcePolicy(
  entered: readonly ResourceEnteredRoom[],
  placements: ReturnType<typeof none>,
) {
  const occurrences = entered.filter(
    (entry): entry is ResourceEnteredRoom & { origin: { kind: 'occurrence' } } =>
      entry.origin.kind === 'occurrence',
  );
  const authoring: RouteResourceAuthoring = {
    entered,
    placements,
    assessmentByFamily: Object.fromEntries(
      resourceFamilies.map((family) => [
        family,
        placements[family] === null ? undefined : { legal: true, reasons: [] },
      ]),
    ) as RouteResourceAuthoring['assessmentByFamily'],
    legalTargetsByFamily: {
      Pickaxe: [],
      Exorcism: [],
      Shovel: [],
      Fishing: [],
    },
  };
  const evaluation = {
    history: { rooms: occurrences.map(({ origin }) => ({ origin })) },
    rewards: {
      roomExitElementCounts: occurrences.map(({ origin }) => ({
        origin,
        elementCounts: emptyElementCounts,
      })),
    },
  };
  return deriveResourceExecutionPolicy(catalog, [evaluation], authoring);
}

describe('selected resource success legality', () => {
  it('derives same-family lookback suppression while keeping the outside point native', () => {
    const entered = [
      enteredAt('F', 'f0', 'F_Combat01'),
      enteredAt('F', 'f1', 'F_Combat02'),
      enteredAt('F', 'f2', 'F_Combat03'),
      enteredAt('F', 'f3', 'F_Combat04'),
      enteredAt('F', 'f4', 'F_Combat05'),
      enteredAt('F', 'target', 'F_Story01'),
    ];
    const policy = directResourcePolicy(entered, {
      ...none(),
      Pickaxe: at('F', 'target'),
    });
    const pickaxe = (occurrenceId: string) =>
      policy.occurrences.find((entry) => entry.occurrenceId === occurrenceId)!.pointDispositions
        .Pickaxe;
    expect(pickaxe('f0')).toBe('native');
    expect(['f1', 'f2', 'f3', 'f4'].map(pickaxe)).toEqual([
      'suppress',
      'suppress',
      'suppress',
      'suppress',
    ]);
    expect(pickaxe('target')).toBe('force');
  });

  it('suppresses an earlier same-family point for a biome cap outside the short lookback', () => {
    const entered = [
      enteredAt('F', 'f0', 'F_Combat01'),
      enteredAt('F', 'f1', 'F_Combat01'),
      enteredAt('F', 'f2', 'F_Combat01'),
      enteredAt('F', 'f3', 'F_Combat01'),
      enteredAt('F', 'f4', 'F_Combat01'),
      enteredAt('F', 'target', 'F_Combat06'),
    ];
    const policy = directResourcePolicy(entered, {
      ...none(),
      Pickaxe: at('F', 'target'),
    });
    expect(
      policy.occurrences.find((entry) => entry.occurrenceId === 'f0')?.pointDispositions.Pickaxe,
    ).toBe('suppress');
    expect(
      policy.occurrences.find((entry) => entry.occurrenceId === 'target')?.pointDispositions
        .Pickaxe,
    ).toBe('force');
  });

  it('suppresses a prior cross-family point according to the target room rule', () => {
    const entered = [enteredAt('F', 'pickaxe', 'F_Combat01'), enteredAt('N', 'target', 'N_Sub14')];
    const policy = directResourcePolicy(entered, {
      ...none(),
      Exorcism: at('N', 'target'),
    });
    expect(
      policy.occurrences.find((entry) => entry.occurrenceId === 'pickaxe')?.pointDispositions
        .Pickaxe,
    ).toBe('suppress');
    expect(
      policy.occurrences.find((entry) => entry.occurrenceId === 'target')?.pointDispositions
        .Exorcism,
    ).toBe('force');
    expect(
      assessResourcePlacement(catalog, 'Pickaxe', at('F', 'pickaxe'), entered, {
        ...none(),
        Exorcism: at('N', 'target'),
      }).reasons,
    ).toContain('cross-family lookback');
  });

  it('derives same-room simple/complex capacity and Chaos all-tool suppression', () => {
    const ordinary = directResourcePolicy([enteredAt('F', 'ordinary', 'F_Combat01')], {
      ...none(),
      Pickaxe: at('F', 'ordinary'),
    });
    const ordinaryRow = ordinary.occurrences[0]!;
    expect(ordinaryRow.pointDispositions).toMatchObject({
      Pickaxe: 'force',
      Shovel: 'suppress',
      Exorcism: 'native',
    });

    const chaos = directResourcePolicy([enteredAt('F', 'chaos', 'Chaos_01')], {
      ...none(),
      Shovel: at('F', 'chaos'),
    });
    expect(chaos.occurrences[0]!.pointDispositions).toEqual({
      Pickaxe: 'suppress',
      Exorcism: 'native',
      Shovel: 'force',
      Fishing: 'suppress',
    });

    const sameRoom = [enteredAt('F', 'ordinary', 'F_Combat01')];
    expect(
      assessResourcePlacement(catalog, 'Shovel', at('F', 'ordinary'), sameRoom, {
        ...none(),
        Pickaxe: at('F', 'ordinary'),
      }),
    ).toEqual({ legal: false, reasons: ['room simple/complex capacity'] });
    expect(
      assessResourcePlacement(
        catalog,
        'Fishing',
        at('F', 'chaos'),
        [enteredAt('F', 'chaos', 'Chaos_01')],
        {
          ...none(),
          Shovel: at('F', 'chaos'),
        },
      ),
    ).toEqual({ legal: false, reasons: ['all-tool room capacity'] });
  });

  it('publishes a tri-state row for an entered N side room at its history position', () => {
    const evaluated = simulateProject(catalog, loadSurfaceNResourcesProject());
    const n = evaluated.route.biomes.find((biome) => biome.biomeKey === 'N');
    if (n?.authoring !== 'complete' || n.validity !== 'valid')
      throw new Error('expected complete-valid N resource checkpoint');
    const authoring = routeResourceAuthoring(catalog, loadSurfaceNResourcesProject().route);
    const sideRoomId = 'surface-n-combat11-sideDoor1';
    const sideIndex = authoring.entered.findIndex(
      (entry) => entry.origin.kind === 'occurrence' && entry.origin.occurrenceId === sideRoomId,
    );
    const sideRow = evaluated.route.resources.occurrences.find(
      (entry) => entry.occurrenceId === sideRoomId,
    );
    expect(sideIndex).toBeGreaterThan(-1);
    expect(sideIndex).toBe(10);
    expect(sideRow).toMatchObject({
      occurrenceId: sideRoomId,
      pointDispositions: expect.objectContaining({ Exorcism: 'force' }),
    });
    expect(evaluated.route.resources.occurrences.map((entry) => entry.occurrenceId)).toContain(
      sideRoomId,
    );
    expect(
      evaluated.route.resources.occurrences.find(
        (entry) => entry.occurrenceId === 'surface-n-combat11',
      )?.pointDispositions.Exorcism,
    ).toBe('suppress');
    expect(
      evaluated.route.resources.occurrences.find(
        (entry) => entry.occurrenceId === 'surface-n-combat23',
      )?.pointDispositions.Exorcism,
    ).toBe('native');
  });

  it('uses an entered Hub before an N side room when applying its lookback distance', () => {
    const hub = {
      biomeKey: 'N',
      origin: { kind: 'hubRoom', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const,
      gameName: 'N_Hub',
    };
    const withHub: ResourceEnteredRoom[] = [
      ...Array.from({ length: 16 }, (_, index) => enteredAt('F', `prior-${index}`, 'F_Combat01')),
      hub,
      enteredAt('N', 'side-target', 'N_Sub14'),
    ];
    const withoutHub = withHub.filter((entry) => entry.origin.kind !== 'hubRoom');
    const placements = { ...none(), Exorcism: at('N', 'side-target') };
    const withHubPolicy = directResourcePolicy(withHub, placements);
    const withoutHubPolicy = directResourcePolicy(withoutHub, placements);
    const disposition = (policy: ReturnType<typeof directResourcePolicy>, id: string) =>
      policy.occurrences.find((entry) => entry.occurrenceId === id)?.pointDispositions.Exorcism;

    // N's Exorcism lookback is 16. The entered Hub moves prior-0 just outside
    // that window while prior-1 remains inside it; removing Hub would suppress
    // both. The target itself is the entered side-room occurrence.
    expect(disposition(withHubPolicy, 'prior-0')).toBe('native');
    expect(disposition(withHubPolicy, 'prior-1')).toBe('suppress');
    expect(disposition(withoutHubPolicy, 'prior-0')).toBe('suppress');
    expect(disposition(withHubPolicy, 'side-target')).toBe('force');
  });

  it('omits a legal resource placement in an unfinished prefix from the replaceable policy', () => {
    const project = createFGenerationProject(undefined, { includeTakeover: false });
    const route = project.route;
    if (route === undefined) throw new Error('expected F route');
    const placement = at('F', fGenerationStartId);
    const incomplete = Object.freeze({
      ...project,
      route: Object.freeze({
        ...route,
        resourcePlacements: Object.freeze({ ...route.resourcePlacements, Pickaxe: placement }),
      }),
    });
    const evaluated = simulateProject(catalog, incomplete);
    expect(evaluated.route?.biomes[0]?.authoring).toBe('incomplete');
    expect(evaluated.route?.resources.occurrences).toEqual([]);
    expect(incomplete.route.resourcePlacements.Pickaxe).toEqual(placement);
  });

  it('counts the N Hub as entered spacing without exposing it as a placement target', () => {
    const project = loadSurfaceNProject();
    const route = project.route;
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
    const route = project.route!;
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
    const route = project.route!;
    const plan = route.biomes.find((candidate) => candidate.biomeKey === 'F')!;
    const completeness = evaluateBiomeCompleteness(catalog, fGenerationBiome, plan);
    if (completeness.completion !== 'complete') throw new Error('expected complete F fixture');
    const snapshot = materializeBiome(catalog, fGenerationBiome, completeness, route.loadout);
    const host = snapshot.entryRoom;
    if (host === undefined) throw new Error('expected F entry room');
    const placement = at('F', host.occurrenceId);
    const invalidProject = {
      ...project,
      route: {
        ...project.route,
        resourcePlacements: { ...none(), Pickaxe: placement, Shovel: placement },
      },
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
    const f = evaluated.route?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (f?.authoring !== 'complete') throw new Error('expected complete F evaluation');
    expect(f.validity).toBe('invalid');
    const underworld = evaluated.route;
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
