import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress } from '@run-planner/engine/authored-project';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { CandidateOptionProjection } from '@planner/projections/candidates/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextual/contextualOptions';
import {
  createContextualPickerProjection,
  declaredChoicesPicker,
} from '@planner/projections/contextual/contextualPicker';

const biome = createBiomeAddress('Underworld', 'F');

function start(value: string, supported: readonly string[]): CandidateOptionProjection<string> {
  const evaluation: ProjectCandidateEvaluation = {
    kind: 'startRoom',
    result: {
      gameName: value,
      supportedGameNames: supported,
      selectedPossible: supported.includes(value),
    },
  };
  return { value, evaluation };
}

describe('contextual picker projection', () => {
  it('presents declared choices with retained invalid selection and unavailable choices separated', () => {
    const choices = [
      { key: 'default', value: '', label: 'Default' },
      { key: 'retained', value: 'retained', label: 'Saved choice', disabled: true },
      {
        key: 'other',
        value: 'other',
        label: 'Other',
        disabled: true,
        explanation: 'Already chosen',
      },
    ];
    const model = declaredChoicesPicker(choices, 'retained');
    expect(model.selected).toMatchObject({ value: 'retained', disabled: true });
    expect(
      model.sections.map((section) => [
        section.kind,
        section.collapsible,
        section.items.map((item) => item.value),
      ]),
    ).toEqual([
      ['selectedInvalid', false, ['retained']],
      ['category', false, ['']],
      ['unavailable', true, ['other']],
    ]);
    expect(model.sections[2]!.items[0]!.explanation).toBe('Already chosen');
    expect(declaredChoicesPicker(choices.slice(0, 1), '').sections).toHaveLength(1);
  });
  it('orders required, selected-invalid, possible, unassessed, and unavailable sections from engine evidence', () => {
    const options = Object.freeze([
      start('required', ['required']),
      start('possible', ['possible', 'other']),
      start('selected-invalid', ['other']),
      start('unavailable', ['other']),
      {
        value: 'unassessed',
        evaluation: {
          kind: 'unavailable' as const,
          reason: 'producerFrontierUnavailable' as const,
          evidence: { kind: 'producerFrontierUnavailable' as const, producer: biome },
        },
      },
    ]);
    const selected = 'selected-invalid';
    const model = createContextualPickerProjection(createContextualOptionResolver(catalog)).project(
      options,
      (option) => ({
        label: option.value,
        category: option.value === 'possible' ? 'Combat' : 'Story',
        selected: option.value === selected,
      }),
      (value) => value,
    );

    expect(model.sections.map((section) => section.kind)).toEqual([
      'required',
      'selectedInvalid',
      'category',
      'unassessed',
      'unavailable',
    ]);
    expect(model.selected?.value).toBe(selected);
    expect(model.sections.find((section) => section.kind === 'unavailable')?.collapsible).toBe(
      true,
    );
  });
});
