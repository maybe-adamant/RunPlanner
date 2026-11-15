import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createAuthoringSession } from '@run-planner/engine/authoring';
import {
  recoverLegacyTimedOutcomes,
  type LegacyTimedOutcome,
} from '@run-planner/engine/project-migration';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { legacyTimedOutcomeLandings } from '../../src/project-migration/legacy-timed-outcomes';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

/** Each landed cycle's value as a schema 98 plan held it, with the command authoring it. */
function landedOutcomes(project: ProjectDocument) {
  return evaluate(project).evaluation.route.biomes.flatMap((biome) =>
    'rewards' in biome
      ? [
          ...biome.rewards.steadyGrowthOutcomes.map((outcome) => ({
            legacy: {
              kind: 'steadyGrowth',
              biomeKey: outcome.owner.biomeKey,
              occurrenceId: outcome.owner.occurrenceId,
              phaseKey: outcome.phaseKey,
              targetTraitKey: outcome.targetTraitKey!,
            } as LegacyTimedOutcome,
            author: (value: boolean): ProjectCommand => ({
              kind: 'ReplaceSteadyGrowthTarget',
              outcome: outcome.address,
              targetTraitKey: value ? outcome.targetTraitKey! : null,
            }),
          })),
          ...biome.rewards.transcendentEmbryoOutcomes.map((outcome) => ({
            legacy: {
              kind: 'transcendentEmbryo',
              biomeKey: outcome.owner.biomeKey,
              occurrenceId: outcome.owner.occurrenceId,
              phaseKey: outcome.phaseKey,
              blessing: outcome.value!,
            } as LegacyTimedOutcome,
            author: (value: boolean): ProjectCommand => ({
              kind: 'ReplaceTranscendentEmbryoTransformation',
              outcome: outcome.address,
              value: value ? outcome.value! : null,
            }),
          })),
        ]
      : [],
  );
}

const authored = loadSurfaceScheduledLifecycleCheckpoint();
const landed = landedOutcomes(authored);
/** The checkpoint as the 98 -> 99 transition leaves it: every timed outcome gone. */
const stripped = landed.reduce(
  (project, { author }) => applyProjectCommand(project, catalog, author(false)),
  authored,
);

describe('legacy timed outcome recovery', () => {
  it('puts each old value back on its source cycle as authoring it would', () => {
    expect(landed.map(({ legacy }) => legacy.kind).sort()).toEqual([
      ...Array<string>(7).fill('steadyGrowth'),
      ...Array<string>(4).fill('transcendentEmbryo'),
    ]);
    const session = createAuthoringSession(catalog, evaluate(stripped));
    for (const { author } of landed) expect(session.apply(author(true)).kind).toBe('applied');

    // Saved order does not matter: each value waits until its cycle lands.
    const recovery = recoverLegacyTimedOutcomes({
      catalog,
      project: stripped,
      outcomes: landed.map(({ legacy }) => legacy).reverse(),
    });
    expect(recovery.dropped).toEqual([]);
    expect(recovery.recovered).toHaveLength(landed.length);
    expect(encodeProjectDocument(recovery.project)).toBe(
      encodeProjectDocument(session.current().project),
    );
    expect(landedOutcomes(recovery.project).map(({ legacy }) => legacy)).toEqual(
      landed.map(({ legacy }) => legacy),
    );
  });

  it('drops an old value no cycle lands at, or one the engine refuses where it lands', () => {
    // The Embryo's first cycle lands first; recovering it lets Steady Growth's first land.
    const embryo = landed.find(({ legacy }) => legacy.kind === 'transcendentEmbryo')!.legacy;
    const growth = landed.find(({ legacy }) => legacy.kind === 'steadyGrowth')!.legacy;
    if (growth.kind !== 'steadyGrowth') throw new Error('Steady Growth outcome missing');
    const unlanded: LegacyTimedOutcome = { ...growth, phaseKey: 'Elsewhere' };
    const refused: LegacyTimedOutcome = { ...growth, targetTraitKey: 'ZeusWeaponBoon' };
    const recovery = recoverLegacyTimedOutcomes({
      catalog,
      project: stripped,
      outcomes: [unlanded, refused, embryo],
    });
    expect(recovery.recovered.map(({ legacy }) => legacy)).toEqual([embryo]);
    expect(recovery.dropped).toEqual([
      { legacy: refused, reason: 'refused' },
      { legacy: unlanded, reason: 'unlanded' },
    ]);
    const findings = evaluate(recovery.project).evaluation.findings;
    expect(findings.map(({ code }) => code)).toEqual(['steadyGrowthOutcomeMissing']);
  });

  it('leaves a plan unchanged when nothing lands', () => {
    const growth = landed.find(({ legacy }) => legacy.kind === 'steadyGrowth')!.legacy;
    const recovery = recoverLegacyTimedOutcomes({ catalog, project: stripped, outcomes: [growth] });
    expect(recovery.dropped).toEqual([{ legacy: growth, reason: 'unlanded' }]);
    expect(recovery.project).toBe(stripped);
  });

  it('attributes an old value only to the one source cycle landing at its encounter', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const owner = createOccurrenceAddress(biome, createOccurrenceId('surface-n-combat03'));
    const cycle = (offerOccurrenceId: string) =>
      createSteadyGrowthOutcomeAddress(
        createTraitOfferAddress(
          createIncomingRewardAddress(biome, createOccurrenceId(offerOccurrenceId)),
          'source',
        ),
        1,
      );
    const legacy: LegacyTimedOutcome = {
      kind: 'steadyGrowth',
      biomeKey: 'N',
      occurrenceId: 'surface-n-combat03',
      phaseKey: 'Encounter',
      targetTraitKey: 'ApolloWeaponBoon',
    };
    const landing = (address: ReturnType<typeof cycle>) =>
      ({ kind: 'steadyGrowth', address, owner, phaseKey: 'Encounter' }) as const;
    const first = landing(cycle('surface-n-combat01'));
    expect(legacyTimedOutcomeLandings([first, first], legacy)).toEqual([first.address]);
    expect(
      legacyTimedOutcomeLandings([first, landing(cycle('surface-n-combat02'))], legacy).map(
        semanticAddressKey,
      ),
    ).toHaveLength(2);
    expect(
      legacyTimedOutcomeLandings(
        [
          { ...first, kind: 'transcendentEmbryo' },
          { ...first, phaseKey: 'Combat1' },
        ],
        legacy,
      ),
    ).toEqual([]);
  });
});
