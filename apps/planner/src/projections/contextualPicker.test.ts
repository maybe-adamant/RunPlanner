import { catalog } from '@run-planner/hades2-catalog';
import { createBiomeAddress } from '@run-planner/engine/authored-project';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { CandidateOptionProjection } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';

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
