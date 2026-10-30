import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  discoverAuthoredTraitCarrierChildren,
  type AuthoredTraitOfferTraits,
  type OccurrenceId,
} from '../../../../src/authored-project';
import {
  completeTraitCarrierChildren,
  FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE,
  type CarrierChildChoice,
} from '../../../../src/simulation/candidates/trait-offer/carrier-child-completion';
import type { ProjectCandidateSession } from '../../../../src/simulation/candidates/session';

describe('carrier-child completion choice', () => {
  const trait = createTraitOfferAddress(
    createIncomingRewardAddress(createBiomeAddress('Surface', 'N'), 'N-r1' as OccurrenceId),
    'source',
  );
  const offer: AuthoredTraitOfferTraits = {
    kind: 'traits',
    giverKey: catalog.traitGivers.values.find((giver) =>
      giver.traitKeys.includes('ZeusWeaponBoon'),
    )!.key,
    options: [
      { traitKey: 'ZeusWeaponBoon' },
      { traitKey: 'ZeusSpecialBoon' },
      { traitKey: 'ZeusCastBoon' },
    ],
    selectedOptionKey: 'option1',
  };
  /** An engine whose Concave Stone must proc on either unselected row and admits every offer. */
  const candidates = {
    evaluate: (query: { readonly kind: string }) =>
      query.kind === 'traitOffer'
        ? { kind: 'traitOffer', result: { supported: true, findings: [] } }
        : {
            kind: 'concaveStone',
            result: { branches: [{ required: true, residualOptionKeys: ['option2', 'option3'] }] },
          },
  } as unknown as ProjectCandidateSession;
  const procRow = (choice: CarrierChildChoice) => {
    const completed = completeTraitCarrierChildren(catalog, candidates, trait, offer, choice);
    return completed.concaveStoneResult?.kind === 'proc'
      ? completed.concaveStoneResult.optionKey
      : undefined;
  };
  // A frozen order proves preference sorts a copy of what the order returned.
  const reversed: CarrierChildChoice = {
    order: (values) => Object.freeze([...values].reverse()),
    allowsTrait: () => true,
    prefersTrait: () => false,
  };

  it('takes the first eligible residual row', () => {
    expect(procRow(FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE)).toBe('option2');
  });

  it("follows the choice's order", () => {
    expect(procRow(reversed)).toBe('option3');
  });

  it('puts a preferred trait ahead of the order', () => {
    expect(procRow({ ...reversed, prefersTrait: (key) => key === 'ZeusSpecialBoon' })).toBe(
      'option2',
    );
  });

  it('never takes a trait the choice does not allow', () => {
    expect(
      procRow({
        ...FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE,
        allowsTrait: (key) => key !== 'ZeusSpecialBoon',
      }),
    ).toBe('option3');
  });

  it('authors a named child again', () => {
    const authored = {
      ...offer,
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    } as const;
    const [stone] = discoverAuthoredTraitCarrierChildren(catalog, trait, authored).filter(
      (child) => child.kind === 'concaveStone',
    );
    const completed = completeTraitCarrierChildren(
      catalog,
      candidates,
      trait,
      authored,
      reversed,
      stone!.address,
    );
    expect(completed.concaveStoneResult).toEqual({ kind: 'proc', optionKey: 'option3' });
  });
});
