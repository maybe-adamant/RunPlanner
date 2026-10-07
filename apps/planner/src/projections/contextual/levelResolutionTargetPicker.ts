import type { LevelResolutionCandidateGroup } from '../candidates/candidateProjection';
import type { ContextualPickerItem, ContextualPickerModel } from './contextualPicker';

/**
 * One Pom target slot's picker: eligible targets, with those another offered
 * slot holds disabled, and a retained ineligible current target pinned first.
 */
export function projectLevelResolutionTargetPicker(input: {
  readonly group: LevelResolutionCandidateGroup | undefined;
  readonly current: string | null;
  readonly traitLabel: (traitKey: string) => string;
  readonly findingCopy: (code: string) => string;
}): ContextualPickerModel<string> {
  const { group, current } = input;
  const eligible = group?.surface.eligibleTargetTraitKeys ?? [];
  const available = group?.evaluations[0]?.availableTargetTraitKeys ?? eligible;
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
      ...(unavailableCurrent ? { status: 'Current · unavailable' } : {}),
      ...(unavailableCurrent
        ? {
            explanation: input.findingCopy(
              group?.evaluations[0]?.findings[0] ?? 'targetUnavailable',
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
