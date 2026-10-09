import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultAuthoredHexTree } from '@run-planner/engine/authored-project';

import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createArcanaFearState } from '../../../src/simulation/arcana-fear';
import {
  bankPathPoints,
  installHexTree,
  pathScreenContext,
  settlePathScreen,
  type HexProgressState,
} from '../../../src/simulation/hex-progress';
import {
  availableHexNodes,
  type HexActivationContext,
} from '../../../src/simulation/hex-activation';
import type { RewardBranchState } from '../../../src/simulation/rewards/branch-primitives';
import {
  createTestArcanaFearState,
  initializeTestRewardBranchesForRoute as initializeRewardBranches,
} from '../../support/arcana-fear';

type PathRewardType = 'MinorTalentDrop' | 'TalentBigDrop' | 'TalentDrop';

/** A fixture selection spending the screen on its shallowest available nodes, in layout order. */
function shallowestSelection(context: HexActivationContext): readonly string[] {
  const selected: string[] = [];
  while (selected.length < context.count) {
    const next = availableHexNodes(context, selected)[0];
    if (next === undefined) throw new Error(`fixture Path screen cannot spend ${context.count}`);
    selected.push(next);
  }
  return selected;
}

/** Settles one Path screen with the fixture's shallowest selection. */
export function settleShallowestPathScreen<Branch extends RewardBranchState>(
  branch: Branch,
  points: 1 | 3 | 5,
): Branch {
  return settlePathScreen(
    catalog,
    branch,
    points,
    shallowestSelection(pathScreenContext(catalog, branch.state.hexProgress, points)),
  ) as Branch;
}

/** A Path source's authored activation: the shallowest selection on this branch. */
export function shallowestPathActivation(branch: RewardBranchState, points: 1 | 3 | 5) {
  return {
    self: {
      selectedNodeKeys: shallowestSelection(
        pathScreenContext(catalog, branch.state.hexProgress, points),
      ),
    },
  };
}

/** Every node of a layout, God Sent pair included only when requested. */
export function everyHexNode(
  spellTraitKey: string,
  layoutKey: string,
  godSentAdded = false,
): readonly string[] {
  return catalog.hexes.byKey[spellTraitKey]!.layouts.byKey[layoutKey]!.nodes.values.filter(
    (node) => godSentAdded || (node.kind !== 'olympianSpell' && node.kind !== 'olympianCount'),
  ).map((node) => node.key);
}

/** Hex progress with its invested point count, as Run State publishes it. */
export function pathPointView(progress: HexProgressState) {
  return { ...progress, investedPathPoints: progress.investedNodeKeys.length };
}

function settlePathReward(
  branch: ReturnType<typeof initializeRewardBranches>[number],
  rewardType: PathRewardType,
) {
  const pathPointGrant = catalog.rewards.acquisitions.byKey[rewardType]?.pathPointGrant;
  if (pathPointGrant === undefined) {
    throw new Error(`test fixture requires a declared Path point grant for ${rewardType}`);
  }
  return settleShallowestPathScreen(branch, pathPointGrant);
}

/** Canonical settlement-seam witness for a normal selected option-3 Lung Hex. */
export function normalOption3LungClosureCheckpoint() {
  const initial = initializeRewardBranches(
    undefined,
    createTestArcanaFearState(),
    catalog,
    'ManaOverTimeRefundKeepsake',
  )[0]!;
  let branch = bankPathPoints(
    installHexTree(
      catalog,
      initial,
      'SpellTimeSlowTrait',
      createDefaultAuthoredHexTree(catalog, 'SpellTimeSlowTrait', 'Lung'),
    ),
    2,
  );
  const afterOption3Bank = branch;
  for (let index = 0; index < 9; index += 1) branch = settlePathReward(branch, 'MinorTalentDrop');
  return Object.freeze({ afterOption3Bank, closed: settlePathReward(branch, 'TalentBigDrop') });
}

/** Canonical settlement-seam witness for Aspect of Selene's concrete Spell Drop screen. */
export function aspectSkyFallClosureCheckpoint() {
  const loadout = {
    ...createDefaultRouteLoadout(catalog),
    weaponKey: 'WeaponSuit',
    aspectKey: 'SuitHexAspect',
    aspectHexTree: createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait', 'Lung'),
  };
  let branch = initializeRewardBranches(
    undefined,
    createArcanaFearState(catalog, loadout),
    catalog,
    'ManaOverTimeRefundKeepsake',
    undefined,
    'Underworld',
    loadout,
  )[0]!;
  // The Aspect-routed Spell Drop settles as the standard three-point Talent
  // screen; use that acquisition's declaration rather than repeat its grant.
  const afterSpellDrop = settlePathReward(branch, 'TalentDrop');
  branch = afterSpellDrop;
  for (let index = 0; index < 8; index += 1) branch = settlePathReward(branch, 'MinorTalentDrop');
  return Object.freeze({ afterSpellDrop, closed: settlePathReward(branch, 'TalentBigDrop') });
}
