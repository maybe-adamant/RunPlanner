import type { AuthoredHexTreeConfiguration } from '../authored-project/traits/state';
import type { Catalog } from '../catalog-schema';
import type { HexActivationContext } from './hex-activation';
import type { RewardBranchState } from './rewards/branch-primitives';

export interface HexProgressState {
  /** The authored tree as installed; absent before the first Hex exists. */
  readonly tree?: AuthoredHexTreeConfiguration;
  readonly spellTraitKey?: string;
  /** Persistent extension fact; it is never derived backwards after insertion. */
  readonly godSentAdded?: boolean;
  /** Source-compatible closure latch for future ordinary Talent Drop generation. */
  readonly talentDropsClosed?: boolean;
  readonly bankedPathPoints: number;
  /** Invested nodes in investment order; the invested point count is its length. */
  readonly investedNodeKeys: readonly string[];
}

/** Lifecycle composition may only consume a closure fact after every surviving branch agrees. */
export function attestTalentDropsClosed(
  branches: readonly { readonly state: { readonly hexProgress: HexProgressState } }[],
): boolean {
  const values = branches.map((branch) => branch.state.hexProgress.talentDropsClosed === true);
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

/** Installs one realised tree and evaluates its initial God Sent contact. */
export function installHexTree(
  catalog: Catalog,
  branch: RewardBranchState,
  spellTraitKey: string,
  tree: AuthoredHexTreeConfiguration,
): RewardBranchState {
  const current = branch.state.hexProgress;
  if (current.tree !== undefined) return maybeAddGodSent(catalog, branch);
  const hex = catalog.hexes.byKey[spellTraitKey];
  const layout = hex?.layouts.byKey[tree.layoutKey];
  if (hex === undefined || layout === undefined) {
    throw new Error(`cannot install undeclared Hex tree ${spellTraitKey}:${tree.layoutKey}`);
  }
  const installed = Object.freeze({
    ...current,
    tree,
    spellTraitKey,
    godSentAdded: false,
    talentDropsClosed: false,
  });
  return maybeAddGodSent(
    catalog,
    Object.freeze({ ...branch, state: Object.freeze({ ...branch.state, hexProgress: installed }) }),
  );
}

/** Re-evaluates one audited provider/keepsake contact without a second ledger. */
export function maybeAddGodSent(catalog: Catalog, branch: RewardBranchState): RewardBranchState {
  const progress = branch.state.hexProgress;
  if (progress.tree === undefined || progress.godSentAdded === true) return branch;
  const spellTraitKey = progress.spellTraitKey;
  const hex = spellTraitKey === undefined ? undefined : catalog.hexes.byKey[spellTraitKey];
  if (hex === undefined) return branch;
  const traitHistory = branch.state.traitHistory;
  const providerTraitHeld = Object.values(traitHistory?.equippedTraits ?? {}).some(
    (trait) => trait.giverKey === hex.godSent.providerKey,
  );
  const providerKeepsakeHeld = branch.state.keepsakes.olympianSources.some(
    (source) => source.providerKey === hex.godSent.providerKey,
  );
  if (!providerTraitHeld && !providerKeepsakeHeld) return branch;
  return Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      hexProgress: Object.freeze({ ...progress, godSentAdded: true }),
    }),
  });
}

/** Banks an already-awarded semantic Path selection for the next writable screen. */
export function bankPathPoints(branch: RewardBranchState, points: number): RewardBranchState {
  if (points === 0) return branch;
  return Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      hexProgress: Object.freeze({
        ...branch.state.hexProgress,
        bankedPathPoints: branch.state.hexProgress.bankedPathPoints + points,
      }),
    }),
  });
}

/** The tree state a writable Path screen granting `points` selects against. */
export function pathScreenContext(
  catalog: Catalog,
  progress: HexProgressState,
  points: 1 | 3 | 5,
): HexActivationContext {
  const capacity = hexEffectiveCapacity(catalog, progress);
  const layout =
    progress.spellTraitKey === undefined || progress.tree === undefined
      ? undefined
      : catalog.hexes.byKey[progress.spellTraitKey]?.layouts.byKey[progress.tree.layoutKey];
  if (capacity === undefined || layout === undefined)
    throw new Error('Path screen settlement requires an installed Hex tree');
  // The source adds grant - 1 to the raw bank before the implicit first
  // selection; a full tree therefore retains the raw bonus.
  const remaining = Math.max(0, capacity - progress.investedNodeKeys.length);
  return Object.freeze({
    spellTraitKey: progress.spellTraitKey!,
    tree: progress.tree!,
    layout,
    godSentAdded: progress.godSentAdded === true,
    investedNodeKeys: progress.investedNodeKeys,
    count: Math.min(remaining, progress.bankedPathPoints + points),
  });
}

/** Invests one screen's already-validated selection; no point is refunded. */
export function settlePathScreen(
  catalog: Catalog,
  branch: RewardBranchState,
  points: 1 | 3 | 5,
  selectedNodeKeys: readonly string[],
): RewardBranchState {
  const progress = branch.state.hexProgress;
  const context = pathScreenContext(catalog, progress, points);
  if (selectedNodeKeys.length !== context.count)
    throw new Error('Path screen selection does not spend the screen');
  const rawBank = progress.bankedPathPoints + points - 1;
  const investedNodeKeys = Object.freeze([...progress.investedNodeKeys, ...selectedNodeKeys]);
  const capacity = hexEffectiveCapacity(catalog, progress)!;
  return Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      hexProgress: Object.freeze({
        ...progress,
        bankedPathPoints: rawBank - Math.max(0, context.count - 1),
        investedNodeKeys,
        ...(investedNodeKeys.length >= capacity ? { talentDropsClosed: true } : {}),
      }),
    }),
  });
}

/** Whether the God Sent Olympian talent is invested: Task Force's prerequisite. */
export function hexOlympianTalentInvested(catalog: Catalog, progress: HexProgressState): boolean {
  if (progress.godSentAdded !== true || progress.spellTraitKey === undefined) return false;
  const layout =
    progress.tree === undefined
      ? undefined
      : catalog.hexes.byKey[progress.spellTraitKey]?.layouts.byKey[progress.tree.layoutKey];
  return progress.investedNodeKeys.some(
    (key) => layout?.nodes.byKey[key]?.kind === 'olympianSpell',
  );
}
