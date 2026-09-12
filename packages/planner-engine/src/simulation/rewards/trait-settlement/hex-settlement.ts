import type { Catalog, TraitSelectedDisposition } from '../../../catalog-schema';
import type { AuthoredTraitOfferTraits } from '../../../authored-project/traits/state';
import { bankPathPoints, installHexTree } from '../../hex-progress';
import type { ReachedTraitOfferEvaluation } from '../../traits';
import type { RewardBranchState } from '../branch-primitives';

/** Installs the selected Spell Drop tree and preserves its settled evaluation evidence. */
export function settleSelectedHexTree(
  catalog: Catalog,
  branch: RewardBranchState,
  offer: AuthoredTraitOfferTraits,
  selectedTraitKey: string | undefined,
  evaluation: ReachedTraitOfferEvaluation,
  frozenAcquisition: boolean,
): RewardBranchState {
  if (
    offer.giverKey !== 'SpellDrop' ||
    selectedTraitKey === undefined ||
    offer.hexTree === undefined
  )
    return branch;
  const settled = installHexTree(catalog, branch, selectedTraitKey, offer.hexTree);
  if (frozenAcquisition) return settled;
  const progress = settled.hexProgress;
  const godSent =
    progress.godSentAdded === true ? catalog.hexes.byKey[selectedTraitKey]?.godSent : undefined;
  if (
    progress.spellTraitKey !== selectedTraitKey ||
    progress.tree?.layoutKey !== offer.hexTree.layoutKey ||
    (progress.godSentAdded === true && godSent === undefined)
  )
    throw new Error('settled SpellDrop Hex evidence is incomplete');
  const settledHexTree = Object.freeze({
    spellTraitKey: selectedTraitKey,
    layoutKey: offer.hexTree.layoutKey,
    rareTalentKeys: Object.freeze([...offer.hexTree.rareTalentKeys]),
    epicTalentKeys: Object.freeze([...offer.hexTree.epicTalentKeys]),
    ...(godSent === undefined
      ? {}
      : {
          godSent: Object.freeze({
            olympianTalentKey: godSent.olympianTalentKey,
            lineageTalentKey: godSent.lineageTalentKey,
          }),
        }),
  });
  return Object.freeze({
    ...settled,
    traitEvaluations: Object.freeze([
      ...(settled.traitEvaluations ?? []).slice(0, -1),
      Object.freeze({ ...evaluation, settledHexTree }),
    ]),
  });
}

export function settleMoonBeamPathPoints(
  catalog: Catalog,
  branch: RewardBranchState,
  selectedDisposition: TraitSelectedDisposition | undefined,
  currentKeepsakeKey: string,
): RewardBranchState {
  return selectedDisposition?.kind === 'advanceCurrentKeepsake' &&
    catalog.keepsakes.byKey[currentKeepsakeKey]?.effect?.kind === 'moonBeam'
    ? bankPathPoints(branch, 2)
    : branch;
}
