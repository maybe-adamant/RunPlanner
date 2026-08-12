import type {
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import type { TraitOfferFocusedOptionEvidence } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
} from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createTraitDomainProjection, prepareTraitOptionDomain } from './traitDomainProjection';

function giver(key: string) {
  const declaration = catalog.traitGivers.byKey[key];
  if (declaration === undefined) throw new Error(`missing fixture giver ${key}`);
  return declaration;
}

function rankedOption(traitKey: string, rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic') {
  return Object.freeze({ traitKey, rarity });
}

function offer(
  giverKey: string,
  options: AuthoredTraitOfferTraits['options'],
): AuthoredTraitOfferTraits {
  return Object.freeze({ kind: 'traits', giverKey, options, selectedOptionKey: 'option1' });
}

function focused(
  supported: boolean,
  evidence: readonly TraitOfferFocusedOptionEvidence[] = Object.freeze([]),
): CandidateProjectionEvaluation {
  return Object.freeze({
    kind: 'traitOfferFocusedOption' as const,
    result: Object.freeze({
      optionKey: 'option1' as const,
      supported,
      branches: Object.freeze([]),
      evidence,
    }),
  });
}

function candidate(
  value: AuthoredTraitOption,
  evaluation: CandidateProjectionEvaluation,
): CandidateOptionProjection<AuthoredTraitOption, CandidateProjectionEvaluation> {
  return Object.freeze({ value, evaluation });
}

function targetCandidate(traitKey: string, supported: boolean) {
  return Object.freeze({
    value: traitKey,
    evaluation: Object.freeze({
      kind: 'traitAcquisitionTarget' as const,
      result: Object.freeze({
        branchSupport: Object.freeze([supported]),
        findings: Object.freeze(
          supported
            ? []
            : [
                Object.freeze({
                  code: 'targetedAcquisitionTargetUnavailable' as const,
                  detail: traitKey,
                  traitKey,
                }),
              ],
        ),
        supported,
        traitKey,
      }),
    }),
  });
}

function itemValues<T>(model: {
  readonly sections: readonly { readonly items: readonly { value: T }[] }[];
}) {
  return model.sections.flatMap((section) => section.items.map((item) => item.value));
}

describe('trait option domain projection', () => {
  it('keeps declaration ordering and a persisted concrete rarity in the structural domain', () => {
    const apollo = giver('Apollo');
    const first = apollo.traitKeys[0];
    const second = apollo.traitKeys[1];
    const third = apollo.traitKeys[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Apollo fixture traits are missing');
    }
    const draft = offer('Apollo', [
      rankedOption(first, 'Heroic'),
      rankedOption(second, 'Common'),
      rankedOption(third, 'Common'),
    ]);

    const prepared = prepareTraitOptionDomain(catalog, apollo, draft, 'option1');

    expect(prepared.variants[0]?.traitKey).toBe(first);
    expect(
      prepared.variants.some((option) => option.traitKey === first && option.rarity === 'Heroic'),
    ).toBe(true);
    expect(prepared.variants.filter((option) => option.traitKey === first)).toEqual(
      expect.arrayContaining([rankedOption(first, 'Common'), rankedOption(first, 'Rare')]),
    );
  });

  it('projects Proper Upbringing, selected-invalid retention, and player-facing reasons', () => {
    const demeter = giver('Demeter');
    const first = demeter.traitKeys[0];
    const second = demeter.traitKeys[1];
    const third = demeter.traitKeys[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Demeter fixture traits are missing');
    }
    const draft = offer('Demeter', [
      rankedOption(first, 'Common'),
      rankedOption(second, 'Rare'),
      rankedOption(third, 'Epic'),
    ]);
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const service = createTraitDomainProjection(catalog, picker);
    const prepared = service.prepare(demeter, draft, 'option1');
    const candidates = prepared.variants.map((option) => {
      const commonFloorFailure = option.traitKey === first && option.rarity === 'Common';
      return candidate(
        option,
        focused(
          !commonFloorFailure,
          commonFloorFailure
            ? [
                Object.freeze({
                  blocksFocusedOption: true,
                  finding: Object.freeze({
                    code: 'rarityBelowActiveFloor' as const,
                    traitKey: first,
                  }),
                  source: 'focusedOption' as const,
                }),
              ]
            : undefined,
        ),
      );
    });

    const projection = service.project(demeter, draft, prepared, Object.freeze(candidates));
    const rarity = projection.rarityPickerFor(first);
    if (rarity === undefined) throw new Error('ranked trait has no rarity picker');

    expect(itemValues(rarity)).toContain('Common');
    expect(rarity.selected?.state).toBe('impossible');
    expect(rarity.selected?.explanation).toContain('Proper Upbringing');
    expect(projection.preferredOptionFor(first)?.rarity).toBe('Rare');
  });

  it('retains a supported current rarity for a different trait and repairs only when needed', () => {
    const apollo = giver('Apollo');
    const first = apollo.traitKeys[0];
    const second = apollo.traitKeys[1];
    const third = apollo.traitKeys[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Apollo fixture traits are missing');
    }
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const service = createTraitDomainProjection(catalog, picker);
    const project = (rarity: 'Rare' | 'Epic', supportedRarities: readonly string[]) => {
      const draft = offer('Apollo', [
        rankedOption(first, rarity),
        rankedOption(second, 'Common'),
        rankedOption(third, 'Common'),
      ]);
      const prepared = service.prepare(apollo, draft, 'option1');
      return service.project(
        apollo,
        draft,
        prepared,
        Object.freeze(
          prepared.variants.map((option) =>
            candidate(
              option,
              focused(
                (option.traitKey === second &&
                  option.rarity !== undefined &&
                  supportedRarities.includes(option.rarity)) ||
                  (option.traitKey === first && option.rarity === rarity),
              ),
            ),
          ),
        ),
      );
    };

    const rare = project('Rare', ['Common', 'Rare']);
    expect(rare.preferredOptionFor(second)).toEqual(rankedOption(second, 'Rare'));

    const epic = project('Epic', ['Common', 'Epic']);
    expect(epic.preferredOptionFor(second)).toEqual(rankedOption(second, 'Epic'));
    expect(epic.preferredOptionFor(first)).toEqual(rankedOption(first, 'Epic'));

    const repair = project('Epic', ['Rare']);
    expect(repair.preferredOptionFor(second)).toEqual(rankedOption(second, 'Rare'));
  });

  it('hides fresh Heroic probes, exposes a supported Heroic replacement, omits Hammer rarity, and drops losing-branch evidence', () => {
    const apollo = giver('Apollo');
    const first = apollo.traitKeys[0];
    const second = apollo.traitKeys[1];
    const third = apollo.traitKeys[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Apollo fixture traits are missing');
    }
    const draft = offer('Apollo', [
      rankedOption(first, 'Epic'),
      rankedOption(second, 'Common'),
      rankedOption(third, 'Common'),
    ]);
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const service = createTraitDomainProjection(catalog, picker);
    const prepared = service.prepare(apollo, draft, 'option1');
    const noHeroic = service.project(
      apollo,
      draft,
      prepared,
      Object.freeze(
        prepared.variants.map((option) => candidate(option, focused(option.rarity !== 'Heroic'))),
      ),
    );
    const noHeroicRarity = noHeroic.rarityPickerFor(first);
    if (noHeroicRarity === undefined) throw new Error('Apollo rarity picker is missing');
    expect(itemValues(noHeroicRarity)).not.toContain('Heroic');

    const replacement = service.project(
      apollo,
      draft,
      prepared,
      Object.freeze(prepared.variants.map((option) => candidate(option, focused(true)))),
    );
    const replacementRarity = replacement.rarityPickerFor(first);
    if (replacementRarity === undefined) throw new Error('Apollo replacement picker is missing');
    expect(itemValues(replacementRarity)).toContain('Heroic');

    const availableDespiteLosingBranchEvidence = service.project(
      apollo,
      draft,
      prepared,
      Object.freeze(
        prepared.variants.map((option) =>
          candidate(
            option,
            option.traitKey === draft.options[0]?.traitKey &&
              option.rarity === draft.options[0]?.rarity
              ? focused(true, [
                  Object.freeze({
                    blocksFocusedOption: true,
                    finding: Object.freeze({
                      code: 'rarityBelowActiveFloor' as const,
                      traitKey: first,
                    }),
                    source: 'focusedOption' as const,
                  }),
                ])
              : focused(true),
          ),
        ),
      ),
    );
    const availableRarity = availableDespiteLosingBranchEvidence.rarityPickerFor(first);
    if (availableRarity === undefined) throw new Error('Apollo rarity picker is missing');
    expect(availableRarity.selected?.explanation).toBeUndefined();

    const hammer = giver('WeaponUpgrade');
    const hammerOptions = hammer.traitKeys.slice(0, 3);
    const [hammer1, hammer2, hammer3] = hammerOptions;
    if (hammer1 === undefined || hammer2 === undefined || hammer3 === undefined) {
      throw new Error('Hammer fixture traits are missing');
    }
    const hammerDraft = offer('WeaponUpgrade', [
      Object.freeze({ traitKey: hammer1 }),
      Object.freeze({ traitKey: hammer2 }),
      Object.freeze({ traitKey: hammer3 }),
    ]);
    const hammerPrepared = service.prepare(hammer, hammerDraft, 'option1');
    const hammerProjection = service.project(
      hammer,
      hammerDraft,
      hammerPrepared,
      Object.freeze(hammerPrepared.variants.map((option) => candidate(option, focused(true)))),
    );
    expect(hammerProjection.rarityPickerFor(hammer1)).toBeUndefined();
  });

  it('projects exact acquisition targets with catalog labels and pins a stale authored target', () => {
    const hera = giver('Hera');
    const draft = offer('Hera', [
      Object.freeze({
        traitKey: 'BoonDecayBoon',
        rarity: 'Common',
        targetTraitKey: 'ZeusWeaponBoon',
      }),
      rankedOption('HeraWeaponBoon', 'Common'),
      rankedOption('HeraSpecialBoon', 'Common'),
    ]);
    const picker = createContextualPickerProjection(createContextualOptionResolver(catalog));
    const service = createTraitDomainProjection(catalog, picker);
    const prepared = service.prepare(hera, draft, 'option1');
    const projection = service.project(
      hera,
      draft,
      prepared,
      Object.freeze(prepared.variants.map((option) => candidate(option, focused(true)))),
      Object.freeze([
        targetCandidate('ApolloCastBoon', true),
        targetCandidate('ZeusWeaponBoon', false),
      ]),
    );

    const targetPicker = projection.targetPicker;
    if (targetPicker === undefined) throw new Error('target picker is missing');
    expect(itemValues(targetPicker)).toEqual(['ZeusWeaponBoon', 'ApolloCastBoon']);
    expect(targetPicker.selected).toMatchObject({
      label: catalog.traits.byKey.ZeusWeaponBoon?.label,
      state: 'impossible',
    });
    expect(targetPicker.selected?.explanation).not.toContain('ZeusWeaponBoon');
    expect(projection.preferredOptionFor('HeraWeaponBoon')).not.toHaveProperty('targetTraitKey');
  });
});
