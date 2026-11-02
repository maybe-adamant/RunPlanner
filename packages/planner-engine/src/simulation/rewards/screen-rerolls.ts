import type { Catalog } from '../../catalog-schema';
import type { SemanticAddress } from '../../authored-project/addresses';
import { screenRerollCost } from '../../authored-project/screen-rerolls';
import { rerollKindEnabled, rerollPoolRemaining, spendRerolls } from '../arcana-fear';
import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';
import type { FindingEvidence } from '../model';
import type { RewardBranchState } from './branch-primitives';
import { addRewardFinding, historyChronology, rewardFinding } from './findings';

/**
 * Settles a screen's authored rerolls before its final rows: each costs one
 * more than the last on the same screen, needs screen rerolls enabled when the
 * screen opens, and is spent from the run's pool. Screen rerolls touch no
 * reward store. The game refuses a reroll it cannot make, so a refused one
 * spends nothing and blocks the screen.
 */
export function settleScreenRerolls(
  catalog: Catalog,
  branch: RewardBranchState,
  count: number | undefined,
  owner: SemanticAddress,
  sequence: number,
  findingChronology: FindingChronology | undefined,
): {
  readonly branch: RewardBranchState;
  readonly findings: readonly FindingRegionEntry[];
  readonly blocked: boolean;
} {
  if (count === undefined || count === 0)
    return Object.freeze({ branch, findings: Object.freeze([]), blocked: false });
  const findings = new Map<string, FindingRegionEntry>();
  const region = ownerRegion(owner);
  const chronology = findingChronology ?? historyChronology(sequence);
  if (!rerollKindEnabled(catalog, branch.state.arcanaFear, 'screens'))
    addRewardFinding(
      findings,
      rewardFinding('screenRerollUnavailable', owner, { count }),
      region,
      chronology,
    );
  const cost = screenRerollCost(count);
  const remaining = rerollPoolRemaining(branch.state);
  if (remaining < cost)
    addRewardFinding(
      findings,
      rewardFinding('rerollPoolExceeded', owner, { cost, remaining }),
      region,
      chronology,
    );
  if (findings.size > 0)
    return Object.freeze({
      branch,
      findings: Object.freeze([...findings.values()]),
      blocked: true,
    });
  return Object.freeze({
    branch: Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        arcanaFear: spendRerolls(branch.state.arcanaFear, cost),
      }),
    }),
    findings: Object.freeze([]),
    blocked: false,
  });
}

/**
 * Settles one Well or Pool reroll press of the given cost: it needs screen
 * rerolls enabled and something left to reroll, and spends from the run's
 * pool. The game refuses a press it cannot make, so a refused press spends
 * and draws nothing and nothing past it happens: no branch continues.
 */
export function settleFeatureReroll(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  input: {
    readonly cost: number;
    readonly somethingLeft: boolean;
    readonly owner: SemanticAddress;
    readonly chronology: FindingChronology;
  },
): {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
} {
  const findings = new Map<string, FindingRegionEntry>();
  const region = ownerRegion(input.owner);
  const report = (
    code: 'screenRerollUnavailable' | 'rerollPoolExceeded',
    evidence: FindingEvidence,
  ) =>
    addRewardFinding(
      findings,
      rewardFinding(code, input.owner, evidence),
      region,
      input.chronology,
    );
  if (!input.somethingLeft) report('screenRerollUnavailable', { reason: 'nothingLeft' });
  else
    for (const branch of branches) {
      if (!rerollKindEnabled(catalog, branch.state.arcanaFear, 'screens'))
        report('screenRerollUnavailable', { reason: 'disabled' });
      const remaining = rerollPoolRemaining(branch.state);
      if (remaining < input.cost) report('rerollPoolExceeded', { cost: input.cost, remaining });
    }
  if (findings.size > 0)
    return Object.freeze({
      branches: Object.freeze([]),
      findings: Object.freeze([...findings.values()]),
    });
  return Object.freeze({
    branches: Object.freeze(
      branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            arcanaFear: spendRerolls(branch.state.arcanaFear, input.cost),
          }),
        }),
      ),
    ),
    findings: Object.freeze([]),
  });
}
