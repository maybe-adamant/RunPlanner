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
  inspectorOptionalRoomActionContent,
  inspectorRoomActionContent,
  inspectorRoomActionRemoval,
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

const cellOrder = ['handle', 'ordinal', 'label', 'editors', 'actions'];
const multiLineEditors = [
  '.reward-wheel',
  '.transcendent-embryo-outcome-row',
  '.scheduled-trait-effect-identity',
  '.shop-family-offer-row',
  '.room-overview-panel',
].join(', ');

/** Every timeline list child is one row of the five fixed cells and two action slots. */
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
      const actions = row.querySelector(':scope > [data-timeline-cell="actions"]')!;
      expect(
        [...actions.children].map((slot) => slot.getAttribute('data-timeline-action-slot')),
        where,
      ).toEqual(['placement', 'delete']);
      const kind = row.getAttribute('data-timeline-row-kind') ?? '';
      kinds.add(kind);
      // Bands hold only single-line controls; multi-line editors continue below them.
      if (kind === 'boundary' || kind === 'checkpoint')
        expect(row.querySelector(multiLineEditors), where).toBeNull();
      if (row.querySelector('.reward-wheel') !== null) {
        expect(kind, where).toBe('continuation');
        expect(row.getAttribute('data-timeline-span'), where).toBe('wide');
        expect(
          row.querySelector(':scope > [data-timeline-cell="label"] > .reward-wheel'),
          where,
        ).not.toBeNull();
        kinds.add('wide-continuation');
      }
      const restore = actions.querySelector('[aria-label="Restore required action"]');
      if (restore?.parentElement?.getAttribute('data-timeline-action-slot') === 'placement')
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
          renderOptionalRoomActionContent={() =>
            inspectorOptionalRoomActionContent(room, interactions)
          }
          renderRoomActionRowContent={(row) => inspectorRoomActionContent(room, interactions, row)}
          renderRoomActionRowRemoval={(row) => inspectorRoomActionRemoval(room, interactions, row)}
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
        'wide-continuation',
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
  return /\.room-action-list|\.timeline-row|\.timeline-cell-|\[data-timeline-cell|\.timeline-action-slot/.test(
    subject,
  );
}

describe('Room Timeline layout contract', () => {
  const timelineRules = Object.values(styles)
    .flatMap(cssRules)
    .filter((rule) => rule.selectors.some(targetsTimelineStructure));

  it('declares the column template only on the list and the shared row', () => {
    const templates = timelineRules.filter((rule) =>
      /(^|;|\s)grid-template-columns\s*:/.test(rule.declarations),
    );
    expect(templates.map((rule) => rule.selectors.join(', '))).toEqual(['.timeline-row']);
    expect(templates[0]!.declarations).toContain('grid-template-columns: var(--timeline-columns);');
    const list = timelineRules.find((rule) => rule.selectors.includes('.room-action-list'));
    expect(list?.declarations).toContain(
      '--timeline-columns: 28px 1.5rem minmax(0, 40fr) minmax(0, 60fr) 8rem;',
    );
  });

  it('never offsets a row or cell with its own inline-start margin or padding', () => {
    for (const rule of timelineRules) {
      if (rule.selectors.includes('.room-action-list')) continue;
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

  it('moves editors and actions below the label in one narrow rule', () => {
    const source = styles['room-workbenches']!;
    const narrow = source.indexOf('@container timeline-list (max-width: 52rem)');
    expect(narrow).toBeGreaterThan(0);
    expect(source.indexOf('@container timeline-list', narrow + 1)).toBe(-1);
    const block = source.slice(narrow, source.indexOf('\n}\n', narrow));
    expect(block).toContain(
      "[data-timeline-cell='editors'] {\n    grid-row: 2;\n    grid-column: 3 / 5;",
    );
    expect(block).toContain(
      "[data-timeline-cell='actions'] {\n    grid-row: 2;\n    grid-column: 5;",
    );
  });
});
