import { describe, expect, it } from 'vitest';
import type {
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
} from '@run-planner/engine/authored-project';
import {
  createIncomingRewardAddress,
  createTraitAcquisitionTargetAddress,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type {
  WorkspaceTraitCarrierChildInteraction,
  WorkspaceTraitOptionDomainInteraction,
} from '@planner/projections/structured-workspace';
import { goldenFBiome, goldenFStartId } from '@run-planner/test-fixtures/underworld';

import { selectedTraitOutcomeDraftComplete } from './traitOfferOptions';

const baseOption = Object.freeze({ traitKey: 'TestTrait', rarity: 'Common' as const });
const carrierOwner = createTraitOfferAddress(
  createIncomingRewardAddress(goldenFBiome, goldenFStartId),
  'source',
);

function carrierBinding(authoredComplete: boolean): WorkspaceTraitCarrierChildInteraction {
  const child = Object.freeze({
    kind: 'traitAcquisitionTarget' as const,
    address: createTraitAcquisitionTargetAddress(carrierOwner, 'option1'),
    marker: Object.freeze({
      address: createTraitAcquisitionTargetAddress(carrierOwner, 'option1'),
      assessment: 'assessed' as const,
      findingCount: 0,
      focusKey: 'test-carrier-child',
    }),
    optionKey: 'option1' as const,
    traitKey: 'TestTrait',
    authoredComplete,
  });
  return Object.freeze({
    child,
    forOffer: () => Object.freeze({ load: () => undefined }),
    update: (value: AuthoredTraitOfferTraits) => value,
  });
}

function offer(
  selected: AuthoredTraitOption = baseOption,
  extras: Partial<AuthoredTraitOfferTraits> = {},
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'TestGiver',
    options: Object.freeze([selected]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
    ...extras,
  });
}

function domain(
  child: Partial<WorkspaceTraitOptionDomainInteraction> = {},
): WorkspaceTraitOptionDomainInteraction {
  return {
    children: Object.freeze([]),
    load: () => {
      throw new Error('draft completeness must not load candidate UI products');
    },
    ...child,
  } as WorkspaceTraitOptionDomainInteraction;
}

describe('selected trait outcome draft completeness', () => {
  it.each([
    [
      'targeted acquisition',
      domain({ children: Object.freeze([carrierBinding(false)]) }),
      offer(),
      offer({ ...baseOption, targetTraitKey: 'TargetTrait' }),
    ],
    [
      'Circe resolution',
      domain({ circeResolution: {} as never }),
      offer(),
      offer({
        ...baseOption,
        circeResolution: { kind: 'activateArcana', arcanaKeys: Object.freeze([]) },
      }),
    ],
    [
      'Echo Pom target',
      domain({ echoPomTarget: {} as never }),
      offer(),
      offer({ ...baseOption, echoPomTarget: null }),
    ],
    [
      'Echo previous-run boon',
      domain({ echoLastRunBoon: {} as never }),
      offer(),
      offer({
        ...baseOption,
        echoLastRunBoon: {
          options: Object.freeze([
            { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          ]),
          selectedOptionKey: 'option1',
        },
      }),
    ],
    [
      'All Together grants',
      domain({ children: Object.freeze([carrierBinding(false)]) }),
      offer(),
      offer({
        ...baseOption,
        allTogetherResult: { earth: null, fire: null, air: null, water: null },
      }),
    ],
    [
      'Natural Selection targets',
      domain({ children: Object.freeze([carrierBinding(false)]) }),
      offer(),
      offer({ ...baseOption, naturalSelectionTargets: Object.freeze(['ApolloWeaponBoon']) }),
    ],
    [
      'Hex layout',
      domain({ hexTree: {} as never }),
      offer(),
      offer(baseOption, {
        hexTree: {
          layoutKey: 'Maze',
          rareTalentKeys: Object.freeze([]),
          epicTalentKeys: Object.freeze([]),
        },
      }),
    ],
  ] as const)('requires the selected %s child', (_label, activeDomain, missing, complete) => {
    expect(selectedTraitOutcomeDraftComplete(missing, activeDomain)).toBe(false);
    expect(
      selectedTraitOutcomeDraftComplete(
        complete,
        Object.freeze({
          ...activeDomain,
          children:
            activeDomain.children.length === 0
              ? activeDomain.children
              : Object.freeze([carrierBinding(true)]),
        }),
      ),
    ).toBe(true);
  });

  it('uses the candidate-backed Concave Stone completion contact', () => {
    const missing = offer();
    const complete = offer(baseOption, { concaveStoneResult: { kind: 'noProc' } });
    const activeDomain = domain({
      concaveStone: {
        completeFor: (value: AuthoredTraitOfferTraits) => value.concaveStoneResult !== undefined,
      } as never,
    });
    expect(selectedTraitOutcomeDraftComplete(missing, activeDomain)).toBe(false);
    expect(selectedTraitOutcomeDraftComplete(complete, activeDomain)).toBe(true);
  });

  it('accepts an ordinary selected trait with no child outcome', () => {
    expect(selectedTraitOutcomeDraftComplete(offer(), domain())).toBe(true);
  });
});
