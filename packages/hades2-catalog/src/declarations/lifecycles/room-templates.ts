import type { RoomTemplateKey } from '@run-planner/engine/catalog-schema';

import type { RawRoomTemplateLifecycleDeclaration } from './types';

/** The lifecycle each room template runs; a room's own `lifecycleProfileKey` replaces it. */
export const roomTemplateLifecycles = {
  Anomaly: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
  Boss: { kind: 'fixed', profileKeys: ['BossRoom'] },
  Chaos: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
  ClockworkCombat: {
    kind: 'clockworkGoal',
    goalProfileKey: 'ClockworkGoalRoom',
    rewardProfileKey: 'StandardRewardRoom',
  },
  ContractBoss: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
  Devotion: { kind: 'fixed', profileKeys: ['DevotionRoom'] },
  EphyraCombat: { kind: 'fixed', profileKeys: ['EphyraMainRoom'] },
  EphyraSideRoom: {
    kind: 'fixed',
    profileKeys: ['StandardRewardRoom'],
    localVisitProfileKey: 'EphyraSideRoom',
  },
  FieldsCombat: { kind: 'fixed', profileKeys: ['FieldsCombatRoom'] },
  // An Intro is its biome's start, whose entry resolution replaces this lifecycle.
  FixedIntro: { kind: 'fixed', profileKeys: ['RewardlessCombatRoom', 'RewardlessRoom'] },
  FixedOpening: { kind: 'fixed', profileKeys: ['OpeningRewardRoom'] },
  FixedPreHub: { kind: 'fixed', profileKeys: ['StandardRewardRoom', 'PCombatRoom'] },
  Fountain: { kind: 'fixed', profileKeys: ['StandardRewardRoom', 'PCombatRoom'] },
  Miniboss: { kind: 'fixed', profileKeys: ['StandardRewardRoom', 'PCombatRoom'] },
  PostBoss: { kind: 'fixed', profileKeys: ['PostBossRoom'] },
  Preboss: {
    kind: 'prebossOffer',
    shopProfileKey: 'PrebossShopRoom',
    freeRewardProfileKey: 'PrebossFreeRewardRoom',
  },
  RewardlessCombat: { kind: 'fixed', profileKeys: ['RewardlessCombatRoom'] },
  ShipCombat: { kind: 'fixed', profileKeys: ['ShipCombatRoom'] },
  Shop: { kind: 'fixed', profileKeys: ['WorldShopRoom'] },
  StandardCombat: { kind: 'fixed', profileKeys: ['StandardRewardRoom', 'PCombatRoom'] },
  Story: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
} as const satisfies Readonly<Record<RoomTemplateKey, RawRoomTemplateLifecycleDeclaration>>;

/** A derived room (the Ephyra hub) is rewardless until its hub materialization. */
export const derivedRoomLifecycle = {
  kind: 'fixed',
  profileKeys: ['RewardlessRoom'],
} as const satisfies RawRoomTemplateLifecycleDeclaration;
