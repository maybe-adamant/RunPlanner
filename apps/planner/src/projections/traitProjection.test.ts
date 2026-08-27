import { simulateProjectAssembly, type ProjectEvaluation } from '@run-planner/engine/simulation';
import {
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { projectRouteTraitOffers, projectTraitOfferFeedback } from './traitProjection';
import { createStructuredWorkspaceTestServices } from '@planner-test/fixtures/structuredWorkspace';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

const { structuredWorkspace } = createStructuredWorkspaceTestServices();

describe('route trait projection', () => {
  it('projects engine-agreed effective level and Persephone range without deriving either', () => {
    const offer: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    };
    const feedback = projectTraitOfferFeedback(offer, {
      value: offer,
      evaluation: {
        kind: 'traitOffer',
        result: {
          supported: true,
          branches: [],
          assessments: [],
          findings: [],
          persephoneLevelBonusMaximums: [5, undefined, undefined],
          effectiveLevels: [6, undefined, undefined],
        },
      },
    });

    expect(feedback.options[0]).toMatchObject({
      effectiveLevel: 6,
      persephoneLevelBonusMaximum: 5,
    });
    expect(feedback.options[1]).not.toHaveProperty('effectiveLevel');
    expect(feedback.options[1]).not.toHaveProperty('persephoneLevelBonusMaximum');
  });

  it('aggregates divergent branch evidence and sorts rows by engine chronology', () => {
    const source = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, source);
    const route = assembly.evaluation.routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
    const fEvaluation = route?.biomes.find((biome) => biome.biomeKey === 'F');
    const traces =
      fEvaluation !== undefined && 'rewards' in fEvaluation
        ? fEvaluation.rewards.selectedTraitOffers.filter((trace) => trace.address.biomeKey === 'F')
        : [];
    const firstTrace = traces[0];
    const secondTrace = traces[1];
    if (firstTrace === undefined || secondTrace === undefined || route === undefined) {
      throw new Error('F branch trait traces are missing');
    }
    if (firstTrace.offer.kind !== 'traits') throw new Error('fixture offer is not traits');
    const selectedIndex =
      firstTrace.offer.selectedOptionKey === 'option1'
        ? 0
        : firstTrace.offer.selectedOptionKey === 'option2'
          ? 1
          : 2;
    const selectedTraitKey = firstTrace.offer.options[selectedIndex]?.traitKey;
    if (selectedTraitKey === undefined) throw new Error('selected trait option is missing');
    const duplicateFinding = Object.freeze({
      code: 'alreadyEquipped' as const,
      detail: 'same branch evidence',
      traitKey: selectedTraitKey,
    });
    const secondFinding = Object.freeze({
      code: 'occupiedBoonSlot' as const,
      detail: 'slot evidence',
      traitKey: selectedTraitKey,
    });
    const invalidAssessment = Object.freeze({
      legal: false,
      findings: Object.freeze([duplicateFinding, duplicateFinding, secondFinding]),
    });
    const invalidBranch = Object.freeze({
      ...firstTrace.branches[0]!,
      assessments: Object.freeze([
        invalidAssessment,
        ...firstTrace.branches[0]!.assessments.slice(1),
      ]),
      composition: Object.freeze({
        ...firstTrace.branches[0]!.composition,
        legal: false,
        findings: Object.freeze([
          { code: 'nonPriorityTrait' as const, traitKey: selectedTraitKey },
        ]),
      }),
    });
    const invalidTrace = Object.freeze({
      ...firstTrace,
      branches: Object.freeze([invalidBranch]),
      chronologicalIndex: 5,
    });
    const validTrace = Object.freeze({ ...firstTrace, chronologicalIndex: 10 });
    const otherTrace = Object.freeze({ ...secondTrace, chronologicalIndex: 7 });
    const modifiedEvaluation = Object.freeze({
      ...assembly.evaluation,
      routes: Object.freeze(
        assembly.evaluation.routes.map((candidate) =>
          candidate.routeKey !== 'Underworld'
            ? candidate
            : Object.freeze({
                ...candidate,
                biomes: Object.freeze(
                  candidate.biomes.map((biome) => {
                    if (!('rewards' in biome)) return biome;
                    return Object.freeze({
                      ...biome,
                      rewards: Object.freeze({
                        ...biome.rewards,
                        selectedTraitOffers: Object.freeze(
                          biome.biomeKey === 'F'
                            ? [validTrace, otherTrace, invalidTrace]
                            : biome.rewards.selectedTraitOffers,
                        ),
                      }),
                    });
                  }),
                ),
              }),
        ),
      ),
    }) as ProjectEvaluation;
    const workspace = structuredWorkspace.project(assembly);
    const rows = projectRouteTraitOffers(
      catalog,
      source,
      modifiedEvaluation,
      'Underworld',
      workspace.interactions,
    );
    const firstKey = semanticAddressKey(firstTrace.address);
    const secondKey = semanticAddressKey(secondTrace.address);
    const firstRow = rows.find((row) => semanticAddressKey(row.address) === firstKey);
    const secondRow = rows.find((row) => semanticAddressKey(row.address) === secondKey);
    if (firstRow === undefined || secondRow === undefined) {
      throw new Error('aggregated trait rows are missing');
    }
    expect(firstRow.invalid).toBe(true);
    expect(firstRow.findingCount).toBe(3);
    expect(rows.indexOf(firstRow)).toBeLessThan(rows.indexOf(secondRow));
    // Chronology restarts for each biome. F's local indices are deliberately
    // later than the first G offer, but the route projection must still keep
    // the earlier biome's rows ahead of the later biome's rows.
    const firstGBiomeRowIndex = rows.findIndex((row) => row.biomeKey === 'G');
    expect(firstGBiomeRowIndex).toBeGreaterThan(rows.indexOf(secondRow));
    const feedback = projectTraitOfferFeedback(firstTrace.offer, {
      value: firstTrace.offer,
      evaluation: {
        kind: 'traitOffer',
        result: {
          supported: false,
          branches: [],
          persephoneLevelBonusMaximums: [],
          effectiveLevels: [],
          assessments: invalidTrace.branches.flatMap((branch) => branch.assessments),
          findings: [duplicateFinding, duplicateFinding, secondFinding],
        },
      },
    });
    expect(feedback.options[selectedIndex]?.reasons).toHaveLength(2);
    expect(feedback.options[selectedIndex]?.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Trait is already equipped'),
        expect.stringContaining('Ordinary boon slot is occupied'),
      ]),
    );
  });

  it('resolves duplicate occurrence IDs within the owning biome', () => {
    const source = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, source);
    const routeEvaluation = assembly.evaluation.routes.find(
      (route) => route.routeKey === 'Underworld',
    );
    const gEvaluation = routeEvaluation?.biomes.find((biome) => biome.biomeKey === 'G');
    const trace =
      gEvaluation !== undefined && 'rewards' in gEvaluation
        ? gEvaluation.rewards.selectedTraitOffers.find(
            (candidate) =>
              candidate.address.biomeKey === 'G' && 'occurrenceId' in candidate.address.owner,
          )
        : undefined;
    if (trace === undefined || !('occurrenceId' in trace.address.owner)) {
      throw new Error('G trait trace with an occurrence owner is missing');
    }
    const traceAddress = trace.address.owner;
    if (!('biomeKey' in traceAddress) || !('occurrenceId' in traceAddress)) {
      throw new Error('G trait trace address is not occurrence-owned');
    }
    const sourceRoute = source.routes.find((route) => route.routeKey === 'Underworld');
    const fBiome = sourceRoute?.biomes.find((biome) => biome.biomeKey === 'F');
    const fOccurrence = fBiome?.topology?.occurrences[0];
    if (sourceRoute === undefined || fBiome === undefined || fOccurrence === undefined) {
      throw new Error('F occurrence fixture is missing');
    }

    // Occurrence IDs are biome-scoped. Make the F occurrence collide with the
    // G owner so a route-wide scan would return the wrong game name.
    const project = Object.freeze({
      ...source,
      routes: Object.freeze(
        source.routes.map((route) =>
          route.routeKey !== 'Underworld'
            ? route
            : Object.freeze({
                ...route,
                biomes: Object.freeze(
                  route.biomes.map((biome) =>
                    biome.biomeKey !== 'F' || biome.topology === null
                      ? biome
                      : Object.freeze({
                          ...biome,
                          topology: Object.freeze({
                            ...biome.topology,
                            occurrences: Object.freeze([
                              Object.freeze({
                                ...fOccurrence,
                                occurrenceId: traceAddress.occurrenceId,
                              }),
                              ...biome.topology.occurrences.slice(1),
                            ]),
                          }),
                        }),
                  ),
                ),
              }),
        ),
      ),
    });
    const workspace = structuredWorkspace.project(assembly);
    const rows = projectRouteTraitOffers(
      catalog,
      project,
      assembly.evaluation,
      'Underworld',
      workspace.interactions,
    );
    const row = rows.find(
      (candidate) =>
        candidate.biomeKey === 'G' &&
        (candidate.address.owner.kind === 'encounterPhase'
          ? candidate.address.owner.owner.occurrenceId
          : candidate.address.owner.kind === 'gorgonPhase'
            ? candidate.address.owner.encounter.owner.occurrenceId
            : candidate.address.owner.kind === 'acquisitionEntry'
              ? candidate.address.owner.site.owner.kind === 'occurrence' &&
                candidate.address.owner.site.owner.occurrenceId
              : candidate.address.owner.occurrenceId) === traceAddress.occurrenceId,
    );
    if (row === undefined) throw new Error('G trait row is missing');
    expect(row.biomeKey).toBe('G');
    expect(row.locationLabel).toBe(
      sourceRoute.biomes
        .find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === traceAddress.occurrenceId,
        )?.gameName,
    );
  });

  it('presents first-Olympian composition findings without inventing option prerequisites', () => {
    const offer: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
        { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' as const },
      ] as const,
      selectedOptionKey: 'option1' as const,
    };
    const feedback = projectTraitOfferFeedback(offer, {
      value: offer,
      evaluation: {
        kind: 'traitOffer',
        result: {
          supported: false,
          branches: [],
          persephoneLevelBonusMaximums: [],
          effectiveLevels: [],
          assessments: [],
          findings: [
            {
              code: 'nonPriorityTrait' as const,
              traitKey: 'ApolloRetaliateBoon',
            },
            { code: 'missingAttackOrSpecial' as const },
            { code: 'missingAttackOrSpecial' as const },
          ],
        },
      },
    });
    expect(feedback.options[2]?.reasons).toEqual([
      expect.stringContaining('First Olympian offer needs a priority trait'),
    ]);
    expect(feedback.options[0]?.reasons).toEqual([]);
    expect(feedback.contextMessage).toContain('First Olympian offer needs Attack or Special');
    expect(
      feedback.contextMessage?.match(/First Olympian offer needs Attack or Special/g),
    ).toHaveLength(1);
  });

  it('projects an active rarity-floor finding as repairable option copy', () => {
    const offer: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' as const },
        { traitKey: 'ApolloCastBoon', rarity: 'Epic' as const },
      ] as const,
      selectedOptionKey: 'option1' as const,
    };
    const feedback = projectTraitOfferFeedback(offer, {
      value: offer,
      evaluation: {
        kind: 'traitOffer',
        result: {
          supported: false,
          branches: [],
          persephoneLevelBonusMaximums: [],
          effectiveLevels: [],
          assessments: [],
          findings: [
            {
              code: 'rarityRollUnavailable' as const,
              traitKey: 'ApolloWeaponBoon',
              detail: 'Rare',
            },
          ],
        },
      },
    });
    expect(feedback.options[0]?.legal).toBe(false);
    expect(feedback.options[0]?.reasons).toEqual([
      expect.stringContaining('Rarity roll is unavailable'),
    ]);
    expect(feedback.options[1]?.reasons).toEqual([]);
    expect(feedback.options[2]?.reasons).toEqual([]);
  });

  it('presents an unavailable selected trait as offer-level feedback', () => {
    const offer: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [{ traitKey: 'ApolloWeaponBoon', rarity: 'Common' }],
      selectedOptionKey: 'option1',
    };
    const feedback = projectTraitOfferFeedback(offer, {
      value: offer,
      evaluation: {
        kind: 'traitOffer',
        result: {
          supported: false,
          branches: [],
          persephoneLevelBonusMaximums: [],
          effectiveLevels: [],
          assessments: [],
          findings: [{ code: 'traitOfferSelectionUnavailable' }],
        },
      },
    });
    expect(feedback.contextMessage).toContain('Choose a materialized trait');
  });

  it('presents prerequisite evidence with player-facing trait labels', () => {
    const offer: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'SlowExAttackBoon', rarity: 'Common' as const },
        { traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const },
        { traitKey: 'DemeterCastBoon', rarity: 'Common' as const },
      ] as const,
      selectedOptionKey: 'option1' as const,
    };
    const feedback = projectTraitOfferFeedback(
      offer,
      {
        value: offer,
        evaluation: {
          kind: 'traitOffer',
          result: {
            supported: false,
            branches: [],
            persephoneLevelBonusMaximums: [],
            effectiveLevels: [],
            assessments: [],
            findings: [
              {
                code: 'missingPrerequisite' as const,
                traitKey: 'SlowExAttackBoon',
                requirementTraitKeys: ['AphroditeWeaponBoon', 'ApolloWeaponBoon'],
              },
            ],
          },
        },
      },
      (traitKey) =>
        ({
          AphroditeWeaponBoon: 'Flutter Strike',
          ApolloWeaponBoon: 'Nova Strike',
        })[traitKey] ?? traitKey,
    );
    expect(feedback.options[0]?.reasons).toEqual([
      'Trait prerequisite is missing: Requires one of Flutter Strike or Nova Strike.',
    ]);
    expect(feedback.options[0]?.reasons.join(' ')).not.toContain('WeaponBoon');
  });

  it('presents an invalid acquisition target with its player-facing label', () => {
    const offer: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Hera',
      options: [
        {
          traitKey: 'BoonDecayBoon',
          rarity: 'Common' as const,
          targetTraitKey: 'ZeusWeaponBoon',
        },
        { traitKey: 'HeraWeaponBoon', rarity: 'Common' as const },
        { traitKey: 'HeraSpecialBoon', rarity: 'Common' as const },
      ] as const,
      selectedOptionKey: 'option1' as const,
    };
    const feedback = projectTraitOfferFeedback(
      offer,
      {
        value: offer,
        evaluation: {
          kind: 'traitOffer',
          result: {
            supported: false,
            branches: [],
            persephoneLevelBonusMaximums: [],
            effectiveLevels: [],
            assessments: [],
            findings: [
              {
                code: 'targetedAcquisitionTargetUnavailable' as const,
                traitKey: 'BoonDecayBoon',
                detail: 'ZeusWeaponBoon',
              },
            ],
          },
        },
      },
      (traitKey) =>
        ({
          ZeusWeaponBoon: 'Heaven Strike',
        })[traitKey] ?? traitKey,
    );

    expect(feedback.options[0]?.reasons).toEqual([expect.stringContaining('Heaven Strike')]);
    expect(feedback.options[0]?.reasons.join(' ')).not.toContain('ZeusWeaponBoon');
  });
});
