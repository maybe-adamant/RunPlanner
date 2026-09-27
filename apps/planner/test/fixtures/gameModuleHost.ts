import { vi } from 'vitest';

import type {
  GameModuleHost,
  GameModuleStatus,
  GamePlanPublication,
  GameTargetInspection,
} from '@planner/persistence/gameModuleHost';

type InspectionOverrides = {
  readonly [Key in keyof GameTargetInspection]?: Partial<GameTargetInspection[Key]>;
};

/** Host-shaped status of a ready r2modman target; overrides replace reported facts. */
export function gameModuleStatus(
  overrides: Partial<Omit<GameModuleStatus, 'inspection'>> & {
    readonly inspection?: InspectionOverrides | null;
  } = {},
): GameModuleStatus {
  const base: GameTargetInspection = {
    module: {
      state: 'plannerInstalled',
      version: '0.1.0',
      source: 'bundled',
      matchesBundled: true,
      modified: false,
    },
    r2modman: { state: 'unmanaged', moduleEnabled: null },
    modpackLib: { state: 'compatible', found: '4.1.0', required: '4.1.0' },
    missingDependencies: [],
    coordinator: { present: false, managed: false },
    install: { action: 'current', consentRequired: false },
    removable: true,
    strandedInstall: null,
  };
  const inspection =
    overrides.inspection === null
      ? null
      : (Object.fromEntries(
          Object.entries(base).map(([key, value]) => {
            const override = overrides.inspection?.[key as keyof GameTargetInspection];
            return [
              key,
              override === undefined
                ? value
                : Array.isArray(override) || typeof override !== 'object'
                  ? override
                  : { ...(value as object), ...override },
            ];
          }),
        ) as unknown as GameTargetInspection);
  return {
    bundledVersion: '0.1.0',
    developmentInstallAvailable: false,
    target: {
      path: '/profiles/h2-dev',
      location: '/profiles/h2-dev',
      label: 'h2-dev',
      kind: 'discovered',
    },
    targetProblem: null,
    publicationBlockers: [],
    ...overrides,
    inspection,
  };
}

export function createFakeGameModuleHost(
  status: GameModuleStatus = gameModuleStatus(),
  publication: GamePlanPublication = { status: 'published', message: 'Published.', blockers: [] },
) {
  const published: { slotNumber: number; json: string }[] = [];
  const host = {
    status: vi.fn<GameModuleHost['status']>(() => Promise.resolve(status)),
    discoverTargets: vi.fn<GameModuleHost['discoverTargets']>(() =>
      Promise.resolve({ supported: true, profiles: [] }),
    ),
    useDiscoveredTarget: vi.fn<GameModuleHost['useDiscoveredTarget']>(() =>
      Promise.resolve(status),
    ),
    chooseTargetFolder: vi.fn<GameModuleHost['chooseTargetFolder']>(() => Promise.resolve(null)),
    install: vi.fn<GameModuleHost['install']>(() =>
      Promise.resolve({ outcome: 'installed', status }),
    ),
    installFromCheckout: vi.fn<GameModuleHost['installFromCheckout']>(() =>
      Promise.resolve({ outcome: 'installed', status }),
    ),
    remove: vi.fn<GameModuleHost['remove']>(() => Promise.resolve({ outcome: 'removed', status })),
    publish: vi.fn<GameModuleHost['publish']>((slotNumber, json) => {
      published.push({ slotNumber, json });
      return Promise.resolve(publication);
    }),
  } satisfies GameModuleHost;
  return { host, published };
}
