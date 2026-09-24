import { describe, expect, it } from 'vitest';
import { projectGeneratedEncounterHighlightPicker } from '@planner/projections/structured-workspace/interactions/generated-encounter-projection';

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
