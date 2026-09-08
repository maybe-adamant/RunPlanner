import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export interface GamePlanTarget {
  readonly id: string;
  readonly label: string;
  readonly moduleVersion: string;
}

export type GamePlanDiscoveryStatus =
  'available' | 'noProfiles' | 'incompatibleModule' | 'unavailable';

export interface GamePlanDiscovery {
  readonly status: GamePlanDiscoveryStatus;
  readonly targets: readonly GamePlanTarget[];
  readonly message: string;
}

export interface GamePlanPublication {
  readonly status: 'published' | 'nativeWrite' | 'unavailable';
  readonly message: string;
}

export const GAME_PLAN_SLOT_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
export type GamePlanSlotNumber = (typeof GAME_PLAN_SLOT_NUMBERS)[number];

export interface GamePlanPublisher {
  readonly discoverProfiles: () => Promise<GamePlanDiscovery>;
  readonly publish: (
    targetId: string,
    slotNumber: GamePlanSlotNumber,
    planJson: string,
  ) => Promise<GamePlanPublication>;
}

export interface TauriGamePlanEnvironment {
  readonly invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
}

export function createTauriGamePlanPublisher(
  environment: TauriGamePlanEnvironment = { invoke: tauriInvoke },
): GamePlanPublisher {
  return Object.freeze({
    discoverProfiles: () => environment.invoke<GamePlanDiscovery>('game_plan_discover_profiles'),
    publish: (targetId: string, slotNumber: GamePlanSlotNumber, planJson: string) =>
      environment.invoke<GamePlanPublication>('game_plan_publish', {
        targetId,
        slotNumber,
        planJson,
      }),
  });
}
