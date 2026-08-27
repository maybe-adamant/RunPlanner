import type { AuthoredHexTreeConfiguration } from '../authored-project/traits';
import type { Catalog } from '../catalog-schema';
import type { RewardBranchState } from './rewards/branch-primitives';

export interface HexProgressState {
  /** Complete installed tree identity; absent before the first Hex exists. */
  readonly tree?: AuthoredHexTreeConfiguration;
  readonly spellTraitKey?: string;
  /** Persistent extension fact; it is never derived backwards after insertion. */
  readonly godSentAdded?: boolean;
  /** Source-compatible closure latch for future ordinary Talent Drop generation. */
  readonly talentDropsClosed?: boolean;
  readonly bankedPathPoints: number;
  readonly investedPathPoints: number;
}

/** Lifecycle composition may only consume a closure fact after every surviving branch agrees. */
export function attestTalentDropsClosed(
  branches: readonly { readonly hexProgress: HexProgressState }[],
): boolean {
  const values = branches.map((branch) => branch.hexProgress.talentDropsClosed === true);
  const first = values[0] ?? false;
  if (values.some((value) => value !== first)) {
    throw new Error('Hex Talent Drop closure frontier is divergent');
  }
  return first;
}

export function hexBaseCapacity(catalog: Catalog, progress: HexProgressState): number | undefined {
  const spellTraitKey = progress.spellTraitKey;
  const layoutKey = progress.tree?.layoutKey;
  if (spellTraitKey === undefined || layoutKey === undefined) return undefined;
  return catalog.hexes.byKey[spellTraitKey]?.layouts.byKey[layoutKey]?.baseCapacity;
}

export function hexEffectiveCapacity(
  catalog: Catalog,
  progress: HexProgressState,
): number | undefined {
  const baseCapacity = hexBaseCapacity(catalog, progress);
  return baseCapacity === undefined
    ? undefined
    : baseCapacity + (progress.godSentAdded === true ? 2 : 0);
}

/** Installs one complete authored tree and evaluates its initial God Sent contact. */
export function installHexTree(
  catalog: Catalog,
  branch: RewardBranchState,
  spellTraitKey: string,
  tree: AuthoredHexTreeConfiguration,
): RewardBranchState {
  const current = branch.hexProgress;
  if (current.tree !== undefined) return maybeAddGodSent(catalog, branch);
  const hex = catalog.hexes.byKey[spellTraitKey];
  const layout = hex?.layouts.byKey[tree.layoutKey];
  if (hex === undefined || layout === undefined) {
    throw new Error(`cannot install undeclared Hex tree ${spellTraitKey}:${tree.layoutKey}`);
  }
  const installed = Object.freeze({
    ...current,
    tree: Object.freeze({ ...tree }),
    spellTraitKey,
    godSentAdded: false,
    talentDropsClosed: false,
  });
  return maybeAddGodSent(catalog, Object.freeze({ ...branch, hexProgress: installed }));
}

/** Re-evaluates one audited provider/keepsake contact without a second ledger. */
export function maybeAddGodSent(catalog: Catalog, branch: RewardBranchState): RewardBranchState {
  const progress = branch.hexProgress;
  if (progress.tree === undefined || progress.godSentAdded === true) return branch;
  const spellTraitKey = progress.spellTraitKey;
  const hex = spellTraitKey === undefined ? undefined : catalog.hexes.byKey[spellTraitKey];
  if (hex === undefined) return branch;
  const traitHistory = branch.traitHistory;
  const providerTraitHeld = Object.values(traitHistory?.equippedTraits ?? {}).some(
    (trait) => trait.giverKey === hex.godSent.providerKey,
  );
  const providerKeepsakeHeld = branch.keepsakes.olympianSources.some(
    (source) => source.providerKey === hex.godSent.providerKey,
  );
  if (!providerTraitHeld && !providerKeepsakeHeld) return branch;
  return Object.freeze({
    ...branch,
    hexProgress: Object.freeze({ ...progress, godSentAdded: true }),
  });
}

/** Banks an already-awarded semantic Path selection for the next writable screen. */
export function bankPathPoints(branch: RewardBranchState, points: number): RewardBranchState {
  if (points === 0) return branch;
  return Object.freeze({
    ...branch,
    hexProgress: Object.freeze({
      ...branch.hexProgress,
      bankedPathPoints: branch.hexProgress.bankedPathPoints + points,
    }),
  });
}

/** Settles one concrete Path screen against the installed finite Hex tree. */
export function settlePathScreen(
  catalog: Catalog,
  branch: RewardBranchState,
  points: 1 | 3 | 5,
): RewardBranchState {
  const capacity = hexEffectiveCapacity(catalog, branch.hexProgress);
  if (capacity === undefined) {
    throw new Error('Path screen settlement requires an installed Hex tree');
  }
  // The source adds grant - 1 to the raw bank before the implicit first
  // selection is attempted.  A full tree therefore retains the raw bonus.
  const rawBank = branch.hexProgress.bankedPathPoints + points - 1;
  const remaining = Math.max(0, capacity - branch.hexProgress.investedPathPoints);
  const selections = Math.min(remaining, rawBank + 1);
  const spentFromBank = Math.max(0, selections - 1);
  const investedPathPoints = branch.hexProgress.investedPathPoints + selections;
  return Object.freeze({
    ...branch,
    hexProgress: Object.freeze({
      ...branch.hexProgress,
      bankedPathPoints: rawBank - spentFromBank,
      investedPathPoints,
      ...(investedPathPoints >= capacity ? { talentDropsClosed: true } : {}),
    }),
  });
}
