import type { Catalog } from '../../catalog-schema';
import {
  createAllTogetherSetAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createNaturalSelectionResultAddress,
  createTraitAcquisitionTargetAddress,
  type AllTogetherSetAddress,
  type CirceResolutionAddress,
  type EchoLastRunBoonAddress,
  type EchoPomTargetAddress,
  type NaturalSelectionResultAddress,
  type TraitOfferAddress,
  type TraitAcquisitionTargetAddress,
} from '../addresses';
import {
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitCarrierOutcome,
  type AuthoredTraitOfferTraits,
  type AuthoredAllTogetherResult,
  type AuthoredCirceResolution,
  type AuthoredConcaveStoneResult,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredHexTreeConfiguration,
  type OneToEight,
  type OneToThree,
  type TraitOptionKey,
} from './state';

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
      readonly kind: 'latestModelTargets';
      readonly address: TraitAcquisitionTargetAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly targets?: readonly [string] | readonly [string, string];
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'allTogetherSet';
      readonly address: AllTogetherSetAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly setKey: import('../../catalog-schema').DirectTraitSetKey;
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
    }
  | {
      readonly kind: 'circeResolution';
      readonly address: CirceResolutionAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly value?: AuthoredCirceResolution;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'echoPomTarget';
      readonly address: EchoPomTargetAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly value?: string | null;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'echoLastRunBoon';
      readonly address: EchoLastRunBoonAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly value?: AuthoredEchoLastRunBoonOffer;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'hexTree';
      readonly trait: TraitOfferAddress;
      readonly address: TraitOfferAddress;
      readonly optionKey: TraitOptionKey;
      readonly traitKey: string;
      readonly value?: AuthoredHexTreeConfiguration;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'concaveStone';
      readonly trait: TraitOfferAddress;
      readonly address: TraitOfferAddress;
      readonly value?: AuthoredConcaveStoneResult;
      readonly authoredComplete: boolean;
    };

/** Local Echo editor row data; it intentionally does not weaken persisted codecs. */
export interface AuthoredEchoLastRunBoonDraftRow extends AuthoredTraitCarrierOutcome {
  readonly giverKey?: string;
  readonly traitKey?: string;
  readonly rarity?: import('../../catalog-schema').TraitRarity;
}

export interface PreparedEchoLastRunBoonDraft {
  readonly complete: boolean;
  readonly selectedIndex: number;
  readonly value?: AuthoredTraitOfferTraits;
}

export type AuthoredTraitCarrierPayload =
  | {
      readonly kind: 'traitAcquisitionTarget';
      readonly traitKey: string;
      readonly targetTraitKey?: string;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'latestModelTargets';
      readonly traitKey: string;
      readonly targets?: readonly [string] | readonly [string, string];
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'allTogetherSet';
      readonly traitKey: string;
      readonly setKey: import('../../catalog-schema').DirectTraitSetKey;
      readonly value?: string | null;
      readonly authoredComplete: boolean;
    }
  | {
      readonly kind: 'naturalSelectionResult';
      readonly traitKey: string;
      readonly slotCount: number;
      readonly targets?: OneToEight<string>;
      readonly authoredComplete: boolean;
    };

/** Shared declaration-owned payload read for outer and nested Echo carriers. */
export function discoverAuthoredTraitCarrierPayloads(
  catalog: Catalog,
  traitKey: string,
  outcome: import('./state').AuthoredTraitCarrierOutcome,
): readonly AuthoredTraitCarrierPayload[] {
  const declaration = catalog.traits.byKey[traitKey];
  if (declaration === undefined) return Object.freeze([]);
  if (declaration.targetedAcquisition?.kind === 'upgradeHammerToRank2')
    return Object.freeze([
      Object.freeze({
        kind: 'latestModelTargets' as const,
        traitKey,
        ...(outcome.icarusHammerTargets === undefined
          ? {}
          : { targets: outcome.icarusHammerTargets }),
        authoredComplete: outcome.icarusHammerTargets !== undefined,
      }),
    ]);
  if (declaration.targetedAcquisition !== undefined)
    return Object.freeze([
      Object.freeze({
        kind: 'traitAcquisitionTarget' as const,
        traitKey,
        ...(outcome.targetTraitKey === undefined ? {} : { targetTraitKey: outcome.targetTraitKey }),
        authoredComplete: outcome.targetTraitKey !== undefined,
      }),
    ]);
  if (declaration.selectedDisposition.kind === 'directTraitSets')
    return Object.freeze(
      declaration.selectedDisposition.sets.map((set) =>
        Object.freeze({
          kind: 'allTogetherSet' as const,
          traitKey,
          setKey: set.key,
          ...(outcome.allTogetherResult === undefined
            ? {}
            : { value: outcome.allTogetherResult[set.key] }),
          authoredComplete: outcome.allTogetherResult !== undefined,
        }),
      ),
    );
  if (declaration.selectedDisposition.kind === 'naturalSelection')
    return Object.freeze([
      Object.freeze({
        kind: 'naturalSelectionResult' as const,
        traitKey,
        slotCount: declaration.selectedDisposition.levelCount,
        ...(outcome.naturalSelectionTargets === undefined
          ? {}
          : { targets: outcome.naturalSelectionTargets }),
        authoredComplete: outcome.naturalSelectionTargets !== undefined,
      }),
    ]);
  return Object.freeze([]);
}

/** Typed selected-row child identity below Echo's existing semantic owner. */
export type AuthoredEchoLastRunBoonDraftChild = AuthoredTraitCarrierPayload & {
  readonly selectedIndex: number;
};

/**
 * Reads a local Echo selected row without requiring its siblings to form a
 * persisted nested offer. Its parent remains the existing EchoBoon address.
 */
export function discoverAuthoredEchoLastRunBoonDraftChildren(
  catalog: Catalog,
  rows: readonly AuthoredEchoLastRunBoonDraftRow[],
  selectedIndex: number,
): readonly AuthoredEchoLastRunBoonDraftChild[] {
  const row = rows[selectedIndex];
  if (row?.traitKey === undefined) return Object.freeze([]);
  return Object.freeze(
    discoverAuthoredTraitCarrierPayloads(catalog, row.traitKey, row).map((payload) =>
      Object.freeze({ ...payload, selectedIndex }),
    ),
  );
}

function completeEchoRows(
  rows: readonly AuthoredEchoLastRunBoonDraftRow[],
): OneToThree<AuthoredEchoLastRunBoonOption> | undefined {
  const optionFor = (
    row: AuthoredEchoLastRunBoonDraftRow,
  ): AuthoredEchoLastRunBoonOption | undefined =>
    row.giverKey === undefined || row.traitKey === undefined || row.rarity === undefined
      ? undefined
      : Object.freeze({
          giverKey: row.giverKey,
          traitKey: row.traitKey,
          rarity: row.rarity,
          ...(row.targetTraitKey === undefined ? {} : { targetTraitKey: row.targetTraitKey }),
          ...(row.allTogetherResult === undefined
            ? {}
            : { allTogetherResult: row.allTogetherResult }),
          ...(row.naturalSelectionTargets === undefined
            ? {}
            : { naturalSelectionTargets: row.naturalSelectionTargets }),
        });
  if (rows.length === 1) {
    const first = optionFor(rows[0]!);
    return first === undefined ? undefined : Object.freeze([first]);
  }
  if (rows.length === 2) {
    const first = optionFor(rows[0]!);
    const second = optionFor(rows[1]!);
    return first === undefined || second === undefined ? undefined : Object.freeze([first, second]);
  }
  if (rows.length === 3) {
    const first = optionFor(rows[0]!);
    const second = optionFor(rows[1]!);
    const third = optionFor(rows[2]!);
    return first === undefined || second === undefined || third === undefined
      ? undefined
      : Object.freeze([first, second, third]);
  }
  return undefined;
}

/** Completes transient Echo rows only when they form one valid authored Boon outcome. */
export function completeAuthoredEchoLastRunBoonDraft(
  rows: readonly AuthoredEchoLastRunBoonDraftRow[],
  selectedIndex: number,
): AuthoredEchoLastRunBoonOffer | undefined {
  const options = completeEchoRows(rows);
  if (options === undefined || selectedIndex < 0 || selectedIndex >= options.length)
    return undefined;
  return Object.freeze({
    options,
    selectedOptionKey: `option${selectedIndex + 1}` as TraitOptionKey,
  });
}

/**
 * Builds a candidate-readable complete outer draft only once local Echo rows
 * are complete. Partial rows remain a React concern and never enter codecs.
 */
export function prepareEchoLastRunBoonDraft(
  offer: AuthoredTraitOfferTraits,
  child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'echoLastRunBoon' }>,
  rows: readonly AuthoredEchoLastRunBoonDraftRow[],
  selectedIndex: number,
): PreparedEchoLastRunBoonDraft {
  requireOwnedOption(offer, child);
  const completed = completeAuthoredEchoLastRunBoonDraft(rows, selectedIndex);
  if (completed === undefined) return Object.freeze({ complete: false, selectedIndex });
  const updated = updateAuthoredTraitCarrierChild(offer, {
    kind: 'echoLastRunBoon',
    child,
    value: completed,
  });
  return Object.freeze({ complete: true, selectedIndex, value: updated });
}

export function discoverAuthoredTraitCarrierChildren(
  catalog: Catalog,
  address: TraitOfferAddress,
  offer: AuthoredTraitOffer,
): readonly AuthoredTraitCarrierChild[] {
  if (offer.kind !== 'traits') return Object.freeze([]);
  const optionKey = offer.selectedOptionKey;
  const selected = offer.options[optionIndex(optionKey)];
  if (selected === undefined) return Object.freeze([]);
  const children: AuthoredTraitCarrierChild[] = [];
  const appendPayloadChildren = (
    childOptionKey: TraitOptionKey,
    option: AuthoredTraitOfferTraits['options'][number],
  ) => {
    for (const payload of discoverAuthoredTraitCarrierPayloads(catalog, option.traitKey, option)) {
      if (payload.kind === 'traitAcquisitionTarget')
        children.push(
          Object.freeze({
            ...payload,
            address: createTraitAcquisitionTargetAddress(address, childOptionKey),
            optionKey: childOptionKey,
          }),
        );
      else if (payload.kind === 'latestModelTargets')
        children.push(
          Object.freeze({
            ...payload,
            address: createTraitAcquisitionTargetAddress(address, childOptionKey),
            optionKey: childOptionKey,
          }),
        );
      else if (payload.kind === 'allTogetherSet')
        children.push(
          Object.freeze({
            ...payload,
            address: createAllTogetherSetAddress(address, childOptionKey, payload.setKey),
            optionKey: childOptionKey,
          }),
        );
      else
        children.push(
          Object.freeze({
            ...payload,
            address: createNaturalSelectionResultAddress(address, childOptionKey),
            optionKey: childOptionKey,
          }),
        );
    }
  };
  appendPayloadChildren(optionKey, selected);
  const residualOptionKey =
    offer.concaveStoneResult?.kind === 'proc' ? offer.concaveStoneResult.optionKey : undefined;
  const residual =
    residualOptionKey === undefined || residualOptionKey === optionKey
      ? undefined
      : offer.options[optionIndex(residualOptionKey)];
  if (residualOptionKey !== undefined && residual !== undefined)
    appendPayloadChildren(residualOptionKey, residual);
  const declaration = catalog.traits.byKey[selected.traitKey];
  if (declaration?.selectedDisposition.kind === 'circe') {
    children.push(
      Object.freeze({
        kind: 'circeResolution' as const,
        trait: address,
        address: createCirceResolutionAddress(address, optionKey),
        optionKey,
        traitKey: selected.traitKey,
        ...(selected.circeResolution === undefined ? {} : { value: selected.circeResolution }),
        authoredComplete: selected.circeResolution !== undefined,
      }),
    );
  }
  if (
    declaration?.selectedDisposition.kind === 'echo' &&
    declaration.selectedDisposition.effect === 'doubleLevel'
  ) {
    children.push(
      Object.freeze({
        kind: 'echoPomTarget' as const,
        trait: address,
        address: createEchoPomTargetAddress(address, optionKey),
        optionKey,
        traitKey: selected.traitKey,
        ...(selected.echoPomTarget === undefined ? {} : { value: selected.echoPomTarget }),
        authoredComplete: selected.echoPomTarget !== undefined,
      }),
    );
  }
  if (
    declaration?.selectedDisposition.kind === 'echo' &&
    declaration.selectedDisposition.effect === 'lastRunBoon'
  ) {
    children.push(
      Object.freeze({
        kind: 'echoLastRunBoon' as const,
        trait: address,
        address: createEchoLastRunBoonAddress(address, optionKey),
        optionKey,
        traitKey: selected.traitKey,
        ...(selected.echoLastRunBoon === undefined ? {} : { value: selected.echoLastRunBoon }),
        authoredComplete: selected.echoLastRunBoon !== undefined,
      }),
    );
  }
  if (catalog.hexes.byKey[selected.traitKey] !== undefined || offer.hexTree !== undefined) {
    children.push(
      Object.freeze({
        kind: 'hexTree' as const,
        trait: address,
        address,
        optionKey,
        traitKey: selected.traitKey,
        ...(offer.hexTree === undefined ? {} : { value: offer.hexTree }),
        authoredComplete: offer.hexTree !== undefined,
      }),
    );
  }
  if (
    catalog.traitGivers.byKey[offer.giverKey]?.shopAwareGodTrait === true ||
    offer.concaveStoneResult !== undefined
  ) {
    children.push(
      Object.freeze({
        kind: 'concaveStone' as const,
        trait: address,
        address,
        ...(offer.concaveStoneResult === undefined ? {} : { value: offer.concaveStoneResult }),
        authoredComplete: offer.concaveStoneResult !== undefined,
      }),
    );
  }
  return Object.freeze(children);
}

type AuthoredTraitOptionCarrierChild = Exclude<
  AuthoredTraitCarrierChild,
  { readonly kind: 'concaveStone' }
>;

function requireOwnedOption(
  offer: AuthoredTraitOfferTraits,
  child: AuthoredTraitOptionCarrierChild,
): AuthoredTraitOfferTraits['options'][number] {
  const activeStoneResidual =
    offer.concaveStoneResult?.kind === 'proc' &&
    offer.concaveStoneResult.optionKey === child.optionKey;
  if (offer.selectedOptionKey !== child.optionKey && !activeStoneResidual)
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
      readonly kind: 'latestModelTargets';
      readonly child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'latestModelTargets' }>;
      readonly icarusHammerTargets: readonly [string] | readonly [string, string];
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
    }
  | {
      readonly kind: 'circeResolution';
      readonly child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'circeResolution' }>;
      readonly value: AuthoredCirceResolution;
    }
  | {
      readonly kind: 'echoPomTarget';
      readonly child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'echoPomTarget' }>;
      readonly value: string | null;
    }
  | {
      readonly kind: 'echoLastRunBoon';
      readonly child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'echoLastRunBoon' }>;
      readonly value: AuthoredEchoLastRunBoonOffer;
    }
  | {
      readonly kind: 'hexTree';
      readonly child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'hexTree' }>;
      readonly value: AuthoredHexTreeConfiguration;
    }
  | {
      readonly kind: 'concaveStone';
      readonly child: Extract<AuthoredTraitCarrierChild, { readonly kind: 'concaveStone' }>;
      readonly value: AuthoredConcaveStoneResult | null;
    };

export function updateAuthoredTraitCarrierChild(
  offer: AuthoredTraitOfferTraits,
  update: AuthoredTraitCarrierChildUpdate,
): AuthoredTraitOfferTraits {
  if (update.kind === 'concaveStone') {
    if (update.value !== null) return Object.freeze({ ...offer, concaveStoneResult: update.value });
    const { concaveStoneResult: _result, ...withoutResult } = offer;
    void _result;
    return Object.freeze(withoutResult);
  }
  const option = requireOwnedOption(offer, update.child);
  const updated =
    update.kind === 'latestModelTargets'
      ? Object.freeze({
          ...option,
          icarusHammerTargets: Object.freeze([
            ...update.icarusHammerTargets,
          ]) as typeof update.icarusHammerTargets,
        })
      : update.kind === 'traitAcquisitionTarget'
        ? Object.freeze({ ...option, targetTraitKey: update.targetTraitKey })
        : update.kind === 'allTogetherSet'
          ? Object.freeze({ ...option, allTogetherResult: update.allTogetherResult })
          : update.kind === 'naturalSelectionResult'
            ? Object.freeze({ ...option, naturalSelectionTargets: update.targets })
            : update.kind === 'circeResolution'
              ? Object.freeze({ ...option, circeResolution: update.value })
              : update.kind === 'echoPomTarget'
                ? Object.freeze({ ...option, echoPomTarget: update.value })
                : update.kind === 'echoLastRunBoon'
                  ? Object.freeze({ ...option, echoLastRunBoon: update.value })
                  : option;
  const options = [...offer.options];
  options[optionIndex(update.child.optionKey)] = updated;
  return Object.freeze({
    ...offer,
    ...(update.kind === 'hexTree' ? { hexTree: update.value } : {}),
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}
