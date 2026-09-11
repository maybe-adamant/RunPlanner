import type { TraitCatalog } from '@run-planner/engine/catalog-schema';

import { freezeUniqueStrings, requireArray } from '../common';
import { normalizeChaos } from './chaos';
import { normalizeAspects } from './aspects';
import { collectCoreGodTraitKeys } from './core-god-keys';
import { normalizeTraits } from './declarations';
import { normalizeWeapons } from './weapons';
import { normalizeGivers } from './givers';
import {
  normalizeBoonRarityBases,
  normalizeBoonRarityRollOrder,
  normalizeBoonReplacementChance,
  normalizeEchoLastRunBoon,
  normalizeContexts,
} from './offer-catalog';
import {
  validateAspectStartingTraits,
  validateAspectTraitOfferLevelBonuses,
  validateHammerCompatibilityClosure,
  validateProperUpbringingAndDeferred,
  validateTraitCatalogClosure,
  validateWeaponAspectClosure,
} from './catalog-assembly';
import type { RawTraitCatalogInput } from '../../declarations/traits/types';
import { normalizeHexes } from './hexes';

const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const BASE_ELEMENTS = ['Earth', 'Air', 'Fire', 'Water'] as const;

export function createTraitCatalog(input: RawTraitCatalogInput): TraitCatalog {
  const declaredDeferred = freezeUniqueStrings(
    requireArray(input.deferredTraitKeys, 'deferredTraitKeys') as readonly string[],
    'deferredTraitKeys',
  );
  const deferred = new Set(declaredDeferred);
  const weapons = normalizeWeapons(input.weapons);
  const aspects = normalizeAspects(input.aspects);
  validateWeaponAspectClosure({ weapons, aspects });
  const coreGodTraitKeys = collectCoreGodTraitKeys(input.givers);
  const traits = normalizeTraits(input.traits, deferred, coreGodTraitKeys);
  validateHammerCompatibilityClosure({ traits, weapons, aspects });
  validateProperUpbringingAndDeferred({ declaredDeferred, traits });
  const givers = normalizeGivers(input.givers, traits);
  const hexes = normalizeHexes(input.hexes);
  const boonRarityBases = normalizeBoonRarityBases(input.boonRarityBases);
  const boonRarityRollOrder = normalizeBoonRarityRollOrder(input.boonRarityRollOrder);
  const boonReplacementChance = normalizeBoonReplacementChance(input.boonReplacementChance);
  validateAspectStartingTraits({ aspects, traits, givers });
  validateAspectTraitOfferLevelBonuses({ aspects, traits });
  validateTraitCatalogClosure({ traits, givers });
  const echoLastRunBoon = normalizeEchoLastRunBoon(input.echoLastRunBoon, traits, givers);
  const offerContexts = normalizeContexts(input.offerContexts);
  const chaos = normalizeChaos(input.chaos);
  return Object.freeze({
    rarityOrder: Object.freeze(['Common', 'Rare', 'Epic', 'Heroic'] as const),
    elements: Object.freeze([...ELEMENTS]),
    baseElements: Object.freeze([...BASE_ELEMENTS] as ['Earth', 'Air', 'Fire', 'Water']),
    offerContexts,
    weapons,
    aspects,
    traits,
    givers,
    boonRarityBases,
    boonRarityRollOrder,
    boonReplacementChance,
    echoLastRunBoon,
    hexes,
    chaos,
  });
}
