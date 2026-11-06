import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { projectStructuredWorkspaceFixture } from '../../fixtures/structuredWorkspace';

it('probe', () => {
  const lines: string[] = [];
  for (const { entry, load } of checkpointRegistry) {
    let workspace;
    try {
      workspace = projectStructuredWorkspaceFixture(load()).workspace;
    } catch (error) {
      lines.push(`${entry.id}: FAILED ${String(error)}`);
      continue;
    }
    for (const biome of workspace.route.biomes) {
      const nodes = [...biome.nodes, ...biome.completionOutline];
      for (const node of nodes) {
        if (node.kind !== 'occurrenceWorkbench') continue;
        const a = node.room.roomActions;
        if (a === undefined) continue;
        const rows = a.rows.map((r) => `${r.reference.kind}${r.stale ? '!stale' : ''}${r.travelDeal ? '+td' : ''}${r.stygianWellTwist ? '+twist' : ''}${r.fountainRarity ? '+phial' : ''}${r.challengeSwitchOutcome ? '+switch' : ''}${r.unlockDoorLabel ? '+unlock' : ''}${r.affordability ? `+aff` : ''}${r.featureRoll ? '+roll' : ''}${r.artificerOutput ? '+artificer' : ''}${r.traitOffer ? '+offer' : ''}[${r.label}]`);
        const bounds = a.timeline.entries.filter((e) => e.kind === 'boundary').map((e) => `${e.boundary.kind}${e.supplement ? '+' + e.supplement.kind : ''}${e.fieldsCage ? '+cage' : ''}`);
        const extra = [
          a.optionalRows.length ? `optional=${a.optionalRows.map((r) => r.reference.kind).join(',')}` : '',
          a.repairRows.length ? `repair=${a.repairRows.map((r) => r.reference.kind + (r.stale ? '!stale' : '')).join(',')}` : '',
          a.featureRolls?.length ? `featureRolls=${a.featureRolls.length}` : '',
          a.objectEntries?.length ? `objects=${a.objectEntries.map((o) => (o as { kind?: string }).kind).join(',')}` : '',
          a.steadyGrowth?.length ? 'steadyGrowth' : '',
          a.transcendentEmbryo?.length ? 'embryo' : '',
          a.timeline.fieldsCageOrder ? 'cageOrder' : '',
          a.timeline.entries.some((e) => e.kind === 'action' && e.supplement) ? 'nemesisSupp' : '',
          a.checkpoints.length ? `checkpoints=${a.checkpoints.length}` : '',
        ].filter(Boolean);
        lines.push(`${entry.id} ${biome.biomeKey} ${node.room.occurrenceId} (${node.room.label ?? ''}) :: ${rows.join(' | ')} :: ${bounds.join(',')} :: ${extra.join(' ')}`);
      }
    }
  }
  writeFileSync(process.env.PROBE_OUT!, lines.join('\n'));
});
