import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultAuthoredHexTree } from '@run-planner/engine/authored-project';

import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createArcanaFearState } from '../../../src/simulation/arcana-fear';
import {
  bankPathPoints,
  installHexTree,
  settlePathScreen,
} from '../../../src/simulation/hex-progress';
import { initializeRewardBranches } from '../../../src/simulation/rewards/processing';
import { createTestArcanaFearState } from '../../support/arcana-fear';

type PathRewardType = 'MinorTalentDrop' | 'TalentBigDrop' | 'TalentDrop';

function settlePathReward(
  branch: ReturnType<typeof initializeRewardBranches>[number],
  rewardType: PathRewardType,
) {
  const pathPointGrant = catalog.rewards.acquisitions.byKey[rewardType]?.pathPointGrant;
  if (pathPointGrant === undefined) {
    throw new Error(`test fixture requires a declared Path point grant for ${rewardType}`);
  }
  return settlePathScreen(catalog, branch, pathPointGrant);
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
