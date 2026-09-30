import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { encounterCompositionView } from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import {
  projectEncounterComposition,
  projectGeneratedEncounterAssessment,
  projectGeneratedEncounterHighlightPicker,
  projectGeneratedEncounterWaveDraft,
  projectGeneratedFangsDraft,
} from '@planner/projections/structured-workspace/interactions/generated-encounter-projection';
import type { GeneratedEncounterAssessment } from '@run-planner/engine/simulation';

const labels = [
  { key: 'Guard', label: 'Whisper' },
  { key: 'Guard_Elite', label: 'Whisper (Elite)' },
  { key: 'Brawler', label: 'Wastrel' },
  { key: 'Brawler_Elite', label: 'Wastrel (Elite)' },
];
const baseAssessment = {
  supported: false,
  issues: [],
  composition: 'active',
  eligibleHighlightKeys: ['Guard', 'Brawler'],
  waves: [],
  knownRunBlacklistAdditions: [],
} as const satisfies GeneratedEncounterAssessment;
const introductionLabel = (key: string) => (key === 'RadiatorIntro' ? 'Spindle introduction' : key);
const items = (picker: ReturnType<typeof projectGeneratedEncounterHighlightPicker>) =>
  picker.sections.flatMap((section) => section.items);

describe('generated enemy presentation', () => {
  it('warns for declared once-per-run enemies among assessed active members', () => {
    const wave = (activeMemberKeys: readonly string[]) =>
      ({ activeMemberKeys }) as unknown as GeneratedEncounterAssessment['waves'][number];
    const projected = (waves: GeneratedEncounterAssessment['waves']) =>
      projectGeneratedEncounterAssessment(
        { ...baseAssessment, waves },
        [...labels, { key: 'Once', label: 'One-time enemy', blacklistAfterAppearance: true }],
        introductionLabel,
      ).warnings;
    expect(projected([wave(['Guard', 'Once']), wave(['Guard', 'Once'])])).toEqual([
      'One-time enemy can appear only once per run. An earlier uncustomized encounter may already include it.',
    ]);
    expect(projected([wave(['Guard', 'Brawler'])])).toEqual([]);
  });
  it('names the Menace source in each Menace finding', () => {
    const messages = projectGeneratedEncounterAssessment(
      {
        ...baseAssessment,
        issues: [
          { reason: 'menace', issue: 'countUnavailable', waveIndex: 1, key: 'Guard' },
          { reason: 'menace', issue: 'targetRequired', waveIndex: 2, key: 'Brawler' },
          { reason: 'menace', issue: 'targetUnavailable', waveIndex: 2, key: 'Guard_Elite' },
        ],
      },
      labels,
      introductionLabel,
    ).issues;
    expect(messages).toEqual([
      {
        message: 'Converted Whisper requests exceed its current count. Reduce Menace Count.',
        waveIndex: 1,
      },
      { message: 'Choose a Menace replacement before converting Wastrel.', waveIndex: 2 },
      {
        message:
          'The stored Menace replacement for Elite Whisper is unavailable. Choose another replacement.',
        waveIndex: 2,
      },
    ]);
  });
  it('renames elite variants without changing paired candidate ordering', () => {
    const picker = projectGeneratedEncounterHighlightPicker(
      undefined,
      undefined,
      labels,
      labels.map((choice) => choice.key),
      introductionLabel,
    );
    expect(items(picker).map((item) => item.label)).toEqual([
      'Whisper',
      'Elite Whisper',
      'Wastrel',
      'Elite Wastrel',
    ]);
  });
  it('leaves an absent shared enemy unselected in assessed and unassessed pickers', () => {
    for (const assessment of [baseAssessment, undefined]) {
      const picker = projectGeneratedEncounterHighlightPicker(
        assessment,
        undefined,
        labels,
        labels.map((choice) => choice.key),
        introductionLabel,
      );
      expect(picker.selected).toBeUndefined();
      expect(picker.sections.some((section) => section.kind === 'selectedInvalid')).toBe(false);
      expect(items(picker).every((item) => item.value !== '' && !item.selected)).toBe(true);
    }
  });
  it('lists unintroduced enemies as disabled options naming their introduction', () => {
    const introductionLabels = [...labels, { key: 'Radiator', label: 'Spindle' }];
    const assessment = {
      ...baseAssessment,
      issues: [
        {
          reason: 'introductionRequired',
          key: 'Radiator',
          introductionEncounterKey: 'RadiatorIntro',
          admitted: true,
          waveIndex: 1,
          position: 2,
        },
      ],
      introductions: {
        encounterKeyByEnemyKey: { Radiator: 'RadiatorIntro' },
        excludedHighlightKeys: ['Radiator'],
      },
      waves: [
        {
          waveIndex: 1,
          typeCount: { min: 2, max: 2 },
          additionalTypeCount: { min: 1, max: 1 },
          seeds: [],
          activeMemberKeys: ['Guard'],
          exhausted: false,
          eligibleKeysByPosition: [['Guard']],
          introductionExcludedKeysByPosition: [['Radiator']],
          sampledBudgetKeys: [],
        },
      ],
    } as const satisfies GeneratedEncounterAssessment;
    const repair =
      'Spindle is not introduced yet: select Spindle introduction for this encounter, or remove Spindle.';
    expect(
      projectGeneratedEncounterAssessment(assessment, introductionLabels, introductionLabel).issues,
    ).toEqual([{ message: repair, waveIndex: 1, field: 'enemies' }]);
    const excluded = { label: 'Spindle', disabled: true, explanation: repair };
    expect(
      projectGeneratedEncounterHighlightPicker(
        assessment,
        undefined,
        introductionLabels,
        [],
        introductionLabel,
      ).sections.at(-1),
    ).toMatchObject({ label: 'Needs introduction', items: [excluded] });
    expect(
      projectGeneratedEncounterWaveDraft(
        { ...assessment, issues: [] },
        1,
        0,
        [],
        introductionLabels,
        introductionLabel,
      ).picker.sections.at(-1),
    ).toMatchObject({ label: 'Needs introduction', items: [excluded] });
  });
  it('retains a selected shared enemy and marks it stale only when assessed unavailable', () => {
    const retained = projectGeneratedEncounterHighlightPicker(
      baseAssessment,
      'Brawler',
      labels,
      [],
      introductionLabel,
    );
    expect(retained.selected).toMatchObject({
      value: 'Brawler',
      label: 'Wastrel',
      disabled: false,
    });
    const stale = projectGeneratedEncounterHighlightPicker(
      baseAssessment,
      'Guard_Elite',
      labels,
      [],
      introductionLabel,
    );
    expect(stale.selected).toMatchObject({
      value: 'Guard_Elite',
      label: 'Elite Whisper',
      state: 'impossible',
    });
    const unassessed = projectGeneratedEncounterHighlightPicker(
      undefined,
      'Guard_Elite',
      labels,
      ['Guard'],
      introductionLabel,
    );
    expect(unassessed.selected).toMatchObject({ value: 'Guard_Elite', state: 'unassessed' });
  });
});

describe('Fangs target and perk presentation', () => {
  const fangsLabels = [
    { key: 'Guard_Elite', label: 'Whisper (Elite)' },
    { key: 'FishSwarmerSquad_Elite', label: 'Pinhead (Elite)', fangsCaveat: 'squad' as const },
  ];
  const perks = {
    Blink: { label: 'Shifter' },
    Fog: { label: 'Spiller', maxPerRoom: 1 },
  };
  const assessment = (fangs: GeneratedEncounterAssessment['fangs']): GeneratedEncounterAssessment =>
    ({
      supported: true,
      issues: [],
      composition: 'active',
      eligibleHighlightKeys: [],
      fangs,
      waves: [],
      knownRunBlacklistAdditions: [],
    }) as GeneratedEncounterAssessment;

  it('presents friendly cap/squad badges and follows engine completion', () => {
    const target = projectGeneratedFangsDraft(
      assessment({
        rank: 2,
        active: true,
        eligibleTypeKeys: ['Guard_Elite', 'FishSwarmerSquad_Elite'],
        perkKeys: [],
        eligiblePerkKeys: [],
        next: 'type',
        canFinish: false,
      }),
      undefined,
      fangsLabels,
      perks,
    );
    expect(
      target.picker.sections.flatMap((section) => section.items.map((item) => item.label)),
    ).toEqual(expect.arrayContaining(['Elite Whisper', 'Elite Pinhead (squad selection)']));
    const perk = projectGeneratedFangsDraft(
      assessment({
        rank: 99,
        active: true,
        eligibleTypeKeys: ['Guard_Elite'],
        perkKeys: [],
        eligiblePerkKeys: ['Blink', 'Fog'],
        next: 'perk',
        canFinish: false,
      }),
      { typeKey: 'Guard_Elite', perkKeys: [] },
      fangsLabels,
      perks,
    );
    expect(
      perk.picker.sections.flatMap((section) => section.items.map((item) => item.label)),
    ).toEqual(expect.arrayContaining(['Shifter', 'Spiller (one per room)']));
    expect(
      perk.picker.sections.flatMap((section) => section.items.map((item) => item.label)),
    ).not.toContain('Default');
  });

  it('does not offer stale Fangs selection a Finish action', () => {
    const stale = projectGeneratedFangsDraft(
      assessment({
        rank: 2,
        active: true,
        eligibleTypeKeys: ['Guard_Elite'],
        perkKeys: ['Blink', 'Orbit'],
        eligiblePerkKeys: ['Fog'],
        next: 'perk',
        canFinish: false,
        issue: 'perkUnavailable',
      }),
      { typeKey: 'Guard_Elite', perkKeys: ['Blink', 'Orbit'] },
      fangsLabels,
      perks,
    );
    expect(
      stale.picker.sections.flatMap((section) => section.items.map((item) => item.label)),
    ).not.toContain('Finish');
    expect(
      stale.picker.sections.flatMap((section) => section.items.map((item) => item.value.kind)),
    ).toContain('perkPrefix');
  });
});

describe('encounter composition presentation', () => {
  const view = (key: string) => {
    const value = encounterCompositionView(catalog, { selectedEncounterDefinitionKey: key });
    if (value === undefined) throw new Error(`${key} has no composition`);
    return projectEncounterComposition(value);
  };
  it('names each disposition and presents elite spawns', () => {
    const mourner = view('MournerIntro');
    expect(mourner.dispositionLabel).toBe('This encounter is fixed');
    expect(mourner.waves.at(-1)?.spawns).toEqual([
      { enemyKey: 'Mourner_Elite', label: 'Elite Mourner', count: 1 },
    ]);
    expect(view('RadiatorIntro').dispositionLabel).toBe('This encounter’s first wave is fixed');
    expect(view('GeneratedF').dispositionLabel).toBe('Not customized');
    expect(encounterCompositionView(catalog, { selectedEncounterDefinitionKey: 'Shop' })).toBe(
      undefined,
    );
  });
  it('publishes the assessed shared-enemy applicability on the bound interaction', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const composed = (waveCount: number) =>
      projectStructuredWorkspaceFixture(
        applyProjectCommand(createCompleteFGProject(), catalog, {
          kind: 'ReplaceEncounterCustomization',
          phase,
          decisionKey: 'generatedComposition',
          value: { kind: 'generated', waveCount, highlightKey: 'Guard' },
        }),
      ).workspace.interactions.encounterCustomizations.get(semanticAddressKey(phase))
        ?.generatedComposition;
    expect(composed(3)).toMatchObject({
      dispositionLabel: 'This encounter is generated',
      editable: true,
      sharedEnemy: true,
      waveCount: { value: 3 },
    });
    expect(composed(3)?.waves.map((wave) => wave.source)).toEqual([
      'authored',
      'authored',
      'authored',
    ]);
    expect(composed(1)?.sharedEnemy).toBe(false);
  });
});
