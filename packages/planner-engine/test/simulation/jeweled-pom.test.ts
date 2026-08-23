import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  type AuthoredTraitOffer,
} from '@run-planner/engine/authored-project';

import {
  applyJeweledPomEquipResult,
  processEncounterTraitOffer,
} from '../../src/simulation/rewards/processing';
import {
  applyKeepsakeDisposition,
  createKeepsakeState,
  invalidateJeweledPom,
} from '../../src/simulation/keepsakes';
import { foldTraitHistoryEvents } from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';

function authoredOffer(giverKey: string): AuthoredTraitOffer {
  const keys = catalog.traitGivers.byKey[giverKey]?.traitKeys.slice(0, 3);
  if (keys?.length !== 3) throw new Error(`missing ${giverKey} fixture traits`);
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(keys.map((traitKey) => Object.freeze({ traitKey, rarity: 'Common' }))),
    selectedOptionKey: 'option1',
  }) as AuthoredTraitOffer;
}

describe('Jeweled Pom', () => {
  it('acquires its exact one-result trait and applies +3 only to later eligible traits', () => {
    const seeded = initializeTestRewardBranches()[0]!;
    const branch = Object.freeze({
      ...seeded,
      keepsakes: createKeepsakeState(catalog, 'HadesAndPersephoneKeepsake', seeded.arcanaFear),
    });
    const result = createKeepsakeEquipResultAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      'jeweledPom',
    );
    const equipped = applyJeweledPomEquipResult(
      catalog,
      branch,
      'HadesAndPersephoneKeepsake',
      {
        jeweledPom: { traitKey: 'HadesLifestealBoon' },
      },
      result,
      1,
    );
    expect(equipped.traitHistory?.equippedTraits.HadesLifestealBoon).toMatchObject({
      sourceRole: 'jeweledPomEquip',
    });
    expect(equipped.traitHistory?.equippedTraits.HadesLifestealBoon?.rarity).toBeUndefined();
    expect(equipped.traitEvaluations?.at(-1)?.composition).toMatchObject({
      applies: false,
      legal: true,
    });

    const encounter = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'F'),
      { kind: 'occurrence', occurrenceId: createOccurrenceId('jeweled-pom-later-trait') },
      'Combat',
    );
    const boosted = processEncounterTraitOffer(
      catalog,
      equipped,
      encounter,
      authoredOffer('Apollo'),
      2,
      'encounterCompleted',
    );
    expect(boosted.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(4);

    const sparseOrdinary = processEncounterTraitOffer(
      catalog,
      branch,
      encounter,
      Object.freeze({
        kind: 'traits',
        giverKey: 'Apollo',
        options: Object.freeze([{ traitKey: 'ApolloWeaponBoon', rarity: 'Common' }]),
        selectedOptionKey: 'option1',
      }) as AuthoredTraitOffer,
      2,
      'encounterCompleted',
    );
    expect(sparseOrdinary.traitEvaluations?.at(-1)?.replacementComposition.legal).toBe(false);
    expect(sparseOrdinary.traitHistory?.equippedTraits.ApolloWeaponBoon).toBeUndefined();
  });

  it('retains its effect across neutral replacement and removes only its exact grant when Unfated', () => {
    const seeded = initializeTestRewardBranches()[0]!;
    const branch = Object.freeze({
      ...seeded,
      keepsakes: createKeepsakeState(catalog, 'HadesAndPersephoneKeepsake', seeded.arcanaFear),
    });
    const result = createKeepsakeEquipResultAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      'jeweledPom',
    );
    const equipped = applyJeweledPomEquipResult(
      catalog,
      branch,
      'HadesAndPersephoneKeepsake',
      { jeweledPom: { traitKey: 'HadesLifestealBoon' } },
      result,
      1,
    );
    const neutral = applyKeepsakeDisposition(
      catalog,
      equipped.keepsakes,
      { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
      equipped.arcanaFear,
    );
    expect(neutral.jeweledPom).toMatchObject({ active: true, levels: 3 });
    const encounter = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'F'),
      { kind: 'occurrence', occurrenceId: createOccurrenceId('jeweled-pom-neutral-trait') },
      'Combat',
    );
    const boosted = processEncounterTraitOffer(
      catalog,
      Object.freeze({ ...equipped, keepsakes: neutral }),
      encounter,
      authoredOffer('Apollo'),
      2,
      'encounterCompleted',
    );
    expect(boosted.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(4);
    const opposing = applyKeepsakeDisposition(
      catalog,
      neutral,
      { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
      equipped.arcanaFear,
    );
    expect(opposing.fatedStatus).toBe('Unfated');
    expect(invalidateJeweledPom(opposing).jeweledPom?.active).toBe(false);

    const acquisitionIdentity = equipped.keepsakes.jeweledPom?.acquisitionIdentity;
    if (acquisitionIdentity === undefined || boosted.traitHistory === undefined)
      throw new Error('expected exact Jeweled Pom acquisition identity');
    const cleaned = foldTraitHistoryEvents(catalog, [
      ...boosted.traitHistory.events,
      Object.freeze({
        kind: 'traitRemoval' as const,
        owner: result,
        acquisitionRole: 'jeweledPomCleanup',
        sequence: 3,
        acquisitionPoint: 'keepsakeFatedInvalidation',
        match: 'acquisitionIdentity' as const,
        traitKey: 'HadesLifestealBoon',
        acquisitionIdentity,
      }),
    ]);
    expect(cleaned.equippedTraits.HadesLifestealBoon).toBeUndefined();
    expect(cleaned.equippedTraits.ApolloWeaponBoon?.level).toBe(4);
  });
});
