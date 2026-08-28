import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createFountainRarityOutcomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type RoomActionAddress,
} from '@run-planner/engine/authored-project';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { describe, expect, it } from 'vitest';

import {
  advanceCurrentKeepsake,
  applyKeepsakeReplacement,
  assessPhialTraitTargets,
  consumePhial,
  createKeepsakeState,
  keepsakeRankForEquip,
} from '../../src/simulation/keepsakes';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../src/simulation/traits';
import { simulateProjectAssembly } from '../../src/simulation';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../src/simulation/project-evaluation-assembly';
import { applyFountainUsedTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/fountain-used';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import type { HistoryEvent } from '../../src/simulation/history';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

function equippedTrait(
  traitKey: string,
  giverKey: string,
  level = 1,
  rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic' = 'Common',
) {
  return {
    traitKey,
    giverKey,
    providerKind: 'olympian' as const,
    rarity,
    level,
    sourceRole: 'main',
  };
}

function historyWith(
  ...traits: readonly ReturnType<typeof equippedTrait>[]
): ReturnType<typeof createTraitHistoryState> {
  return foldTraitHistoryEvents(
    catalog,
    traits.map((trait, index) =>
      Object.freeze({
        kind: 'traitOffer' as const,
        owner: fountainAction,
        acquisitionRole: 'test',
        sequence: index,
        giverKey: trait.giverKey,
        options: Object.freeze([
          {
            traitKey: trait.traitKey,
            rarity: trait.rarity,
          },
        ] as const),
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
        acquisitionIdentity: `phial-test-${index}`,
      }),
    ),
  );
}

const occurrence = createOccurrenceAddress(
  goldenFBiome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);
const fountainAction: RoomActionAddress = createRoomActionAddress(
  goldenFBiome,
  occurrence.occurrenceId,
  roomActionKey({ kind: 'useFountain' }),
);

function fountainEvent(sequence = 1): Extract<HistoryEvent, { readonly kind: 'fountainUsed' }> {
  return Object.freeze({
    kind: 'fountainUsed',
    sequence,
    operationIndex: 0,
    origin: occurrence,
    owner: fountainAction,
  });
}

function fountainBranch(
  trait: ReturnType<typeof equippedTrait>,
  traitHistory = historyWith(trait),
  keepsakes = createKeepsakeState(catalog, 'FountainRarityKeepsake'),
): RewardBranchState {
  const base = initializeTestRewardBranches()[0]!;
  return Object.freeze({
    ...base,
    history: attachTraitHistory(base.history, traitHistory),
    traitHistory,
    keepsakes,
  });
}

function cappedHephaestusHistory() {
  const base = historyWith(equippedTrait('HephaestusWeaponBoon', 'Hephaestus', 1));
  const target = base.equippedTraits.HephaestusWeaponBoon;
  if (target === undefined) throw new Error('missing Hephaestus test target');
  return Object.freeze({
    ...base,
    equippedTraits: Object.freeze({
      ...base.equippedTraits,
      HephaestusWeaponBoon: Object.freeze({ ...target, level: 10 }),
    }),
  });
}

function fountainRoom(targetTraitKey: string): CanonicalAuthoredRoom {
  return { fountainRarityResult: { targetTraitKey } } as unknown as CanonicalAuthoredRoom;
}

describe('Aromatic Phial catalog and target domains', () => {
  it('declares the fixed rank profile and remains Epic under Cherished reconstruction', () => {
    const effect = catalog.keepsakes.byKey.FountainRarityKeepsake?.effect;
    expect(effect).toEqual({
      kind: 'fountainRarity',
      uses: 1,
      targetRarityLevelByRank: { Common: 2, Rare: 3, Epic: 4 },
      sourceMaxRarityLevel: 1,
    });
    const history = createTraitHistoryState();
    expect(keepsakeRankForEquip(catalog, 'FountainRarityKeepsake', history)).toBe('Epic');
    const state = createKeepsakeState(catalog, 'FountainRarityKeepsake');
    expect(advanceCurrentKeepsake(catalog, state, 1)).toEqual(state);
  });

  it('initializes at route start, removes on ordinary replacement, and reinitializes at a rack equip', () => {
    const initial = createKeepsakeState(catalog, 'FountainRarityKeepsake');
    expect(initial.phial).toEqual({ status: 'pending' });
    const arcanaFear = initializeTestRewardBranches()[0]!.arcanaFear;
    const removed = applyKeepsakeReplacement(catalog, initial, 'GoldifyKeepsake', arcanaFear);
    expect(removed.phial).toBeUndefined();
    const reequipped = applyKeepsakeReplacement(
      catalog,
      createKeepsakeState(catalog, 'GoldifyKeepsake'),
      'FountainRarityKeepsake',
      arcanaFear,
    );
    expect(reequipped.phial).toEqual({ status: 'pending' });
  });

  it('keeps the consumption guard broader than the mutation domain', () => {
    const normal = assessPhialTraitTargets(
      catalog,
      historyWith(equippedTrait('ApolloWeaponBoon', 'Apollo')),
    );
    expect(normal).toEqual({
      consumptionTargetKeys: ['ApolloWeaponBoon'],
      mutationTargetKeys: ['ApolloWeaponBoon'],
    });
    const nonCore = assessPhialTraitTargets(
      catalog,
      historyWith(equippedTrait('CastLobBoon', 'Dionysus')),
    );
    expect(nonCore).toEqual({
      consumptionTargetKeys: ['CastLobBoon'],
      mutationTargetKeys: ['CastLobBoon'],
    });

    const capped = assessPhialTraitTargets(catalog, cappedHephaestusHistory());
    expect(capped).toEqual({
      consumptionTargetKeys: ['HephaestusWeaponBoon'],
      mutationTargetKeys: [],
    });
    expect(
      assessPhialTraitTargets(
        catalog,
        historyWith(equippedTrait('ElementalDamageFloorBoon', 'Apollo')),
      ),
    ).toEqual({ consumptionTargetKeys: [], mutationTargetKeys: [] });
  });
});

describe('Aromatic Phial fountain lifecycle', () => {
  it('emits the ordinary Reprieve fountain lifecycle event from a reached authored room', () => {
    const reprieveId = goldenFOccurrenceId(5, 1);
    let project = createCompleteFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, reprieveId),
      gameName: 'F_Reprieve01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: {
        kind: 'keepsakeSelection',
        routeKey: 'Underworld',
        biomeKey: 'routeStart',
        owner: 'routeStart',
      },
      keepsakeKey: 'FountainRarityKeepsake',
    });
    project = authorLegalTraitOffers(project);
    const missing = simulateProjectAssembly(catalog, project)
      .evaluation.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    expect(missing?.findings).toContainEqual(
      expect.objectContaining({
        code: 'fountainRarityResultMissing',
        origin: createFountainRarityOutcomeAddress(
          createRoomActionAddress(goldenFBiome, reprieveId, roomActionKey({ kind: 'useFountain' })),
        ),
      }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome: createFountainRarityOutcomeAddress(
        createRoomActionAddress(goldenFBiome, reprieveId, roomActionKey({ kind: 'useFountain' })),
      ),
      targetTraitKey: 'ApolloWeaponBoon',
    });
    expect(
      project.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((candidate) => candidate.biomeKey === 'F')
        ?.topology?.occurrences.map((candidate) => [candidate.occurrenceId, candidate.gameName]),
    ).toContainEqual([reprieveId, 'F_Reprieve01']);
    expect(
      project.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((candidate) => candidate.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === reprieveId)
        ?.fountainRarityResult,
    ).toEqual({ targetTraitKey: 'ApolloWeaponBoon' });
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const f = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biomeEvaluation) => biomeEvaluation.biomeKey === 'F');
    if (f === undefined || f.authoring !== 'complete' || f.validity !== 'valid')
      throw new Error(
        `expected valid ordinary Reprieve evaluation: ${JSON.stringify({
          authoring: f?.authoring,
          validity: 'validity' in (f ?? {}) ? f?.validity : undefined,
          findings: f?.findings,
        })}`,
      );
    const event = f.history.events.find(
      (candidate) =>
        candidate.kind === 'fountainUsed' &&
        candidate.origin.kind === 'occurrence' &&
        candidate.origin.occurrenceId === reprieveId,
    );
    expect(event).toBeDefined();
    expect(f.rewards.branches[0]?.keepsakes.phial).toEqual({ status: 'consumed' });
  });

  it('emits the fixed-linked Postboss fountain lifecycle event after room creation', () => {
    const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
    let project = createCompleteFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: {
        kind: 'keepsakeSelection',
        routeKey: 'Underworld',
        biomeKey: 'routeStart',
        owner: 'routeStart',
      },
      keepsakeKey: 'FountainRarityKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome: createFountainRarityOutcomeAddress(
        createRoomActionAddress(goldenFBiome, postbossId, roomActionKey({ kind: 'useFountain' })),
      ),
      targetTraitKey: 'ApolloWeaponBoon',
    });
    const evaluation = simulateProjectAssembly(catalog, authorLegalTraitOffers(project)).evaluation;
    const f = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biomeEvaluation) => biomeEvaluation.biomeKey === 'F');
    if (f === undefined || f.authoring !== 'complete' || f.validity !== 'valid')
      throw new Error('expected valid fixed-linked Postboss evaluation');
    const postbossEvents = f.history.events.filter(
      (event) =>
        event.kind === 'fountainUsed' &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === postbossId,
    );
    expect(postbossEvents).toHaveLength(1);
    const created = f.history.events.find(
      (event) =>
        event.kind === 'roomCreated' &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === postbossId,
    );
    expect(created).toBeDefined();
    expect(created!.sequence).toBeLessThan(postbossEvents[0]!.sequence);
    expect(f.rewards.branches[0]?.keepsakes.phial).toEqual({ status: 'consumed' });
  });

  it('publishes and resolves a Phial target after a Postboss rack is moved before its fountain', () => {
    const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const selection = {
      kind: 'keepsakeSelection' as const,
      routeKey: 'Underworld' as const,
      biomeKey: 'F',
      owner: createOccurrenceAddress(goldenFBiome, postbossId),
    };
    const fountain = createRoomActionAddress(
      goldenFBiome,
      postbossId,
      roomActionKey({ kind: 'useFountain' }),
    );
    const outcome = createFountainRarityOutcomeAddress(fountain);
    let project = authorLegalTraitOffers(createCompleteFGProject());
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: 'FountainRarityKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(
        goldenFBiome,
        postbossId,
        roomActionKey({ kind: 'interactKeepsakeRack' }),
      ),
      toIndex: 0,
    });

    const missing = simulateProjectAssembly(catalog, project);
    const fMissing = missing.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    expect(fMissing?.findings).toContainEqual(
      expect.objectContaining({ code: 'fountainRarityResultMissing', origin: outcome }),
    );
    const capability = candidateArtifactsForProjectEvaluationAssembly(missing)
      .biomeAt(goldenFBiome)
      ?.fountainRarity.at(outcome);
    const targetTraitKey = capability?.frontiers[0]?.mutationTargetKeys[0];
    expect(targetTraitKey).toBeDefined();

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey: targetTraitKey!,
    });
    const resolved = simulateProjectAssembly(catalog, project)
      .evaluation.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (resolved?.authoring !== 'complete' || resolved.validity !== 'valid') {
      throw new Error(
        `expected valid Phial Postboss result: ${JSON.stringify(resolved?.findings)}`,
      );
    }
    expect(resolved.rewards.branches[0]?.keepsakes.phial).toEqual({ status: 'consumed' });
    expect(resolved.findings).not.toContainEqual(
      expect.objectContaining({ code: 'fountainRarityResultMissing' }),
    );
  });

  it('mutates the selected Common god trait directly to Heroic and consumes the source', () => {
    const result = applyFountainUsedTransition(
      catalog,
      fountainEvent(),
      fountainRoom('ApolloWeaponBoon'),
      [fountainBranch(equippedTrait('ApolloWeaponBoon', 'Apollo'))],
    );
    const branch = result.branches[0];
    expect(branch?.keepsakes.phial).toEqual({ status: 'consumed' });
    expect(branch?.traitHistory?.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Heroic');
    expect(branch?.traitHistory?.events.at(-1)).toMatchObject({
      kind: 'rarityMutation',
      acquisitionRole: 'fountainRarity',
      acquisitionPoint: 'fountainUsed',
      targetTraitKey: 'ApolloWeaponBoon',
      oldRarity: 'Common',
      newRarity: 'Heroic',
    });
    expect(result.findings).toEqual([]);
  });

  it('consumes with no mutation when the Hephaestus cap empties only the mutation domain', () => {
    const result = applyFountainUsedTransition(catalog, fountainEvent(), undefined, [
      fountainBranch(
        equippedTrait('HephaestusWeaponBoon', 'Hephaestus', 1),
        cappedHephaestusHistory(),
      ),
    ]);
    const branch = result.branches[0];
    expect(branch?.keepsakes.phial).toEqual({ status: 'consumed' });
    expect(branch?.traitHistory?.equippedTraits.HephaestusWeaponBoon?.rarity).toBe('Common');
    expect(branch?.traitHistory?.events).not.toContainEqual(
      expect.objectContaining({ kind: 'rarityMutation' }),
    );
    expect(result.findings).toEqual([]);
  });

  it('leaves an empty consumption guard pending and does not spend a second use after consumption', () => {
    const empty = applyFountainUsedTransition(catalog, fountainEvent(), undefined, [
      fountainBranch(equippedTrait('ElementalDamageFloorBoon', 'Apollo')),
    ]);
    expect(empty.branches[0]?.keepsakes.phial).toEqual({ status: 'pending' });
    expect(empty.findings).toEqual([]);

    const consumed = consumePhial(createKeepsakeState(catalog, 'FountainRarityKeepsake'));
    const later = applyFountainUsedTransition(
      catalog,
      fountainEvent(2),
      fountainRoom('ApolloWeaponBoon'),
      [fountainBranch(equippedTrait('ApolloWeaponBoon', 'Apollo'), undefined, consumed)],
    );
    expect(later.branches[0]?.keepsakes.phial).toEqual({ status: 'consumed' });
    expect(later.branches[0]?.traitHistory?.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Common');
  });

  it('blocks later chronology on a missing or unavailable required target', () => {
    const branch = fountainBranch(equippedTrait('ApolloWeaponBoon', 'Apollo'));
    const missing = applyFountainUsedTransition(catalog, fountainEvent(), undefined, [branch]);
    expect(missing.branches).toEqual([]);
    expect(missing.findings[0]?.finding.code).toBe('fountainRarityResultMissing');

    const unavailable = applyFountainUsedTransition(
      catalog,
      fountainEvent(),
      fountainRoom('ZeusWeaponBoon'),
      [branch],
    );
    expect(unavailable.branches).toEqual([]);
    expect(unavailable.findings[0]?.finding.code).toBe('fountainRarityResultUnavailable');
  });
});
