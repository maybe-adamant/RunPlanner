import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  simulateProject,
  simulateProjectAssembly,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import type { TraitOfferCandidateContext } from '../../src/simulation/traits';
import {
  evaluateTraitAcquisitionTargetDomain,
  evaluateTraitOfferCandidate,
  evaluateTraitOfferFocusedOptionCandidate,
  type TraitOfferFocusedOptionCandidateQuery,
} from '../../src/simulation/candidates/trait-offer';

const project = createGoldenFGHIProject();
const evaluation = simulateProject(catalog, project);
const offerOwner = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
const trait = createTraitOfferAddress(offerOwner, 'source');
const historyOwner = { kind: 'project' } as SemanticAddress;

function offer(
  giverKey: string,
  options: Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
): AuthoredTraitOffer {
  return Object.freeze({ kind: 'traits', giverKey, options, selectedOptionKey: 'option1' });
}

function historyWith(giverKey: string, traitKey: string, rarity: string) {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) throw new Error(`missing giver ${giverKey}`);
  return foldTraitHistoryEvents(catalog, [
    {
      kind: 'traitOffer',
      owner: historyOwner,
      acquisitionRole: 'seed',
      sequence: 0,
      giverKey,
      options: Object.freeze([
        { traitKey, rarity },
        { traitKey: giver.traitKeys[1]! },
        { traitKey: giver.traitKeys[2]! },
      ]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'test',
    },
  ]);
}

function artifacts(contexts: readonly TraitOfferCandidateContext[]) {
  return createTraitOfferCandidateArtifacts(
    catalog,
    new Map([[semanticAddressKey(trait), Object.freeze([...contexts])]]),
  );
}

function focused(
  value: AuthoredTraitOffer,
  optionKey: TraitOfferFocusedOptionCandidateQuery['optionKey'],
  contexts: readonly TraitOfferCandidateContext[] | undefined,
) {
  return evaluateTraitOfferFocusedOptionCandidate(
    catalog,
    project,
    evaluation,
    contexts === undefined ? undefined : artifacts(contexts),
    { kind: 'traitOfferFocusedOption', trait, value, optionKey },
  );
}

function reachedContext(before = createTraitHistoryState()): TraitOfferCandidateContext {
  return Object.freeze({ before, context: Object.freeze({}) });
}

describe('focused trait offer candidates', () => {
  it('publishes branch-aware targets without combining support and pins a stale target', () => {
    const targetDomain = evaluateTraitAcquisitionTargetDomain(
      catalog,
      project,
      evaluation,
      artifacts([
        reachedContext(historyWith('Demeter', 'DemeterWeaponBoon', 'Common')),
        reachedContext(historyWith('Apollo', 'ApolloCastBoon', 'Rare')),
      ]),
      {
        kind: 'traitAcquisitionTargetDomain',
        trait,
        value: offer(
          'Hera',
          Object.freeze([
            { traitKey: 'BoonDecayBoon', rarity: 'Common' },
            { traitKey: 'HeraWeaponBoon', rarity: 'Common' },
            { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
          ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
        ),
        optionKey: 'option1',
        retainedTargetTraitKey: 'ZeusWeaponBoon',
      },
    );
    if (targetDomain.kind !== 'traitAcquisitionTargetDomain') {
      throw new Error('target domain was unavailable');
    }
    expect(
      targetDomain.result.candidates.map((candidate) => ({
        traitKey: candidate.result.traitKey,
        supported: candidate.result.supported,
        branchSupport: candidate.result.branchSupport,
      })),
    ).toEqual([
      { traitKey: 'ApolloCastBoon', supported: false, branchSupport: [false, true] },
      { traitKey: 'DemeterWeaponBoon', supported: false, branchSupport: [true, false] },
      { traitKey: 'ZeusWeaponBoon', supported: false, branchSupport: [false, false] },
    ]);
  });

  it('isolates a focused option from sibling prerequisites while retaining its own failure', () => {
    const value = offer(
      'Aphrodite',
      Object.freeze([
        { traitKey: 'AphroditeWeaponBoon', rarity: 'Common' },
        { traitKey: 'DoorHealToFullBoon', rarity: 'Common' },
        { traitKey: 'AphroditeSpecialBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );

    const unaffected = focused(value, 'option1', [reachedContext()]);
    if (unaffected.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(unaffected.result.supported).toBe(true);
    expect(unaffected.result.evidence).toContainEqual({
      source: 'siblingOption',
      blocksFocusedOption: false,
      finding: expect.objectContaining({
        code: 'missingPrerequisite',
        traitKey: 'DoorHealToFullBoon',
      }),
    });

    const complete = evaluateTraitOfferCandidate(
      catalog,
      project,
      evaluation,
      artifacts([reachedContext()]),
      { kind: 'traitOffer', trait, value },
    );
    if (complete.kind !== 'traitOffer') {
      throw new Error('complete candidate was unavailable');
    }
    expect(complete.result.supported).toBe(false);
    expect(complete.result.findings).toContainEqual(
      expect.objectContaining({ code: 'missingPrerequisite', traitKey: 'DoorHealToFullBoon' }),
    );

    const blocked = focused(value, 'option2', [reachedContext()]);
    if (blocked.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(blocked.result.supported).toBe(false);
    expect(blocked.result.evidence).toContainEqual({
      source: 'focusedOption',
      blocksFocusedOption: true,
      finding: expect.objectContaining({
        code: 'missingPrerequisite',
        traitKey: 'DoorHealToFullBoon',
      }),
    });
  });

  it('keeps a missing Q-style trait child candidate-backed with Common excluded and Rare supported', () => {
    const qOverride = catalog.rooms.byKey.Q_MiniBoss02?.boonRarityOverride;
    if (qOverride === undefined) throw new Error('missing Q Miniboss rarity override');
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    // This is the retained candidate context published for a missing child after
    // `withBoonRarityFacts` resolves Q_Miniboss02's reached room facts.
    const missingChildContext: TraitOfferCandidateContext = Object.freeze({
      before: createTraitHistoryState(),
      context: Object.freeze({
        resolvedProviderKey: 'Apollo',
        boonRarityFacts: {
          providerBase: catalog.boonRarityBases.olympian,
          roomOverride: qOverride,
          contributions: [],
        },
      }),
    });
    const common = focused(value, 'option1', [missingChildContext]);
    const rare = focused(value, 'option2', [missingChildContext]);
    if (common.kind !== 'traitOfferFocusedOption' || rare.kind !== 'traitOfferFocusedOption')
      throw new Error('missing child candidate context was unavailable');
    expect(common.result.supported).toBe(false);
    expect(common.result.evidence).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ code: 'rarityRollUnavailable', detail: 'Common' }),
      }),
    );
    expect(rare.result.supported).toBe(true);
  });

  it('publishes exact branch-correlated rarity and replacement generation state', () => {
    const qOverride = catalog.rooms.byKey.Q_MiniBoss02?.boonRarityOverride;
    if (qOverride === undefined) throw new Error('missing Q Miniboss rarity override');
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const result = evaluateTraitOfferCandidate(
      catalog,
      project,
      evaluation,
      artifacts([
        Object.freeze({
          before: createTraitHistoryState(),
          context: Object.freeze({ resolvedProviderKey: 'Apollo' }),
        }),
        Object.freeze({
          before: createTraitHistoryState(),
          context: Object.freeze({
            resolvedProviderKey: 'Apollo',
            boonRarityRoomOverride: qOverride,
            limitedSwapUses: 1,
          }),
        }),
      ]),
      { kind: 'traitOffer', trait, value },
    );
    if (result.kind !== 'traitOffer') throw new Error('offer candidate was unavailable');

    expect(result.result.branches.map((branch) => branch.offerGenerationState)).toEqual([
      expect.objectContaining({
        rarity: { kind: 'orderedChecks', values: catalog.boonRarityBases.olympian },
        replacementRollChance: 0.1,
      }),
      expect.objectContaining({
        rarity: { kind: 'orderedChecks', values: qOverride },
        replacementRollChance: 1,
        forcedRollRequiredReplacementCount: expect.any(Number),
      }),
    ]);
  });

  it('attributes duplicate offers to every participating focus without poisoning siblings', () => {
    const focusedDuplicate = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const blocked = focused(focusedDuplicate, 'option1', [reachedContext()]);
    if (blocked.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(blocked.result.supported).toBe(false);
    expect(blocked.result.evidence).toContainEqual({
      source: 'duplicate',
      blocksFocusedOption: true,
      finding: {
        code: 'duplicateOfferedTrait',
        traitKey: 'ApolloWeaponBoon',
        detail: 'trait appears in more than one offered option',
        optionKeys: ['option1', 'option2'],
      },
    });

    const siblingDuplicate = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const unaffected = focused(siblingDuplicate, 'option1', [reachedContext()]);
    if (unaffected.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(unaffected.result.supported).toBe(true);
    expect(unaffected.result.evidence).toContainEqual({
      source: 'duplicate',
      blocksFocusedOption: false,
      finding: expect.objectContaining({
        code: 'duplicateOfferedTrait',
        traitKey: 'ApolloCastBoon',
      }),
    });
  });

  it('closes a focused duplicate before lifecycle candidate coverage exists', () => {
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const focusedResult = focused(value, 'option1', undefined);
    if (focusedResult.kind !== 'traitOfferFocusedOption') {
      throw new Error('context-free duplicate was incorrectly unassessed');
    }
    expect(focusedResult.result).toMatchObject({ supported: false, branches: [] });
    expect(focusedResult.result.evidence).toContainEqual({
      source: 'duplicate',
      blocksFocusedOption: true,
      finding: expect.objectContaining({ code: 'duplicateOfferedTrait' }),
    });

    const completeResult = evaluateTraitOfferCandidate(catalog, project, evaluation, undefined, {
      kind: 'traitOffer',
      trait,
      value,
    });
    expect(completeResult).toMatchObject({
      kind: 'traitOffer',
      result: {
        supported: false,
        findings: [expect.objectContaining({ code: 'duplicateOfferedTrait' })],
      },
    });

    const unique = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const unavailableFocused = focused(unique, 'option1', undefined);
    const unavailableComplete = evaluateTraitOfferCandidate(
      catalog,
      project,
      evaluation,
      undefined,
      {
        kind: 'traitOffer',
        trait,
        value: unique,
      },
    );
    expect(unavailableFocused).toEqual(unavailableComplete);
  });

  it('attributes first-offer priority and Attack/Special composition to the focused value', () => {
    const noAttackOrSpecial = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const missingAttack = focused(noAttackOrSpecial, 'option1', [reachedContext()]);
    if (missingAttack.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(missingAttack.result.supported).toBe(false);
    expect(missingAttack.result.evidence).toContainEqual({
      source: 'firstOfferComposition',
      blocksFocusedOption: true,
      finding: { code: 'missingAttackOrSpecial' },
    });

    const completeMissingAttack = evaluateTraitOfferCandidate(
      catalog,
      project,
      evaluation,
      artifacts([reachedContext()]),
      { kind: 'traitOffer', trait, value: noAttackOrSpecial },
    );
    expect(completeMissingAttack).toMatchObject({
      kind: 'traitOffer',
      result: {
        supported: false,
        findings: [expect.objectContaining({ code: 'missingAttackOrSpecial' })],
      },
    });

    const repaired = focused(
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      ),
      'option1',
      [reachedContext()],
    );
    expect(repaired).toMatchObject({
      kind: 'traitOfferFocusedOption',
      result: { supported: true },
    });

    const nonPriority = focused(
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      ),
      'option1',
      [reachedContext()],
    );
    if (nonPriority.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(nonPriority.result.evidence).toContainEqual({
      source: 'firstOfferComposition',
      blocksFocusedOption: true,
      finding: {
        code: 'nonPriorityTrait',
        traitKey: 'ApolloRetaliateBoon',
        optionKey: 'option1',
      },
    });
  });

  it('blocks a focused replacement excess without poisoning an ordinary sibling', () => {
    const before = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer',
        owner: historyOwner,
        acquisitionRole: 'seed1',
        sequence: 0,
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'test',
      },
      {
        kind: 'traitOffer',
        owner: historyOwner,
        acquisitionRole: 'seed2',
        sequence: 1,
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'test',
      },
      {
        kind: 'traitOffer',
        owner: historyOwner,
        acquisitionRole: 'seed3',
        sequence: 2,
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'test',
      },
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );

    const replacement = focused(value, 'option1', [reachedContext(before)]);
    if (replacement.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(replacement.result.supported).toBe(false);
    expect(replacement.result.evidence).toContainEqual({
      source: 'replacementComposition',
      blocksFocusedOption: true,
      finding: expect.objectContaining({ code: 'replacementCompositionExceeded' }),
    });

    const ordinary = focused(value, 'option3', [reachedContext(before)]);
    if (ordinary.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(ordinary.result.supported).toBe(true);
    expect(ordinary.result.evidence).toContainEqual({
      source: 'replacementComposition',
      blocksFocusedOption: false,
      finding: expect.objectContaining({ code: 'replacementCompositionExceeded' }),
    });
  });

  it('does not combine different blocking reasons from separate branches', () => {
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const occupiedFocus = historyWith('Apollo', 'ApolloCastBoon', 'Common');
    const result = focused(value, 'option1', [reachedContext(), reachedContext(occupiedFocus)]);
    if (result.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(result.result.supported).toBe(false);
    expect(result.result.branches).toHaveLength(2);
    expect(result.result.branches[0]).toMatchObject({
      supported: false,
      evidence: [
        {
          source: 'firstOfferComposition',
          blocksFocusedOption: true,
          finding: { code: 'missingAttackOrSpecial' },
        },
      ],
    });
    expect(result.result.branches[1]?.evidence).toContainEqual({
      source: 'focusedOption',
      blocksFocusedOption: true,
      finding: expect.objectContaining({ code: 'alreadyEquipped', traitKey: 'ApolloCastBoon' }),
    });
  });

  it('retains focused support when one history branch supports the same draft', () => {
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const occupied = historyWith('Apollo', 'ApolloWeaponBoon', 'Common');
    const result = focused(value, 'option1', [reachedContext(occupied), reachedContext()]);
    if (result.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(result.result.supported).toBe(true);
    expect(result.result.branches).toMatchObject([
      { supported: true, evidence: [] },
      {
        supported: false,
        evidence: [
          {
            source: 'firstOfferComposition',
            blocksFocusedOption: true,
            finding: { code: 'missingAttackOrSpecial' },
          },
        ],
      },
    ]);
  });

  it('retains Hammer loadout and acquired-Hammer exclusions in focused evidence', () => {
    const value = offer(
      'WeaponUpgrade',
      Object.freeze([
        { traitKey: 'LobPulseAmmoTrait' },
        { traitKey: 'LobAmmoMagnetismTrait' },
        { traitKey: 'LobAmmoTrait' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const before = historyWith('WeaponUpgrade', 'LobAmmoMagnetismTrait', 'Common');
    const result = focused(value, 'option1', [
      Object.freeze({
        before,
        context: Object.freeze({
          weaponKey: 'WeaponStaffSwing',
          aspectKey: 'BaseStaffAspect',
        }),
      }),
    ]);
    if (result.kind !== 'traitOfferFocusedOption') {
      throw new Error('focused candidate was unavailable');
    }
    expect(result.result.supported).toBe(false);
    expect(result.result.evidence).toContainEqual({
      source: 'focusedOption',
      blocksFocusedOption: true,
      finding: { code: 'wrongHammerLoadout', traitKey: 'LobPulseAmmoTrait' },
    });
    expect(result.result.evidence).toContainEqual({
      source: 'focusedOption',
      blocksFocusedOption: true,
      finding: expect.objectContaining({
        code: 'negativePrerequisite',
        traitKey: 'LobPulseAmmoTrait',
      }),
    });
  });

  it('dispatches reached and unreached focused queries through the project-bound session', () => {
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(
      session.evaluate({
        kind: 'traitOfferFocusedOption',
        trait,
        value,
        optionKey: 'option1',
      }),
    ).toMatchObject({
      kind: 'traitOfferFocusedOption',
      result: { optionKey: 'option1', supported: true },
    });

    const unreachedTrait = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, createOccurrenceId('unreached-focused-offer')),
      'source',
    );
    const unreachedQuery = {
      kind: 'traitOfferFocusedOption' as const,
      trait: unreachedTrait,
      value,
      optionKey: 'option1' as const,
    };
    const scalar = session.evaluate(unreachedQuery);
    const [batched] = session.evaluate([unreachedQuery]);
    expect(scalar).toMatchObject({
      kind: 'unavailable',
      reason: 'coverageNotReached',
      evidence: { kind: 'coverageNotReached', requiredOwner: unreachedTrait.owner },
    });
    expect(batched).toEqual(scalar);
  });
});
