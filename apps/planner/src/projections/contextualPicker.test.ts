import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceId,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { CandidateOptionProjection } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';

const biome = createBiomeAddress('Underworld', 'F');
const target = createTargetAddress(biome, createOccurrenceId('picker-parent'), 1);

function candidate(
  value: string,
  support: 'forced' | 'possible' | 'impossible',
): CandidateOptionProjection<string> {
  const evaluation: ProjectCandidateEvaluation =
    support === 'impossible'
      ? {
          context: 'evaluated',
          query: { kind: 'roomTarget', target, gameName: value },
          support,
          findings: [],
          evidence: {
            beforeSequence: 1,
            sourceGameName: 'F_Opening01',
            candidateGameName: value,
            exitIndex: 1,
            biomeDepthCache: 1,
            biomeEncounterDepth: 1,
            candidateCreationCount: 0,
            candidateAppearanceCount: 0,
            candidateParentCreationCount: 0,
            eligibleRoomGameNames: [],
            optionalForcedRoomGameNames: [],
            requiredForcedRoomGameNames: ['F_MiniBoss01'],
            supportRoomGameNames: ['F_MiniBoss01'],
            exclusionReasons: ['forcedPool'],
            exclusions: [{ kind: 'forcedPool', requiredRoomGameNames: ['F_MiniBoss01'] }],
          },
        }
      : {
          context: 'evaluated',
          query: { kind: 'roomTarget', target, gameName: value },
          support,
          findings: [],
          evidence: {
            beforeSequence: 1,
            sourceGameName: 'F_Opening01',
            candidateGameName: value,
            exitIndex: 1,
            biomeDepthCache: 1,
            biomeEncounterDepth: 1,
            candidateCreationCount: 0,
            candidateAppearanceCount: 0,
            candidateParentCreationCount: 0,
            eligibleRoomGameNames: [value],
            optionalForcedRoomGameNames: [],
            requiredForcedRoomGameNames: support === 'forced' ? [value] : [],
            supportRoomGameNames: [value],
            exclusionReasons: [],
            exclusions: [],
          },
        };
  return { value, evaluation };
}

function unassessed(value: string): CandidateOptionProjection<string> {
  return {
    value,
    evaluation: {
      context: 'unavailable',
      query: { kind: 'roomTarget', target, gameName: value },
      reason: 'coverageNotReached',
      evidence: {
        kind: 'coverageNotReached',
        requiredOwner: target,
        requiredCheckpoint: 'afterTargetGeneration',
        coverage: { kind: 'none', reason: 'notEvaluated' },
      },
    },
  };
}

describe('contextual picker projection', () => {
  it('orders required, selected-invalid, possible, unassessed, and unavailable sections', () => {
    const options = Object.freeze([
      candidate('possible-combat', 'possible'),
      candidate('unavailable-combat', 'impossible'),
      unassessed('future-story'),
      candidate('required-miniboss', 'forced'),
      candidate('selected-invalid', 'impossible'),
      candidate('possible-story', 'possible'),
    ]);
    const selected = 'selected-invalid';
    const categories = new Map([
      ['possible-combat', 'Combat'],
      ['unavailable-combat', 'Combat'],
      ['future-story', 'Story'],
      ['required-miniboss', 'Miniboss'],
      ['selected-invalid', 'Combat'],
      ['possible-story', 'Story'],
    ]);
    const projection = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const model = projection.project(
      options,
      (option) => {
        const category = categories.get(option.value);
        return {
          label: option.value,
          ...(category === undefined ? {} : { category }),
          selected: option.value === selected,
        };
      },
      (value) => value,
    );

    expect(model.sections.map(({ kind, label }) => ({ kind, label }))).toEqual([
      { kind: 'required', label: 'Required now' },
      { kind: 'selectedInvalid', label: 'Current selection' },
      { kind: 'category', label: 'Combat' },
      { kind: 'category', label: 'Story' },
      { kind: 'unassessed', label: 'Story · Not evaluated' },
      { kind: 'unavailable', label: 'Unavailable' },
    ]);
    expect(model.selected).toMatchObject({
      key: selected,
      disabled: true,
      explanation: expect.stringContaining('forced room'),
    });
    expect(model.sections.at(-1)).toMatchObject({
      collapsible: true,
      items: [{ key: 'unavailable-combat', disabled: true }],
    });
  });

  it('keeps unassessed options selectable and caches equal picker projections', () => {
    const options = Object.freeze([unassessed('future-combat')]);
    const projection = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const present = (option: CandidateOptionProjection<string>) => ({
      label: option.value,
      category: 'Combat',
      selected: false,
    });
    const first = projection.project(options, present, (value) => value);
    const second = projection.project(options, present, (value) => value);

    expect(second).toBe(first);
    expect(first.sections[0]).toMatchObject({
      kind: 'unassessed',
      items: [{ key: 'future-combat', disabled: false, state: 'unassessed' }],
    });
  });
});
