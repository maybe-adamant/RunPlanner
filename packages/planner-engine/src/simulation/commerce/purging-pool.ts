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

/** One generated Pool list assessed against the traits held where it is generated. */
export interface PurgingPoolAssessment {
  readonly eligibleTraitKeys: readonly string[];
  readonly requiredTraitCount: number;
  /** The slots the list shows: as many as there are eligible traits, up to three, stocked first. */
  readonly offeredSlotKeys: readonly PurgingPoolSlotKey[];
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
  /** Every trait the list can draw where it is generated. */
  readonly eligibleTraitKeys: readonly string[];
  /** The traits on show just before a reroll; the game bans one when it leaves eligible ones unshown. */
  readonly shownTraitKeys?: readonly string[];
  /** The listed slots no longer eligible where the list is judged: the list is stale. */
  readonly staleSlotKeys: readonly PurgingPoolSlotKey[];
}

export interface PurgingPoolCandidateCapability {
  /** The entry list's assessment at room entry. */
  readonly assessment: PurgingPoolAssessment;
  /** The entry list's candidates. */
  readonly candidateTraitKeysBySlot: Readonly<Record<PurgingPoolSlotKey, readonly string[]>>;
  /** The list regenerated after the fountain use made the entry list stale. */
  readonly refresh?: PurgingPoolRollCapability;
  /** The fountain use judged the entry list: a refresh absent then is not needed. */
  readonly fountainJudged: boolean;
  /** Each reached Pool reroll's list, by its reroll id. */
  readonly rolls: Readonly<Record<string, PurgingPoolRollCapability>>;
  /** Undefined while the Pool's sequence is unreached. */
  readonly interaction?: PurgingPoolInteraction;
}
export interface PurgingPoolCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => PurgingPoolCandidateCapability | undefined;
}

/** One Pool room's assessed lists: the entry one, its refresh, then each reroll's by its id. */
export interface PurgingPoolRoomAssessments {
  readonly assessment: PurgingPoolAssessment;
  readonly refresh?: PurgingPoolAssessment;
  readonly fountainJudged?: boolean;
  readonly rolls?: Readonly<
    Record<
      string,
      {
        readonly offeredSlotKeys: readonly PurgingPoolSlotKey[];
        readonly assessment: PurgingPoolAssessment;
        readonly shownTraitKeys?: readonly string[];
      }
    >
  >;
  readonly interaction?: PurgingPoolInteraction;
}

function rollCapability(
  assessment: PurgingPoolAssessment,
  shownTraitKeys?: readonly string[],
): PurgingPoolRollCapability {
  return Object.freeze({
    offeredSlotKeys: assessment.offeredSlotKeys,
    candidateTraitKeysBySlot: assessment.candidateTraitKeysBySlot,
    eligibleTraitKeys: assessment.eligibleTraitKeys,
    ...(shownTraitKeys === undefined ? {} : { shownTraitKeys }),
    staleSlotKeys: Object.freeze(
      assessment.findings.flatMap((finding) =>
        finding.code === 'purgingPoolTraitUnavailable' ? [finding.slotKey] : [],
      ),
    ),
  });
}

export function createPurgingPoolCandidateArtifacts(
  contexts: ReadonlyMap<string, PurgingPoolRoomAssessments>,
): PurgingPoolCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => {
      const room = privateContexts.get(semanticAddressKey(occurrence));
      if (room === undefined) return undefined;
      return Object.freeze({
        assessment: room.assessment,
        candidateTraitKeysBySlot: room.assessment.candidateTraitKeysBySlot,
        ...(room.refresh === undefined ? {} : { refresh: rollCapability(room.refresh) }),
        fountainJudged: room.fountainJudged === true,
        rolls: Object.freeze(
          Object.fromEntries(
            Object.entries(room.rolls ?? {}).map(([rollKey, roll]) => [
              rollKey,
              rollCapability(roll.assessment, roll.shownTraitKeys),
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
  return assessPurgingPoolList(catalog, state.traitKeyBySlot, equippedTraits);
}

/**
 * Assesses one generated list against the traits held where it is generated:
 * it shows as many slots as there are eligible traits, up to three, stocked
 * slots first, and a blank shown slot is missing until an edit stocks it.
 */
export function assessPurgingPoolList(
  catalog: Catalog,
  traitKeyBySlot: Readonly<Partial<Record<PurgingPoolSlotKey, string | null>>>,
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
  const stocked = SLOT_KEYS.filter((slotKey) => selectedBySlot[slotKey] !== null);
  const shown = new Set(
    [...stocked, ...SLOT_KEYS.filter((slotKey) => selectedBySlot[slotKey] === null)].slice(
      0,
      requiredTraitCount,
    ),
  );
  const offeredSlotKeys = Object.freeze(SLOT_KEYS.filter((slotKey) => shown.has(slotKey)));
  const findings: PurgingPoolAssessmentFinding[] = [];
  const seen = new Set<string>();
  for (const slotKey of SLOT_KEYS) {
    const traitKey = selectedBySlot[slotKey];
    if (traitKey === null) {
      if (shown.has(slotKey))
        findings.push(
          Object.freeze({ code: 'purgingPoolTraitMissing', slotKey, evidence: Object.freeze({}) }),
        );
      continue;
    }
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
  }
  // Overfilling needs more distinct eligible names than exist, so a slot is already
  // reported as duplicate or unavailable.
  return Object.freeze({
    eligibleTraitKeys,
    requiredTraitCount,
    offeredSlotKeys,
    candidateTraitKeysBySlot,
    complete: findings.length === 0,
    findings: Object.freeze(findings),
  });
}
