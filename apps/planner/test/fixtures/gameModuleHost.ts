import { vi } from 'vitest';

import {
  GAME_EVENT_SLOT,
  GAME_PLAN_SLOT_NUMBERS,
  type GameActiveSlotSetting,
  type GameEventSlot,
  type GamePlanSlot,
  type GamePlanSlotNumber,
  type GameModuleHost,
  type GameModuleStatus,
  type GamePlanPublication,
  type GameTargetInspection,
  type GamePlanSlotSummary,
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
    install: { action: 'current', consentRequired: false, updateAvailable: false },
    removable: true,
    strandedInstall: null,
    planSlots: GAME_PLAN_SLOT_NUMBERS.map((slot) => ({
      slot,
      state: 'empty' as const,
      modifiedAtMs: null,
      routeKey: null,
      biomeKeys: [],
      planFingerprint: null,
      projectId: null,
      displayName: null,
      weaponKey: null,
      aspectKey: null,
      hasSource: false,
    })),
    eventSlot: eventSlot(),
    activeSlot: { state: 'missing' },
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
  publication: GamePlanPublication = {
    status: 'published',
    message: 'Published.',
    blockers: [],
    activationProblem: null,
  },
  activation: GameActiveSlotSetting = { status: 'activated', message: 'Active.', blockers: [] },
) {
  const published: {
    slotNumber: number;
    json: string;
    sourceJson: string;
    summary: GamePlanSlotSummary;
  }[] = [];
  const rebuilt: typeof published = [];
  const sources = new Map<number, string>();
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
    setActiveSlot: vi.fn<GameModuleHost['setActiveSlot']>(() => Promise.resolve(activation)),
    clearSlot: vi.fn<GameModuleHost['clearSlot']>((slotNumber) =>
      Promise.resolve({
        status: 'cleared',
        message: `Cleared slot ${slotNumber}.`,
        blockers: [],
        cleared: {
          slot: slotNumber,
          plan: '{"format":"run-planner-execution"}',
          source: null,
          summary: null,
          wasActive: false,
        },
        activeSlotMoved: false,
        activationProblem: null,
      }),
    ),
    restoreSlot: vi.fn<GameModuleHost['restoreSlot']>((cleared) =>
      Promise.resolve({
        status: 'restored',
        message: `Restored slot ${cleared.slot}.`,
        blockers: [],
        activationProblem: null,
      }),
    ),
    publish: vi.fn<GameModuleHost['publish']>((slotNumber, json, sourceJson, summary) => {
      published.push({ slotNumber, json, sourceJson, summary });
      sources.set(slotNumber, sourceJson);
      return Promise.resolve(publication);
    }),
    readSlotSource: vi.fn<GameModuleHost['readSlotSource']>((slotNumber) =>
      Promise.resolve(sources.get(slotNumber) ?? null),
    ),
    rebuildSlot: vi.fn<GameModuleHost['rebuildSlot']>((slotNumber, json, sourceJson, summary) => {
      rebuilt.push({ slotNumber, json, sourceJson, summary });
      sources.set(slotNumber, sourceJson);
      return Promise.resolve({ ...publication, activationProblem: null });
    }),
    createBugReport: vi.fn<GameModuleHost['createBugReport']>((defaultFileName) =>
      Promise.resolve({
        kind: 'saved',
        fileName: defaultFileName,
        entries: ['report.json'],
        issuePageUrl: 'https://github.com/maybe-adamant/RunPlanner/issues/new',
      }),
    ),
    revealBugReport: vi.fn<GameModuleHost['revealBugReport']>(() => Promise.resolve()),
  } satisfies GameModuleHost;
  return { host, published, rebuilt, sources };
}

/** One plan slot as the host reports it; empty unless overridden. */
export function planSlot(
  slot: GamePlanSlotNumber,
  overrides: Partial<GamePlanSlot> = {},
): GamePlanSlot {
  return {
    slot,
    state: 'empty',
    modifiedAtMs: null,
    routeKey: null,
    biomeKeys: [],
    planFingerprint: null,
    projectId: null,
    displayName: null,
    weaponKey: null,
    aspectKey: null,
    hasSource: false,
    ...overrides,
  };
}

/** Every slot, with the given ones replaced. */
export function planSlots(...present: readonly GamePlanSlot[]): readonly GamePlanSlot[] {
  return GAME_PLAN_SLOT_NUMBERS.map(
    (slot) => present.find((entry) => entry.slot === slot) ?? planSlot(slot),
  );
}

/** The event slot as the host reports it; empty unless overridden. */
export function eventSlot(overrides: Partial<GameEventSlot> = {}): GameEventSlot {
  return {
    ...planSlot(1),
    slot: GAME_EVENT_SLOT,
    event: null,
    ...overrides,
  };
}
