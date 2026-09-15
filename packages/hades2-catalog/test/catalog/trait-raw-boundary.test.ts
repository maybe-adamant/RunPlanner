import { describe, expect, it } from 'vitest';

import { createCatalog } from '../../src';
import { declarations } from '../../src/declarations';

describe('trait raw declaration boundary', () => {
  it('rejects malformed raw booleans, rarity domains, and requirement discriminators', () => {
    const invalidBoolean = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, blockStacking: 'false' as unknown as boolean }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(invalidBoolean)).toThrow(/blockStacking: must be boolean/);

    const invalidBossPayoutBlock = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'BankBoon' ? { ...trait, nonFinalBossRarityBlock: false as never } : trait,
        ),
      },
    };
    expect(() => createCatalog(invalidBossPayoutBlock)).toThrow(
      /nonFinalBossRarityBlock: must be true when declared/,
    );

    const emptyRanked = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, freshOfferRarities: [] as const }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(emptyRanked)).toThrow(/ranked rarity domains must not be empty/);

    const unknownRarity = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, freshOfferRarities: ['Mythic' as unknown as 'Common'] }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(unknownRarity)).toThrow(/must be one of Common/);

    const emptyGiverRarities = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite'
            ? { ...giver, rarityPolicy: { kind: 'selectable' as const, rarities: [] } }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(emptyGiverRarities)).toThrow(
      /rarityPolicy\.rarities: must not be empty/,
    );

    const hammerRarity = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'WeaponUpgrade'
            ? {
                ...giver,
                rarityPolicy: { kind: 'fixed' as const, rarity: 'Common' as const },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(hammerRarity as never)).toThrow(
      /Hammer givers require no rarity authorship/,
    );

    const unknownRequirement = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? {
                ...trait,
                eligibilityRequirements: [{ kind: 'futurePredicate' } as never],
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(unknownRequirement)).toThrow(/unknown requirement kind/);

    const unknownLinkedReference = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? {
                ...trait,
                linkedBoonRequirements: [
                  { kind: 'anyEquippedTrait', traitKeys: ['MissingTrait'] },
                ] as never,
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(unknownLinkedReference)).toThrow(
      /linkedBoonRequirements\[0\]\.traitKeys\[0\]: unknown trait operand MissingTrait/,
    );
  });

  it('rejects malformed raw array and object contacts with declaration paths', () => {
    const malformedRequirements = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, eligibilityRequirements: null as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformedRequirements)).toThrow(
      /traits\[.*\]\.eligibilityRequirements: must be an array/,
    );

    const malformedLinkedRequirements = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, linkedBoonRequirements: null as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformedLinkedRequirements)).toThrow(
      /traits\[.*\]\.linkedBoonRequirements: must be an array/,
    );

    const malformedElements = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, elementContributions: null as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformedElements)).toThrow(
      /traits\[.*\]\.elementContributions: must be an object/,
    );

    const malformedRarities = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AphroditeWeaponBoon'
            ? { ...trait, freshOfferRarities: null as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformedRarities)).toThrow(
      /traits\[.*\]\.freshOfferRarities: must be an array/,
    );

    const malformedPolicy = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'WeaponUpgrade' ? { ...giver, rarityPolicy: null as never } : giver,
        ),
      },
    };
    expect(() => createCatalog(malformedPolicy)).toThrow(
      /givers\[.*\]\.rarityPolicy: must be an object/,
    );

    const unsupportedFixedPolicy = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'WeaponUpgrade'
            ? {
                ...giver,
                rarityPolicy: { kind: 'fixed', rarity: 'Common' } as never,
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(unsupportedFixedPolicy)).toThrow(
      /Hammer givers require no rarity authorship/,
    );
  });
});
