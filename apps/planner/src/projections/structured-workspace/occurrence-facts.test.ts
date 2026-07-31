import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '../../../test/fixtures/underworldProject';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '../../../test/fixtures/surfaceProject';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceProjectSourceIndex } from './source-index';

function biomeSource(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function withFPrebossSelection(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
): ProjectDocument {
  const sourceOccurrenceId = goldenFOccurrenceId(10, 1);
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        decision.source.kind === 'occurrence' &&
                        decision.source.occurrenceId === sourceOccurrenceId
                          ? { ...decision, selection: { kind: 'normal' as const, exitKey } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

describe('structured workspace occurrence assembly facts', () => {
  it('keeps authored detail activation separate from evaluated entry and classifies Ephyra leaves', () => {
    const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(
      catalog,
      biomeSource(createRepresentativeNOPQProject(), 'Surface', 'N'),
    );
    const activeEphyra = nOccurrenceId('combat05');
    const dormantEphyra = nOccurrenceId('combat10');
    const activeSideReward = createLocalRewardAddress(
      nBiome,
      activeEphyra,
      'sideRooms',
      'sideDoor1',
    );
    const dormantSideChild = createLocalChildAddress(
      nBiome,
      dormantEphyra,
      'sideRooms',
      'sideDoor1',
    );
    const dormantSideReward = createLocalRewardAddress(
      nBiome,
      dormantEphyra,
      'sideRooms',
      'sideDoor1',
    );

    expect(facts.occurrence(activeEphyra)?.detailsActive).toBe(true);
    expect(facts.occurrence(dormantEphyra)?.detailsActive).toBe(false);
    expect(facts.leafLifecycle(createIncomingRewardAddress(nBiome, dormantEphyra))).toBe('active');
    expect(facts.leafLifecycle(activeSideReward)).toBe('active');
    expect(facts.leafLifecycle(dormantSideChild)).toBe('dormant');
    expect(facts.leafLifecycle(dormantSideReward)).toBe('dormant');
    expect(facts.leafSurface(dormantSideReward)).toBe('withheld');
    expect(
      facts.leafLifecycle(createIncomingRewardAddress(nBiome, createOccurrenceId('not-in-plan'))),
    ).toBe('absent');
  });

  it('keeps a selected Shop active behind an unresolved prefix and marks its retained unpicked inventory dormant', () => {
    const shop = createOccurrenceId('golden-f-preboss-shop');
    const offer = createShopOfferAddress(goldenFBiome, shop, 'MajorNonBoon');
    const selected = createWorkspaceBiomeOccurrenceAssemblyFacts(
      catalog,
      biomeSource(
        withFPrebossSelection(createGoldenFGHIProject(catalog), 'exit1'),
        'Underworld',
        'F',
      ),
    );
    const unpicked = createWorkspaceBiomeOccurrenceAssemblyFacts(
      catalog,
      biomeSource(
        withFPrebossSelection(createGoldenFGHIProject(catalog), 'exit2'),
        'Underworld',
        'F',
      ),
    );

    expect(selected.occurrence(shop)?.detailsActive).toBe(true);
    expect(selected.leafLifecycle(offer)).toBe('active');
    expect(selected.leafSurface(offer)).toBe('published');
    expect(unpicked.occurrence(shop)?.detailsActive).toBe(false);
    expect(unpicked.leafLifecycle(offer)).toBe('dormant');
    expect(unpicked.leafSurface(offer)).toBe('withheld');
  });

  it('keeps authored dormant Fields and Ship leaves published for editing', () => {
    const fields = createWorkspaceBiomeOccurrenceAssemblyFacts(
      catalog,
      biomeSource(createGoldenFGHIProject(catalog), 'Underworld', 'H'),
    );
    const ship = createWorkspaceBiomeOccurrenceAssemblyFacts(
      catalog,
      biomeSource(createRepresentativeNOPQProject(), 'Surface', 'O'),
    );
    const cage3 = createLocalRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-combat02'),
      'cages',
      'cage3',
    );
    const wheel2 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel2');
    const inactiveOffer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer2',
    );

    expect(fields.leafLifecycle(cage3)).toBe('dormant');
    expect(fields.leafSurface(cage3)).toBe('published');
    expect(ship.leafLifecycle(wheel2)).toBe('dormant');
    expect(ship.leafSurface(wheel2)).toBe('published');
    expect(ship.leafLifecycle(inactiveOffer)).toBe('dormant');
    expect(ship.leafSurface(inactiveOffer)).toBe('published');
  });
});
