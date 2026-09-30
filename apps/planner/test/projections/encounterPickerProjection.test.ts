import { describe, expect, it } from 'vitest';

import type {
  CandidateOptionProjection,
  EncounterCandidateProjectionEvaluation,
} from '@planner/projections/candidates/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextual/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextual/contextualPicker';
import { projectEncounterPicker } from '@planner/projections/encounterPickerProjection';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  createFreshFileRouteProject,
  freshFileFBiome,
} from '@run-planner/test-fixtures/fresh-file';
import {
  createEncounterPhaseAddress,
  createOccurrenceId,
  decodeProjectDocument,
  encodeProjectDocument,
  type BiomeAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseAuthoringDomainForRoom,
  simulateProjectAssembly,
  type EncounterRequirementEvidence,
} from '@run-planner/engine/simulation';
import { createCandidateSessionFactory } from '@planner/projections/candidates/candidateProjection';

function candidate(
  value: string,
  support: EncounterCandidateProjectionEvaluation['result']['support'],
  evidence: EncounterCandidateProjectionEvaluation['result']['evidence'],
): CandidateOptionProjection<string, EncounterCandidateProjectionEvaluation> {
  return Object.freeze({
    value,
    evaluation: Object.freeze({
      kind: 'encounter' as const,
      result: Object.freeze({ evidence, support }),
    }),
  });
}

describe('encounter picker projection', () => {
  it('explains a Dream route exclusion without hiding the encounter', () => {
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const model = projectEncounterPicker(
      catalog,
      picker,
      [{ label: 'Nemesis event', value: 'NemesisRandomEvent' }],
      'GeneratedF',
      [
        candidate('NemesisRandomEvent', 'impossible', {
          kind: 'requirementsExcluded',
          exclusions: [
            {
              kind: 'requirements',
              encounterKey: 'NemesisRandomEvent',
              definitions: [
                {
                  encounterDefinitionKey: 'NemesisRandomEvent',
                  evaluation: {
                    kind: 'not',
                    satisfied: false,
                    child: {
                      kind: 'routeKeyEquals',
                      satisfied: true,
                      actual: 'Dream',
                      expected: 'Dream',
                    },
                  },
                },
              ],
            },
          ],
        }),
      ],
    );
    expect(model.sections[0]?.items[0]).toMatchObject({
      disabled: true,
      explanation: `Unavailable in ${catalog.routes.byKey.Dream!.label}.`,
    });
  });

  it('allows reopening an invalid selected Nemesis family without enabling an unavailable new encounter', () => {
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const choices = [{ label: 'Nemesis event', value: 'NemesisRandomEvent' }];
    const candidates = [candidate('NemesisRandomEvent', 'impossible', { kind: 'inactiveSlot' })];
    const selected = projectEncounterPicker(
      catalog,
      picker,
      choices,
      'NemesisRandomEvent',
      candidates,
    );
    expect(selected.selected).toMatchObject({ state: 'impossible', disabled: false });
    expect(selected.sections[0]!.items[0]).toBe(selected.selected);
    const unselected = projectEncounterPicker(catalog, picker, choices, 'GeneratedF', candidates);
    expect(unselected.sections[0]!.items[0]).toMatchObject({ state: 'impossible', disabled: true });
  });

  it('retains declaration labels and ordering while separating coverage, activation, and requirements evidence', () => {
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const model = projectEncounterPicker(
      catalog,
      picker,
      Object.freeze([
        Object.freeze({ label: 'Default combat', value: 'default' }),
        Object.freeze({ label: 'Required combat', value: 'required' }),
        Object.freeze({ label: 'Later combat', value: 'later' }),
        Object.freeze({ label: 'Inactive combat', value: 'inactive' }),
      ]),
      'default',
      Object.freeze([
        candidate(
          'default',
          'impossible',
          Object.freeze<EncounterCandidateProjectionEvaluation['result']['evidence']>({
            kind: 'requirementsExcluded' as const,
            exclusions: [
              {
                kind: 'requirements',
                encounterKey: 'default',
                definitions: [
                  {
                    encounterDefinitionKey: 'default',
                    evaluation: {
                      kind: 'counterRange',
                      satisfied: false,
                      axis: 'biomeDepthCache',
                      actual: 2,
                      expected: { min: 4 },
                    },
                  },
                ],
              },
            ],
          }),
        ),
        candidate('required', 'forced', Object.freeze({ kind: 'supported' as const })),
        candidate('later', 'unavailable', Object.freeze({ kind: 'coverageUnavailable' as const })),
        candidate('inactive', 'impossible', Object.freeze({ kind: 'inactiveSlot' as const })),
      ]),
    );

    expect(model.sections.map((section) => section.kind)).toEqual([
      'required',
      'selectedInvalid',
      'unassessed',
      'unavailable',
    ]);
    expect(model.selected).toMatchObject({
      disabled: true,
      explanation: 'Requires biome depth at least 4; currently 2.',
      label: 'Default combat',
      state: 'impossible',
      value: 'default',
    });
    expect(model.sections[2]?.items).toEqual([
      expect.objectContaining({
        disabled: false,
        explanation: 'This encounter phase has not been evaluated yet.',
        label: 'Later combat',
        state: 'unassessed',
      }),
    ]);
    expect(model.sections[3]).toMatchObject({
      collapsible: true,
      items: [
        expect.objectContaining({
          disabled: true,
          explanation: 'This encounter phase is not active for the selected room setup.',
          label: 'Inactive combat',
        }),
      ],
    });
  });

  it('lists a context-less phase as its declared encounters without availability claims', () => {
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const model = projectEncounterPicker(
      catalog,
      picker,
      Object.freeze([
        Object.freeze({ label: 'Default combat', value: 'default' }),
        Object.freeze({ label: 'Later combat', value: 'later' }),
      ]),
      'default',
      Object.freeze([
        candidate(
          'default',
          'unavailable',
          Object.freeze({ kind: 'coverageUnavailable' as const }),
        ),
        candidate('later', 'unavailable', Object.freeze({ kind: 'coverageUnavailable' as const })),
      ]),
    );
    expect(model.sections).toEqual([
      {
        key: 'unassessed:declared',
        kind: 'unassessed',
        label: 'Declared encounters · evaluated after earlier choices',
        collapsible: false,
        items: [
          expect.objectContaining({ label: 'Default combat', selected: true, disabled: false }),
          expect.objectContaining({ label: 'Later combat', selected: false, disabled: false }),
        ],
      },
    ]);
    for (const item of model.sections[0]!.items) {
      expect(item).not.toHaveProperty('status');
      expect(item).not.toHaveProperty('explanation');
    }
  });

  it('carries real encounter preparation failures through the candidate session to the picker', () => {
    const assembly = simulateProjectAssembly(catalog, createCompleteFGProject());
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
      'Encounter',
    );
    const keys = ['GeneratedF', 'ArtemisCombatF'];
    const candidates = createCandidateSessionFactory(catalog)
      .bind(assembly)
      .encounterPhases(phase, keys);
    const model = projectEncounterPicker(
      catalog,
      createContextualPickerProjection(createContextualOptionResolver(catalog)),
      keys.map((key) => ({ value: key, label: catalog.encounterDefinitions.byKey[key]!.label })),
      'GeneratedF',
      candidates,
    );
    const artemis = model.sections
      .flatMap((section) => section.items)
      .find((item) => item.value === 'ArtemisCombatF');
    expect(artemis).toMatchObject({
      disabled: true,
      explanation: expect.stringContaining('Requires biome depth at least 4; currently 1.'),
    });
  });

  it('lists introduction members with their gate or reachability evidence', () => {
    const items = (project: ProjectDocument, biome: BiomeAddress, occurrenceId: string) => {
      const assembly = simulateProjectAssembly(catalog, project);
      const phase = createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId(occurrenceId) },
        'Encounter',
      );
      const keys = ['GeneratedF', 'RadiatorIntro', 'ScreamerIntro'];
      return projectEncounterPicker(
        catalog,
        createContextualPickerProjection(createContextualOptionResolver(catalog)),
        keys.map((key) => ({ value: key, label: catalog.encounterDefinitions.byKey[key]!.label })),
        'GeneratedF',
        createCandidateSessionFactory(catalog).bind(assembly).encounterPhases(phase, keys),
      ).sections.flatMap((section) => section.items);
    };
    const fresh = createFreshFileRouteProject();
    expect(items(fresh, freshFileFBiome, 'fresh-2-0')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'RadiatorIntro', disabled: false }),
        expect.objectContaining({ value: 'ScreamerIntro', disabled: false }),
      ]),
    );
    expect(items(fresh, freshFileFBiome, 'fresh-1-0')).toContainEqual(
      expect.objectContaining({
        value: 'RadiatorIntro',
        disabled: true,
        explanation:
          'No encounter here can include Spindle / Spindle (Elite), so this introduction cannot occur.',
      }),
    );
    expect(items(fresh, freshFileFBiome, 'fresh-3-0')).toContainEqual(
      expect.objectContaining({
        value: 'RadiatorIntro',
        disabled: true,
        explanation: 'Spindle introduction was already completed this run.',
      }),
    );
    // The mature domain omits every introduction, so its rows are unchanged.
    const mature = createCompleteFGProject();
    const occurrence = mature.route.biomes[0]!.topology!.occurrences.find(
      (entry) => entry.occurrenceId === goldenFOccurrenceId(5, 1),
    )!;
    const matureKeys = encounterPhaseAuthoringDomainForRoom(
      catalog,
      goldenFBiome,
      catalog.rooms.byKey[occurrence.gameName]!,
      { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
      occurrence.encounters,
    )[0]!.choices.map((choice) => choice.key);
    expect(matureKeys).toEqual([
      'GeneratedF',
      'ArtemisCombatF',
      'ArachneCombatF',
      'NemesisCombatF',
      'NemesisRandomEvent',
    ]);
  });

  it('renders a retained off-route introduction as a disabled row with its route evidence', () => {
    const raw = JSON.parse(encodeProjectDocument(createCompleteFGProject()));
    const retained = raw.route.biomes[0].topology.occurrences.find(
      (entry: { occurrenceId: string }) => entry.occurrenceId === goldenFOccurrenceId(5, 1),
    );
    retained.encounters.encounterKeyByPhase.Encounter = 'RadiatorIntro';
    const project = decodeProjectDocument(raw, catalog);
    const occurrence = project.route.biomes[0]!.topology!.occurrences.find(
      (entry) => entry.occurrenceId === goldenFOccurrenceId(5, 1),
    )!;
    const keys = encounterPhaseAuthoringDomainForRoom(
      catalog,
      goldenFBiome,
      catalog.rooms.byKey[occurrence.gameName]!,
      { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
      occurrence.encounters,
    )[0]!.choices.map((choice) => choice.key);
    expect(keys).toContain('RadiatorIntro');
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
      'Encounter',
    );
    const model = projectEncounterPicker(
      catalog,
      createContextualPickerProjection(createContextualOptionResolver(catalog)),
      keys.map((key) => ({
        value: key,
        label: catalog.encounterDefinitions.byKey[key]?.label ?? key,
      })),
      'RadiatorIntro',
      createCandidateSessionFactory(catalog)
        .bind(simulateProjectAssembly(catalog, project))
        .encounterPhases(phase, keys),
    );
    expect(model.selected).toMatchObject({
      value: 'RadiatorIntro',
      state: 'impossible',
      explanation: expect.stringContaining(
        `Requires the ${catalog.routes.byKey.FreshFile!.label} route.`,
      ),
    });
  });

  it('explains all failed conditions without listing successful ones', () => {
    const requirements: EncounterRequirementEvidence[] = [
      {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        satisfied: false,
        actual: 3,
        expected: { min: 4 },
      },
      {
        kind: 'counterRange',
        axis: 'biomeEncounterDepth',
        satisfied: true,
        actual: 4,
        expected: { min: 1 },
      },
      {
        kind: 'currentRoomRewardExcludes',
        satisfied: false,
        actual: 'Boon',
        rewardTypes: ['Boon'],
      },
      {
        kind: 'encounterKeyCount',
        satisfied: false,
        scope: 'route',
        encounterKeys: ['ArtemisCombatF', 'ArtemisCombatG'],
        actual: 1,
        expected: { max: 0 },
      },
      {
        kind: 'previousRoomEncounterKeyCount',
        satisfied: false,
        encounterKeys: ['NemesisCombatF'],
        matchingEncounterKeys: ['NemesisCombatF'],
        actual: 1,
        roomWindow: 6,
        expected: { max: 0 },
      },
      {
        kind: 'currentRoomStructuralTagsInclude',
        satisfied: false,
        actual: ['Indoor'],
        expected: ['Outdoor'],
      },
    ];
    const model = projectEncounterPicker(
      catalog,
      createContextualPickerProjection(createContextualOptionResolver(catalog)),
      [{ value: 'ArtemisCombatF', label: 'Artemis combat' }],
      'ArtemisCombatF',
      [
        candidate('ArtemisCombatF', 'impossible', {
          kind: 'requirementsExcluded',
          exclusions: [
            {
              kind: 'requirements',
              encounterKey: 'ArtemisCombatF',
              definitions: [
                {
                  encounterDefinitionKey: 'ArtemisCombatF',
                  evaluation: { kind: 'all', satisfied: false, children: requirements },
                },
              ],
            },
          ],
        }),
      ],
    );
    expect(model.selected?.explanation).toBe(
      'Requires biome depth at least 4; currently 3. Unavailable with the current room reward: Boon. Artemis combat already occurred this run. Nemesis combat occurred within the previous 6 rooms. Requires outdoor rooms.',
    );
  });

  it('explains keepsake exclusions and inactive depth windows separately', () => {
    const model = projectEncounterPicker(
      catalog,
      createContextualPickerProjection(createContextualOptionResolver(catalog)),
      [
        { value: 'AthenaCombatP', label: 'Athena combat' },
        { value: 'GeneratedO', label: 'Ship combat' },
      ],
      'AthenaCombatP',
      [
        candidate('AthenaCombatP', 'impossible', {
          kind: 'requirementsExcluded',
          exclusions: [
            { kind: 'gorgonConsumed', encounterKey: 'AthenaCombatP' },
            {
              kind: 'requirements',
              encounterKey: 'AthenaCombatP',
              definitions: [
                {
                  encounterDefinitionKey: 'AthenaCombatP',
                  evaluation: {
                    kind: 'counterRange',
                    satisfied: false,
                    axis: 'biomeDepthCache',
                    actual: 3,
                    expected: { min: 4 },
                  },
                },
              ],
            },
          ],
        }),
        candidate('GeneratedO', 'impossible', {
          kind: 'inactiveSlot',
          requirement: {
            kind: 'counterRange',
            satisfied: false,
            axis: 'biomeEncounterDepth',
            actual: 6,
            expected: { min: 2, max: 5 },
          },
        }),
      ],
    );
    expect(model.selected?.explanation).toBe(
      'Athena has already appeared through Gorgon Amulet. Requires biome depth at least 4; currently 3.',
    );
    expect(
      model.sections.flatMap((section) => section.items).find((item) => item.value === 'GeneratedO')
        ?.explanation,
    ).toBe('Requires biome encounter depth 2–5; currently 6.');
  });

  it('preserves alternative groups and negated requirements in explanations', () => {
    const evaluation: EncounterRequirementEvidence = {
      kind: 'any',
      satisfied: false,
      children: [
        {
          kind: 'all',
          satisfied: false,
          children: [
            {
              kind: 'counterRange',
              axis: 'biomeDepthCache',
              satisfied: false,
              actual: 3,
              expected: { min: 4 },
            },
            {
              kind: 'currentRoomStructuralTagsInclude',
              satisfied: false,
              actual: ['Indoor'],
              expected: ['Outdoor'],
            },
          ],
        },
        {
          kind: 'not',
          satisfied: false,
          child: {
            kind: 'currentRoomRewardExcludes',
            satisfied: true,
            actual: 'Boon',
            rewardTypes: ['ClockworkGoal'],
          },
        },
      ],
    };
    const model = projectEncounterPicker(
      catalog,
      createContextualPickerProjection(createContextualOptionResolver(catalog)),
      [{ value: 'encounter', label: 'Encounter' }],
      'encounter',
      [
        candidate('encounter', 'impossible', {
          kind: 'requirementsExcluded',
          exclusions: [
            {
              kind: 'requirements',
              encounterKey: 'encounter',
              definitions: [{ encounterDefinitionKey: 'encounter', evaluation }],
            },
          ],
        }),
      ],
    );
    expect(model.selected?.explanation).toBe(
      'Requires one alternative: (Requires biome depth at least 4; currently 3. Requires outdoor rooms.) OR (Requires a room reward of Clockwork goal.)',
    );
  });
});
