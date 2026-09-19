import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  simulateProjectAssembly,
  createPreparedProjectCandidateSession,
} from '../../src/simulation';
import { createBiomeAddress, createTargetAddress } from '../../src/authored-project';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';

it('publishes a command-authored Dream route through the strict execution codec', () => {
  const assembly = simulateProjectAssembly(catalog, dreamMixedHandoffProject());
  expect(assembly.evaluation.findings).toEqual([]);
  const candidates = createPreparedProjectCandidateSession(catalog, assembly);
  const n = createBiomeAddress('Dream', 'N');
  const nStart = assembly.project.route.biomes.find((biome) => biome.biomeKey === 'N')!.topology!
    .startOccurrenceId;
  expect(
    candidates.evaluate({
      kind: 'roomTarget',
      target: createTargetAddress(n, { kind: 'occurrence', occurrenceId: nStart }, 'prehub'),
      gameName: 'N_PreHub01',
    }),
  ).toMatchObject({ result: { pressure: { biomeDepthCache: 2, selectedPossible: true } } });
  const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
  expect(plan.routeKey).toBe('Dream');
  expect(plan.extent.biomeKeys).toEqual(['Q', 'F', 'N']);
  expect(
    plan.occurrences
      .filter((room) => room.resumeBoundary === 'postbossEntry')
      .map((room) => room.gameName),
  ).toEqual(['Dream_PostBoss01', 'Dream_PostBoss02', 'Dream_PostBoss03']);
  for (const gameName of ['F_Opening02', 'N_Opening01']) {
    const room = plan.occurrences.find((room) => room.gameName === gameName);
    expect(room?.overview.encounterPhases).toEqual([
      { slotKey: 'Encounter', encounterKey: 'OpeningEmpty', kind: 'nonCombat' },
    ]);
    expect(room?.overview.incomingReward).toBeUndefined();
  }
  expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  const wire = JSON.parse(encodeExecutionPlan(plan));
  for (const biomeKeys of [[], ['Q', 'Q'], ['Unknown'], ['Q', 'F', 'N', 'H', 'O']]) {
    expect(() => decodeExecutionPlan({ ...wire, extent: { ...wire.extent, biomeKeys } })).toThrow();
  }
  for (const routeKey of ['Surface', 'Underworld']) {
    expect(() => decodeExecutionPlan({ ...wire, routeKey })).toThrow();
  }
});
