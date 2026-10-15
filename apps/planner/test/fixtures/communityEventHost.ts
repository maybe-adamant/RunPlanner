import { vi } from 'vitest';

import type {
  ActiveCommunityEvent,
  ActiveEventProject,
  CommunityEvent,
  CommunityEventDevelopmentHost,
  CommunityEventHost,
  EventSlotClearing,
} from '@planner/persistence/communityEventHost';

/** A verified event; fields override the defaults. */
export function communityEvent(overrides: Partial<CommunityEvent> = {}): CommunityEvent {
  return {
    id: '2026-w42-staff',
    title: 'Week 42: Staff sprint',
    description: 'Clear the Surface.',
    rules: 'Fear 8.',
    startsAt: '2026-10-12T00:00:00Z',
    endsAt: '2026-10-19T00:00:00Z',
    projectUrl:
      'https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/2026-w42-staff.runplanner.json',
    projectSha256: '5650824531e382c27c755760f7bc6db4c5b690a5df74dc9438e26995bf2f7fbf',
    projectSchemaVersion: 96,
    ...overrides,
  };
}

/** The active event with its verified project file; fields override the event's defaults. */
export function activeEvent(
  projectJson: string,
  overrides: Partial<CommunityEvent> = {},
): ActiveCommunityEvent {
  return activeEventWith({ kind: 'verified', json: projectJson }, overrides);
}

export function activeEventWith(
  project: ActiveEventProject,
  overrides: Partial<CommunityEvent> = {},
): ActiveCommunityEvent {
  return { event: communityEvent(overrides), project };
}

export function clearing(overrides: Partial<EventSlotClearing> = {}): EventSlotClearing {
  return {
    status: 'alreadyEmpty',
    message: 'The event slot is empty.',
    blockers: [],
    clearedEvent: null,
    activeSlotMoved: false,
    activationProblem: null,
    fallbackSlotHasPlan: true,
    ...overrides,
  };
}

/** A feed with no active event until `refreshFeed` is told otherwise. */
export function createFakeCommunityEventHost() {
  return {
    refreshFeed: vi.fn<CommunityEventHost['refreshFeed']>(() =>
      Promise.resolve({ active: null, source: 'network', problem: null }),
    ),
    publishEvent: vi.fn<CommunityEventHost['publishEvent']>(() =>
      Promise.resolve({
        status: 'published',
        message: 'The event slot now holds Week 42: Staff sprint.',
        blockers: [],
        activationProblem: null,
      }),
    ),
    clearEvent: vi.fn<CommunityEventHost['clearEvent']>(() => Promise.resolve(clearing())),
    downloadProject: vi.fn<CommunityEventHost['downloadProject']>(() =>
      Promise.reject(new Error('No project.')),
    ),
  } satisfies CommunityEventHost;
}

export function createFakeCommunityEventDevelopmentHost() {
  return {
    pickEventFolder: vi.fn<CommunityEventDevelopmentHost['pickEventFolder']>(() =>
      Promise.resolve(null),
    ),
    loadEventFolder: vi.fn<CommunityEventDevelopmentHost['loadEventFolder']>(() =>
      Promise.reject(new Error('No event folder.')),
    ),
    clearLocalEvent: vi.fn<CommunityEventDevelopmentHost['clearLocalEvent']>(() =>
      Promise.resolve(),
    ),
  } satisfies CommunityEventDevelopmentHost;
}
