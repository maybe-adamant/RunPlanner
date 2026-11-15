import type { RoomTemplateKey } from '@run-planner/engine/catalog-schema';

import type { RawRoomTemplateLifecycleDeclaration } from './types';

/**
 * The lifecycle each room template runs; a room's own `lifecycleProfileKey`
 * replaces it. An Ephyra Hub role runs its role's lifecycle.
 */
export const roomTemplateLifecycles = {
  Anomaly: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
  Boss: { kind: 'fixed', profileKeys: ['BossRoom'] },
  Chaos: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
  // A Clockwork Goal door's room runs this lifecycle without a pickable reward.
  ClockworkCombat: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
  ContractBoss: { kind: 'fixed', profileKeys: ['StandardRewardRoom'] },
  Devotion: { kind: 'fixed', profileKeys: ['DevotionRoom'] },
  EphyraCombat: {
    kind: 'fixed',
    profileKeys: ['EphyraMainRoom'],
    roleProfileKeys: { hubTarget: 'EphyraMainRoom' },
  },
  EphyraSideRoom: {
    kind: 'fixed',
    profileKeys: ['StandardRewardRoom'],
    roleProfileKeys: { localVisit: 'EphyraSideRoom' },
  },
  FieldsCombat: { kind: 'fixed', profileKeys: ['FieldsCombatRoom'] },
  // A biome start; only the route's first one holds the run-start reward.
  FixedIntro: { kind: 'fixed', profileKeys: ['OpeningRewardRoom', 'OpeningRewardNoEncounterRoom'] },
  FixedOpening: { kind: 'fixed', profileKeys: ['OpeningRewardRoom'] },
  FixedPreHub: { kind: 'fixed', profileKeys: ['StandardRewardRoom', 'PCombatRoom'] },
  Fountain: { kind: 'fixed', profileKeys: ['StandardRewardRoom', 'PCombatRoom'] },
  Miniboss: {
    kind: 'fixed',
    profileKeys: ['StandardRewardRoom', 'PCombatRoom'],
    roleProfileKeys: { hubTarget: 'EphyraMainRoom' },
  },
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
  Story: {
    kind: 'fixed',
    profileKeys: ['StandardRewardRoom'],
    roleProfileKeys: { hubTarget: 'EphyraMainRoom' },
  },
} as const satisfies Readonly<Record<RoomTemplateKey, RawRoomTemplateLifecycleDeclaration>>;

/** A derived room is the Ephyra Hub's board room. */
export const derivedRoomLifecycle = {
  kind: 'fixed',
  profileKeys: ['EphyraHubRoom'],
} as const satisfies RawRoomTemplateLifecycleDeclaration;
