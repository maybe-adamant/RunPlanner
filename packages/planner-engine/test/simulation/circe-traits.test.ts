import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createRouteAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  activateTemporaryArcana,
  createPreparedProjectCandidateSession,
  promoteArcana,
  simulateProjectAssembly,
  suppressFearVow,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome';
import { processEncounterTraitOffer } from '../../src/simulation/rewards/processing';
import { createTraitHistoryState, evaluateReachedTraitOffer } from '../../src/simulation/traits';

const surface = createRouteAddress('Surface');
const circeOwner = createTraitOfferAddress(
  createEncounterPhaseAddress(
    oBiome,
    { kind: 'occurrence', occurrenceId: oOccurrenceIds.story },
    'Encounter',
  ),
  'selection',
);

function circeOffer(
  selectedOptionKey: Extract<AuthoredTraitOffer, { kind: 'traits' }>['selectedOptionKey'],
  options: Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
): AuthoredTraitOffer {
  return Object.freeze({ kind: 'traits', giverKey: 'Circe', options, selectedOptionKey });
}

function withCirce(
  offer: AuthoredTraitOffer,
  manualArcanaKeys: readonly string[] = [],
  fearRanks: Readonly<Record<string, number>> = {},
): ProjectDocument {
  let project = createRepresentativeNOProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: surface,
    arcanaKeys: manualArcanaKeys,
  });
  if (Object.keys(fearRanks).length > 0) {
    for (const [vowKey, rank] of Object.entries(fearRanks)) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFearVowRank',
        route: surface,
        vowKey,
        rank,
      });
    }
  }
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: circeOwner,
    value: offer,
  });
}

function oEvaluation(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  const biome = assembly.evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (biome === undefined || biome.authoring !== 'complete') throw new Error('O must be evaluated');
  return { assembly, biome };
}

function authoredCirceOffer(
  project: ProjectDocument,
): Extract<AuthoredTraitOffer, { kind: 'traits' }> {
  const value = project.routes
    .find((route) => route.routeKey === 'Surface')!
    .biomes.find((biome) => biome.biomeKey === 'O')!
    .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === oOccurrenceIds.story)!
    .encounters.traitOffersByPhase!.Encounter!.Story_Circe_01;
  if (value === undefined) throw new Error('Circe offer must be authored');
  if (value?.kind !== 'traits') throw new Error('Circe offer must contain traits');
  return value;
}

describe('Circe selected trait acquisition', () => {
  it('binds the catalog-owned nine-choice provider and applies direct selection plus Red at its pre-effect frontier', () => {
    expect(catalog.traitGivers.byKey.Circe?.traitKeys).toHaveLength(9);
    const project = withCirce(
      circeOffer('option1', [
        {
          traitKey: 'RandomArcanaTrait',
          circeResolution: { kind: 'activateArcana', arcanaKeys: ['ChanneledCast'] },
        },
        { traitKey: 'CirceShrinkTrait' },
        { traitKey: 'CirceEnlargeTrait' },
      ]),
    );
    const { biome } = oEvaluation(project);
    expect(
      biome.rewards.runStateSnapshots.some(
        (snapshot) => snapshot.traits.equippedTraits.RandomArcanaTrait !== undefined,
      ),
    ).toBe(true);
    const branch = biome.rewards.branches[0]!;
    expect(branch.arcanaFear.arcana.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ChanneledCast', origin: 'temporary', rarity: 'Epic' }),
      ]),
    );
  });

  it('permits Red’s exhausted empty no-op and promotes only Epic manual, automatic, and temporary Lapis targets', () => {
    const lapis = circeOffer('option1', [
      {
        traitKey: 'ArcanaRarityTrait',
        circeResolution: { kind: 'promoteArcana', arcanaKeys: ['CastCount', 'ChanneledCast'] },
      },
      { traitKey: 'CirceShrinkTrait' },
      { traitKey: 'CirceEnlargeTrait' },
    ]);
    const state = createArcanaFearState(catalog, {
      ...createDefaultRouteLoadout(catalog),
      manualArcanaKeys: ['CastCount'],
    });
    const temporary = activateTemporaryArcana(catalog, state, ['ChanneledCast'], {
      owner: circeOwner.owner,
      sequence: 0,
    });
    if (!temporary.legal) throw new Error('temporary Lapis fixture must be legal');
    const heroic = promoteArcana(catalog, temporary.state, ['CardDraw'], {
      owner: circeOwner.owner,
      sequence: 1,
    });
    if (!heroic.legal) throw new Error('Heroic Lapis exclusion fixture must be legal');
    const applied = processEncounterTraitOffer(
      catalog,
      initializeTestRewardBranches(heroic.state)[0]!,
      circeOwner.owner,
      lapis,
      2,
      'encounterCompleted',
    );
    const active = applied.arcanaFear.arcana.active;
    expect(active.find((card) => card.key === 'CastCount')).toMatchObject({ rarity: 'Heroic' });
    expect(active.find((card) => card.key === 'ChanneledCast')).toMatchObject({
      origin: 'temporary',
      rarity: 'Heroic',
    });
    expect(active.find((card) => card.key === 'CardDraw')).toMatchObject({ rarity: 'Heroic' });

    const exhaustedActivation = activateTemporaryArcana(
      catalog,
      createArcanaFearState(catalog, createDefaultRouteLoadout(catalog)),
      catalog.arcanaCards.values.map((card) => card.key),
      { owner: circeOwner.owner, sequence: 0 },
    );
    if (!exhaustedActivation.legal) {
      throw new Error('exhausted Red fixture must use legal run-local Arcana activation');
    }
    const exhausted = exhaustedActivation.state;
    const red = processEncounterTraitOffer(
      catalog,
      initializeTestRewardBranches(exhausted)[0]!,
      circeOwner.owner,
      circeOffer('option1', [
        {
          traitKey: 'RandomArcanaTrait',
          circeResolution: { kind: 'activateArcana', arcanaKeys: [] },
        },
        { traitKey: 'CirceShrinkTrait' },
        { traitKey: 'CirceEnlargeTrait' },
      ]),
      1,
      'encounterCompleted',
    );
    expect(red.arcanaFear).toBe(exhausted);
  });

  it('gates Black Night from effective configured removable Vows, including Rivals and already-disabled state', () => {
    const black = circeOffer('option1', [
      {
        traitKey: 'RemoveShrineTrait',
        circeResolution: { kind: 'disableFear', vowKey: 'EnemyDamageShrineUpgrade' },
      },
      { traitKey: 'CirceShrinkTrait' },
      { traitKey: 'CirceEnlargeTrait' },
    ]);
    const unavailable = oEvaluation(withCirce(black));
    expect(unavailable.biome.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'circeOptionUnavailable' })]),
    );
    const rivals = oEvaluation(withCirce(black, [], { BossDifficultyShrineUpgrade: 1 }));
    expect(rivals.biome.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'circeOptionUnavailable' })]),
    );
    const removable = oEvaluation(withCirce(black, [], { EnemyDamageShrineUpgrade: 1 }));
    expect(removable.biome.rewards.branches[0]!.arcanaFear.fear.effectiveRanks).toMatchObject({
      EnemyDamageShrineUpgrade: 0,
    });

    const configured = createArcanaFearState(catalog, {
      ...createDefaultRouteLoadout(catalog),
      fearRanks: {
        ...createDefaultRouteLoadout(catalog).fearRanks,
        EnemyDamageShrineUpgrade: 1,
      },
    });
    const disabled = suppressFearVow(catalog, configured, 'EnemyDamageShrineUpgrade', {
      owner: circeOwner,
      sequence: 1,
    });
    if (!disabled.legal) throw new Error('disabled Black Night fixture must be legal');
    const findings = new Map();
    const repeated = processEncounterTraitOffer(
      catalog,
      initializeTestRewardBranches(disabled.state)[0]!,
      circeOwner.owner,
      black,
      2,
      'encounterCompleted',
      findings,
    );
    expect(repeated.arcanaFear).toBe(disabled.state);
    expect(
      [...findings.values()].some((entry) => entry.finding.code === 'circeOptionUnavailable'),
    ).toBe(true);
  });

  it('retains the missing child repair domain at Circe and stops later O state', () => {
    const project = withCirce(
      circeOffer('option1', [
        { traitKey: 'RandomArcanaTrait' },
        { traitKey: 'CirceShrinkTrait' },
        { traitKey: 'CirceEnlargeTrait' },
      ]),
    );
    const { assembly, biome } = oEvaluation(project);
    expect(biome.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'circeResolutionMissing' })]),
    );
    expect(
      biome.rewards.branches[0]?.traitHistory?.equippedTraits.RandomArcanaTrait,
    ).toBeUndefined();
    expect(biome.coverage).toMatchObject({ kind: 'prefix' });
    const domain = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'circeResolutionDomain',
      trait: circeOwner,
      value: project.routes
        .find((route) => route.routeKey === 'Surface')!
        .biomes.find((biome) => biome.biomeKey === 'O')!
        .topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === oOccurrenceIds.story,
        )!.encounters.traitOffersByPhase!.Encounter!.Story_Circe_01!,
      optionKey: 'option1',
    });
    expect(domain).toMatchObject({ kind: 'circeResolutionDomain', result: { requiredCount: 1 } });
  });

  it('canonicalizes and deep-freezes Circe Arcana sets, retains dormant detail, and rejects an unknown encoded Vow', () => {
    const project = withCirce(
      circeOffer('option1', [
        {
          traitKey: 'ArcanaRarityTrait',
          circeResolution: { kind: 'promoteArcana', arcanaKeys: ['CastCount', 'CardDraw'] },
        },
        { traitKey: 'CirceShrinkTrait' },
        { traitKey: 'CirceEnlargeTrait' },
      ]),
    );
    const first = authoredCirceOffer(project);
    const resolution = first.options[0].circeResolution;
    expect(resolution).toMatchObject({
      kind: 'promoteArcana',
      arcanaKeys: ['CastCount', 'CardDraw'],
    });
    if (resolution?.kind !== 'promoteArcana') throw new Error('expected promote resolution');
    expect(Object.isFrozen(resolution)).toBe(true);
    expect(Object.isFrozen(resolution.arcanaKeys)).toBe(true);

    const dormant = applyProjectCommand(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitSelection',
        trait: circeOwner,
        selectedOptionKey: 'option2',
      }),
      catalog,
      { kind: 'ReplaceTraitSelection', trait: circeOwner, selectedOptionKey: 'option1' },
    );
    expect(authoredCirceOffer(dormant).options[0].circeResolution).toEqual(resolution);

    const encoded = JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
    const routes = encoded.routes as Record<string, unknown>[];
    const o = (
      routes.find((route) => route.routeKey === 'Surface')!.biomes as Record<string, unknown>[]
    ).find((biome) => biome.biomeKey === 'O')!;
    const story = (
      (o.topology as Record<string, unknown>).occurrences as Record<string, unknown>[]
    ).find((occurrence) => occurrence.occurrenceId === oOccurrenceIds.story)!;
    const options = (
      ((story.encounters as Record<string, unknown>).traitOffersByPhase as Record<string, unknown>)
        .Encounter as Record<string, unknown>
    ).Story_Circe_01 as Record<string, unknown>;
    (
      (options.options as Record<string, unknown>[])[0]!.circeResolution as Record<string, unknown>
    ).kind = 'disableFear';
    (
      (options.options as Record<string, unknown>[])[0]!.circeResolution as Record<string, unknown>
    ).vowKey = 'UnknownVow';
    delete (
      (options.options as Record<string, unknown>[])[0]!.circeResolution as Record<string, unknown>
    ).arcanaKeys;
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow('unknown Vow');
  });

  it('retains divergent Arcana frontiers through trace grouping for atomic-domain rejection', () => {
    const offer = circeOffer('option1', [
      { traitKey: 'RandomArcanaTrait' },
      { traitKey: 'CirceShrinkTrait' },
      { traitKey: 'CirceEnlargeTrait' },
    ]);
    const initial = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
    const changed = activateTemporaryArcana(catalog, initial, ['ChanneledCast'], {
      owner: circeOwner,
      sequence: 1,
    });
    if (!changed.legal) throw new Error('divergent Circe frontier fixture must be legal');
    const history = createTraitHistoryState();
    const context = Object.freeze({ resolvedProviderKey: 'Circe' });
    const branches = [initial, changed.state].map((arcanaFear) => {
      const branch = initializeTestRewardBranches(arcanaFear)[0]!;
      return Object.freeze({
        ...branch,
        traitEvaluations: Object.freeze([
          evaluateReachedTraitOffer(
            catalog,
            circeOwner.owner,
            'selection',
            offer,
            history,
            context,
            0,
            arcanaFear,
          ),
        ]),
      });
    });
    const products = selectedTraitOfferProducts(Object.freeze(branches));
    const contexts = products.candidateContexts.get(semanticAddressKey(circeOwner));
    expect(contexts).toHaveLength(2);
    const domains = createTraitOfferCandidateArtifacts(catalog, products.candidateContexts)
      .at(circeOwner)
      ?.circeResolution(offer, 'option1');
    expect(domains).toHaveLength(2);
    expect(domains?.map((domain) => domain.arcanaKeys.includes('ChanneledCast'))).toEqual([
      true,
      false,
    ]);
  });
});
