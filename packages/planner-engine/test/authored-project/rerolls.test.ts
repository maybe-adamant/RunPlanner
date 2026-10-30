import { describe, expect, it } from 'vitest';
import {
  createBiomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createHubRerollAddress,
  hubStayRows,
  type HubAction,
} from '@run-planner/engine/authored-project';

const n = createBiomeAddress('Surface', 'N');
const hub = createHubDecisionAddress(n, 'hub');
const visit = (hubSlotKey: string): HubAction => ({ kind: 'roomVisit', hubSlotKey });
const reroll = (rerollId: string): HubAction => ({
  kind: 'reroll',
  rerollId,
  hubSlotKey: 'combat03',
  reward: { rewardType: 'MaxHealthDropBig' },
});
const fountain: HubAction = { kind: 'useFountain' };

/** Each stay's rows by kind, a press by its id. */
function shape(actions: readonly HubAction[]) {
  return hubStayRows(hub, { actions }).map((stay) =>
    stay.rows.map((row) => (row.kind === 'reroll' ? row.action.rerollId : 'fountain')),
  );
}

describe('Hub stay rows', () => {
  it.each([
    ['alone', [fountain, visit('a')], [['fountain'], []]],
    [
      'at the start',
      [fountain, reroll('r1'), reroll('r2'), visit('a')],
      [['fountain', 'r1', 'r2'], []],
    ],
    [
      'in the middle',
      [reroll('r1'), fountain, reroll('r2'), visit('a')],
      [['r1', 'fountain', 'r2'], []],
    ],
    [
      'at the end',
      [reroll('r1'), reroll('r2'), fountain, visit('a')],
      [['r1', 'r2', 'fountain'], []],
    ],
    [
      'in a later stay',
      [visit('a'), reroll('r1'), fountain, visit('b'), reroll('r2')],
      [[], ['r1', 'fountain'], ['r2']],
    ],
  ] as const)('keep the fountain where it is authored %s', (_case, actions, expected) => {
    expect(shape(actions)).toEqual(expected);
  });

  it('address each row at its index in the actions and append before the next visit', () => {
    const actions = [visit('a'), reroll('r1'), fountain, visit('b')];
    expect(hubStayRows(hub, { actions })).toEqual([
      { precedingVisitCount: 0, rows: [], appendIndex: 0 },
      {
        precedingVisitCount: 1,
        rows: [
          {
            kind: 'reroll',
            address: createHubRerollAddress(n, 'hub', 'r1'),
            actionIndex: 1,
            action: actions[1],
          },
          { kind: 'useFountain', address: createHubFountainAddress(n, 'hub'), actionIndex: 2 },
        ],
        appendIndex: 3,
      },
      { precedingVisitCount: 2, rows: [], appendIndex: 4 },
    ]);
  });

  it('end with the stay after the last authored visit', () => {
    expect(hubStayRows(hub, { actions: [] })).toEqual([
      { precedingVisitCount: 0, rows: [], appendIndex: 0 },
    ]);
  });
});
