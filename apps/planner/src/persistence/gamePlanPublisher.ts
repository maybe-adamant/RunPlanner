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

export interface GamePlanPublisher {
  readonly discoverProfiles: () => Promise<GamePlanDiscovery>;
  readonly publish: (targetId: string, planJson: string) => Promise<GamePlanPublication>;
}

export interface TauriGamePlanEnvironment {
  readonly invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
}

export function createTauriGamePlanPublisher(
  environment: TauriGamePlanEnvironment = { invoke: tauriInvoke },
): GamePlanPublisher {
  return Object.freeze({
    discoverProfiles: () => environment.invoke<GamePlanDiscovery>('game_plan_discover_profiles'),
    publish: (targetId: string, planJson: string) =>
      environment.invoke<GamePlanPublication>('game_plan_publish', { targetId, planJson }),
  });
}
