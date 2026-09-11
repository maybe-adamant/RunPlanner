import type { Catalog } from '../catalog-schema';
import {
  createAllTogetherSetAddress,
  createNaturalSelectionResultAddress,
  createTraitAcquisitionTargetAddress,
  type AllTogetherSetAddress,
  type NaturalSelectionResultAddress,
  type TraitOfferAddress,
  type TraitAcquisitionTargetAddress,
} from './addresses';
import {
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredAllTogetherResult,
  type OneToEight,
  type TraitOptionKey,
} from './traits';

/**
 * A structurally owned selected-trait outcome. Contextual support remains a
 * candidate-session concern; this product only preserves authored repair
 * children from the exact complete offer draft.
 */
export type AuthoredTraitCarrierChild =
  | {
      readonly kind: 'traitAcquisitionTarget';
      readonly address: TraitAcquisitionTargetAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly targetTraitKey?: string;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'allTogetherSet';
      readonly address: AllTogetherSetAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly setKey: import('../catalog-schema').DirectTraitSetKey;
      readonly value?: string | null;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'naturalSelectionResult';
      readonly address: NaturalSelectionResultAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly slotCount: number;
      readonly targets?: OneToEight<string>;
      readonly authoredComplete: boolean;
    };

export function discoverAuthoredTraitCarrierChildren(
  catalog: Catalog,
  address: TraitOfferAddress,
  offer: AuthoredTraitOffer,
): readonly AuthoredTraitCarrierChild[] {
  if (offer.kind !== 'traits') return Object.freeze([]);
  const optionKey = offer.selectedOptionKey;
  const selected = offer.options[optionIndex(optionKey)];
  if (selected === undefined) return Object.freeze([]);
  const declaration = catalog.traits.byKey[selected.traitKey];
  if (declaration === undefined) return Object.freeze([]);
  const children: AuthoredTraitCarrierChild[] = [];
  if (declaration.targetedAcquisition !== undefined) {
    children.push(
      Object.freeze({
        kind: 'traitAcquisitionTarget' as const,
        address: createTraitAcquisitionTargetAddress(address, optionKey),
        optionKey,
        traitKey: selected.traitKey,
        ...(selected.targetTraitKey === undefined
          ? {}
          : { targetTraitKey: selected.targetTraitKey }),
        authoredComplete: selected.targetTraitKey !== undefined,
      }),
    );
  }
  if (declaration.selectedDisposition.kind === 'directTraitSets') {
    for (const set of declaration.selectedDisposition.sets) {
      const allTogetherResult = selected.allTogetherResult;
      children.push(
        Object.freeze({
          kind: 'allTogetherSet' as const,
          address: createAllTogetherSetAddress(address, optionKey, set.key),
          optionKey,
          traitKey: selected.traitKey,
          setKey: set.key,
          ...(allTogetherResult === undefined ? {} : { value: allTogetherResult[set.key] }),
          authoredComplete: allTogetherResult !== undefined,
        }),
      );
    }
  }
  if (declaration.selectedDisposition.kind === 'naturalSelection') {
    const targets = selected.naturalSelectionTargets;
    children.push(
      Object.freeze({
        kind: 'naturalSelectionResult' as const,
        address: createNaturalSelectionResultAddress(address, optionKey),
        optionKey,
        traitKey: selected.traitKey,
        slotCount: declaration.selectedDisposition.levelCount,
        ...(targets === undefined ? {} : { targets }),
        // A candidate capability determines whether a shortened sequence is
        // a legal exhausted result. Structure only knows it was authored.
        authoredComplete: targets !== undefined,
      }),
    );
  }
  return Object.freeze(children);
}

function requireOwnedOption(
  offer: AuthoredTraitOfferTraits,
  child: AuthoredTraitCarrierChild,
): AuthoredTraitOfferTraits['options'][number] {
  if (offer.selectedOptionKey !== child.optionKey)
    throw new Error('trait carrier child does not belong to the selected trait option');
  const option = offer.options[optionIndex(child.optionKey)];
  if (option === undefined) throw new Error('trait carrier child option is missing');
  if (option.traitKey !== child.traitKey)
    throw new Error('trait carrier child does not belong to the current selected trait');
  return option;
}

/** Replaces one exact structurally discovered child without a field-path API. */
export type AuthoredTraitCarrierChildUpdate =
  | {
      readonly kind: 'traitAcquisitionTarget';
      readonly child: Extract<
        AuthoredTraitCarrierChild,
        { readonly kind: 'traitAcquisitionTarget' }
      >;
      readonly targetTraitKey: string;
    }
  | {
      readonly kind: 'allTogetherSet';
      readonly child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'allTogetherSet' }>;
      readonly allTogetherResult: AuthoredAllTogetherResult;
    }
  | {
      readonly kind: 'naturalSelectionResult';
      readonly child: Extract<
        AuthoredTraitCarrierChild,
        { readonly kind: 'naturalSelectionResult' }
      >;
      readonly targets: OneToEight<string>;
    };

export function updateAuthoredTraitCarrierChild(
  offer: AuthoredTraitOfferTraits,
  update: AuthoredTraitCarrierChildUpdate,
): AuthoredTraitOfferTraits {
  const option = requireOwnedOption(offer, update.child);
  const updated =
    update.kind === 'traitAcquisitionTarget'
      ? Object.freeze({ ...option, targetTraitKey: update.targetTraitKey })
      : update.kind === 'allTogetherSet'
        ? Object.freeze({ ...option, allTogetherResult: update.allTogetherResult })
        : Object.freeze({ ...option, naturalSelectionTargets: update.targets });
  const options = [...offer.options];
  options[optionIndex(update.child.optionKey)] = updated;
  return Object.freeze({
    ...offer,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}
