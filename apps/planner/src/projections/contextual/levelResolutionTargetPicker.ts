import type { LevelResolutionCandidateProjection } from '../candidates/candidateProjection';
import {
  formatFindingExplanation,
  presentLevelResolutionCandidateFinding,
} from '../evaluationProjection';
import type { ContextualPickerItem, ContextualPickerModel } from './contextualPicker';

/**
 * One Pom target slot's picker: eligible targets, with those another offered
 * slot holds disabled, and a retained ineligible current target pinned first.
 */
export function projectLevelResolutionTargetPicker(input: {
  readonly candidate: LevelResolutionCandidateProjection | undefined;
  readonly current: string | null;
  readonly traitLabel: (traitKey: string) => string;
}): ContextualPickerModel<string> {
  const { candidate, current } = input;
  const eligible = candidate?.surface.eligibleTargetTraitKeys ?? [];
  const available = candidate?.evaluation.availableTargetTraitKeys ?? eligible;
  const targets = new Set(eligible);
  if (current !== null) targets.add(current);
  const items: ContextualPickerItem<string>[] = [...targets].map((target) => {
    const supported = eligible.includes(target);
    const selected = target === current;
    const unavailableCurrent = selected && !supported;
    return Object.freeze({
      disabled: supported ? !selected && !available.includes(target) : !selected,
      key: target,
      label: input.traitLabel(target),
      selected,
      state: supported ? ('possible' as const) : ('impossible' as const),
      ...(unavailableCurrent
        ? {
            explanations: Object.freeze(
              [
                ...new Set(
                  (candidate?.evaluation.findings.length
                    ? candidate.evaluation.findings
                    : ['targetUnavailable']
                  ).map((code) =>
                    formatFindingExplanation(presentLevelResolutionCandidateFinding(code)),
                  ),
                ),
              ].slice(0, 2),
            ),
          }
        : {}),
      value: target,
    });
  });
  const invalid = items.filter((item) => item.selected && item.state === 'impossible');
  const selected = items.find((item) => item.selected);
  return Object.freeze({
    ...(selected === undefined ? {} : { selected }),
    sections: Object.freeze([
      ...(invalid.length === 0
        ? []
        : [
            Object.freeze({
              collapsible: false,
              items: Object.freeze(invalid),
              key: 'selected-invalid',
              kind: 'selectedInvalid' as const,
              label: 'Current target',
            }),
          ]),
      Object.freeze({
        collapsible: false,
        items: Object.freeze(items.filter((item) => item.state === 'possible')),
        key: 'eligible',
        kind: 'category' as const,
        label: 'Eligible traits',
      }),
    ]),
  });
}
