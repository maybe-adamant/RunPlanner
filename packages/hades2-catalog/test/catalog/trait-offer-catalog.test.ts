import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';

describe('trait offer-catalog compiler owner', () => {
  it('normalizes one closed audited Olympian and Hermes boon-rarity base table', () => {
    expect(catalog.boonRarityBases.olympian).toEqual({
      Rare: 0.1,
      Epic: 0.05,
      Duo: 0.12,
      Legendary: 0.1,
    });
    expect(catalog.boonRarityBases.hermes).toEqual({
      Rare: 0.06,
      Epic: 0.03,
      Duo: 0,
      Legendary: 0.01,
    });
    expect(catalog.traitGivers.byKey.Apollo).not.toHaveProperty('boonRarityBase');
    expect(catalog.traitGivers.byKey.Hermes).not.toHaveProperty('boonRarityBase');
  });

  it('rejects incomplete, extra, and non-finite provider base declarations', () => {
    const malformed = (boonRarityBases: object) =>
      createCatalog({
        ...declarations,
        traitCatalog: { ...declarations.traitCatalog, boonRarityBases: boonRarityBases as never },
      });
    expect(() =>
      malformed({ olympian: declarations.traitCatalog.boonRarityBases.olympian }),
    ).toThrow(/exactly olympian and hermes/);
    expect(() =>
      malformed({
        ...declarations.traitCatalog.boonRarityBases,
        npc: declarations.traitCatalog.boonRarityBases.hermes,
      }),
    ).toThrow(/exactly olympian and hermes/);
    expect(() =>
      malformed({
        ...declarations.traitCatalog.boonRarityBases,
        hermes: { ...declarations.traitCatalog.boonRarityBases.hermes, Duo: Number.NaN },
      }),
    ).toThrow(/finite number/);
  });

  const traits = {
    weapons: catalog.weapons,
    aspects: catalog.aspects,
    traits: catalog.traits,
    givers: catalog.traitGivers,
    echoLastRunBoon: catalog.echoLastRunBoon,
    offerContexts: catalog.traitOfferContexts,
    rarityOrder: catalog.traitRarityOrder,
    baseElements: catalog.traitBaseElements,
  };

  it('declares Echo Boon as the exact source-resolved 13-provider union', () => {
    const variants = traits.echoLastRunBoon.variants.values;
    expect([...new Set(variants.map((variant) => variant.giverKey))]).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Demeter',
      'Hephaestus',
      'Hera',
      'Hestia',
      'Poseidon',
      'Zeus',
      'Hermes',
      'Artemis',
      'Athena',
      'Dionysus',
    ]);
    expect(variants).toHaveLength(236);
    expect(
      variants.every((variant) => {
        const trait = traits.traits.byKey[variant.traitKey];
        return trait?.rarityDomain.kind === 'ranked';
      }),
    ).toBe(true);
    expect(traits.echoLastRunBoon.variants.byKey['Hades:CastProjectileBoon']).toBeUndefined();
    expect(traits.echoLastRunBoon.variants.byKey['Aphrodite:SprintEchoBoon']).toEqual({
      key: 'Aphrodite:SprintEchoBoon',
      giverKey: 'Aphrodite',
      traitKey: 'SprintEchoBoon',
      lootHistorySource: 'AphroditeUpgrade',
    });
    expect(traits.echoLastRunBoon.variants.byKey['Zeus:SprintEchoBoon']).toEqual({
      key: 'Zeus:SprintEchoBoon',
      giverKey: 'Zeus',
      traitKey: 'SprintEchoBoon',
      lootHistorySource: 'ZeusUpgrade',
    });
    expect(traits.echoLastRunBoon.variants.byKey['Artemis:SupportingFireBoon']).toEqual(
      expect.not.objectContaining({ lootHistorySource: expect.anything() }),
    );
    expect(
      variants
        .filter(
          (variant) => traits.traits.byKey[variant.traitKey]?.targetedAcquisition !== undefined,
        )
        .map((variant) => variant.key),
    ).toEqual(['Hera:BoonDecayBoon']);
    expect(
      variants
        .filter(
          (variant) =>
            traits.traits.byKey[variant.traitKey]?.selectedDisposition.kind ===
            'advanceCurrentKeepsake',
        )
        .map((variant) => variant.key),
    ).toEqual(['Demeter:KeepsakeLevelBoon', 'Hera:KeepsakeLevelBoon']);
  });

  it('rejects duplicate and rarityless Echo-last-run sources at the catalog boundary', () => {
    const duplicateSource = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        echoLastRunBoon: {
          ...declarations.traitCatalog.echoLastRunBoon,
          sources: [
            ...declarations.traitCatalog.echoLastRunBoon.sources,
            { giverKey: 'Apollo', lootHistorySource: 'ApolloUpgrade' },
          ],
        },
      },
    };
    expect(() => createCatalog(duplicateSource)).toThrow(/distinct participating givers/);

    const raritylessSource = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        echoLastRunBoon: {
          ...declarations.traitCatalog.echoLastRunBoon,
          sources: [{ giverKey: 'Echo' }],
        },
      },
    };
    expect(() => createCatalog(raritylessSource)).toThrow(
      /Echo cannot participate in Echo's last-run domain/,
    );
  });
});
