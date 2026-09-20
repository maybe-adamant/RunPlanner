import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export interface GamePlanTarget {
  readonly id: string;
  readonly label: string;
  readonly location?: string;
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
  readonly discoverProfiles: (compatibility: GamePlanCompatibility) => Promise<GamePlanDiscovery>;
  readonly chooseProfile: (compatibility: GamePlanCompatibility) => Promise<GamePlanTarget | null>;
  readonly publish: (
    targetId: string,
    slotNumber: GamePlanSlotNumber,
    planJson: string,
  ) => Promise<GamePlanPublication>;
}

export interface GamePlanCompatibility {
  readonly format: string;
  readonly protocolVersion: number;
  readonly catalogVersion: string;
}

export interface TauriGamePlanEnvironment {
  readonly invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  readonly chooseDirectory: () => Promise<string | null>;
}

export function createTauriGamePlanPublisher(
  environment: TauriGamePlanEnvironment = {
    invoke: tauriInvoke,
    chooseDirectory: () =>
      open({ directory: true, multiple: false, title: 'Choose Profile or ReturnOfModding Folder' }),
  },
): GamePlanPublisher {
  return Object.freeze({
    discoverProfiles: (compatibility: GamePlanCompatibility) =>
      environment.invoke<GamePlanDiscovery>('game_plan_discover_profiles', { compatibility }),
    chooseProfile: async (compatibility: GamePlanCompatibility) => {
      const path = await environment.chooseDirectory();
      if (path === null) return null;
      return environment.invoke<GamePlanTarget>('game_plan_choose_profile', {
        path,
        compatibility,
      });
    },
    publish: (targetId: string, slotNumber: GamePlanSlotNumber, planJson: string) =>
      environment.invoke<GamePlanPublication>('game_plan_publish', {
        targetId,
        slotNumber,
        planJson,
      }),
  });
}
