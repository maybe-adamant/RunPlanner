import { describe, expect, it } from 'vitest';

import {
  encounterCustomizationFindingFacts,
  type SemanticFinding,
} from '@run-planner/engine/simulation';

const finding = (code: string, evidence: Record<string, unknown>) =>
  ({
    code,
    phase: 'rewardGeneration',
    origin: { kind: 'project' },
    evidence,
  }) as unknown as SemanticFinding;

describe('encounter customization finding facts', () => {
  it('reads the reason each customization finding spreads into its evidence', () => {
    for (const code of [
      'encounterCustomizationUnavailable',
      'challengeSwitchCustomizationUnavailable',
      'unlockExitCustomizationUnavailable',
    ])
      expect(
        encounterCustomizationFindingFacts(
          finding(code, { decisionKey: 'cocoonCount', reason: 'valueNotDeclared' }),
        ),
      ).toEqual({ decisionKey: 'cocoonCount', reason: 'valueNotDeclared' });
  });

  it('reads nothing from another code, an unknown reason or a missing decision', () => {
    const evidence = { decisionKey: 'cocoonCount', reason: 'valueNotDeclared' };
    expect(encounterCustomizationFindingFacts(finding('encounterUnavailable', evidence))).toBe(
      undefined,
    );
    expect(
      encounterCustomizationFindingFacts(
        finding('encounterCustomizationUnavailable', { ...evidence, reason: 'toString' }),
      ),
    ).toBeUndefined();
    expect(
      encounterCustomizationFindingFacts(
        finding('encounterCustomizationUnavailable', { reason: 'valueNotDeclared' }),
      ),
    ).toBeUndefined();
  });
});
