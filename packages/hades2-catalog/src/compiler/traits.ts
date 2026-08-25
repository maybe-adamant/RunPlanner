import type { TraitCatalog } from '@run-planner/engine/catalog-schema';

import { freezeUniqueStrings, requireArray } from './common';
import { normalizeChaos } from './trait-chaos';
import {
  collectCoreGodTraitKeys,
  normalizeAspects,
  normalizeTraits,
  normalizeWeapons,
} from './trait-declarations';
import { normalizeGivers } from './trait-givers';
import {
  normalizeBoonRarityBases,
  normalizeEchoLastRunBoon,
  normalizeContexts,
} from './trait-offer-catalog';
import {
  validateAspectStartingTraits,
  validateProperUpbringingAndDeferred,
  validateRuntimeOfferFallbacks,
  validateTraitCatalogClosure,
} from './trait-catalog-assembly';
import type { RawTraitCatalogInput } from '../declarations/traits';

const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const BASE_ELEMENTS = ['Earth', 'Air', 'Fire', 'Water'] as const;

export function createTraitCatalog(input: RawTraitCatalogInput): TraitCatalog {
  const declaredDeferred = freezeUniqueStrings(
    requireArray(input.deferredTraitKeys, 'deferredTraitKeys') as readonly string[],
    'deferredTraitKeys',
  );
  const deferred = new Set(declaredDeferred);
  const weapons = normalizeWeapons(input.weapons);
  const aspects = normalizeAspects(input.aspects, weapons);
  const coreGodTraitKeys = collectCoreGodTraitKeys(input.givers);
  const traits = normalizeTraits(input.traits, weapons, aspects, deferred, coreGodTraitKeys);
  validateProperUpbringingAndDeferred({ declaredDeferred, traits });
  const givers = normalizeGivers(input.givers, traits);
  validateRuntimeOfferFallbacks({ traits, givers });
  const boonRarityBases = normalizeBoonRarityBases(input.boonRarityBases);
  validateAspectStartingTraits({ aspects, traits, givers });
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
    echoLastRunBoon,
    chaos,
  });
}
