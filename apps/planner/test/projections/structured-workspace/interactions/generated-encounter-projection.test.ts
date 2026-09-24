import { describe, expect, it } from 'vitest';
import {
  projectGeneratedEncounterHighlightPicker,
  projectGeneratedFangsDraft,
} from '@planner/projections/structured-workspace/interactions/generated-encounter-projection';
import type { GeneratedEncounterAssessment } from '@run-planner/engine/simulation';

describe('generated enemy presentation', () => {
  it('renames elite variants without changing paired candidate ordering', () => {
    const labels = [
      { key: 'Guard', label: 'Whisper' },
      { key: 'Guard_Elite', label: 'Whisper (Elite)' },
      { key: 'Brawler', label: 'Wastrel' },
      { key: 'Brawler_Elite', label: 'Wastrel (Elite)' },
    ];
    const picker = projectGeneratedEncounterHighlightPicker(
      undefined,
      undefined,
      labels,
      labels.map((choice) => choice.key),
    );
    expect(picker.sections.flatMap((section) => section.items.map((item) => item.label))).toEqual([
      'Default',
      'Whisper',
      'Elite Whisper',
      'Wastrel',
      'Elite Wastrel',
    ]);
  });
});

describe('Fangs target and perk presentation', () => {
  const labels = [
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

  it('keeps Default on the target, presents friendly cap/squad badges, and follows engine completion', () => {
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
      labels,
      perks,
    );
    expect(
      target.picker.sections.flatMap((section) => section.items.map((item) => item.label)),
    ).toEqual(
      expect.arrayContaining(['Default', 'Elite Whisper', 'Elite Pinhead (squad selection)']),
    );
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
      labels,
      perks,
      false,
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
      labels,
      perks,
      false,
    );
    expect(
      stale.picker.sections.flatMap((section) => section.items.map((item) => item.label)),
    ).not.toContain('Finish');
    expect(
      stale.picker.sections.flatMap((section) => section.items.map((item) => item.value.kind)),
    ).toContain('perkPrefix');
  });
});
