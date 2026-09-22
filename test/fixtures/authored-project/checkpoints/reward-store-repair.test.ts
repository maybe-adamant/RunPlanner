import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { checkpointManifest } from './manifest';
import { loadCheckpoint } from './registry';
import { applyRewardStoreRepair, rewardStoreRepairPlans } from './reward-store-repair';

const checkpointDirectory = resolve(process.cwd(), 'test/fixtures/authored-project/checkpoints');
const rewrite = process.env.RUN_PLANNER_WRITE_CHECKPOINT_REPAIRS === '1';

const storeFindingCodes = new Set([
  'batchRewardStoreMissing',
  'baseRewardStoreUnavailable',
  'rewardBagEntryUnavailable',
]);

describe('run-scoped reward-store checkpoint repair', () => {
  it('leaves every committed checkpoint at a settled reward-store ledger', () => {
    const unsettled: string[] = [];
    for (const entry of checkpointManifest) {
      const plan = rewardStoreRepairPlans[entry.id] ?? [];
      const repaired = applyRewardStoreRepair(loadCheckpoint(entry.id), plan);
      const encoded = encodeProjectDocument(repaired);
      const file = resolve(checkpointDirectory, entry.file);
      if (rewrite) {
        if (encoded !== readFileSync(file, 'utf8')) writeFileSync(file, encoded);
        continue;
      }
      // The committed bytes already carry the repair, so re-applying the
      // command list is a fixed point — the audit trail's own regression guard.
      expect(encoded, `${entry.id} drifted from its repair plan`).toBe(readFileSync(file, 'utf8'));
      const findings = simulateProject(catalog, repaired).findings.filter((finding) =>
        storeFindingCodes.has(finding.code),
      );
      if (findings.length > 0)
        unsettled.push(`${entry.id}: ${findings.map((f) => f.code).join(',')}`);
    }
    expect(unsettled).toEqual([]);
  });
});
