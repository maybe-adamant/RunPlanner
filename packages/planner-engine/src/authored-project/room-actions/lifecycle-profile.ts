import type { RoomDeclaration } from '../../catalog-schema';
import type { RoomOccurrence } from '../model';

/** Declaration/state-owned lifecycle selection before simulation materialization. */
export function authoredRoomLifecycleProfileKey(
  declaration: RoomDeclaration,
  occurrence: RoomOccurrence,
  role: 'ordinary' | 'ephyraSide' = 'ordinary',
): string {
  if (role === 'ephyraSide') return 'EphyraSideRoom';
  if (declaration.lifecycleProfileKey !== undefined) return declaration.lifecycleProfileKey;
  if (declaration.mode.kind !== 'authored') return 'RewardlessRoom';
  switch (declaration.mode.templateKey) {
    case 'Anomaly':
    case 'Chaos':
    case 'ContractBoss':
      return 'StandardRewardRoom';
    case 'Boss':
      return 'BossRoom';
    case 'ClockworkCombat':
      return occurrence.state.kind === 'counted' && occurrence.state.reward === null
        ? 'ClockworkGoalRoom'
        : 'StandardRewardRoom';
    case 'Devotion':
      return 'DevotionRoom';
    case 'EphyraCombat':
      return 'EphyraMainRoom';
    case 'EphyraSideRoom':
      return 'StandardRewardRoom';
    case 'FieldsCombat':
      return 'FieldsCombatRoom';
    case 'ShipCombat':
      return 'ShipCombatRoom';
    case 'Shop':
      return declaration.kind === 'Preboss' ? 'PrebossShopRoom' : 'WorldShopRoom';
    case 'Preboss':
      return occurrence.state.kind === 'shop' ? 'PrebossShopRoom' : 'PrebossFreeRewardRoom';
    case 'PostBoss':
      return 'PostBossRoom';
    case 'FixedIntro':
    case 'RewardlessCombat':
      return 'RewardlessCombatRoom';
    case 'FixedOpening':
      return 'OpeningRewardRoom';
    case 'FixedPreHub':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat':
      return declaration.encounterEnvelopeKey === 'PEncounter'
        ? 'PCombatRoom'
        : 'StandardRewardRoom';
    case 'Story':
      return 'StandardRewardRoom';
  }
}
