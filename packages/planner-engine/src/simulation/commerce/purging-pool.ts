import type {
  PurgingPoolSlotKey as AuthoredPurgingPoolSlotKey,
  PurgingPoolState,
  RoomActionReference,
} from '../../authored-project/model';
import type { FeatureRerollOption } from './feature-rolls';
import type { Catalog } from '../../catalog-schema';
import type { EquippedTrait } from '../../authored-project/traits/state';
import type { FindingEvidence } from '../model';
import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';

export type PurgingPoolSlotKey = AuthoredPurgingPoolSlotKey;

export interface PurgingPoolAssessmentFinding {
  readonly code:
    'purgingPoolTraitMissing' | 'purgingPoolTraitUnavailable' | 'purgingPoolTraitDuplicate';
  readonly slotKey: PurgingPoolSlotKey;
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

/** What can be done at the end of a Pool's authored sequence, where a new action is appended. */
export interface PurgingPoolInteraction {
  readonly historySequence: number;
  /** The list on show there: `initial` or a Pool reroll's id. */
  readonly rollKey: string;
  /** Each slot that can be sold there, with the exact sale action to insert. */
  readonly offers: readonly {
    readonly slotKey: PurgingPoolSlotKey;
    /** Null while the slot is unpinned. */
    readonly traitKey: string | null;
    readonly sale: Extract<RoomActionReference, { readonly kind: 'sellPurgingPoolTrait' }>;
  }[];
  readonly reroll: FeatureRerollOption;
  /** The list a reroll appended there would draw from the current traits. */
  readonly pendingRoll: PurgingPoolRollCapability;
}

export interface PurgingPoolRollCapability {
  /** The slots the list fills: as many as there are eligible traits, up to three. */
  readonly offeredSlotKeys: readonly PurgingPoolSlotKey[];
  readonly candidateTraitKeysBySlot: Readonly<Record<PurgingPoolSlotKey, readonly string[]>>;
}

export interface PurgingPoolCandidateCapability {
  readonly assessments: readonly PurgingPoolAssessment[];
  /** The initial list's candidates. */
  readonly candidateTraitKeysBySlot: Readonly<Record<PurgingPoolSlotKey, readonly string[]>>;
  /** Each reached Pool reroll's list, by its reroll id. */
  readonly rolls: Readonly<Record<string, PurgingPoolRollCapability>>;
  /** Undefined while the Pool's sequence is unreached. */
  readonly interaction?: PurgingPoolInteraction;
}
export interface PurgingPoolCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => PurgingPoolCandidateCapability | undefined;
}

/** The candidates every branch's assessment agrees on. */
export function agreedPurgingPoolCandidates(
  assessments: readonly PurgingPoolAssessment[],
): Readonly<Record<PurgingPoolSlotKey, readonly string[]>> {
  const first = assessments[0];
  return Object.freeze(
    Object.fromEntries(
      SLOT_KEYS.map((slotKey) => [
        slotKey,
        Object.freeze(
          (first?.candidateTraitKeysBySlot[slotKey] ?? []).filter((traitKey) =>
            assessments.every((assessment) =>
              assessment.candidateTraitKeysBySlot[slotKey].includes(traitKey),
            ),
          ),
        ),
      ]),
    ) as Record<PurgingPoolSlotKey, readonly string[]>,
  );
}

/** One Pool room's assessed lists: the initial one, then each reroll's by its id. */
export interface PurgingPoolRoomAssessments {
  readonly assessments: readonly PurgingPoolAssessment[];
  readonly rolls?: Readonly<
    Record<
      string,
      {
        readonly offeredSlotKeys: readonly PurgingPoolSlotKey[];
        readonly assessments: readonly PurgingPoolAssessment[];
      }
    >
  >;
  readonly interaction?: PurgingPoolInteraction;
}

export function createPurgingPoolCandidateArtifacts(
  contexts: ReadonlyMap<string, PurgingPoolRoomAssessments>,
): PurgingPoolCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => {
      const room = privateContexts.get(semanticAddressKey(occurrence));
      if (room === undefined || room.assessments.length === 0) return undefined;
      return Object.freeze({
        assessments: room.assessments,
        candidateTraitKeysBySlot: agreedPurgingPoolCandidates(room.assessments),
        rolls: Object.freeze(
          Object.fromEntries(
            Object.entries(room.rolls ?? {}).map(([rollKey, roll]) => [
              rollKey,
              Object.freeze({
                offeredSlotKeys: roll.offeredSlotKeys,
                candidateTraitKeysBySlot: agreedPurgingPoolCandidates(roll.assessments),
              }),
            ]),
          ),
        ),
        ...(room.interaction === undefined ? {} : { interaction: room.interaction }),
      });
    },
  });
}
export function createEmptyPurgingPoolCandidateArtifacts(): PurgingPoolCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
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
  return assessPurgingPoolList(catalog, state.traitKeyBySlot, equippedTraits, true);
}

/**
 * Assesses one list against the current traits. The initial list must fill
 * every eligible slot; a reroll's list is pinned slot by slot.
 */
export function assessPurgingPoolList(
  catalog: Catalog,
  traitKeyBySlot: Readonly<Partial<Record<PurgingPoolSlotKey, string | null>>>,
  equippedTraits: Readonly<Record<string, EquippedTrait>>,
  requireFill: boolean,
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
  const selectedBySlot = Object.freeze(
    Object.fromEntries(SLOT_KEYS.map((slotKey) => [slotKey, traitKeyBySlot[slotKey] ?? null])),
  ) as Readonly<Record<PurgingPoolSlotKey, string | null>>;
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
  // The game's list is unordered; each missing fill marks the next empty slot by planner convention.
  const emptySlotKeys = SLOT_KEYS.filter((slotKey) => selectedBySlot[slotKey] === null);
  const missingCount = requireFill ? Math.max(0, requiredTraitCount - resolvedCount) : 0;
  for (const slotKey of emptySlotKeys.slice(0, missingCount)) {
    findings.push(
      Object.freeze({
        code: 'purgingPoolTraitMissing',
        slotKey,
        evidence: Object.freeze({ requiredTraitCount, resolvedCount }),
      }),
    );
  }
  // Overfilling needs more distinct eligible names than exist, so a slot is already
  // reported as duplicate or unavailable.
  return Object.freeze({
    eligibleTraitKeys,
    requiredTraitCount,
    candidateTraitKeysBySlot,
    complete:
      (!requireFill || resolvedCount === requiredTraitCount) &&
      validSelectedCount === resolvedCount &&
      findings.length === 0,
    findings: Object.freeze(findings),
  });
}
