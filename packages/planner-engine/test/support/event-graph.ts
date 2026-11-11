import type { RoomEvent } from '../../src/authored-project/room-actions/event-graph';

const automatic = { kind: 'automatic' } as const;

/** A hand-built graph's events: each gate-free phase begun and fought in turn, then the doors. */
export function gateFreeGraphEvents(
  phaseKeys: readonly string[],
  generatesOutgoing: boolean,
): readonly RoomEvent[] {
  return [
    { kind: 'roomEntered', key: 'roomEntered', trigger: automatic },
    ...phaseKeys.flatMap((phaseKey): RoomEvent[] => [
      {
        kind: 'encounterBegun',
        key: `encounterBegun:${phaseKey}`,
        phaseKey,
        trigger: automatic,
        merged: true,
      },
      {
        kind: 'encounterStarted',
        key: `encounterStarted:${phaseKey}`,
        phaseKey,
        trigger: automatic,
      },
      { kind: 'encounterEnd', key: `encounterEnd:${phaseKey}`, phaseKey, trigger: automatic },
    ]),
    {
      kind: 'doorsOpened',
      key: 'doorsOpened',
      generatesOutgoing,
      trigger: { kind: 'doorsPredicate' },
    },
  ];
}

/**
 * A hand-built graph's events for phases in run order: a wheel phase opens its
 * wheels and starts at its wheel's choice; any other begins and starts at once.
 */
export function testGraphEvents(
  phases: readonly { readonly phaseKey: string; readonly rewardWheelKey?: string }[],
  options: {
    readonly boss?: boolean;
    readonly generatesOutgoing: boolean;
    /** Fields: each phase is a cage its activation row begins. */
    readonly cages?: boolean;
  },
): readonly RoomEvent[] {
  const events: RoomEvent[] = [{ kind: 'roomEntered', key: 'roomEntered', trigger: automatic }];
  phases.forEach((phase, index) => {
    const wheelKey = phase.rewardWheelKey;
    if (wheelKey !== undefined)
      events.push({
        kind: 'wheelsOpen',
        key: `wheelsOpen:${wheelKey}`,
        wheelKey,
        phaseKey: phase.phaseKey,
        ...(index === 0 ? {} : { afterPhaseKey: phases[index - 1]!.phaseKey }),
        trigger: automatic,
      });
    events.push(
      {
        kind: 'encounterBegun',
        key: `encounterBegun:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
        trigger:
          options.cages === true
            ? { kind: 'action', action: { kind: 'completeFieldsCage', phaseKey: phase.phaseKey } }
            : automatic,
        ...(wheelKey === undefined ? { merged: true as const } : {}),
      },
      {
        kind: 'encounterStarted',
        key: `encounterStarted:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
        trigger:
          wheelKey === undefined
            ? automatic
            : { kind: 'action', action: { kind: 'chooseRewardWheel', wheelKey } },
      },
    );
    if (options.boss === true)
      events.push({
        kind: 'bossDefeated',
        key: `bossDefeated:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
        trigger: automatic,
      });
    events.push({
      kind: 'encounterEnd',
      key: `encounterEnd:${phase.phaseKey}`,
      phaseKey: phase.phaseKey,
      trigger: automatic,
    });
  });
  events.push({
    kind: 'doorsOpened',
    key: 'doorsOpened',
    generatesOutgoing: options.generatesOutgoing,
    trigger: { kind: 'doorsPredicate' },
  });
  return events;
}
