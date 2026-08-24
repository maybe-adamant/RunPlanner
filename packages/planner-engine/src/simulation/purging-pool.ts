import type { PurgingPoolState } from '../authored-project/model';
import type { Catalog } from '../catalog-schema';
import type { EquippedTrait } from '../authored-project/traits';
import type { FindingEvidence } from './model';

export type PurgingPoolSlotKey = keyof PurgingPoolState['traitKeyBySlot'];

export interface PurgingPoolAssessmentFinding {
  readonly code:
    | 'purgingPoolTraitMissing'
    | 'purgingPoolTraitUnavailable'
    | 'purgingPoolTraitDuplicate'
    | 'purgingPoolWrongCardinality';
  readonly slotKey?: PurgingPoolSlotKey;
  readonly evidence: FindingEvidence;
}

/** Exact final-list authoring support at one post-encounter Pool frontier. */
export interface PurgingPoolAssessment {
  readonly eligibleTraitKeys: readonly string[];
  readonly requiredTraitCount: number;
  readonly candidateTraitKeysBySlot: Readonly<Record<PurgingPoolSlotKey, readonly string[]>>;
  readonly complete: boolean;
  readonly findings: readonly PurgingPoolAssessmentFinding[];
}

const SLOT_KEYS = ['left', 'middle', 'right'] as const satisfies readonly PurgingPoolSlotKey[];

function isShopAwareGodTrait(catalog: Catalog, traitKey: string): boolean {
  return catalog.traitGivers.values.some(
    (giver) => giver.shopAwareGodTrait && giver.traitKeys.includes(traitKey),
  );
}

/** Shared source predicate for Pool generation and exact sale-prefix legality. */
export function isPurgingPoolEligibleTrait(catalog: Catalog, trait: EquippedTrait): boolean {
  return trait.rarity !== undefined && isShopAwareGodTrait(catalog, trait.traitKey);
}

/**
 * The source predicate is membership in any normalized shop-aware giver plus
 * a concrete current rarity. It intentionally does not infer from slot,
 * provider kind, or acquisition giver, so Duos, Hermes, and field providers
 * retain their source membership while rarityless direct grants do not enter.
 */
export function assessPurgingPool(
  catalog: Catalog,
  state: PurgingPoolState,
  equippedTraits: Readonly<Record<string, EquippedTrait>>,
): PurgingPoolAssessment {
  const eligibleTraitKeys = Object.freeze(
    [
      ...new Set(
        Object.values(equippedTraits)
          .filter((trait) => isPurgingPoolEligibleTrait(catalog, trait))
          .map((trait) => trait.traitKey),
      ),
    ].sort(),
  );
  const eligible = new Set(eligibleTraitKeys);
  const requiredTraitCount = Math.min(SLOT_KEYS.length, eligibleTraitKeys.length);
  const selectedBySlot = state.traitKeyBySlot;
  const candidateTraitKeysBySlot = Object.freeze(
    Object.fromEntries(
      SLOT_KEYS.map((slotKey) => {
        const siblings = new Set(
          SLOT_KEYS.flatMap((key) =>
            key === slotKey || selectedBySlot[key] === null ? [] : [selectedBySlot[key]],
          ),
        );
        return [slotKey, Object.freeze(eligibleTraitKeys.filter((key) => !siblings.has(key)))];
      }),
    ) as Record<PurgingPoolSlotKey, readonly string[]>,
  );
  const findings: PurgingPoolAssessmentFinding[] = [];
  const seen = new Set<string>();
  let resolvedCount = 0;
  let validSelectedCount = 0;
  for (const slotKey of SLOT_KEYS) {
    const traitKey = selectedBySlot[slotKey];
    if (traitKey === null) continue;
    resolvedCount += 1;
    if (seen.has(traitKey)) {
      findings.push(
        Object.freeze({
          code: 'purgingPoolTraitDuplicate',
          slotKey,
          evidence: Object.freeze({ traitKey }),
        }),
      );
      continue;
    }
    seen.add(traitKey);
    if (!eligible.has(traitKey)) {
      findings.push(
        Object.freeze({
          code: 'purgingPoolTraitUnavailable',
          slotKey,
          evidence: Object.freeze({ traitKey, eligibleTraitKeys }),
        }),
      );
      continue;
    }
    validSelectedCount += 1;
  }
  if (resolvedCount < requiredTraitCount) {
    findings.push(
      Object.freeze({
        code: 'purgingPoolTraitMissing',
        evidence: Object.freeze({ requiredTraitCount, resolvedCount }),
      }),
    );
  }
  if (resolvedCount > requiredTraitCount) {
    findings.push(
      Object.freeze({
        code: 'purgingPoolWrongCardinality',
        evidence: Object.freeze({ requiredTraitCount, resolvedCount }),
      }),
    );
  }
  return Object.freeze({
    eligibleTraitKeys,
    requiredTraitCount,
    candidateTraitKeysBySlot,
    complete:
      resolvedCount === requiredTraitCount &&
      validSelectedCount === requiredTraitCount &&
      findings.length === 0,
    findings: Object.freeze(findings),
  });
}
