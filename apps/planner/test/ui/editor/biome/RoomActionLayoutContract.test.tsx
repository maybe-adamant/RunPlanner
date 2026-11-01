// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import {
  inspectorLifecycleBoundaryContent,
  inspectorRoomActionContent,
} from '@planner/ui/editor/biome/BiomeInspectorControls';
import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import { staticWorkspaceFixture } from '@planner-test/support/biome-workbench';
import {
  loadNemesisFieldsCheckpoint,
  loadNemesisPomSeaStarCheckpoint,
  loadUnderworldGAnomalyRosterCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createFConversionFrontierProject,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);

const cellOrder = ['handle', 'label', 'editors', 'money', 'actions'];
const multiLineEditors = [
  '.reward-wheel',
  '.transcendent-embryo-outcome-row',
  '.scheduled-trait-effect-identity',
  '.shop-family-offer-row',
  '.room-overview-panel',
].join(', ');

/** Every timeline list child is one row of the five fixed cells; a placement sits in money. */
function expectTimelineRows(root: HTMLElement, kinds: Set<string>): number {
  let rows = 0;
  for (const list of root.querySelectorAll<HTMLElement>('ol.room-action-list')) {
    for (const row of list.children) {
      const where = `${list.getAttribute('aria-label')}: ${row.textContent?.slice(0, 60)}`;
      expect(row.matches('li.timeline-row'), where).toBe(true);
      expect(
        [...row.children].map((cell) => cell.getAttribute('data-timeline-cell')),
        where,
      ).toEqual(cellOrder);
      // The trailing cell holds at most the row's delete, so the right edge never shifts.
      const actions = row.querySelector(':scope > [data-timeline-cell="actions"]')!;
      expect(actions.children.length, where).toBeLessThanOrEqual(1);
      const kind = row.getAttribute('data-timeline-row-kind') ?? '';
      kinds.add(kind);
      // Bands hold only single-line controls; multi-line editors continue below them.
      if (kind === 'boundary' || kind === 'checkpoint')
        expect(row.querySelector(multiLineEditors), where).toBeNull();
      const money = row.querySelector(':scope > [data-timeline-cell="money"]')!;
      if (money.querySelector('[aria-label="Restore required action"]') !== null)
        kinds.add('restore-required');
      rows += 1;
    }
  }
  return rows;
}

function renderInspectorOccurrence(
  fixture: ReturnType<typeof staticWorkspaceFixture>,
  room: WorkspaceRoomSummary,
) {
  const { store, workspace } = fixture;
  const interactions = workspace.interactions;
  return render(
    <Provider store={store}>
      <FindingTargetScope
        authoringReadiness={workspace.authoringReadiness}
        findings={workspace.findingsByRepairTarget}
      >
        <OccurrenceWorkbench
          interactions={interactions}
          room={room}
          renderLifecycleBoundaryContent={(boundary) =>
            inspectorLifecycleBoundaryContent(room, interactions, boundary)
          }
          renderRoomActionRowContent={(row) => inspectorRoomActionContent(room, interactions, row)}
        />
      </FindingTargetScope>
    </Provider>,
  );
}

/** Opens every timeline tab of every room in one biome and checks its rows. */
function witnessBiome(project: ProjectDocument, biomeKey: string, kinds: Set<string>): number {
  const fixture = staticWorkspaceFixture(project);
  const biome = fixture.workspace.route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${biomeKey} has no workspace biome`);
  let rows = 0;
  for (const node of [...biome.nodes, ...biome.completionOutline]) {
    if (node.kind !== 'occurrenceWorkbench') continue;
    const view = renderInspectorOccurrence(
      fixture,
      (node as WorkspaceOccurrenceWorkbenchNode).room,
    );
    const tabs = within(view.container)
      .queryAllByRole('tab')
      .filter((tab) => /Timeline$|^Inactive Actions$/.test(tab.textContent ?? ''));
    for (const tab of tabs) {
      fireEvent.click(tab);
      rows += expectTimelineRows(view.container, kinds);
      // The Add area sits beside one timeline column, never beside each timeline part.
      for (const add of view.container.querySelectorAll('.room-add')) {
        expect(
          [...add.parentElement!.children].map((child) => child.className.split(' ')[0]),
        ).toEqual(['room-timeline-main', 'room-add']);
      }
      const add = within(view.container).queryAllByRole('button', { name: /^Add / })[0];
      if (add !== undefined && !(add as HTMLButtonElement).disabled) {
        fireEvent.click(add);
        rows += expectTimelineRows(view.container, kinds);
        fireEvent.keyDown(document, { key: 'Escape' });
      }
    }
    view.unmount();
  }
  return rows;
}

/** An emptied authored order leaves the room's required action as a Timeline repair. */
function emptiedOrderProject(): ProjectDocument {
  const occurrenceId = goldenFOccurrenceId(1, 1);
  const authored = createFConversionFrontierProject('MetaCurrencyDrop').project;
  return decodeProjectDocument(
    {
      ...authored,
      route: {
        ...authored.route,
        biomes: authored.route.biomes.map((biome) =>
          biome.biomeKey !== 'F' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((occurrence) =>
                    occurrence.occurrenceId === occurrenceId
                      ? { ...occurrence, roomActions: { order: [] } }
                      : occurrence,
                  ),
                },
              },
        ),
      },
    },
    catalog,
  );
}

describe('Room Timeline row structure', () => {
  it('renders every timeline list child through the five shared cells', () => {
    const kinds = new Set<string>();
    const witnesses: readonly (readonly [() => ProjectDocument, string])[] = [
      [loadNemesisPomSeaStarCheckpoint, 'F'],
      [loadNemesisFieldsCheckpoint, 'H'],
      [loadUnderworldWorldShopTravelDealCheckpoint, 'F'],
      [loadUnderworldGAnomalyRosterCheckpoint, 'G'],
      [loadSurfaceScheduledLifecycleCheckpoint, 'O'],
      [emptiedOrderProject, 'F'],
    ];
    for (const [load, biomeKey] of witnesses) {
      expect(witnessBiome(load(), biomeKey, kinds), biomeKey).toBeGreaterThan(0);
    }
    expect([...kinds].sort()).toEqual(
      expect.arrayContaining([
        'action',
        'boundary',
        'continuation',
        'effect',
        'insertion',
        'restore-required',
      ]),
    );
  });
});

const styles = Object.fromEntries(
  ['room-workbenches', 'biome-layout', 'editor-structure', 'trait-feedback', 'responsive'].map(
    (name) => [
      name,
      readFileSync(resolve(import.meta.dirname, `../../../../src/ui/styles/${name}.css`), 'utf8'),
    ],
  ),
);

interface CssRule {
  readonly selectors: readonly string[];
  readonly declarations: string;
}

function cssRules(source: string): CssRule[] {
  const rules: CssRule[] = [];
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of text.matchAll(pattern)) {
    const prelude = match[1]!.trim();
    if (prelude.startsWith('@')) continue;
    rules.push({
      selectors: prelude.split(/,(?![^(]*\))/).map((selector) => selector.trim()),
      declarations: match[2]!,
    });
  }
  return rules;
}

/** The selector's subject (last compound) is a timeline list, row, or cell. */
function targetsTimelineStructure(selector: string): boolean {
  const subject =
    selector
      .replace(/\([^()]*\)/g, '')
      .split(/\s*[>+~]\s*|\s+/)
      .pop() ?? '';
  return /\.room-action-list|\.timeline-row(?![-\w])|\.timeline-cell-|\[data-timeline-cell/.test(
    subject,
  );
}

describe('Room Timeline layout contract', () => {
  const timelineRules = Object.values(styles)
    .flatMap(cssRules)
    .filter((rule) => rule.selectors.some(targetsTimelineStructure));

  it('declares the column template only on the list; rows and banner cells subgrid it', () => {
    const templates = timelineRules.filter((rule) =>
      /(^|;|\s)grid-template-columns\s*:/.test(rule.declarations),
    );
    const own = templates.filter(
      (rule) => !/grid-template-columns\s*:\s*subgrid\s*;/.test(rule.declarations),
    );
    expect(own.map((rule) => rule.selectors.join(', '))).toEqual(['.room-action-list']);
    expect(own[0]!.declarations).toContain('grid-template-columns: var(--timeline-columns);');
    expect(
      templates.find((rule) => rule.selectors.join(', ') === '.timeline-row')?.declarations,
    ).toContain('grid-template-columns: subgrid;');
    // Handle, label, decisions, a spacer, money and the delete.
    expect(own[0]!.declarations.replace(/\s+/g, ' ')).toContain(
      '--timeline-columns: 28px max-content minmax(0, max-content) 1fr var(--timeline-money-width) var(--timeline-control-height);',
    );
  });

  it('never offsets a row or cell with its own inline-start margin or padding', () => {
    for (const rule of timelineRules) {
      if (rule.selectors.includes('.room-action-list')) continue;
      // The Add area's object entries reuse the row cells as a flex line off the timeline grid.
      if (rule.selectors.every((selector) => selector.startsWith('.room-add '))) continue;
      // Every row's decisions keep one shared gap from the label; no row offsets itself alone.
      if (
        rule.selectors.join(', ').replace(/\s+/g, ' ') ===
          ".timeline-row:not([data-timeline-row-kind='boundary'], [data-timeline-row-kind='checkpoint']) > [data-timeline-cell='editors']" &&
        rule.declarations.trim() === 'margin-inline-start: 0.5rem;'
      )
        continue;
      expect(rule.declarations, rule.selectors.join(', ')).not.toMatch(
        /(^|;|\s)(margin|padding)-(left|inline-start|inline)\s*:/,
      );
      if (!(rule.selectors.length === 1 && rule.selectors[0] === '.timeline-row')) {
        expect(rule.declarations, rule.selectors.join(', ')).not.toMatch(
          /(^|;|\s)(margin|padding)\s*:/,
        );
      }
    }
  });

  it('starts lifecycle banner titles at the handle column through a cell span', () => {
    const source = styles['room-workbenches']!.replace(/\/\*[\s\S]*?\*\//g, '').replace(
      /\s+/g,
      ' ',
    );
    const banner =
      ".timeline-row:is([data-timeline-row-kind='boundary'], [data-timeline-row-kind='checkpoint'])";
    expect(source).toContain(
      `${banner} > [data-timeline-cell='label'] { grid-row: 1; grid-column: 1 / 5;`,
    );
    expect(source).toContain(
      `${banner} > :is( [data-timeline-cell='handle'], [data-timeline-cell='money'], [data-timeline-cell='actions'] ) { display: none; }`,
    );
  });

  it('places the optional actions column in the one row beside the timeline column', () => {
    const source = styles['room-workbenches']!;
    const wide = source.indexOf('@container room-panel (min-width: 62rem)');
    expect(wide).toBeGreaterThan(0);
    const block = source.slice(wide, source.indexOf('\n}\n', wide));
    const side = block.slice(block.indexOf('> .room-add[data-empty]'));
    // Spanning extra rows would add their gaps to the panel and make it scroll for nothing.
    expect(side.slice(0, side.indexOf('}'))).toMatch(/grid-row: 1;/);
    expect(block).not.toMatch(/grid-row:[^;]*span/);
  });

  it("moves a row's decisions below its label in one narrow rule", () => {
    const source = styles['room-workbenches']!;
    const narrow = source.indexOf('@container timeline-list (max-width: 46rem)');
    expect(narrow).toBeGreaterThan(0);
    expect(source.indexOf('@container timeline-list', narrow + 1)).toBe(-1);
    const block = source.slice(narrow, source.indexOf('\n}\n', narrow));
    expect(block).toContain(
      "[data-timeline-cell='editors'] {\n    grid-row: 2;\n    grid-column: 2 / 6;",
    );
    // Money and the delete stay on the label's line.
    expect(block).toContain(
      "> :is([data-timeline-cell='money'], [data-timeline-cell='actions']) {\n    grid-row: 1;",
    );
  });
});
