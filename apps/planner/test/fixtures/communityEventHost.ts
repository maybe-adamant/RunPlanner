import { vi } from 'vitest';

import type {
  CommunityEventDevelopmentHost,
  CommunityEventHost,
  CommunityEventPlan,
  EventSlotClearing,
} from '@planner/persistence/communityEventHost';

/** A verified event whose plan is `planJson`; fields override the defaults. */
export function eventPlan(
  planJson: string,
  overrides: Partial<CommunityEventPlan['event']> = {},
): CommunityEventPlan {
  return {
    event: {
      id: '2026-w42-staff',
      title: 'Week 42: Staff sprint',
      description: 'Clear the Surface.',
      rules: 'Fear 8.',
      startsAt: '2026-10-12T00:00:00Z',
      endsAt: '2026-10-19T00:00:00Z',
      projectUrl:
        'https://github.com/maybe-adamant/RunPlanner/releases/download/events/2026-w42-staff.runplanner.json',
      projectSha256: '5650824531e382c27c755760f7bc6db4c5b690a5df74dc9438e26995bf2f7fbf',
      ...overrides,
    },
    planJson,
  };
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
    pickEventFile: vi.fn<CommunityEventDevelopmentHost['pickEventFile']>(() =>
      Promise.resolve(null),
    ),
    loadEventFile: vi.fn<CommunityEventDevelopmentHost['loadEventFile']>(() =>
      Promise.reject(new Error('No event file.')),
    ),
    clearLocalEvent: vi.fn<CommunityEventDevelopmentHost['clearLocalEvent']>(() =>
      Promise.resolve(),
    ),
    saveEventFile: vi.fn<CommunityEventDevelopmentHost['saveEventFile']>(() =>
      Promise.resolve(true),
    ),
  } satisfies CommunityEventDevelopmentHost;
}
