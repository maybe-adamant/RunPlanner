import { describe, expect, it } from 'vitest';

import type {
  CandidateOptionProjection,
  EncounterCandidateProjectionEvaluation,
} from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { projectEncounterPicker } from './encounterPickerProjection';
import { catalog } from '@run-planner/hades2-catalog';

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
  it('retains declaration labels and ordering while separating coverage, activation, and requirements evidence', () => {
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const model = projectEncounterPicker(
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
          Object.freeze({ kind: 'requirementsExcluded' as const }),
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
      explanation: 'This encounter does not meet the current encounter requirements.',
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
});
