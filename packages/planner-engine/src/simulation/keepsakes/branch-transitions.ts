import type { Catalog, KeepsakeRank } from '../../catalog-schema';

import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';
import type { AuthoredTraitOffer } from '../../authored-project/traits';

import { createRewardBagState, insertExactPriorityIntoBag } from '../../reward-kernel';
import {
  attachTraitHistory,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  recordReachedTraitOffer,
} from '../traits';
import {
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  assessTranscendentEmbryoBlessing,
  equipExperimentalHammer,
  equipJeweledPom,
  equipTranscendentEmbryo,
  type TranscendentEmbryoBlessingContext,
} from './trait-effects';
import { jeweledPomEffectForKey } from './state';
import { freezeRecord, type RewardBranchState } from '../rewards/branch-primitives';
import { bankPathPoints, maybeAddGodSent } from '../hex-progress';

/** The exact source-time FromLoot transition: queue first, then RunProgress presence refill. */
export function applyOlympianRewardPressureEquip(
  catalog: Catalog,
  branch: RewardBranchState,
  keepsakeKey: string,
): RewardBranchState {
  const effect = catalog.keepsakes.byKey[keepsakeKey]?.effect;
  if (effect?.kind !== 'olympianRewardPressure') return branch;
  return maybeAddGodSent(
    catalog,
    applyExactRewardPriority(catalog, branch, effect.priorityRewardType),
  );
}

/** Shared source-time exact priority insertion and immediate RunProgress refill. */
export function applyExactRewardPriority(
  catalog: Catalog,
  branch: RewardBranchState,
  priority: string,
): RewardBranchState {
  const store = catalog.rewards.stores.byKey.RunProgress;
  if (store === undefined)
    return Object.freeze({
      ...branch,
      rewardPriorities: Object.freeze([...branch.rewardPriorities, priority]),
    });
  const existing = branch.bags.RunProgress;
  const current = existing ?? createRewardBagState(store);
  const bag = insertExactPriorityIntoBag(store, current, priority);
  return Object.freeze({
    ...branch,
    bags:
      existing === undefined && bag === current
        ? branch.bags
        : freezeRecord({ ...branch.bags, RunProgress: bag }),
    rewardPriorities: Object.freeze([...branch.rewardPriorities, priority]),
  });
}

/** Moon Beam's source-time callback: bank points and queue one exact future reward. */
export function applyMoonBeamEquip(
  catalog: Catalog,
  branch: RewardBranchState,
  keepsakeKey: string,
  rank: KeepsakeRank | undefined,
  preferBigTalent = false,
): RewardBranchState {
  const effect = catalog.keepsakes.byKey[keepsakeKey]?.effect;
  if (effect?.kind !== 'moonBeam' || rank === undefined) return branch;
  const priority =
    (branch.history.useRecord.SpellDrop ?? 0) === 0
      ? effect.priorityRewardTypes[0]
      : preferBigTalent
        ? effect.priorityRewardTypes[2]
        : effect.priorityRewardTypes[1];
  return applyExactRewardPriority(
    catalog,
    bankPathPoints(branch, effect.pathPointsByRank[rank]),
    priority,
  );
}

/** Applies the closed immediate Jeweled Pom result through ordinary trait history. */
export function applyJeweledPomEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
  equippedRank?: KeepsakeRank,
): RewardBranchState {
  const result = results?.jeweledPom;
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = jeweledPomEffectForKey(catalog, equippedKeepsakeKey);
  if (keepsake === undefined || effect === undefined || result === undefined) return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessJeweledPomEquipResult(catalog, result, before, branch.keepsakes.fatedStatus).legal)
    return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      {
        traitKey: result.traitKey,
        ...(result.rarity === undefined ? {} : { rarity: result.rarity }),
      },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'jeweledPomEquip',
    offer,
    before,
    { resolvedProviderKey: effect.giverKey },
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipJeweledPom(
      branch.keepsakes,
      result.traitKey,
      effect.subsequentEligibleTraitLevelsByRank[equippedRank ?? keepsake.rank],
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

/** Applies the one direct, rarityless Experimental Hammer acquisition. */
export function applyExperimentalHammerEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
  equippedRank?: KeepsakeRank,
): RewardBranchState {
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = keepsake?.effect;
  const result = results?.experimentalHammer;
  if (keepsake === undefined || effect?.kind !== 'experimentalHammer' || result === undefined)
    return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessExperimentalHammerEquipResult(catalog, result, before, loadout).legal) return branch;
  if (result.kind === 'exhausted') return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      { traitKey: result.traitKey },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'experimentalHammerEquip',
    offer,
    before,
    loadout,
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipExperimentalHammer(
      branch.keepsakes,
      result.traitKey,
      effect.qualifyingEncounterUsesByRank[equippedRank ?? keepsake.rank],
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

export function applyTranscendentEmbryoEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  result: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>,
  owner: SemanticAddress,
  sequence: number,
  origin: 'ordinary' | 'echo',
  equippedRank: KeepsakeRank,
  context: TranscendentEmbryoBlessingContext = {},
): RewardBranchState {
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = keepsake?.effect;
  if (effect?.kind !== 'transcendentEmbryo') return branch;
  const rarity = effect.blessingRarityByRank[equippedRank];
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessTranscendentEmbryoBlessing(catalog, result, before, rarity, context).legal)
    return branch;
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const history = foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directChaosBlessing' as const,
      owner,
      acquisitionRole: 'transcendentEmbryoEquip' as const,
      sequence,
      acquisitionPoint: origin === 'echo' ? 'biomeStart' : 'keepsakeEquip',
      acquisitionIdentity,
      blessingKey: result.blessingKey,
      rarity,
      blessingValues: result.blessingValues,
    }),
  ]);
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, history),
    traitHistory: history,
    keepsakes: equipTranscendentEmbryo(
      branch.keepsakes,
      origin,
      rarity,
      result,
      acquisitionIdentity,
    ),
  });
}
