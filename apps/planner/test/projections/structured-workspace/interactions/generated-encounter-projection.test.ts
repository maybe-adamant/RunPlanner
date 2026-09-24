import { describe, expect, it } from 'vitest';
import {
  projectGeneratedEncounterAssessment,
  projectGeneratedEncounterHighlightPicker,
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
const items = (picker: ReturnType<typeof projectGeneratedEncounterHighlightPicker>) =>
  picker.sections.flatMap((section) => section.items);

describe('generated enemy presentation', () => {
  it('warns for declared once-per-run enemies among assessed active members', () => {
    const wave = (activeMemberKeys: readonly string[]) =>
      ({ activeMemberKeys }) as unknown as GeneratedEncounterAssessment['waves'][number];
    const projected = (waves: GeneratedEncounterAssessment['waves']) =>
      projectGeneratedEncounterAssessment({ ...baseAssessment, waves }, [
        ...labels,
        { key: 'Once', label: 'One-time enemy', blacklistAfterAppearance: true },
      ]).warnings;
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
      );
      expect(picker.selected).toBeUndefined();
      expect(picker.sections.some((section) => section.kind === 'selectedInvalid')).toBe(false);
      expect(items(picker).every((item) => item.value !== '' && !item.selected)).toBe(true);
    }
  });
  it('retains a selected shared enemy and marks it stale only when assessed unavailable', () => {
    const retained = projectGeneratedEncounterHighlightPicker(
      baseAssessment,
      'Brawler',
      labels,
      [],
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
    );
    expect(stale.selected).toMatchObject({
      value: 'Guard_Elite',
      label: 'Elite Whisper',
      state: 'impossible',
    });
    const unassessed = projectGeneratedEncounterHighlightPicker(undefined, 'Guard_Elite', labels, [
      'Guard',
    ]);
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
