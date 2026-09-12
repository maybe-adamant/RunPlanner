import type { TraitRarity } from '../../../catalog-schema';
import type { AuthoredEchoLastRunBoonDraftRow } from '../../../authored-project/trait-carrier-children';
import type {
  EvaluatedDirectTraitOutcomeCandidate,
  EvaluatedEchoLastRunBoonCandidate,
} from '../trait-offer';

export interface EchoLastRunBoonTraitIdentity {
  readonly giverKey: string;
  readonly traitKey: string;
}

export type EchoLastRunBoonDraftRow = AuthoredEchoLastRunBoonDraftRow;

export interface EchoLastRunBoonDraftSupport {
  readonly rowSupport: readonly boolean[];
  readonly selectedTargetSupported: boolean;
  readonly complete: boolean;
  readonly remainingTraitIdentities: readonly EchoLastRunBoonTraitIdentity[];
  readonly canAppend: boolean;
}

export interface EchoLastRunBoonDraftTransition {
  readonly rows: readonly EchoLastRunBoonDraftRow[];
  readonly selectedIndex: number;
}

/**
 * Evaluates one transient BBB compound draft without inventing a persisted
 * default. Exact row support, selected-target support, and remaining identities
 * stay engine-owned while the application holds partial rows locally.
 */
export function evaluateEchoLastRunBoonDraftSupport(
  candidates: readonly EvaluatedEchoLastRunBoonCandidate[],
  rows: readonly EchoLastRunBoonDraftRow[],
  selectedIndex: number,
): EchoLastRunBoonDraftSupport {
  const traitKeys = rows.flatMap((row) => (row.traitKey === undefined ? [] : [row.traitKey]));
  const distinctTraits = new Set(traitKeys).size === traitKeys.length;
  const exactCandidates = rows.map((row) =>
    row.giverKey === undefined || row.traitKey === undefined || row.rarity === undefined
      ? undefined
      : candidates.find(
          (candidate) =>
            candidate.option.giverKey === row.giverKey &&
            candidate.option.traitKey === row.traitKey &&
            candidate.option.rarity === row.rarity,
        ),
  );
  const rowSupport = Object.freeze(
    exactCandidates.map(
      (candidate) =>
        distinctTraits && candidate !== undefined && candidate.support !== 'impossible',
    ),
  );
  const selectedRow = rows[selectedIndex];
  const selectedCandidate = exactCandidates[selectedIndex];
  const selectedTargetSupported =
    selectedRow !== undefined &&
    selectedCandidate !== undefined &&
    (selectedCandidate.targetRequired
      ? selectedRow.targetTraitKey !== undefined &&
        selectedCandidate.targetCandidates.some(
          (candidate) =>
            candidate.value === selectedRow.targetTraitKey && candidate.support !== 'impossible',
        )
      : selectedRow.targetTraitKey === undefined);
  const remaining = new Map<string, EchoLastRunBoonTraitIdentity>();
  for (const candidate of candidates) {
    if (candidate.support === 'impossible' || traitKeys.includes(candidate.option.traitKey))
      continue;
    const key = `${candidate.option.giverKey}:${candidate.option.traitKey}`;
    remaining.set(
      key,
      Object.freeze({
        giverKey: candidate.option.giverKey,
        traitKey: candidate.option.traitKey,
      }),
    );
  }
  const remainingTraitIdentities = Object.freeze([...remaining.values()]);
  const complete =
    rows.length >= 1 && rows.length <= 3 && rowSupport.every(Boolean) && selectedTargetSupported;
  return Object.freeze({
    rowSupport,
    selectedTargetSupported,
    complete,
    remainingTraitIdentities,
    canAppend: rows.length < 3 && remainingTraitIdentities.length > 0,
  });
}

/** Appends one blank transient Echo row only when another distinct identity remains. */
export function nextEchoLastRunBoonDraft(
  candidates: readonly EvaluatedEchoLastRunBoonCandidate[],
  rows: readonly EchoLastRunBoonDraftRow[],
  selectedIndex: number,
): EchoLastRunBoonDraftTransition | undefined {
  if (rows.length < 1 || rows.length >= 3) return undefined;
  if (!evaluateEchoLastRunBoonDraftSupport(candidates, rows, selectedIndex).canAppend)
    return undefined;
  return Object.freeze({ rows: Object.freeze([...rows, Object.freeze({})]), selectedIndex });
}

/** Drops only the final transient Echo row; incomplete retained rows remain untouched. */
export function previousEchoLastRunBoonDraft(
  rows: readonly EchoLastRunBoonDraftRow[],
  selectedIndex: number,
): EchoLastRunBoonDraftTransition | undefined {
  if (rows.length <= 1 || rows.length > 3) return undefined;
  const nextRows = Object.freeze(rows.slice(0, -1));
  return Object.freeze({
    rows: nextRows,
    selectedIndex: Math.min(Math.max(selectedIndex, 0), nextRows.length - 1),
  });
}

/**
 * Projects the exact mixed-provider domain into one transient BBB row. Trait
 * distinctness remains an engine rule even while the application is building
 * a complete child outside persisted authored state.
 */
export function echoLastRunBoonTraitCandidatesForRow(
  candidates: readonly EvaluatedEchoLastRunBoonCandidate[],
  occupiedTraitKeys: readonly string[],
  selected: EchoLastRunBoonTraitIdentity | undefined,
): readonly EvaluatedDirectTraitOutcomeCandidate<EchoLastRunBoonTraitIdentity>[] {
  const identities = new Map<string, EchoLastRunBoonTraitIdentity>();
  for (const candidate of candidates) {
    const key = `${candidate.option.giverKey}:${candidate.option.traitKey}`;
    identities.set(
      key,
      Object.freeze({
        giverKey: candidate.option.giverKey,
        traitKey: candidate.option.traitKey,
      }),
    );
  }
  return Object.freeze(
    [...identities.values()].map((identity) => {
      const variants = candidates.filter(
        (candidate) =>
          candidate.option.giverKey === identity.giverKey &&
          candidate.option.traitKey === identity.traitKey,
      );
      const branchCount = variants[0]?.branchSupport.length ?? 0;
      const branchSupport = Object.freeze(
        Array.from({ length: branchCount }, (_, index) =>
          variants.some((candidate) => candidate.branchSupport[index] === true),
        ),
      );
      const duplicate = occupiedTraitKeys.includes(identity.traitKey);
      // One exact persisted rarity must survive every branch. Do not make a
      // trait selectable by combining different rarity variants per branch.
      const universallySupported =
        !duplicate && variants.some((candidate) => candidate.support !== 'impossible');
      return Object.freeze({
        value: identity,
        support: universallySupported ? ('possible' as const) : ('impossible' as const),
        branchSupport,
        selected:
          selected?.giverKey === identity.giverKey && selected.traitKey === identity.traitKey,
        ...(!universallySupported
          ? {
              reason: duplicate
                ? ('duplicateTrait' as const)
                : branchSupport.some(Boolean)
                  ? ('branchDivergence' as const)
                  : ('unavailable' as const),
            }
          : {}),
      });
    }),
  );
}

/** Exact rarity domain for one transient BBB provider/trait row. */
export function echoLastRunBoonRarityCandidates(
  candidates: readonly EvaluatedEchoLastRunBoonCandidate[],
  identity: EchoLastRunBoonTraitIdentity,
  selectedRarity: TraitRarity | undefined,
): readonly EvaluatedDirectTraitOutcomeCandidate<TraitRarity>[] {
  return Object.freeze(
    candidates
      .filter(
        (candidate) =>
          candidate.option.giverKey === identity.giverKey &&
          candidate.option.traitKey === identity.traitKey,
      )
      .map((candidate) =>
        Object.freeze({
          value: candidate.option.rarity,
          support: candidate.support,
          branchSupport: candidate.branchSupport,
          selected: candidate.option.rarity === selectedRarity,
          ...(candidate.reason === undefined ? {} : { reason: candidate.reason }),
        }),
      ),
  );
}
