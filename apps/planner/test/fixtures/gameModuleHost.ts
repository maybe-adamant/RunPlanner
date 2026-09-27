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
    modpackLib: {
      state: 'compatible',
      found: '4.1.0',
      required: '4.1.0',
      pageUrl: 'https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/',
    },
    missingDependencies: [],
    coordinator: { present: false, managed: false },
    install: { action: 'current', consentRequired: false },
    removable: true,
    strandedInstall: null,
    planSlots: ([1, 2, 3, 4, 5, 6] as const).map((slot) => ({
      slot,
      state: 'empty' as const,
      modifiedAtMs: null,
      routeKey: null,
      biomeKeys: [],
      planFingerprint: null,
      projectId: null,
    })),
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
    lastSlot: null,
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
    openExternalPage: vi.fn<GameModuleHost['openExternalPage']>(() => Promise.resolve()),
    discoverTargets: vi.fn<GameModuleHost['discoverTargets']>(() =>
      Promise.resolve({ supported: true, profiles: [] }),
    ),
    useDiscoveredTarget: vi.fn<GameModuleHost['useDiscoveredTarget']>(() =>
      Promise.resolve(status),
    ),
    pickTargetFolder: vi.fn<GameModuleHost['pickTargetFolder']>(() => Promise.resolve(null)),
    useChosenTarget: vi.fn<GameModuleHost['useChosenTarget']>(() => Promise.resolve(status)),
    validateTarget: vi.fn<GameModuleHost['validateTarget']>((path, kind) =>
      Promise.resolve({ path, location: path, label: path.split('/').at(-1) ?? path, kind }),
    ),
    forgetTarget: vi.fn<GameModuleHost['forgetTarget']>(() =>
      Promise.resolve({ ...status, target: null, inspection: null }),
    ),
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
